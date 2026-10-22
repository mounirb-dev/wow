// PATCH /api/players/:id — edita un jugador (editor+): datos básicos, económicos y de contacto
// (nombre, club, posición, edad, contrato, teléfono, email…) y los datos del staff (minutos, goles,
// notas…). Solo acepta una lista blanca de campos y valida cada uno; cualquier otro se ignora.
// DELETE /api/players/:id — borra el jugador y todo lo que cuelga de él (editor+).
import { NextResponse } from "next/server";
import { PlayerError, deletePlayer, updatePlayer } from "@/lib/player-store.js";
import { getWorkspaceContext } from "@/lib/workspace.js";

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  try {
    return NextResponse.json({ player: await updatePlayer(context, id, await request.json().catch(() => ({}))) });
  } catch (error) {
    if (error instanceof PlayerError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
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
