import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import AddPlayerDialog from "@/components/AddPlayerDialog.jsx";
import DeletePlayerButton from "@/components/DeletePlayerButton.jsx";
import PageHeader from "@/components/PageHeader.jsx";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import { loadPlayers } from "@/lib/data.js";
import { requireUser } from "@/lib/session.js";
import { fmtM, monthsLeft } from "@/lib/tools.js";
import { canEdit, getWorkspaceContext } from "@/lib/workspace.js";

export const metadata = { title: "AgentSolver · Jugadores" };
export const dynamic = "force-dynamic";

const contractEnd = (player) => new Date(player.contractEnd).toLocaleDateString("es-ES", { month: "short", year: "numeric" });
const Source = ({ player }) => player.sourceUrl
  ? <a href={player.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"><CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" /> Verificada</a>
  : <span className="text-xs text-muted-foreground">Fuente pendiente</span>;

export default async function PlayersPage() {
  await requireUser();
  const [players, context] = await Promise.all([loadPlayers(), getWorkspaceContext()]);
  const editable = Boolean(canEdit(context?.member));

  return <WorkspaceShell><main className="min-h-screen px-2 py-5">
    <PageHeader eyebrow="espacio de trabajo / registros" title="Jugadores" description="Todos los jugadores del workspace en una vista operativa." actions={editable ? <AddPlayerDialog /> : null} />
    <Card className="overflow-hidden">
      <CardHeader className="border-b px-4 py-3"><p className="text-sm font-medium">Todos los jugadores · {players.length}</p></CardHeader>
      <CardContent className="p-0">
        {!players.length && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Todavía no hay jugadores en este workspace.{editable && " Usa “Añadir jugador” para crear el primero."}</p>}
        <ul className="divide-y md:hidden">{players.map((player) => <li key={player.id} className="flex items-center pr-2"><Link href={`/players/${player.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 active:bg-muted/50">
          <span className="min-w-0"><span className="block truncate font-medium">{player.name}</span><span className="block truncate text-xs text-muted-foreground">{player.club} · {player.pos} · {player.age} años</span><span className="mt-1 block text-xs text-muted-foreground">{monthsLeft(player)} meses · {contractEnd(player)}</span></span>
          <span className="shrink-0 text-right"><span className="block font-medium tabular-nums">{fmtM(player.value)}</span><ArrowUpRight className="ml-auto mt-1 size-4 text-muted-foreground" aria-hidden="true" /></span>
        </Link>{editable && <DeletePlayerButton id={player.id} name={player.name} compact />}</li>)}</ul>
        {players.length > 0 && <div className="hidden overflow-x-auto md:block"><table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><tr><th scope="col" className="px-4 py-3 font-medium">Jugador</th><th scope="col" className="px-4 py-3 font-medium">Club</th><th scope="col" className="px-4 py-3 font-medium">Posición</th><th scope="col" className="px-4 py-3 font-medium">Contrato</th><th scope="col" className="px-4 py-3 font-medium">Valor</th><th scope="col" className="px-4 py-3 font-medium">Fuente</th>{editable && <th scope="col" className="w-12 px-2 py-3"><span className="sr-only">Acciones</span></th>}</tr></thead>
          <tbody>{players.map((player) => <tr key={player.id} className="border-b last:border-0 hover:bg-muted/30">
            <td className="px-4 py-3"><Link href={`/players/${player.id}`} className="group inline-flex items-center gap-2 font-medium hover:underline"><span>{player.name}</span><ArrowUpRight className="size-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" aria-hidden="true" /></Link></td>
            <td className="px-4 py-3 text-muted-foreground">{player.club}</td>
            <td className="px-4 py-3 text-muted-foreground">{player.pos} · {player.age}</td>
            <td className="px-4 py-3 tabular-nums"><span>{monthsLeft(player)} meses</span><span className="mt-0.5 block text-xs text-muted-foreground">{contractEnd(player)}</span></td>
            <td className="px-4 py-3 font-medium tabular-nums">{fmtM(player.value)}</td>
            <td className="px-4 py-3"><Source player={player} /></td>
            {editable && <td className="px-2 py-3"><DeletePlayerButton id={player.id} name={player.name} compact /></td>}
          </tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
  </main></WorkspaceShell>;
}
