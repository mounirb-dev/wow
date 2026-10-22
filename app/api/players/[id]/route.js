// PATCH /api/players/:id — edita un jugador (editor+): datos básicos, económicos y de contacto
// (nombre, club, posición, edad, contrato, teléfono, email…) y los datos del staff (minutos, goles,
// notas…). Solo acepta una lista blanca de campos y valida cada uno; cualquier otro se ignora.
// DELETE /api/players/:id — borra el jugador y todo lo que cuelga de él (editor+).
import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { DB, listAll } from "@/lib/appwrite.js";
import { revalidatePlayersCache } from "@/lib/cache-tags.js";
import { parsePlayerPatch, playerKey } from "@/lib/player-input.js";
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
  const body = await request.json().catch(() => ({}));
  const edit = parsePlayerPatch(body);
  if (edit.error) return NextResponse.json({ error: edit.error }, { status: 400 });
  const data = { ...edit.data };
  for (const [field, value] of Object.entries(body)) {
    if (integerFields.has(field)) {
      if (value === "" || value === null) data[field] = null;
      else if (Number.isInteger(Number(value)) && Number(value) >= 0 && Number(value) <= (["minutes", "goals", "assists", "progressiveActions"].includes(field) ? 100000 : 100)) data[field] = Number(value);
    }
    if (stringFields.has(field)) data[field] = String(value ?? "").trim() || null;
  }
  if (!Object.keys(data).length) return NextResponse.json({ error: "Sin cambios válidos" }, { status: 400 });
  if (data.name !== undefined || data.club !== undefined) {
    // Renombrar o cambiar de club no puede dejar dos jugadores iguales (mismo nombre y club).
    const key = playerKey(data.name ?? player.name, data.club ?? player.club);
    const others = await listAll(context.db, "players", [Query.equal("workspaceId", context.workspace.$id)]);
    if (others.some((other) => other.$id !== id && playerKey(other.name, other.club) === key)) return NextResponse.json({ error: "Ya tienes un jugador con ese nombre y club" }, { status: 409 });
  }
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
