// GET /api/clubs — clubes de las ligas europeas de OpenFootball, agrupados por liga. Sin API key;
// la respuesta de cada archivo se cachea 24 h en la caché de datos de Next.
import { NextResponse } from "next/server";
import { loadEuropeanClubs } from "@/lib/clubs.js";
import { getUser } from "@/lib/session.js";

const DAY = 60 * 60 * 24;

async function fetchJson(url) {
  const response = await fetch(url, { next: { revalidate: DAY }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`OpenFootball respondió ${response.status}`);
  return response.json();
}

export async function GET() {
  if (!(await getUser())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const leagues = await loadEuropeanClubs(fetchJson);
  if (!leagues.length) return NextResponse.json({ error: "No se pudo cargar la lista de clubes" }, { status: 502 });
  return NextResponse.json({ leagues }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
