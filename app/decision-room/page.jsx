import Link from "next/link";
import { ArrowRight, GitCompare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader.jsx";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import { loadPlayers } from "@/lib/data.js";

export const metadata = { title: "AgentSolver · Sala de decisión" };
export const dynamic = "force-dynamic";

export default async function DecisionRoomPage() {
  const player = (await loadPlayers())[0];

  return <WorkspaceShell><main className="min-h-screen px-2 py-5"><PageHeader eyebrow="sala de decisión" title="Sala de decisión" description="Reúne las evidencias verificadas y la valoración del staff antes de decidir." />{player ? <Card><CardHeader><CardTitle>{player.name}</CardTitle><p className="text-sm text-muted-foreground">{player.pos} · {player.club}</p></CardHeader><CardContent className="space-y-4"><div className="rounded-md border border-dashed p-5"><p className="font-medium">No hay una decisión guardada</p><p className="mt-1 text-sm text-muted-foreground">Añade una valoración desde Negociaciones cuando el staff haya revisado este perfil.</p></div><div className="flex flex-wrap gap-2"><Link href={`/negotiations?player=${player.id}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">Abrir negociación <ArrowRight className="size-4" /></Link><Link href="/compare" className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><GitCompare className="size-4" />Comparar jugadores</Link></div></CardContent></Card> : <Card><CardContent className="p-6 text-sm text-muted-foreground">No hay jugadores verificados en el workspace.</CardContent></Card>}</main></WorkspaceShell>;
}
