import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session.js";
import WorkspaceShell from "@/components/WorkspaceShell.jsx";
import FolderDesktop from "@/components/FolderDesktop.jsx";
import { canEdit, getWorkspaceContext, listFolders, loadAllFolders } from "@/lib/workspace.js";

export const dynamic = "force-dynamic";

const systemTitles = { priority: "Prioridad alta", expiring: "Vencen pronto", followup: "En seguimiento", opportunities: "Oportunidades" };

export default async function FolderPage({ params }) {
  await requireUser();
  const [{ slug }, context] = await Promise.all([params, getWorkspaceContext()]);
  // listFolders solo trae las carpetas a las que el usuario puede entrar: una restringida ajena
  // llega aquí igual que una que no existe.
  const sharedFolders = context ? await listFolders(context) : [];
  const record = sharedFolders.find((item) => item.$id === slug);
  const hidden = context ? (await loadAllFolders(context)).some((item) => item.$id === slug) && !record : false;
  if (hidden || (!record && !systemTitles[slug])) notFound();
  const title = systemTitles[slug] ?? record.name;
  const children = sharedFolders.filter((item) => item.parentId === slug);
  const current = record ? { $id: record.$id, createdBy: record.createdBy, restricted: Boolean(record.restricted), allowedUserIds: record.allowedUserIds ?? [] } : null;

  return <WorkspaceShell><main className="flex min-h-[calc(100dvh-5.5rem)] flex-col px-2 md:min-h-[calc(100dvh-2.5rem)]">
    <Link href="/folders" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Carpetas</Link>
    <FolderDesktop folderId={slug} name={title} canEdit={Boolean(canEdit(context?.member))} canCreateFolders={Boolean(record)} initialFolders={children} current={current} viewer={context ? { userId: context.member.userId, role: context.member.role } : null} />
  </main></WorkspaceShell>;
}
