"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const fitFields = [["tacticalFit", "Encaje táctico"], ["availability", "Disponibilidad"], ["adaptationRisk", "Riesgo de adaptación"]];

function initialData(player) {
  return { minutes: player.minutes ?? "", goals: player.goals ?? "", assists: player.assists ?? "", progressiveActions: player.progressiveActions ?? "", role: player.role ?? "", staffNotes: player.staffNotes ?? "", tacticalFit: player.tacticalFit, availability: player.availability, adaptationRisk: player.adaptationRisk };
}

export default function PlayerFitPanel({ player }) {
  const [data, setData] = useState(() => initialData(player));
  const hydrated = useRef(false);
  const match = useMemo(() => [data.tacticalFit, data.availability, data.adaptationRisk].every((value) => value !== null && value !== "" && value !== undefined) ? Math.round((Number(data.tacticalFit) + Number(data.availability) + (100 - Number(data.adaptationRisk))) / 3) : null, [data]);
  const matchLabel = match === null ? "Pendiente de valorar" : match >= 75 ? "Encaje alto" : match >= 50 ? "Encaje por revisar" : "Encaje bajo";

  function update(field, value) { setData((current) => ({ ...current, [field]: value })); }

  useEffect(() => {
    if (!hydrated.current) { hydrated.current = true; return; }
    const timeout = window.setTimeout(() => {
      fetch(`/api/players/${player.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ tacticalFit: data.tacticalFit, availability: data.availability, adaptationRisk: data.adaptationRisk }) });
    }, 450);
    return () => window.clearTimeout(timeout);
  }, [data.tacticalFit, data.availability, data.adaptationRisk, player.id]);

  const score = match ?? 0;
  return <div className="flex flex-col gap-4"><Card>
      <CardHeader><div className="flex items-center justify-between gap-4"><div><CardTitle className="text-base">Match con el equipo</CardTitle><p className="text-sm text-muted-foreground">Calculado solo con valoraciones guardadas en Appwrite.</p></div><div aria-label={match === null ? "Match pendiente" : `Match ${match} sobre 100`} className={`relative grid size-20 shrink-0 place-items-center rounded-full transition-[background] duration-700 ${match === null ? "" : "animate-pulse"}`} style={{ background: match === null ? "var(--muted)" : `conic-gradient(var(--chart-1) ${score}%, var(--muted) 0)` }}><div className="grid size-16 place-items-center rounded-full bg-card"><span className="text-lg font-semibold tabular-nums">{match === null ? "—" : match}</span></div></div></div><p className="text-right text-xs text-muted-foreground">{matchLabel}</p></CardHeader>
      <CardContent className="flex flex-col gap-3">{fitFields.map(([field, label]) => <label key={field} className="flex flex-col gap-1.5 text-xs font-medium">{label}<input aria-label={label} type="range" min="0" max="100" value={data[field] ?? 0} onChange={(event) => update(field, Number(event.target.value))} /><span className="text-right text-muted-foreground">{data[field] === null || data[field] === undefined ? "Sin valorar" : `${data[field]}/100`}</span></label>)}</CardContent>
    </Card>
  </div>;
}
