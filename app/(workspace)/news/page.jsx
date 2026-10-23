import { ExternalLink, Newspaper, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader.jsx";
import { requireUser } from "@/lib/session.js";
import { after } from "next/server";
import { loadPlayers } from "@/lib/data.js";
import { loadAllNews, refreshNewsIfStale } from "@/lib/news-sync.js";
import { getWorkspaceContext } from "@/lib/workspace.js";

export const metadata = { title: "wow · Noticias" };

const cleanText = (value) => String(value || "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim();

export default async function NewsPage() {
  await requireUser();
  const [newsItems, context, players] = await Promise.all([loadAllNews(), getWorkspaceContext(), loadPlayers()]);
  // Si lo guardado tiene más de una hora, se refresca tras responder (no hay cron programado).
  if (context) after(() => refreshNewsIfStale({ workspaceId: context.workspace.$id, players, items: newsItems }));
  return <main className="min-h-screen px-2 py-5"><PageHeader showBack={false} eyebrow="evidencia" title="Noticias y contexto" description="Solo se muestran hechos con fuente, fecha y revisión del staff." /><div><Card><CardHeader><div className="flex items-center gap-2"><Newspaper className="size-4" /><CardTitle className="text-base">Bandeja de noticias</CardTitle></div></CardHeader><CardContent>{newsItems.length ? newsItems.map((item) => <article key={item.$id} className="border-b py-4 last:border-0"><div className="flex items-center gap-2"><span className="text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleString("es-ES")}</span></div><h2 className="mt-2 text-sm font-medium">{cleanText(item.title)}</h2><p className="mt-1 text-sm text-muted-foreground">{cleanText(item.summary)}</p><a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Ver fuente <ExternalLink className="size-3" /></a></article>) : <div className="rounded-md border border-dashed p-8 text-center"><ShieldAlert className="mx-auto size-6 text-muted-foreground" /><p className="mt-3 text-sm font-medium">No hay noticias sincronizadas</p><p className="mt-1 text-xs text-muted-foreground">La bandeja se llenará cuando el sincronizador consulte la fuente RSS.</p></div>}</CardContent></Card></div></main>;
}
