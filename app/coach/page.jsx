import PageHeader from "@/components/PageHeader.jsx";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";

export const metadata = { title: "AgentSolver · Entrenador" };

export default function CoachPage() {
  return <WorkspaceShell><main className="min-h-screen px-2 py-5"><PageHeader eyebrow="staff" title="Entrenador" description="Una carpeta de trabajo para la persona, el modelo de juego y los documentos del staff." /><div className="max-w-xl rounded-lg border bg-card p-6"><p className="font-medium">No hay entrenador registrado</p><p className="mt-1 text-sm text-muted-foreground">Añade un registro verificado para activar esta carpeta.</p></div></main></WorkspaceShell>;
}
