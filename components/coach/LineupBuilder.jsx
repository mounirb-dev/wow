"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FORMATIONS, GROUPS, GROUP_LABEL, checkLineup, positionGroup, suggestLineup, suitability } from "@/lib/coach.js";

const selectClass = "w-full rounded-md border bg-background px-2 py-2 text-sm text-foreground";
// De delantera a portería, como se lee un campo.
const LINES_TOP_DOWN = [...GROUPS].reverse();

// Constructor de once: parte de la sugerencia automática (los mejor valorados de cada línea) y el
// entrenador puede cambiar cualquier puesto o la formación. Todo vive en el cliente: no se guarda.
export default function LineupBuilder({ players }) {
  const [formation, setFormation] = useState("4-3-3");
  const [slots, setSlots] = useState(() => suggestLineup(players, "4-3-3").slots);
  const byId = useMemo(() => new Map(players.map((player) => [player.id, player])), [players]);
  const warnings = useMemo(() => checkLineup(slots, players), [slots, players]);
  const bench = players.filter((player) => !slots.some((slot) => slot.playerId === player.id));

  function changeFormation(name) {
    setFormation(name);
    setSlots(suggestLineup(players, name).slots);
  }

  function assign(position, playerId) {
    setSlots((current) => current.map((slot, index) => (index === position ? { ...slot, playerId: playerId || null } : slot)));
  }

  // Los jugadores de la línea del puesto primero; el resto debajo (se avisará si juega fuera de línea).
  const optionsFor = (group) => [...players].sort((a, b) => (positionGroup(b.pos) === group) - (positionGroup(a.pos) === group) || a.name.localeCompare(b.name));

  return <Card>
    <CardHeader>
      <CardTitle className="text-base">Alineación</CardTitle>
      <p className="text-sm text-muted-foreground">Sugerencia automática con la valoración técnica del staff. Cambia cualquier puesto y revisa los avisos.</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs text-muted-foreground"><span>Formación</span>
          <select value={formation} onChange={(event) => changeFormation(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm text-foreground">{Object.keys(FORMATIONS).map((name) => <option key={name} value={name}>{name}</option>)}</select>
        </label>
        <Button type="button" variant="outline" onClick={() => changeFormation(formation)}><Wand2 data-icon="inline-start" aria-hidden="true" />Restablecer sugerencia</Button>
      </div>

      <div className="space-y-4 rounded-xl border bg-emerald-600/5 p-3 sm:p-4">
        {LINES_TOP_DOWN.map((group) => {
          const positions = slots.map((slot, position) => ({ ...slot, position })).filter((slot) => slot.group === group);
          return <div key={group}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{GROUP_LABEL[group]}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {positions.map((slot, index) => {
                const player = byId.get(slot.playerId);
                const score = player ? suitability(player).score : null;
                return <label key={slot.position} className="grid min-w-0 gap-1 text-xs text-muted-foreground"><span>{GROUP_LABEL[group].slice(0, -1)} {index + 1}{player ? ` · valoración ${score ?? "sin valorar"}` : ""}</span>
                  <select value={slot.playerId ?? ""} onChange={(event) => assign(slot.position, event.target.value)} className={selectClass}>
                    <option value="">Vacío</option>
                    {optionsFor(group).map((option) => <option key={option.id} value={option.id}>{option.name} ({option.pos})</option>)}
                  </select>
                </label>;
              })}
            </div>
          </div>;
        })}
      </div>

      <div aria-live="polite">
        {warnings.length
          ? <ul className="space-y-1.5">{warnings.map((warning) => <li key={warning} className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{warning}</li>)}</ul>
          : <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="size-4" aria-hidden="true" />Sin avisos para este once.</p>}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium">Banquillo y resto de la plantilla ({bench.length})</p>
        {bench.length ? <ul className="flex flex-wrap gap-2">{bench.map((player) => <li key={player.id} className="rounded-md border px-2 py-1 text-xs">{player.name} · {player.pos}</li>)}</ul> : <p className="text-sm text-muted-foreground">Todos los jugadores están en el once.</p>}
      </div>
    </CardContent>
  </Card>;
}
