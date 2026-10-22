import Link from "next/link";
import { ArrowLeft, Mail, MapPin, Phone, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import DeletePlayerButton from "./DeletePlayerButton.jsx";
import EditPlayerDialog from "./EditPlayerDialog.jsx";
import PlayerHeatmap from "./PlayerHeatmap.jsx";
import PlayerFitPanel from "./PlayerFitPanel.jsx";
import PlayerNewsSection from "./PlayerNewsSection.jsx";
import PlayerNewsActivityChart from "./PlayerNewsActivityChart.jsx";
import PlayerReportCard from "./coach/PlayerReportCard.jsx";
import StaffCommentsCard from "./StaffCommentsCard.jsx";
import { playerReport } from "@/lib/coach.js";
import { fmtM, monthsLeft } from "@/lib/tools.js";
import { loadPlayerNews } from "@/lib/news-sync.js";
import { loadPlayerStaffData } from "@/lib/staff-data.js";
import { staffComments } from "@/lib/staff-notes.js";
import { telHref } from "@/lib/player-input.js";

// Una línea de contacto: icono + dato (con enlace si lo hay) o un aviso de que falta.
function ContactRow({ icon: Icon, value, href = null, missing }) {
  const content = href ? <a href={href} className="underline-offset-4 hover:underline">{value}</a> : value;
  return <p className={`flex items-center gap-2 ${value ? "" : "text-muted-foreground"}`}><Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />{value ? content : missing}</p>;
}

export default async function PlayerProfile({ player, canEdit = false }) {
  const [news, staff] = await Promise.all([loadPlayerNews(player.id), loadPlayerStaffData(player.id)]);
  return <main className="min-h-screen px-2 py-5">
    <Link href="/players" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Jugadores</Link>
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">ficha de jugador</p><h1 className="editorial-heading mt-2 text-4xl">{player.name}</h1><p className="mt-2 text-sm text-muted-foreground">{player.pos} · {player.age} años · {player.club}</p></div>{canEdit && <div className="flex flex-wrap gap-2"><EditPlayerDialog player={player} /><DeletePlayerButton id={player.id} name={player.name} redirectTo="/players" /></div>}</div>
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4"><Card><CardHeader><CardTitle className="text-base">Resumen deportivo</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><PlayerHeatmap position={player.pos} /><div className="grid grid-cols-2 gap-2"><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Valor</p><p className="mt-1 text-2xl font-semibold">{fmtM(player.value)}</p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Contrato</p><p className="mt-1 text-2xl font-semibold">{monthsLeft(player)}<span className="text-sm font-normal"> meses</span></p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Salario</p><p className="mt-1 text-xl font-semibold">{fmtM(player.salary, 2)}</p></div><div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Forma 12m</p><p className="mt-1 text-xl font-semibold">Pendiente</p></div></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Rendimiento</CardTitle></CardHeader><CardContent><div className="rounded-md border border-dashed p-5 text-sm text-muted-foreground">Sin métricas de partidos conectadas. Importa eventos o un proveedor autorizado para ver minutos, acciones y evolución.</div></CardContent></Card><PlayerNewsActivityChart news={news} /></div>
      <div className="space-y-4"><PlayerReportCard report={playerReport(player)} /><PlayerFitPanel player={player} /><StaffCommentsCard playerId={player.id} comments={staffComments(staff)} /><Card><CardHeader><CardTitle className="text-base">Contacto y representación</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><ContactRow icon={Phone} value={player.phone} href={telHref(player.phone)} missing="Teléfono no disponible" /><ContactRow icon={Mail} value={player.email} href={player.email ? `mailto:${player.email}` : null} missing="Email no disponible" /><ContactRow icon={MapPin} value={player.location} missing="Ubicación no disponible" /><ContactRow icon={ShieldCheck} value={[player.agentName, player.agentPhone].filter(Boolean).join(" · ")} href={telHref(player.agentPhone)} missing="Representante no disponible" />{canEdit && !(player.phone && player.email && player.location && player.agentName) && <p className="text-xs text-muted-foreground">Completa estos datos con «Editar jugador».</p>}</CardContent></Card><PlayerNewsSection player={player} news={news} /><Card><CardHeader><CardTitle className="text-base">Club y contrato</CardTitle></CardHeader><CardContent className="grid grid-cols-3 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">Club</p><p className="mt-1 font-medium">{player.club}</p></div><div><p className="text-xs text-muted-foreground">Fin de contrato</p><p className="mt-1 font-medium">{new Date(player.contractEnd).toLocaleDateString("es-ES", { month: "short", year: "numeric" })}</p></div><div><p className="text-xs text-muted-foreground">Mercado</p><p className="mt-1 font-medium">{fmtM(player.fair, 2)}</p></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Clubes interesados</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">No hay contactos de clubes verificados todavía.</p></CardContent></Card></div>
    </div>
  </main>;
}
