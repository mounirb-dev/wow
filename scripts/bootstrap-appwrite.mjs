// Creates the console admin, team, project and API key on the local Appwrite
// and writes them to .env.local. Idempotent: reuses what already exists.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const ENDPOINT = process.env.APPWRITE_ENDPOINT ?? "http://localhost:8080/v1";
const EMAIL = process.env.APPWRITE_ADMIN_EMAIL ?? "admin@agentsolver.local";
const PASSWORD = process.env.APPWRITE_ADMIN_PASSWORD ?? "AgentSolver#2026!";
const PROJECT_ID = "agentsolver";
const SCOPES = [
  "databases.read", "databases.write", "tables.read", "tables.write",
  "columns.read", "columns.write", "indexes.read", "indexes.write",
  "rows.read", "rows.write", "users.read", "users.write", "sessions.write", "platforms.read", "platforms.write", "keys.read", "keys.write", "project.oauth2.read", "project.oauth2.write",
];

let cookie = "";
async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(ENDPOINT + path, {
    method,
    headers: { Host: "localhost", "X-Appwrite-Project": "console", "Content-Type": "application/json", Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  const set = res.headers.getSetCookie?.() ?? [];
  if (set.length) cookie = set.map((c) => c.split(";")[0]).join("; ");
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}

await api("/account", { method: "POST", body: { userId: "unique()", email: EMAIL, password: PASSWORD, name: "Admin" } });
const login = await api("/account/sessions/email", { method: "POST", body: { email: EMAIL, password: PASSWORD } });
if (login.status >= 300) throw new Error("login failed: " + JSON.stringify(login.json));

let { json: teams } = await api("/teams");
let team = teams.teams?.[0];
if (!team) team = (await api("/teams", { method: "POST", body: { teamId: "unique()", name: "AgentSolver" } })).json;

let proj = await api(`/projects/${PROJECT_ID}`);
if (proj.status === 404) {
  proj = await api("/projects", { method: "POST", body: { projectId: PROJECT_ID, name: "AgentSolver", teamId: team.$id } });
  if (proj.status >= 300) throw new Error("project failed: " + JSON.stringify(proj.json));
}

const envFile = ".env.local";
const prev = existsSync(envFile) ? readFileSync(envFile, "utf8") : "";
if (/^APPWRITE_API_KEY=.+/m.test(prev)) {
  console.log("API key already in .env.local; nothing to do.");
} else {
  const key = await api(`/projects/${PROJECT_ID}/keys`, { method: "POST", body: { keyId: "unique()", name: "migrations", scopes: SCOPES } });
  if (key.status >= 300) throw new Error("key failed: " + JSON.stringify(key.json));
  const lines = prev.split("\n").filter((l) => l && !/^APPWRITE_/.test(l));
  lines.push(`APPWRITE_ENDPOINT=${ENDPOINT}`, `APPWRITE_PROJECT_ID=${PROJECT_ID}`, `APPWRITE_API_KEY=${key.json.secret}`, "APPWRITE_DATABASE_ID=agentsolver");
  writeFileSync(envFile, lines.join("\n") + "\n");
  console.log("Wrote .env.local");
}
console.log(`Console: http://localhost:8080  (${EMAIL})  project=${PROJECT_ID}`);
