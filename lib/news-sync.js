import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { unstable_cache } from "next/cache";
import { Query, TablesDB } from "node-appwrite";
import { adminClient, DB } from "./appwrite.js";
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

export async function fetchPlayerNews(player) {
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

export async function syncPlayerNews(player) {
  const db = new TablesDB(adminClient());
  const items = await fetchPlayerNews(player);
  const fetchedAt = new Date().toISOString();
  let inserted = 0;
  for (const item of items) {
    try {
      await db.getRow(DB, "news_items", item.id);
      continue;
    } catch (error) {
      if (error.code !== 404) throw error;
    }
    const { id, ...newsData } = item;
    await db.createRow(DB, "news_items", id, { ...newsData, fetchedAt, status: "pending-review", impact: "pending", confidence: "unreviewed" });
    inserted += 1;
  }
  return { fetched: items.length, inserted };
}

export async function loadPlayerNews(playerId) {
  const context = await getWorkspaceContext();
  if (!context) return [];
  const player = await context.db.getRow(DB, "players", playerId).catch(() => null);
  if (!player || player.workspaceId !== context.workspace.$id) return [];
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
  const { rows: players } = await context.db.listRows(DB, "players", [Query.equal("workspaceId", context.workspace.$id), Query.limit(100)]);
  const playerIds = new Set(players.map((player) => player.$id));
  if (!playerIds.size) return [];
  const loadCached = unstable_cache(async () => {
    try {
      const db = new TablesDB(adminClient());
      const { rows } = await db.listRows(DB, "news_items", [Query.orderDesc("publishedAt"), Query.limit(500)]);
      return rows.filter((item) => playerIds.has(item.playerId)).slice(0, 200);
    } catch (error) {
      if (error.code === 404) return [];
      throw error;
    }
  }, ["agentsolver-all-news", context.workspace.$id], {
    revalidate: 300,
    tags: ["news"],
  });
  return loadCached();
}
