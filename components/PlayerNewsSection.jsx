import Link from "next/link";
import { ExternalLink, Newspaper, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PlayerNewsSection({ player, news }) {
  const visibleNews = news.slice(0, 6);
  return <Card>
    <CardHeader><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Newspaper className="size-4 text-muted-foreground" /><CardTitle className="text-base">Noticias de {player.name}</CardTitle></div><p className="mt-1 text-sm text-muted-foreground">Lesiones, sanciones, polémicas, rendimiento y fichajes con fuente.</p></div><Link href="/news" className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Ver bandeja</Link></div></CardHeader>
    <CardContent>{news.length ? <div className="divide-y">{visibleNews.map((item) => <article key={item.$id} className="py-3 first:pt-0 last:pb-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs text-muted-foreground">{new Date(item.publishedAt).toLocaleDateString("es-ES")}</span><span className="text-xs text-muted-foreground">· {item.sourceName}</span></div><h3 className="mt-2 text-sm font-medium leading-snug">{item.title}</h3>{item.url && <a href={item.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">Ver fuente <ExternalLink className="size-3" /></a>}</article>)}{news.length > visibleNews.length && <Link href="/news" className="mt-3 inline-block text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">Ver las {news.length} noticias en la bandeja</Link>}</div> : <div className="rounded-md border border-dashed p-5"><div className="flex items-center gap-2"><ShieldAlert className="size-4 text-muted-foreground" /><p className="text-sm font-medium">Sin noticias sincronizadas</p></div><p className="mt-2 text-sm text-muted-foreground">La fuente RSS todavía no ha encontrado noticias asociadas a este futbolista.</p></div>}</CardContent>
  </Card>;
}
