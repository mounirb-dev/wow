import { NextResponse } from "next/server";
import { TablesDB } from "node-appwrite";
import { adminClient, DB } from "@/lib/appwrite.js";
import { revalidatePlayersCache } from "@/lib/cache-tags.js";
import { getUser } from "@/lib/session.js";

const integerFields = new Set(["minutes", "goals", "assists", "progressiveActions", "tacticalFit", "availability", "adaptationRisk"]);
const stringFields = new Set(["role", "staffNotes"]);

export async function PATCH(request, { params }) {
  if (!await getUser()) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const data = {};
  for (const [field, value] of Object.entries(body)) {
    if (integerFields.has(field)) {
      if (value === "" || value === null) data[field] = null;
      else if (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= (["minutes", "goals", "assists", "progressiveActions"].includes(field) ? 100000 : 100)) data[field] = Number(value);
    }
    if (stringFields.has(field)) data[field] = String(value ?? "").trim() || null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Sin cambios válidos" }, { status: 400 });
  const row = await new TablesDB(adminClient()).updateRow(DB, "players", id, data);
  revalidatePlayersCache();
  return NextResponse.json({ player: row });
}
