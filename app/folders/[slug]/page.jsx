import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader.jsx";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import FolderFiles from "@/components/FolderFiles.jsx";
import FolderManager from "@/components/FolderManager.jsx";
import { listFolders } from "@/lib/workspace.js";

export const dynamic = "force-dynamic";
import { loadPlayers } from "@/lib/data.js";
import { fmtM, leverage, monthsLeft } from "@/lib/tools.js";

const folders = {
  priority: { title: "Prioridad alta", description: "Jugadores con palanca", files: ["Informe de palanca.pdf", "Lista de clubes objetivo.csv", "Notas de negociación.txt"], filter: (p) => leverage(p) >= 70 },
  expiring: { title: "Vencen pronto", description: "Contratos en 12 meses", files: ["Calendario de vencimientos.pdf", "Renovaciones pendientes.docx", "Comparativa salarial.csv"], filter: (p) => monthsLeft(p) <= 12 },
  followup: { title: "En seguimiento", description: "Contactos activos", files: ["Seguimiento de cartera.csv", "Últimos contactos.txt", "Valoraciones recientes.pdf"], filter: () => true },
  opportunities: { title: "Oportunidades", description: "Negociaciones abiertas", files: ["Clubes interesados.csv", "Ofertas recibidas.pdf", "Pipeline de comisión.xlsx"], filter: (p) => p.suitors.length >= 2 },
};

export default async function FolderPage({ params, searchParams }) {
  const { slug } = await params;
  const query = await searchParams;
  const players = await loadPlayers();
  const sharedFolders = await listFolders();
  const record = sharedFolders.find((item) => item.$id === slug);
  const isCustom = !folders[slug];
  const folder = folders[slug] ?? { title: record?.name || query?.name || "Nueva carpeta", description: record?.description || "Fichero creado por el staff", files: [], filter: () => true };
  const sharedFolder = record || (folders[slug] ? sharedFolders.find((item) => item.$id === slug) : null);
  const children = sharedFolders.filter((item) => item.parentId === slug);
  const visiblePlayers = players.filter(folder.filter);

  return <WorkspaceShell><main className="min-h-screen px-2 py-5">
    <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Resumen</Link>
    <PageHeader eyebrow="carpeta de trabajo" title={folder.title} description={folder.description} />
    {sharedFolder && <FolderManager folder={sharedFolder} childrenFolders={children} />}
    <div className={isCustom ? "max-w-3xl" : "grid gap-6 lg:grid-cols-[1fr_360px]"}>
      {!isCustom && <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-sm font-medium">Jugadores en esta carpeta</h2><Badge variant="secondary">{visiblePlayers.length} jugadores</Badge></div>
        <div className="grid gap-3 md:grid-cols-2">{visiblePlayers.map((player) => <Link key={player.id} href={`/players/${player.id}`}><Card className="transition hover:-translate-y-0.5 hover:bg-secondary"><CardHeader><CardTitle className="text-base">{player.name}</CardTitle><p className="text-sm text-muted-foreground">{player.pos} · {player.club}</p></CardHeader><CardContent className="flex items-end justify-between"><div><p className="text-xl font-semibold">{fmtM(player.value)}</p><p className="text-xs text-muted-foreground">{monthsLeft(player)} meses de contrato</p></div><Badge variant={leverage(player) >= 70 ? "default" : "secondary"}>Palanca {leverage(player)}</Badge></CardContent></Card></Link>)}</div>
      </section>}
      <FolderFiles folderId={slug} initialFiles={folder.files} />
    </div>
  </main></WorkspaceShell>;
}
