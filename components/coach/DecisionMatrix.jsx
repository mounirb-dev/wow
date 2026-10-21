"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CRITERIA, DEFAULT_WEIGHTS, GROUPS, GROUP_LABEL, decisionMatrix, positionGroup } from "@/lib/coach.js";

// Por debajo de esta cobertura la puntuación se apoya en pocos datos y se resalta en ámbar.
const LOW_COVERAGE = 50;

// Matriz de decisión multicriterio: el entrenador pondera lo que le importa (0-5) y se ordena la
// plantilla. Los criterios sin dato se excluyen y se muestra la cobertura (ver decisionMatrix).
export default function DecisionMatrix({ players }) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [line, setLine] = useState("all");
  const rows = useMemo(() => decisionMatrix(players.filter((player) => line === "all" || positionGroup(player.pos) === line), weights), [players, weights, line]);
  const setWeight = (key, value) => setWeights((current) => ({ ...current, [key]: Number(value) }));

  return <Card className="min-w-0">
    <CardHeader>
      <CardTitle className="text-base">Matriz de decisión</CardTitle>
      <p className="text-sm text-muted-foreground">Da más peso a lo que más te importa y obtén un orden objetivo y reproducible. Un criterio sin dato nunca se inventa: se excluye y baja la cobertura.</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{CRITERIA.map((criterion) => <label key={criterion.key} className="grid min-w-0 gap-1 text-xs font-medium">
        <span className="flex justify-between"><span>{criterion.label}</span><span className="tabular-nums text-muted-foreground">{weights[criterion.key]}</span></span>
        <input type="range" min="0" max="5" step="1" value={weights[criterion.key]} onChange={(event) => setWeight(criterion.key, event.target.value)} aria-describedby={`${criterion.key}-hint`} />
        <span id={`${criterion.key}-hint`} className="font-normal text-muted-foreground">{criterion.hint}</span>
      </label>)}</div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground"><span>Línea</span>
          <select value={line} onChange={(event) => setLine(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm text-foreground"><option value="all">Toda la plantilla</option>{GROUPS.map((group) => <option key={group} value={group}>{GROUP_LABEL[group]}</option>)}</select>
        </label>
        <Button type="button" variant="outline" onClick={() => setWeights(DEFAULT_WEIGHTS)}><RotateCcw data-icon="inline-start" aria-hidden="true" />Pesos por defecto</Button>
      </div>

      <p className="text-xs text-muted-foreground">Cobertura en <span className="font-medium text-amber-700 dark:text-amber-300">ámbar</span> (menos del {LOW_COVERAGE}%): la puntuación se basa en pocos datos y puede engañar. Completa la valoración del staff antes de decidir con ella.</p>
      <div className="relative overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><tr><th scope="col" className="px-3 py-2 font-medium">#</th><th scope="col" className="px-3 py-2 font-medium">Jugador</th><th scope="col" className="px-3 py-2 font-medium">Puntuación</th><th scope="col" className="px-3 py-2 font-medium">Cobertura</th><th scope="col" className="px-3 py-2 font-medium">Datos pendientes</th></tr></thead>
          <tbody>{rows.map((row, index) => <tr key={row.id} className="border-b last:border-0">
            <td className="px-3 py-2 tabular-nums text-muted-foreground">{row.score === null ? "–" : index + 1}</td>
            <td className="whitespace-nowrap px-3 py-2 font-medium"><Link href={`/players/${row.id}`} className="hover:underline">{row.name}</Link></td>
            <td className="px-3 py-2">{row.score === null ? <span className="text-muted-foreground">Sin datos</span> : <span className="flex items-center gap-2"><span className="tabular-nums font-medium">{row.score}</span><span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted" aria-hidden="true"><span className="block h-full bg-primary" style={{ width: `${row.score}%` }} /></span></span>}</td>
            <td className={`px-3 py-2 tabular-nums ${row.coverage < LOW_COVERAGE ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground"}`}>{row.coverage}%{row.coverage < LOW_COVERAGE && <span className="sr-only"> (cobertura baja)</span>}</td>
            <td className="px-3 py-2 text-xs text-muted-foreground">{row.missing.length ? row.missing.join(", ") : "—"}</td>
          </tr>)}</tbody>
        </table>
        {!rows.length && <p className="px-3 py-6 text-center text-sm text-muted-foreground">No hay jugadores en esta línea.</p>}
      </div>
    </CardContent>
  </Card>;
}
