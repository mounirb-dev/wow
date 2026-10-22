// PATCH /api/players/:id — edita los datos del staff de un jugador (minutos, goles, notas…).
// Solo acepta una lista blanca de campos y valida rangos; cualquier otro campo se ignora.
// DELETE /api/players/:id — borra el jugador y todo lo que cuelga de él (editor+).
import { NextResponse } from "next/server";
import { DB } from "@/lib/appwrite.js";
import { revalidatePlayersCache } from "@/lib/cache-tags.js";
import { PlayerError, deletePlayer } from "@/lib/player-store.js";
import { canEdit, getWorkspaceContext } from "@/lib/workspace.js";

const integerFields = new Set(["minutes", "goals", "assists", "progressiveActions", "tacticalFit", "availability", "adaptationRisk"]);
const stringFields = new Set(["role", "staffNotes"]);

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "Tu rol solo permite consultar" }, { status: 403 });
  const { id } = await params;
  let player;
  try { player = await context.db.getRow(DB, "players", id); }
  catch (error) { if (error.code === 404) return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 }); throw error; }
  if (player.workspaceId !== context.workspace.$id) return NextResponse.json({ error: "Jugador no encontrado" }, { status: 404 });
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
  const row = await context.db.updateRow(DB, "players", id, data);
  revalidatePlayersCache();
  return NextResponse.json({ player: row });
}

export async function DELETE(_request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    await deletePlayer(context, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof PlayerError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
