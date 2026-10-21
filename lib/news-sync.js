import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache";
import { Query, TablesDB } from "node-appwrite";
import { adminClient, DB, chunk } from "./appwrite.js";
import { loadPlayer, loadPlayers } from "./data.js";
import { getWorkspaceContext } from "./workspace.js";

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
const rssUrl = (player) => `https://news.google.com/rss/search?q=${encodeURIComponent(`"${player.name}" ${player.club}`)}&hl=es&gl=ES&ceid=ES:es`;
const asArray = (value) => Array.isArray(value) ? value : value ? [value] : [];
const text = (value) => typeof value === "string" ? value : value?.["#text"] ?? "";
const clean = (value) => String(value ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
const idFor = (playerId, url) => `news_${createHash("sha256").update(`${playerId}:${url}`).digest("hex").slice(0, 28)}`;

function parseDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function fetchPlayerNews(player) {
  const response = await fetch(rssUrl(player), { headers: { "user-agent": "AgentSolver/1.0 news-ingestor" }, signal: AbortSignal.timeout(10000), cache: "no-store" });
  if (!response.ok) throw new Error(`Google News RSS respondió ${response.status}`);
  const items = asArray(parser.parse(await response.text())?.rss?.channel?.item);
  return items.map((item) => ({
    id: idFor(player.id, text(item.link)),
    playerId: player.id,
    title: clean(text(item.title)),
    summary: clean(text(item.description)),
    url: text(item.link),
    sourceName: clean(text(item.source)) || "Google News RSS",
    publishedAt: parseDate(text(item.pubDate)),
  })).filter((item) => item.title && item.url && item.publishedAt);
}

// Runs fn over items with at most `limit` in flight, keeping the order of results.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]); }
  }));
  return results;
}

export async function syncPlayerNews(player) {
  const db = new TablesDB(adminClient());
  const items = await fetchPlayerNews(player);
  const fetchedAt = new Date().toISOString();
  // One lookup per 100 ids instead of a getRow per article.
  const known = new Set((await Promise.all(chunk(items.map((item) => item.id)).map((ids) => db.listRows(DB, "news_items", [Query.equal("$id", ids), Query.select(["$id"]), Query.limit(100)]))))
    .flatMap((page) => page.rows.map((row) => row.$id)));
  const fresh = items.filter((item) => !known.has(item.id));
  await mapLimit(fresh, 5, ({ id, ...newsData }) => db.createRow(DB, "news_items", id, { ...newsData, fetchedAt, status: "pending-review", impact: "pending", confidence: "unreviewed" }).catch((error) => { if (error.code !== 409) throw error; }));
  return { fetched: items.length, inserted: fresh.length };
}

export async function loadPlayerNews(playerId) {
  const context = await getWorkspaceContext();
  if (!context) return [];
  if (!(await loadPlayer(playerId))) return [];
  const loadCached = unstable_cache(async () => {
    try {
      const db = new TablesDB(adminClient());
      const { rows } = await db.listRows(DB, "news_items", [Query.equal("playerId", playerId), Query.orderDesc("publishedAt"), Query.limit(50)]);
      return rows;
    } catch (error) {
      if (error.code === 404) return [];
      throw error;
    }
  }, ["agentsolver-player-news", playerId], {
    revalidate: 300,
    tags: ["news", `news:${playerId}`],
  });
  return loadCached();
}

export async function loadAllNews() {
  const context = await getWorkspaceContext();
  if (!context) return [];
  const playerIds = (await loadPlayers()).map((player) => player.id);
  if (!playerIds.length) return [];
  const loadCached = unstable_cache(async () => {
    try {
      const db = new TablesDB(adminClient());
      const pages = await Promise.all(chunk(playerIds).map((ids) => db.listRows(DB, "news_items", [Query.equal("playerId", ids), Query.orderDesc("publishedAt"), Query.limit(200)])));
      return pages.flatMap((page) => page.rows).sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt))).slice(0, 200);
    } catch (error) {
      if (error.code === 404) return [];
      throw error;
    }
  }, ["agentsolver-all-news", context.workspace.$id, String(playerIds.length)], {
    revalidate: 300,
    tags: ["news"],
  });
  return loadCached();
}
