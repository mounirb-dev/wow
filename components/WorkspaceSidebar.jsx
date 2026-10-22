"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, ClipboardList, Folder, FolderTree, GitCompare, LayoutDashboard, Menu, Newspaper, Search, ShieldCheck, Users, X } from "lucide-react";
import ClubPicker from "./ClubPicker.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import WorkspaceMembersPanel from "./WorkspaceMembersPanel.jsx";
import { useUiStore } from "@/lib/ui-store.js";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

// Navegación principal. Las carpetas de sistema (priority/expiring/followup) están fijas abajo;
// el resto de carpetas vienen del servidor (WorkspaceShell) como prop.
const navItems = [
  { href: "/coach", label: "Cuerpo técnico", icon: ClipboardList },
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/folders", label: "Carpetas", icon: FolderTree },
  { href: "/negotiations", label: "Negociaciones", icon: Folder },
  { href: "/decision-room", label: "Sala de decisión", icon: ShieldCheck },
  { href: "/news", label: "Noticias", icon: Newspaper },
  { href: "/compare", label: "Comparador", icon: GitCompare },
];
const itemClass = "group flex h-8 w-full min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm text-muted-foreground transition-[background-color,color] duration-150 hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring";
const sectionLabelClass = "text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground";
const JSON_HEADERS = { "content-type": "application/json" };

const matches = (label, search) => !search.trim() || label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());

// Escritura contra la API con guarda de reentrada; al terminar bien pide al servidor los datos
// frescos (router.refresh) en vez de duplicar el estado en el cliente.
function useWrite() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function write(url, init, onSuccess) {
    if (busy) return false;
    setBusy(true);
    try {
      const response = await fetch(url, init);
      if (!response.ok) return false;
      onSuccess?.(await response.json().catch(() => ({})));
      router.refresh();
      return true;
    } catch {
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, write };
}

function NavLink({ href, label, icon: Icon, active, collapsed, onNavigate }) {
  return <Link onClick={onNavigate} prefetch scroll={false} href={href} title={collapsed ? label : undefined} aria-current={active ? "page" : undefined} className={`${itemClass} ${active ? "bg-secondary text-foreground" : ""} ${collapsed ? "justify-center px-0" : ""}`}>
    <Icon aria-hidden="true" className="size-4 shrink-0" />
    {collapsed ? <span className="sr-only">{label}</span> : <span className="min-w-0 flex-1 truncate">{label}</span>}
  </Link>;
}

