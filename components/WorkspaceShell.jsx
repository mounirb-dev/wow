import WorkspaceSidebar from "./WorkspaceSidebar.jsx";
import { canManage, getWorkspaceContext } from "@/lib/workspace.js";

// Marco común de las páginas privadas: barra lateral (escritorio) o barra superior + drawer
// (móvil) y el contenido a la derecha. Es un server component: carga aquí el workspace
// (getWorkspaceContext va cacheado por petición, así que no repite consultas) y lo pasa a la
// barra por props. El padding superior en móvil deja sitio a la barra fija.
export default async function WorkspaceShell({ children }) {
  const context = await getWorkspaceContext();
  const workspace = {
    name: context?.workspace.name ?? "AgentSolver",
    iconUrl: context?.workspace.iconFileId ? `/api/workspace/icon?v=${context.workspace.iconFileId}` : null,
  };

  return <div className="mx-auto flex max-w-[1440px] gap-5 px-4 pb-5 pt-[4.5rem] md:pt-5 transition-[gap,padding] duration-200 lg:px-6">
    <WorkspaceSidebar workspace={workspace} canManage={Boolean(canManage(context?.member))} />
    <div className="min-w-0 flex-1 transition-[opacity] duration-200">{children}</div>
  </div>;
}
