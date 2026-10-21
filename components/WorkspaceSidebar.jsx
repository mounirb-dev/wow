"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Folder, GitCompare, LayoutDashboard, Newspaper, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import WorkspaceMembersPanel from "./WorkspaceMembersPanel.jsx";
import { useUiStore } from "@/lib/ui-store.js";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/players", label: "Jugadores", icon: Users, count: "8" },
  { href: "/negotiations", label: "Negociaciones", icon: Folder, count: "4" },
  { href: "/decision-room", label: "Sala de decisión", icon: ShieldCheck },
  { href: "/news", label: "Noticias", icon: Newspaper },
  { href: "/compare", label: "Comparador", icon: GitCompare },
];
const folderColors = { priority: "bg-[#9f2f2d]", expiring: "bg-[#956400]", followup: "bg-[#1f6c9f]" };

export default function WorkspaceSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sidebarCollapsed);
  const customFolders = useUiStore((state) => state.customFolders);
  const workspaceName = useUiStore((state) => state.workspaceName);
  const workspaceLoaded = useUiStore((state) => state.workspaceLoaded);
  const foldersLoaded = useUiStore((state) => state.foldersLoaded);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const addFolderToStore = useUiStore((state) => state.addFolder);
  const setFolders = useUiStore((state) => state.setFolders);
  const setWorkspaceName = useUiStore((state) => state.setWorkspaceName);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState(false);
  const [workspaceDraft, setWorkspaceDraft] = useState(workspaceName);

  useEffect(() => {
    if (foldersLoaded) return;
    fetch("/api/workspace/folders").then((response) => response.ok ? response.json() : null).then((payload) => payload?.folders && setFolders(payload.folders.map((folder) => ({ id: folder.$id, name: folder.name, parentId: folder.parentId, kind: folder.kind }))));
  }, [foldersLoaded, setFolders]);
  useEffect(() => {
    if (workspaceLoaded) return;
    fetch("/api/workspace").then((response) => response.ok ? response.json() : null).then((payload) => { if (payload?.workspace?.name) { setWorkspaceName(payload.workspace.name); setWorkspaceDraft(payload.workspace.name); } });
  }, [workspaceLoaded, setWorkspaceName]);

  async function renameWorkspace(event) {
    event.preventDefault();
    const name = workspaceDraft.trim();
    if (!name) return;
    const response = await fetch("/api/workspace", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (!response.ok) return;
    const payload = await response.json();
    setWorkspaceName(payload.workspace.name);
    setWorkspaceDraft(payload.workspace.name);
    setEditingWorkspace(false);
  }
  async function addFolder(event) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const response = await fetch("/api/workspace/folders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    if (!response.ok) return;
    const { folder } = await response.json();
    addFolderToStore({ id: folder.$id, name: folder.name, parentId: folder.parentId, kind: folder.kind });
    setDraft("");
    setAddingFolder(false);
  }

  const matches = (label) => !search.trim() || label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const visibleNavItems = useMemo(() => navItems.filter((item) => matches(item.label)), [search]);
  const visibleFolders = useMemo(() => customFolders.filter((folder) => !folder.parentId && folder.kind !== "system" && matches(folder.name)), [customFolders, search]);
  const itemClass = "group flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
  const isActive = (href) => pathname === href || (href !== "/" && pathname.startsWith(href));

  function renderNavItem({ href, label, icon: Icon, count }) {
    return <Link key={href} prefetch scroll={false} href={href} title={collapsed ? label : undefined} className={`${itemClass} ${isActive(href) ? "bg-secondary text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}><Icon aria-hidden="true" className="size-4 shrink-0" />{!collapsed && <><span className="min-w-0 flex-1 truncate">{label}</span>{count && <span className="font-mono text-[11px] text-muted-foreground">{count}</span>}</>}</Link>;
  }

  return <aside className={`hidden shrink-0 md:block ${collapsed ? "w-12" : "w-60"}`}><div className="sticky top-5 flex min-h-[calc(100dvh-2.5rem)] flex-col border-r border-border pr-2">
    <header className={`flex items-center gap-2 px-1 pb-4 ${collapsed ? "flex-col" : "justify-between"}`}><div className={`flex min-w-0 items-center gap-2 ${collapsed ? "flex-col" : ""}`}><div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">AS</div>{!collapsed && (editingWorkspace ? <form onSubmit={renameWorkspace} className="min-w-0"><input value={workspaceDraft} onChange={(event) => setWorkspaceDraft(event.target.value)} autoFocus onBlur={() => setEditingWorkspace(false)} className="w-32 rounded-md border bg-background px-2 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Nombre del workspace" /></form> : <button type="button" onClick={() => setEditingWorkspace(true)} className="group flex min-w-0 items-center gap-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0"><span className="block truncate text-sm font-medium">{workspaceName}</span><span className="block text-[10px] text-muted-foreground">Workspace</span></span><ChevronDown aria-hidden="true" className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:rotate-180" /></button>)}</div><div className={`flex items-center gap-1 ${collapsed ? "flex-col" : ""}`}><ThemeToggle compact /><button type="button" onClick={toggleSidebar} className="grid size-8 place-items-center rounded-md border bg-card text-muted-foreground transition-[background-color,color] hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={collapsed ? "Mostrar navegación" : "Ocultar navegación"}>{collapsed ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronLeft aria-hidden="true" className="size-4" />}</button></div></header>
      <div className={`flex flex-1 flex-col gap-4 ${collapsed ? "items-center" : ""}`}>
      <div className={`w-full ${collapsed ? "flex justify-center" : ""}`}>{searchOpen && !collapsed ? <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2"><Search aria-hidden="true" className="size-4 text-muted-foreground" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar…" aria-label="Buscar en la navegación" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="button" onClick={() => { setSearch(""); setSearchOpen(false); }} aria-label="Cerrar búsqueda" className="text-muted-foreground hover:text-foreground"><X aria-hidden="true" className="size-3.5" /></button></div> : <Button variant="outline" size={collapsed ? "icon" : "sm"} onClick={() => setSearchOpen(true)} className={collapsed ? "size-8" : "w-full justify-start"} aria-label="Buscar"><Search data-icon="inline-start" />{!collapsed && <>Buscar<span className="ml-auto text-[10px] text-muted-foreground">⌘ K</span></>}</Button>}</div>
      <nav className={`flex w-full flex-col gap-1 ${collapsed ? "items-center" : ""}`} aria-label="Navegación principal">{!collapsed && <div className="flex h-7 items-center px-2"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Favoritos</p></div>}{renderNavItem({ href: "/", label: "Resumen", icon: LayoutDashboard })}{!collapsed && <div className="mt-2 flex h-7 items-center px-2"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p></div>}{visibleNavItems.map(renderNavItem)}</nav>
      <section className={`w-full border-t pt-3 ${collapsed ? "flex flex-col items-center" : ""}`} aria-labelledby="folders-label">{!collapsed && <div className="mb-1 flex items-center justify-between px-2"><p id="folders-label" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Carpetas</p><button type="button" onClick={() => setAddingFolder((value) => !value)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Añadir carpeta">{addingFolder ? <X aria-hidden="true" className="size-3" /> : <Plus aria-hidden="true" className="size-3" />}</button></div>}{addingFolder && !collapsed && <form onSubmit={addFolder} className="mb-2 flex gap-1 px-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus placeholder="Nombre…" aria-label="Nombre de carpeta" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" /><button type="submit" className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Guardar carpeta"><Plus aria-hidden="true" className="size-3" /></button></form>}<div className="flex w-full flex-col gap-1">{["priority", "expiring", "followup"].map((id) => { const folder = customFolders.find((item) => item.id === id); const label = folder?.name || ({ priority: "Prioridad alta", expiring: "Vencen pronto", followup: "En seguimiento" }[id]); return <Link key={id} prefetch scroll={false} href={`/folders/${id}`} title={collapsed ? label : undefined} className={`${itemClass} ${isActive(`/folders/${id}`) ? "bg-secondary text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}><span className={`size-2 shrink-0 rounded-full ${folderColors[id]}`} />{!collapsed && <span className="truncate">{label}</span>}</Link>; })}{visibleFolders.map((folder) => <Link key={folder.id} prefetch scroll={false} href={`/folders/${folder.id}`} title={collapsed ? folder.name : undefined} className={`${itemClass} ${isActive(`/folders/${folder.id}`) ? "bg-secondary text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}><span className="size-2 shrink-0 rounded-full bg-primary" />{!collapsed && <span className="truncate">{folder.name}</span>}</Link>)}</div></section>
    </div><div className="mt-4 border-t pt-3"><WorkspaceMembersPanel /></div>
  </div></aside>;
}
