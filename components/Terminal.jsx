"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, LogOut, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import Sparkline from "./Sparkline.jsx";
import ContractClock from "./ContractClock.jsx";
import Negotiation from "./Negotiation.jsx";
import Copilot from "./Copilot.jsx";
import Hint from "./Hint.jsx";
import { change12m, curve, fmtM, history, leverage, monthsLeft, negotiate, portfolio } from "@/lib/tools.js";

function useCountUp(target, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const tick = (t) => { const k = Math.min(1, (t - t0) / ms); setV(target * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const LEVERAGE_TIP = "Palanca (0-100): cuánta fuerza tienes para negociar ahora. Sube si le queda poco contrato, está en racha o cobra menos de lo que vale.";
const underpaid = (p) => Math.max(0, Math.round((1 - p.salary / p.fair) * 100));

export default function Terminal({ players, user }) {
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("resumen");
  const [filter, setFilter] = useState("todos");

  const rows = useMemo(() => players.map((p) => ({ ...p, hist: history(p), chg: change12m(p), lev: leverage(p), months: monthsLeft(p) })), [players]);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.lev - a.lev), [rows]);
  const visible = sorted.filter((r) => filter === "todos" || (filter === "palanca" && r.lev >= 70) || (filter === "vencen" && r.months <= 12));
  const pf = useMemo(() => portfolio(players), [players]);
  const aum = useCountUp(pf.aum);
  const pipeline = useCountUp(pf.pipeline);
  const player = rows.find((r) => r.id === sel) ?? sorted[0];
  const top = sorted[0];
  const topSuitor = [...top.suitors].sort((a, b) => b.need - a.need)[0];
  const topBest = topSuitor ? curve(top, topSuitor).best : null;

  const select = (id, nextTab = "resumen") => { setSel(id); setTab(nextTab); };

  return (
    <div className="min-h-screen">
      <div className="overflow-hidden border-b bg-black/40 py-1.5 font-mono text-xs">
        <div className="ticker flex w-max gap-8 whitespace-nowrap">
          {[...rows, ...rows].map((r, i) => (
            <span key={i} className="flex gap-2">
              <span className="text-muted-foreground">{r.name.split(" ")[1].toUpperCase().slice(0, 4)}</span>
              <span>{r.value.toFixed(1)}</span>
              <span className={r.chg >= 0 ? "text-emerald-400" : "text-rose-400"}>{r.chg >= 0 ? "▲" : "▼"} {Math.abs(r.chg).toFixed(1)}%</span>
            </span>
          ))}
        </div>
      </div>

      <header className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-6 px-6 pb-2 pt-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-primary">AgentSolver</p>
          <div className="mt-2 text-5xl font-semibold tabular-nums tracking-tight sm:text-6xl">{fmtM(aum)}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Hint tip="Suma del valor de mercado de todos tus jugadores.">Valor de tu cartera</Hint> · {pf.count} jugadores ·{" "}
            <Hint tip="Contratos que vencen en 12 meses o menos: es cuando más fuerza tienes para negociar.">{pf.expiring} en zona de palanca</Hint>
          </p>
        </div>
        <div className="flex items-end gap-6">
          <div className="text-right">
            <div className="text-xs text-muted-foreground"><Hint tip="Lo que esperas cobrar en comisiones si negocias a cada jugador con su mejor club y con la petición óptima.">Comisión esperada</Hint></div>
            <div className="text-3xl font-semibold tabular-nums text-amber-400">{fmtM(pipeline, 2)}</div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto rounded-full p-1">
                <Avatar><AvatarFallback>{(user.name || user.email).slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user.name || user.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action="/api/auth/logout" method="post">
                <DropdownMenuItem asChild><button className="w-full"><LogOut /> Salir</button></DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-primary/15 p-2 text-primary"><Zap className="size-5" /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Tu mejor oportunidad ahora</p>
                <p className="mt-0.5 text-base">
                  <b>{top.name}</b>: le quedan {top.months} meses de contrato y cobra un {underpaid(top)}% menos de lo que vale.
                  {topBest && <> {topSuitor.club} es su mejor opción: pide <b>{fmtM(topBest.ask, 2)}</b> y espera <b className="text-amber-400">{fmtM(topBest.ev, 2)}</b>.</>}
                </p>
              </div>
            </div>
            <Button onClick={() => select(top.id, "negociacion")}>Preparar negociación <ArrowRight /></Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <section className="space-y-3">
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="todos">Todos ({rows.length})</TabsTrigger>
                <TabsTrigger value="palanca">Palanca alta</TabsTrigger>
                <TabsTrigger value="vencen">Vencen pronto</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="grid gap-3 sm:grid-cols-2">
              {visible.map((r) => (
                <Card key={r.id} role="button" tabIndex={0} onClick={() => select(r.id)} onKeyDown={(e) => e.key === "Enter" && select(r.id)}
                  className={`cursor-pointer gap-3 py-4 transition hover:ring-primary/40 ${player.id === r.id ? "ring-2 ring-primary/70" : ""}`}>
                  <CardHeader className="px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{r.name}</CardTitle>
                        <CardDescription>{r.pos} · {r.age} años · {r.club}</CardDescription>
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild><Badge variant={r.lev >= 70 ? "default" : "secondary"}>Palanca {r.lev}</Badge></TooltipTrigger>
                        <TooltipContent className="max-w-60 text-xs">{LEVERAGE_TIP}</TooltipContent>
                      </Tooltip>
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-end justify-between px-4">
                    <div>
                      <div className="text-2xl font-semibold tabular-nums">{fmtM(r.value)}</div>
                      <div className={`text-xs ${r.chg >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{r.chg >= 0 ? "▲" : "▼"} {Math.abs(r.chg).toFixed(1)}% en 12 meses</div>
                    </div>
                    <Sparkline values={r.hist} up={r.chg >= 0} id={r.id} />
                  </CardContent>
                </Card>
              ))}
              {!visible.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Ningún jugador cumple este filtro.</p>}
            </div>
          </section>

          <Card className="lg:sticky lg:top-6 lg:self-start">
            <CardHeader>
              <CardTitle className="text-xl">{player.name}</CardTitle>
              <CardDescription>{player.pos} · {player.age} años · {player.club}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full">
                  <TabsTrigger value="resumen">Resumen</TabsTrigger>
                  <TabsTrigger value="negociacion">Negociar</TabsTrigger>
                  <TabsTrigger value="clubes">Clubes ({player.suitors.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="resumen" className="space-y-6 pt-4">
                  <div>
                    <p className="mb-2 text-sm font-medium"><Hint tip="Cada barra es un mes de contrato. Las ámbar son los últimos 12: ahí tienes más fuerza.">Contrato restante</Hint></p>
                    <ContractClock months={player.months} />
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm font-medium"><Hint tip="Compara lo que cobra hoy con lo que el mercado paga por un jugador así.">Salario frente a mercado</Hint></p>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Cobra hoy</span><span>{fmtM(player.salary, 2)}</span></div>
                      <Progress value={(player.salary / Math.max(player.fair, player.salary)) * 100} />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground"><span>Vale en el mercado</span><span>{fmtM(player.fair, 2)}</span></div>
                      <Progress value={(player.fair / Math.max(player.fair, player.salary)) * 100} className="[&>div]:bg-amber-400" />
                    </div>
                    <p className="text-sm">{underpaid(player) > 0 ? <>Está <b className="text-amber-400">{underpaid(player)}% por debajo</b> de su valor: hay margen para renegociar.</> : "Cobra en línea con el mercado o por encima."}</p>
                  </div>
                  <Button className="w-full" onClick={() => setTab("negociacion")}>Ir a negociar <ArrowRight /></Button>
                </TabsContent>

                <TabsContent value="negociacion" className="pt-4">
                  <Negotiation key={player.id} player={player} />
                </TabsContent>

                <TabsContent value="clubes" className="space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">Clubes interesados, de mayor a menor necesidad.</p>
                  {[...player.suitors].sort((a, b) => b.need - a.need).map((s) => (
                    <div key={s.club} className="space-y-1.5 rounded-lg border p-3">
                      <div className="flex justify-between text-sm"><span className="font-medium">{s.club}</span><span className="text-muted-foreground">Pagaría hasta {fmtM(negotiate(player, s, player.fair).clubMax, 2)}</span></div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="w-28"><Hint tip="Cuánto necesita este club a un jugador de esta posición (0-100).">Necesidad {s.need}</Hint></span><Progress value={s.need} /></div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
      <Copilot onFocusPlayer={(id) => select(id, "negociacion")} />
    </div>
  );
}
