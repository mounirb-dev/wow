import { NextResponse } from "next/server";
import { ID, TablesDB } from "node-appwrite";
import { adminClient, DB } from "@/lib/appwrite.js";
import { canEdit, getWorkspaceContext } from "@/lib/workspace.js";

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!canEdit(context.member)) return NextResponse.json({ error: "Tu rol solo permite consultar" }, { status: 403 });
  const body = await request.json();
  const club = String(body.club ?? "").trim();
  const playerId = String(body.playerId ?? "").trim();
  if (!club || !playerId) return NextResponse.json({ error: "Faltan jugador y club" }, { status: 400 });
  const player = await context.db.getRow(DB, "players", playerId).catch(() => null);
  if (!player || player.workspaceId !== context.workspace.$id) return NextResponse.json({ error: "Jugador no encontrado en este workspace" }, { status: 404 });
  const numberOrZero = (value) => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : 0;
  const row = await new TablesDB(adminClient()).createRow(DB, "transfer_targets", ID.unique(), {
    workspaceId: context.workspace.$id, playerId, club, direction: body.direction === "out" ? "out" : "in", fee: numberOrZero(body.fee), salary: numberOrZero(body.salary), contractYears: Math.min(10, Math.max(0, Math.round(numberOrZero(body.contractYears)))), status: "proposed", notes: String(body.notes ?? "").trim().slice(0, 2000) || null, createdBy: context.user.$id, createdAt: new Date().toISOString(),
  });
  return NextResponse.json({ target: row }, { status: 201 });
}
