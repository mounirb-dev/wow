import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/files.js";

const badgeVariant = { interested: "default", "not-interested": "destructive", pending: "secondary" };

const Meta = ({ author, date }) => <span className="text-xs text-muted-foreground">{[author, formatDate(date)].filter(Boolean).join(" · ")}</span>;

// Lo que ha escrito el staff del workspace (valoraciones con su nota y los movimientos propuestos).
// Solo presenta; se edita desde Negociaciones. `comments` = resultado de staffComments()
// (lib/staff-notes.js). En Negociaciones se reutiliza con otro título, sin el enlace de editar y con
// su propio texto de vacío.
export default function StaffCommentsCard({ playerId, comments, title = "Comentarios del staff", showLink = true, emptyText = "Todavía no hay comentarios. Escríbelos desde Negociaciones, en “Mi valoración”." }) {
  const { opinions, moves } = comments;
  const empty = !opinions.length && !moves.length;
  return <Card>
    <CardHeader><div className="flex items-center justify-between gap-3"><CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="size-4" aria-hidden="true" />{title}</CardTitle>{showLink && <Link href={`/negotiations?player=${encodeURIComponent(playerId)}`} className="text-xs text-muted-foreground hover:text-foreground hover:underline">Escribir o editar</Link>}</div></CardHeader>
    <CardContent className="space-y-4 text-sm">
      {empty && <p className="text-muted-foreground">{emptyText}</p>}
      {opinions.length > 0 && <ul className="space-y-3" aria-label="Valoraciones">{opinions.map((opinion) => <li key={opinion.id} className="rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="font-medium">{opinion.author}</span><Badge variant={badgeVariant[opinion.interest]}>{opinion.label}</Badge></span><Meta date={opinion.date} /></div>
        {opinion.notes ? <p className="mt-2 whitespace-pre-line text-muted-foreground">{opinion.notes}</p> : <p className="mt-2 text-xs text-muted-foreground">Sin nota.</p>}
      </li>)}</ul>}
      {moves.length > 0 && <div><p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Movimientos propuestos</p><ul className="space-y-3" aria-label="Movimientos propuestos">{moves.map((move) => <li key={move.id} className="rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-medium">{move.direction === "out" ? "Salida" : "Entrada"} · {move.club}<span className="ml-2 font-normal text-muted-foreground">{move.fee ? `€${move.fee}M` : "Coste pendiente"}</span></span><Meta author={move.author} date={move.date} /></div>
        {move.notes && <p className="mt-2 whitespace-pre-line text-muted-foreground">{move.notes}</p>}
      </li>)}</ul></div>}
    </CardContent>
  </Card>;
}
