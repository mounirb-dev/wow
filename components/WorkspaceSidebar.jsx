"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Folder, GitCompare, LayoutDashboard, Menu, Newspaper, Plus, Search, ShieldCheck, Users, X } from "lucide-react";
import ThemeToggle from "./ThemeToggle.jsx";
import WorkspaceMembersPanel from "./WorkspaceMembersPanel.jsx";
import { useUiStore } from "@/lib/ui-store.js";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/negotiations", label: "Negociaciones", icon: Folder },
  { href: "/decision-room", label: "Sala de decisión", icon: ShieldCheck },
  { href: "/news", label: "Noticias", icon: Newspaper },
  { href: "/compare", label: "Comparador", icon: GitCompare },
];
const folderColors = { priority: "bg-[#9f2f2d]", expiring: "bg-[#956400]", followup: "bg-[#1f6c9f]" };
const systemNames = { priority: "Prioridad alta", expiring: "Vencen pronto", followup: "En seguimiento" };

function SidebarPanel({ mobile = false, onNavigate }) {
  const pathname = usePathname();
  const storeCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const collapsed = storeCollapsed && !mobile;
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
  const [workspaceIconUrl, setWorkspaceIconUrl] = useState(null);
  const [iconUploading, setIconUploading] = useState(false);

  useEffect(() => {
    if (foldersLoaded) return;
    fetch("/api/workspace/folders").then((r) => r.ok ? r.json() : null).then((p) => p?.folders && setFolders(p.folders.map((f) => ({ id: f.$id, name: f.name, parentId: f.parentId, kind: f.kind }))));
  }, [foldersLoaded, setFolders]);
  useEffect(() => {
    if (workspaceLoaded && !mobile) return;
    fetch("/api/workspace").then((r) => r.ok ? r.json() : null).then((p) => { if (p?.workspace?.name) { setWorkspaceName(p.workspace.name); setWorkspaceDraft(p.workspace.name); setWorkspaceIconUrl(p.iconUrl); } });
  }, [workspaceLoaded, setWorkspaceName, mobile]);

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

  async function uploadWorkspaceIcon(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setIconUploading(true);
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/workspace/icon", { method: "POST", body });
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setWorkspaceIconUrl(payload.iconUrl);
    setIconUploading(false);
    event.target.value = "";
  }

  const matches = (label) => !search.trim() || label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  const visibleNavItems = useMemo(() => navItems.filter((item) => matches(item.label)), [search]);
  const visibleFolders = useMemo(() => customFolders.filter((folder) => !folder.parentId && folder.kind !== "system" && matches(folder.name)), [customFolders, search]);
  const itemClass = "group flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
  const isActive = (href) => pathname === href || (href !== "/" && pathname.startsWith(href));
  const renderNavItem = ({ href, label, icon: Icon }) => <Link onClick={onNavigate} key={href} prefetch scroll={false} href={href} title={collapsed ? label : undefined} className={`${itemClass} ${isActive(href) ? "bg-secondary text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}><Icon aria-hidden="true" className="size-4 shrink-0" />{!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}</Link>;

  return <aside className={mobile ? "min-w-0" : `hidden shrink-0 md:block ${collapsed ? "w-12" : "w-60"}`}><div className={mobile ? "flex min-h-full min-w-0 flex-col" : "sticky top-5 flex min-h-[calc(100dvh-2.5rem)] min-w-0 flex-col border-r border-border pr-2"}>
    <header className={`flex min-w-0 items-center gap-2 px-1 pb-4 ${collapsed ? "flex-col" : "justify-between"}`}>
      <div className={`flex min-w-0 flex-1 items-center gap-2 ${collapsed ? "flex-col" : ""}`}><label className="relative grid size-8 shrink-0 cursor-pointer place-items-center overflow-hidden rounded-md bg-primary text-xs font-semibold text-primary-foreground" title="Cambiar icono del workspace"><input type="file" accept="image/*" onChange={uploadWorkspaceIcon} disabled={iconUploading} className="sr-only" />{workspaceIconUrl ? <img src={workspaceIconUrl} alt="" className="size-full object-cover" /> : "AS"}</label>{!collapsed && (editingWorkspace ? <form onSubmit={renameWorkspace} className="min-w-0 flex-1"><input value={workspaceDraft} onChange={(event) => setWorkspaceDraft(event.target.value)} autoFocus onBlur={() => setEditingWorkspace(false)} className="w-full max-w-32 rounded-md border bg-background px-2 py-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Nombre del workspace" /></form> : <button type="button" onClick={() => setEditingWorkspace(true)} className="group flex min-w-0 max-w-full flex-1 items-center gap-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{workspaceName}</span><span className="block text-[10px] text-muted-foreground">Workspace</span></span><ChevronDown aria-hidden="true" className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:rotate-180" /></button>)}</div>
      <div className={`flex shrink-0 items-center gap-1 ${collapsed ? "flex-col" : ""}`}>{!mobile && <ThemeToggle compact />}{!mobile && <button type="button" onClick={toggleSidebar} className="grid size-8 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground transition-[background-color,color] hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={collapsed ? "Mostrar navegación" : "Ocultar navegación"}>{collapsed ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronLeft aria-hidden="true" className="size-4" />}</button>}</div>
    </header>
    <div className={`flex flex-1 flex-col gap-4 ${collapsed ? "items-center" : ""}`}><div className={`w-full ${collapsed ? "flex justify-center" : ""}`}>{searchOpen && !collapsed ? <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2"><Search aria-hidden="true" className="size-4 text-muted-foreground" /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar…" aria-label="Buscar en la navegación" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="button" onClick={() => { setSearch(""); setSearchOpen(false); }} aria-label="Cerrar búsqueda" className="text-muted-foreground hover:text-foreground"><X aria-hidden="true" className="size-3.5" /></button></div> : <Button variant="outline" size={collapsed ? "icon" : "sm"} onClick={() => setSearchOpen(true)} className={collapsed ? "size-8" : "w-full justify-start"} aria-label="Buscar"><Search data-icon="inline-start" />{!collapsed && <>Buscar<span className="ml-auto text-[10px] text-muted-foreground">⌘ K</span></>}</Button>}</div>
      <nav className={`flex w-full flex-col gap-1 ${collapsed ? "items-center" : ""}`} aria-label="Navegación principal">{!collapsed && <div className="flex h-7 items-center px-2"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Favoritos</p></div>}{renderNavItem({ href: "/", label: "Resumen", icon: LayoutDashboard })}{!collapsed && <div className="mt-2 flex h-7 items-center px-2"><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Workspace</p></div>}{visibleNavItems.map(renderNavItem)}</nav>
      <section className={`w-full border-t pt-3 ${collapsed ? "flex flex-col items-center" : ""}`} aria-labelledby="folders-label">{!collapsed && <div className="mb-1 flex items-center justify-between px-2"><p id="folders-label" className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Carpetas</p><button type="button" onClick={() => setAddingFolder((value) => !value)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Añadir carpeta">{addingFolder ? <X className="size-3" /> : <Plus className="size-3" />}</button></div>}{addingFolder && !collapsed && <form onSubmit={addFolder} className="mb-2 flex gap-1 px-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} autoFocus placeholder="Nombre…" aria-label="Nombre de carpeta" className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5 text-xs outline-none" /><button type="submit" className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground" aria-label="Guardar carpeta"><Plus className="size-3" /></button></form>}<div className="flex w-full flex-col gap-1">{["priority", "expiring", "followup"].map((id) => { const folder = customFolders.find((item) => item.id === id); const label = folder?.name || systemNames[id]; return <Link onClick={onNavigate} key={id} prefetch scroll={false} href={`/folders/${id}`} title={collapsed ? label : undefined} className={`${itemClass} ${isActive(`/folders/${id}`) ? "bg-secondary text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}><span className={`size-2 shrink-0 rounded-full ${folderColors[id]}`} />{!collapsed && <span className="min-w-0 truncate">{label}</span>}</Link>; })}{visibleFolders.map((folder) => <Link onClick={onNavigate} key={folder.id} prefetch scroll={false} href={`/folders/${folder.id}`} title={collapsed ? folder.name : undefined} className={`${itemClass} ${isActive(`/folders/${folder.id}`) ? "bg-secondary text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}><span className="size-2 shrink-0 rounded-full bg-primary" />{!collapsed && <span className="min-w-0 truncate">{folder.name}</span>}</Link>)}</div></section>
    </div><div className="mt-4 min-w-0 border-t pt-3"><WorkspaceMembersPanel /></div>
  </div></aside>;
}

export default function WorkspaceSidebar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return <>
    <SidebarPanel />
    <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Abrir navegación"><Menu aria-hidden="true" /></Button></SheetTrigger>
        <SheetContent side="left" showCloseButton className="w-[min(20rem,85vw)] gap-0 overflow-y-auto p-4 pt-12">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SheetDescription className="sr-only">Secciones, carpetas y miembros del workspace</SheetDescription>
          <SidebarPanel mobile onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="text-sm font-semibold tracking-tight">AgentSolver</Link>
      <div className="ml-auto"><ThemeToggle compact /></div>
    </div>
  </>;
}
