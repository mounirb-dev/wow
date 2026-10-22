import { requireUser } from "@/lib/session.js";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import FolderExplorer from "@/components/FolderExplorer.jsx";
import { canEdit, getWorkspaceContext, listFolders } from "@/lib/workspace.js";

export const dynamic = "force-dynamic";

export const metadata = { title: "wow · Carpetas" };

// Sección "Carpetas": todas las carpetas y archivos a los que el usuario tiene acceso.
export default async function FoldersPage() {
  await requireUser();
  const context = await getWorkspaceContext();
  const folders = context ? await listFolders(context) : [];
  return <WorkspaceShell><main className="flex min-h-[calc(100dvh-5.5rem)] flex-col px-2 md:min-h-[calc(100dvh-2.5rem)]">
    <FolderExplorer folders={folders} canEdit={Boolean(canEdit(context?.member))} viewer={context ? { userId: context.member.userId, role: context.member.role } : null} />
  </main></WorkspaceShell>;
}
