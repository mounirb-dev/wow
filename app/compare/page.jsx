import Link from "next/link";
import { GitCompare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CompareExportButton from "@/components/CompareExportButton.jsx";
import PageHeader from "@/components/PageHeader.jsx";
import { requireUser } from "@/lib/session.js";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import { loadPlayers } from "@/lib/data.js";
import { fmtM, leverage, monthsLeft } from "@/lib/tools.js";

export const metadata = { title: "AgentSolver · Comparador" };
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  await requireUser();
  const players = await loadPlayers();
  const selected = players.slice(0, 3);
  const rows = [["Edad", (p) => `${p.age} años`], ["Posición", (p) => p.pos], ["Valor", (p) => fmtM(p.value)], ["Contrato", (p) => `${monthsLeft(p)} meses`], ["Palanca", (p) => leverage(p)], ["Disponibilidad", () => "Pendiente"], ["Encaje táctico", () => "Pendiente"]];
  const exportRows = rows.map(([label, get]) => [label, selected.map(get)]);
  return <WorkspaceShell><main className="min-h-screen px-2 py-5"><PageHeader eyebrow="scouting" title="Comparador" description="Compara perfiles con datos disponibles y marca lo que todavía necesita una fuente." /><Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><GitCompare className="size-4" /><CardTitle className="text-base">Comparativa de cartera</CardTitle></div><CompareExportButton players={selected} rows={exportRows} /></div></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead><tr className="border-b text-left"><th className="px-3 py-3 font-medium text-muted-foreground">Criterio</th>{selected.map((p) => <th key={p.id} className="px-3 py-3 font-medium"><Link href={`/players/${p.id}`} className="hover:underline">{p.name}</Link><span className="block text-xs font-normal text-muted-foreground">{p.club}</span></th>)}</tr></thead><tbody>{rows.map(([label, get]) => <tr key={label} className="border-b last:border-0"><td className="px-3 py-3 text-muted-foreground">{label}</td>{selected.map((p) => <td key={p.id} className="px-3 py-3">{get(p)}</td>)}</tr>)}</tbody></table></CardContent></Card></main></WorkspaceShell>;
}
