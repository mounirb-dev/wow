// PATCH /api/players/:id/staff — guarda la valoración (interesa / no interesa / pendiente) y
// notas del usuario actual sobre un jugador. Hay UNA fila por (jugador, usuario): el ID de fila
// es un hash determinista, así que se actualiza si existe y se crea si no (upsert).
import { NextResponse } from "next/server";
import { PlayerError, saveStaffSignal } from "@/lib/player-store.js";
import { getWorkspaceContext } from "@/lib/workspace.js";

export async function PATCH(request, { params }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const [{ id: playerId }, body] = await Promise.all([params, request.json()]);
  try {
    return NextResponse.json({ signal: await saveStaffSignal(context, playerId, body) });
  } catch (error) {
    // Sin la comprobación de workspace se podrían escribir valoraciones sobre jugadores de otro workspace.
    if (error instanceof PlayerError) return NextResponse.json({ error: error.status === 404 ? "Jugador no encontrado en este workspace" : error.message }, { status: error.status });
    throw error;
  }
}
