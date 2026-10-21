import { ExternalLink, Newspaper, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader.jsx";
import { requireUser } from "@/lib/session.js";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import { loadAllNews } from "@/lib/news-sync.js";

export const metadata = { title: "AgentSolver · Noticias" };

const cleanText = (value) => String(value || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

export default async function NewsPage() {
  await requireUser();
  const newsItems = await loadAllNews();
  return <WorkspaceShell><main className="min-h-screen px-2 py-5"><PageHeader showBack={false} eyebrow="evidencia" title="Noticias y contexto" description="Solo se muestran hechos con fuente, fecha y revisión del staff." /><div className="grid gap-4 lg:grid-cols-[1fr_320px]"><Card><CardHeader><div className="flex items-center gap-2"><Newspaper className="size-4" /><CardTitle className="text-base">Bandeja de noticias</CardTitle></div></CardHeader><CardContent>{newsItems.length ? newsItems.map((item) => <article key={item.$id} className="border-b py-4 last:border-0"><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleString("es-ES")}</span></div><h2 className="mt-2 text-sm font-medium">{cleanText(item.title)}</h2><p className="mt-1 text-sm text-muted-foreground">{cleanText(item.summary)}</p><a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Ver fuente <ExternalLink className="size-3" /></a></article>) : <div className="rounded-md border border-dashed p-8 text-center"><ShieldAlert className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No hay noticias sincronizadas</p><p className="mt-1 text-xs text-muted-foreground">La bandeja se llenará cuando el sincronizador consulte la fuente RSS.</p></div>}</CardContent></Card><Card className="h-fit"><CardHeader><CardTitle className="text-base">Estado de la fuente</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Google News RSS · {newsItems.length} noticias guardadas</p><p className="mt-2 text-xs text-muted-foreground">Las noticias se guardan en Appwrite para revisarlas desde el workspace.</p></CardContent></Card></div></main></WorkspaceShell>;
}
