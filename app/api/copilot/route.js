import { NextResponse } from "next/server";
import { getUser } from "@/lib/session.js";
import { loadPlayers } from "@/lib/data.js";
import { curve, fmtM, leverage, monthsLeft, portfolio } from "@/lib/tools.js";

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Rule-based tool router; Claude only rewords the tool output when a key is configured.
function run(message, players) {
  const q = norm(message);
  const named = players.find((p) => norm(p.name).split(" ").some((w) => w.length > 3 && q.includes(w)));
  const tools = [];

  if (named) {
    tools.push("valuation", "negotiation_brief");
    const suitor = [...named.suitors].sort((a, b) => b.need - a.need)[0];
    const best = suitor ? curve(named, suitor).best : null;
    const answer =
      `${named.name} (${named.pos}, ${named.club}): valor ${fmtM(named.value)}, contrato ${monthsLeft(named)} meses, palanca ${leverage(named)}/100. ` +
      `Cobra ${fmtM(named.salary, 2)} y el mercado dice ${fmtM(named.fair, 2)}.` +
      (best ? `\nMejor opción: ${suitor.club} (necesidad ${suitor.need}). Pide ${fmtM(best.ask, 2)}: ${Math.round(best.pDeal * 100)}% de cierre y ${fmtM(best.ev, 2)} de comisión esperada.` : "");
    return { answer, tools, focus: named.id, facts: { named: named.name, best } };
  }
  if (/palanca|leverage|verano|contrato|vence|negociar|prioridad/.test(q)) {
    tools.push("list_clients", "leverage_ranking");
    const top = [...players].sort((a, b) => leverage(b) - leverage(a)).slice(0, 3);
    const answer = "Mayor palanca ahora:\n" + top.map((p, i) => `${i + 1}. ${p.name} — palanca ${leverage(p)}, ${monthsLeft(p)} meses de contrato, infrapagado ${Math.max(0, Math.round((1 - p.salary / p.fair) * 100))}%`).join("\n");
    return { answer, tools, focus: top[0].id, facts: { top: top.map((p) => p.name) } };
  }
  tools.push("portfolio_summary");
  const pf = portfolio(players);
  return { answer: `Cartera de ${pf.count} jugadores valorada en ${fmtM(pf.aum)}. ${pf.expiring} tienen contrato en zona de palanca (≤12 meses). Comisión esperada si negocias todo: ${fmtM(pf.pipeline, 2)}.`, tools, facts: pf };
}

async function reword(message, result) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-5-5", max_tokens: 400,
      system: "Eres el copiloto de un agente de fútbol. Responde en español, breve y claro, usando SOLO los datos dados. Son datos de demostración.",
      messages: [{ role: "user", content: `Pregunta: ${message}\nDatos: ${result.answer}` }],
    }),
  });
  if (!res.ok) return null;
  return (await res.json()).content?.[0]?.text ?? null;
}

export async function POST(req) {
  if (!(await getUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { message = "" } = await req.json();
  const players = await loadPlayers();
  const result = run(message, players);
  if (process.env.ANTHROPIC_API_KEY) {
    try { const text = await reword(message, result); if (text) result.answer = text; } catch {}
  }
  return NextResponse.json({ answer: result.answer, tools: result.tools, focus: result.focus ?? null });
}
