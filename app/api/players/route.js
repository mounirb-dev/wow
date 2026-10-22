// POST /api/players — añade un jugador al workspace (editor+). Valida los campos y rechaza
// duplicados (mismo nombre y club); ver lib/player-store.js.
import { NextResponse } from "next/server";
import { PlayerError, createPlayer } from "@/lib/player-store.js";
import { getWorkspaceContext } from "@/lib/workspace.js";

export async function POST(request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  try {
    const player = await createPlayer(context, await request.json().catch(() => ({})));
    return NextResponse.json({ player }, { status: 201 });
  } catch (error) {
    if (error instanceof PlayerError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
