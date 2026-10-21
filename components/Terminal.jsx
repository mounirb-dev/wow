"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, LogOut, Zap } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ContractClock from "./ContractClock.jsx";
import Hint from "./Hint.jsx";
import ActivityChart from "./ActivityChart.jsx";
import FolderCard from "./FolderCard.jsx";
import PlayerFolder from "./PlayerFolder.jsx";
import WorkspaceShell from "./WorkspaceShell.jsx";
import { curve, fmtM, leverage, monthsLeft, negotiate, portfolio } from "@/lib/tools.js";

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
const underpaid = (p) => p.fair > 0 && p.salary > 0 ? Math.max(0, Math.round((1 - p.salary / p.fair) * 100)) : null;

export default function Terminal({ players, user }) {
  const [sel, setSel] = useState(null);
  const [filter, setFilter] = useState("todos");

  const rows = useMemo(() => players.map((p) => ({ ...p, lev: leverage(p), months: monthsLeft(p) })), [players]);
  const sorted = useMemo(() => [...rows].sort((a, b) => b.lev - a.lev), [rows]);
  const visible = sorted.filter((r) => filter === "todos" || (filter === "palanca" && r.lev >= 70) || (filter === "vencen" && r.months <= 12));
  const pf = useMemo(() => portfolio(players), [players]);
  const aum = useCountUp(pf.aum);
  const pipeline = useCountUp(pf.pipeline);
  const player = rows.find((r) => r.id === sel) ?? sorted[0];
  if (!players.length) return <div className="min-h-screen"><WorkspaceShell><main className="space-y-6 py-10"><header><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">cartera</p><h1 className="mt-2 text-4xl font-semibold tracking-tight">Aún no hay jugadores</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground">La base de datos está conectada. Importa un perfil con una fuente para empezar.</p></header><Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6"><div><p className="font-medium">Sin registros</p><p className="mt-1 text-sm text-muted-foreground">Todavía no hay jugadores en este workspace.</p></div><Button asChild><Link href="/players">Abrir jugadores</Link></Button></CardContent></Card></main></WorkspaceShell></div>;
  const top = sorted[0];
  const topSuitor = [...top.suitors].sort((a, b) => b.need - a.need)[0];
  const topBest = topSuitor ? curve(top, topSuitor).best : null;

  const select = (id) => setSel(id);

  return (
    <div className="min-h-screen">
      <WorkspaceShell>
      <header className="flex flex-wrap items-end justify-between gap-6 pb-4 pt-3">
        <div>
          <div className="mt-2 text-4xl font-semibold tabular-nums tracking-tight sm:text-6xl">{fmtM(aum)}</div>
          <p className="mt-1 text-sm text-muted-foreground">
            <Hint tip="Suma del valor de mercado de todos tus jugadores.">Valor de tu cartera</Hint> · {pf.count} jugadores ·{" "}
            <Hint tip="Contratos que vencen en 12 meses o menos: es cuando más fuerza tienes para negociar.">{pf.expiring} en zona de palanca</Hint>
          </p>
        </div>
        <div className="flex w-full items-end justify-between gap-6 rounded-lg border bg-card px-4 py-3 sm:w-auto">
          <div className="text-right">
            <div className="text-xs text-muted-foreground"><Hint tip="Lo que esperas cobrar en comisiones si negocias a cada jugador con su mejor club y con la petición óptima.">Comisión esperada</Hint></div>
            <div className="text-3xl font-semibold tabular-nums text-[#956400]">{fmtM(pipeline, 2)}</div>
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
                <DropdownMenuItem asChild><button type="submit" className="w-full"><LogOut /> Salir</button></DropdownMenuItem>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="space-y-6 py-6">
        <section className="border-b pb-10">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Carpetas de trabajo</p>
              <p className="text-xs text-muted-foreground">Organiza el trabajo por estado.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-4">
            <FolderCard title="Prioridad alta" description="Jugadores con palanca" count="4" tone="red" href="/folders/priority" />
            <FolderCard title="Vencen pronto" description="Contratos en 12 meses" count="3" tone="yellow" href="/folders/expiring" />
            <FolderCard title="En seguimiento" description="Contactos activos" count="8" tone="blue" href="/folders/followup" />
            <FolderCard title="Oportunidades" description="Negociaciones abiertas" count="4" tone="green" href="/folders/opportunities" />
          </div>
        </section>

        <Card className="border bg-card">
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-accent p-2 text-accent-foreground"><Zap className="size-5" /></div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-primary">Siguiente revisión</p>
                <p className="mt-0.5 text-base">
                  <b>{top.name}</b>: le quedan {top.months} meses de contrato. {underpaid(top) === null ? "Los datos económicos están pendientes de verificar." : <>Cobra un {underpaid(top)}% menos de lo que vale.</>}
                  {topBest && <> {topSuitor.club} es su mejor opción: pide <b>{fmtM(topBest.ask, 2)}</b> y espera <b className="text-amber-400">{fmtM(topBest.ev, 2)}</b>.</>}
                </p>
              </div>
            </div>
            <Button asChild><Link href={`/negotiations?player=${encodeURIComponent(top.id)}`}>Preparar negociación <ArrowRight /></Link></Button>
          </CardContent>
        </Card>

        <section className="max-w-xl"><div className="rounded-lg border bg-card p-5"><div className="mb-4"><p className="text-sm font-medium">Carpeta del jugador</p><p className="text-xs text-muted-foreground">Guarda la ficha, el historial y las negociaciones.</p></div><PlayerFolder player={player} /></div></section>

        <Card className="border bg-card p-5 sm:p-6">
          <ActivityChart />
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
                  className={`cursor-pointer gap-3 border bg-card py-4 transition duration-200 hover:-translate-y-0.5 hover:bg-secondary hover:ring-primary/30 ${player.id === r.id ? "ring-2 ring-primary/70" : ""}`}>
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
            <CardContent className="px-4">
                    <div>
                      <div className="text-2xl font-semibold tabular-nums">{fmtM(r.value)}</div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {!visible.length && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">Ningún jugador cumple este filtro.</p>}
            </div>
          </section>

          <Card className="border bg-card lg:sticky lg:top-6 lg:self-start">
            <CardHeader>
              <CardTitle className="text-xl">{player.name}</CardTitle>
              <CardDescription>{player.pos} · {player.age} años · {player.club}</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="resumen">
                <TabsList className="w-full">
                  <TabsTrigger value="resumen">Resumen</TabsTrigger>
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
                  <Button asChild className="w-full"><Link href={`/negotiations?player=${encodeURIComponent(player.id)}`}>Ir a negociar <ArrowRight /></Link></Button>
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
      </WorkspaceShell>
    </div>
  );
}