// Nombre e icono del workspace (editables solo por owner/admin) más los botones de tema y plegado.
function WorkspaceHeader({ workspace, canManage, collapsed, mobile }) {
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { busy, write } = useWrite();
  const [picking, setPicking] = useState(false);

  // El club elegido (o un nombre propio) pasa a ser el nombre del workspace.
  async function rename(name, { club }) {
    // Un club de la lista también guarda su escudo como icono; un nombre propio solo renombra.
    const saved = await write(club ? "/api/workspace/club" : "/api/workspace", { method: club ? "POST" : "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ name }) });
    if (saved) setPicking(false);
    return saved;
  }

  async function uploadIcon(event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    await write("/api/workspace/icon", { method: "POST", body });
    input.value = "";
  }

  const iconClass = "relative grid size-8 shrink-0 place-items-center overflow-hidden rounded-md bg-primary text-xs font-semibold text-primary-foreground";
  const iconContent = workspace.iconUrl ? <img src={workspace.iconUrl} alt="" className="size-full object-cover" /> : "AS";

  return <header className={`flex min-w-0 items-center gap-2 px-1 pb-4 ${collapsed ? "flex-col" : "justify-between"}`}>
    <div className={`flex min-w-0 flex-1 items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
      {canManage
        ? <label className={`${iconClass} cursor-pointer`} title="Cambiar icono del workspace"><input type="file" accept="image/*" onChange={uploadIcon} disabled={busy} className="sr-only" aria-label="Cambiar icono del workspace" />{iconContent}</label>
        : <div className={iconClass}>{iconContent}</div>}
      {!collapsed && <button type="button" disabled={!canManage} onClick={() => setPicking(true)} aria-haspopup="dialog" className="group flex min-w-0 max-w-full flex-1 items-center gap-1 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{workspace.name}</span><span className="block text-[10px] text-muted-foreground">Workspace</span></span>{canManage && <ChevronDown aria-hidden="true" className="size-3 shrink-0 text-muted-foreground transition-transform group-hover:rotate-180" />}</button>}
      {canManage && <ClubPicker open={picking} onOpenChange={setPicking} current={workspace.name} busy={busy} onSelect={rename} />}
    </div>
    <div className={`flex shrink-0 items-center gap-1 ${collapsed ? "flex-col" : ""}`}>
      {!mobile && <ThemeToggle compact />}
      {!mobile && <button type="button" onClick={toggleSidebar} className="grid size-8 shrink-0 place-items-center rounded-md border bg-card text-muted-foreground transition-[background-color,color] hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label={collapsed ? "Mostrar navegación" : "Ocultar navegación"}>{collapsed ? <ChevronRight aria-hidden="true" className="size-4" /> : <ChevronLeft aria-hidden="true" className="size-4" />}</button>}
    </div>
  </header>;
}

function SearchBox({ search, onSearch, collapsed }) {
  const [open, setOpen] = useState(false);
  if (open && !collapsed) {
    return <div className="flex h-8 items-center gap-2 rounded-md border bg-background px-2"><Search aria-hidden="true" className="size-4 text-muted-foreground" /><input autoFocus value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar…" aria-label="Buscar en la navegación" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /><button type="button" onClick={() => { onSearch(""); setOpen(false); }} aria-label="Cerrar búsqueda" className="text-muted-foreground hover:text-foreground"><X aria-hidden="true" className="size-3.5" /></button></div>;
  }
  return <Button variant="outline" size={collapsed ? "icon" : "sm"} onClick={() => setOpen(true)} className={collapsed ? "size-8" : "w-full justify-start"} aria-label="Buscar"><Search data-icon="inline-start" />{!collapsed && <>Buscar<span className="ml-auto text-[10px] text-muted-foreground">⌘ K</span></>}</Button>;
}

// Contenido de la navegación. Se renderiza en dos sitios: la barra fija de escritorio y el
// drawer móvil (`mobile`), donde nunca está plegada y cierra el drawer al navegar (`onNavigate`).
function SidebarPanel({ mobile = false, onNavigate, workspace, canManage }) {
  const pathname = usePathname();
  const collapsed = useUiStore((state) => state.sidebarCollapsed) && !mobile;
  const [search, setSearch] = useState("");
  const isActive = (href) => pathname === href || (href !== "/" && pathname.startsWith(href));
  const link = (item) => <NavLink key={item.href} {...item} active={isActive(item.href)} collapsed={collapsed} onNavigate={onNavigate} />;
  const groupLabel = (text, extra = "") => !collapsed && <div className={`flex h-7 items-center px-2 ${extra}`}><p className={sectionLabelClass}>{text}</p></div>;

  return <aside className={mobile ? "min-w-0" : `hidden shrink-0 md:block ${collapsed ? "w-12" : "w-60"}`}>
    <div className={mobile ? "flex min-h-full min-w-0 flex-col" : "sticky top-5 flex min-h-[calc(100dvh-2.5rem)] min-w-0 flex-col border-r border-border pr-2"}>
      <WorkspaceHeader workspace={workspace} canManage={canManage} collapsed={collapsed} mobile={mobile} />
      <div className={`flex flex-1 flex-col gap-4 ${collapsed ? "items-center" : ""}`}>
        <div className={`w-full ${collapsed ? "flex justify-center" : ""}`}><SearchBox search={search} onSearch={setSearch} collapsed={collapsed} /></div>
        <nav className={`flex w-full flex-col gap-1 ${collapsed ? "items-center" : ""}`} aria-label="Navegación principal">
          {groupLabel("Favoritos")}
          {link({ href: "/", label: "Resumen", icon: LayoutDashboard })}
          {groupLabel("Workspace", "mt-2")}
          {navItems.filter((item) => matches(item.label, search)).map(link)}
        </nav>
      </div>
      <div className="mt-4 min-w-0 border-t pt-3"><WorkspaceMembersPanel collapsed={collapsed} /></div>
    </div>
  </aside>;
}

// Escritorio (>= md): panel lateral fijo. Móvil: barra superior con botón de menú que abre el
// mismo panel en un Sheet. Se cierra solo al cambiar de ruta. Los datos llegan del servidor
// (WorkspaceShell), así que no hay fetch en el cliente ni estado duplicado.
export default function WorkspaceSidebar(props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  return <>
    <SidebarPanel {...props} />
    <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild><Button variant="outline" size="icon" aria-label="Abrir navegación"><Menu aria-hidden="true" /></Button></SheetTrigger>
        <SheetContent side="left" showCloseButton className="w-[min(20rem,85vw)] gap-0 overflow-y-auto p-4 pt-12">
          <SheetTitle className="sr-only">Navegación</SheetTitle>
          <SheetDescription className="sr-only">Secciones, carpetas y miembros del workspace</SheetDescription>
          <SidebarPanel {...props} mobile onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <Link href="/" className="text-sm font-semibold tracking-tight">AgentSolver</Link>
      <div className="ml-auto"><ThemeToggle compact /></div>
    </div>
  </>;
}
