import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/session.js";
import FolderDesktop from "@/components/FolderDesktop.jsx";
import { canEdit, getWorkspaceContext, listFolders } from "@/lib/workspace.js";

export const dynamic = "force-dynamic";

export default async function FolderPage({ params }) {
  await requireUser();
  const [{ slug }, context] = await Promise.all([params, getWorkspaceContext()]);
  // listFolders solo trae las carpetas a las que el usuario puede entrar: una restringida ajena
  // llega aquí igual que una que no existe.
  const sharedFolders = context ? await listFolders(context) : [];
  const record = sharedFolders.find((item) => item.$id === slug);
  if (!record) notFound();
  const children = sharedFolders.filter((item) => item.parentId === slug);
  const current = { $id: record.$id, createdBy: record.createdBy, restricted: Boolean(record.restricted), allowedUserIds: record.allowedUserIds ?? [] };

  return <main className="flex min-h-[calc(100dvh-5.5rem)] flex-col px-2 md:min-h-[calc(100dvh-2.5rem)]">
    <Link href="/folders" className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Carpetas</Link>
    <FolderDesktop folderId={slug} name={record.name} canEdit={Boolean(canEdit(context?.member))} canCreateFolders initialFolders={children} current={current} viewer={context ? { userId: context.member.userId, role: context.member.role } : null} />
  </main>;
}
