"use client";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import Hint from "./Hint.jsx";
import { curve, negotiate, fmtM } from "@/lib/tools.js";

export default function Negotiation({ player }) {
  const [si, setSi] = useState(0);
  const suitor = player.suitors[si] ?? player.suitors[0];
  const c = useMemo(() => curve(player, suitor), [player, suitor]);
  const [ask, setAsk] = useState(player.fair);
  const r = negotiate(player, suitor, ask);

  const W = 520, H = 140;
  const X = (a) => ((a - c.lo) / (c.hi - c.lo)) * W;
  const maxEv = Math.max(...c.pts.map((p) => p.ev)) || 1;
  const pDealPath = c.pts.map((p, i) => `${i ? "L" : "M"}${X(p.ask).toFixed(1)},${(H - p.pDeal * (H - 10) - 5).toFixed(1)}`).join(" ");
  const evPath = c.pts.map((p, i) => `${i ? "L" : "M"}${X(p.ask).toFixed(1)},${(H - (p.ev / maxEv) * (H - 10) - 5).toFixed(1)}`).join(" ");
  const isOptimal = Math.abs(ask - c.best.ask) < 0.03;

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground">1 · Elige el club con el que negocias</p>
        <div className="flex flex-wrap gap-2">
          {player.suitors.map((s, i) => (
            <Button key={s.club} size="sm" variant={i === si ? "default" : "outline"} onClick={() => setSi(i)}>
              {s.club}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs font-medium text-muted-foreground">2 · Mueve el salario que pides</p>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Pides al año</span>
          <span className="text-3xl font-semibold tabular-nums">{fmtM(ask, 2)}</span>
        </div>
        <Slider className="mt-3" min={+c.lo.toFixed(2)} max={+c.hi.toFixed(2)} step={0.01} value={[ask]} onValueChange={([v]) => setAsk(v)} />
        <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{fmtM(c.lo, 1)}</span><span>{fmtM(c.hi, 1)}</span></div>
      </div>

      <Card className="bg-muted/30 py-3">
        <CardContent className="px-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
            <path d={evPath} fill="none" stroke="#fbbf24" strokeWidth="2" />
            <path d={pDealPath} fill="none" stroke="#34d399" strokeWidth="2" strokeDasharray="4 3" />
            <line x1={X(c.best.ask)} x2={X(c.best.ask)} y1="0" y2={H} stroke="#fbbf24" strokeOpacity=".4" strokeDasharray="2 3" />
            <line x1={X(ask)} x2={X(ask)} y1="0" y2={H} stroke="#fff" strokeWidth="1.5" />
            <circle cx={X(ask)} cy={H - r.pDeal * (H - 10) - 5} r="4" fill="#34d399" />
          </svg>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
            <span className="text-emerald-400">- - Probabilidad de que cierren</span>
            <span className="text-amber-400">— Lo que esperas cobrar</span>
          </div>
        </CardContent>
      </Card>

      <p className="rounded-lg border bg-card p-3 text-sm leading-relaxed">
        Si pides <b>{fmtM(ask, 2)}</b> a {suitor.club}, cierran el trato el <b>{Math.round(r.pDeal * 100)}%</b> de las veces
        y tu comisión esperada es <b className="text-amber-400">{fmtM(r.ev, 2)}</b>
        {isOptimal ? <span className="text-emerald-400"> — es tu mejor punto.</span> : <> (si cierra, cobras {fmtM(r.comm, 2)}).</>}
      </p>

      <Button className="w-full" onClick={() => { setAsk(+c.best.ask.toFixed(2)); toast.success(`Petición óptima aplicada: ${fmtM(c.best.ask, 2)}`, { description: `${Math.round(c.best.pDeal * 100)}% de cierre · ${fmtM(c.best.ev, 2)} esperados` }); }}>
        <Sparkles /> Calcular mi petición óptima
      </Button>
      <p className="text-[11px] text-muted-foreground">
        <Hint tip="Comisión ilustrativa: 5% del salario × 3 años. Probabilidades de un modelo de demostración con datos ficticios.">Modelo ilustrativo, no asesoramiento</Hint>
      </p>
    </div>
  );
}
