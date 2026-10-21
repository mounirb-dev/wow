// PATCH /api/players/:id/staff — guarda la valoración (interesa / no interesa / pendiente) y
// notas del usuario actual sobre un jugador. Hay UNA fila por (jugador, usuario): el ID de fila
// es un hash determinista, así que se actualiza si existe y se crea si no (upsert).
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { TablesDB } from "node-appwrite";
import { adminClient, DB } from "@/lib/appwrite.js";
import { canEdit, getWorkspaceContext } from "@/lib/workspace.js";

const interests = new Set(["interested", "not-interested", "pending"]);

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "Tu rol solo permite consultar" }, { status: 403 });
  const { id: playerId } = await params;
  const body = await request.json();
  const interest = interests.has(body.interest) ? body.interest : "pending";
  const notes = String(body.notes ?? "").trim().slice(0, 4000) || null;
  const rowId = `signal_${createHash("sha256").update(`${playerId}:${context.user.$id}`).digest("hex").slice(0, 29)}`;
  const db = new TablesDB(adminClient());
  const data = { workspaceId: context.workspace.$id, playerId, userId: context.user.$id, userName: context.user.name || context.user.email, interest, notes, updatedAt: new Date().toISOString() };
  let row;
  try { row = await db.updateRow(DB, "player_staff_signals", rowId, data); }
  catch (error) {
    if (error.code !== 404) throw error;
    row = await db.createRow(DB, "player_staff_signals", rowId, data);
  }
  return NextResponse.json({ signal: row });
}
