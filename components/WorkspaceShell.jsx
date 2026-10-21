import WorkspaceSidebar from "./WorkspaceSidebar.jsx";

// Marco común de las páginas privadas: barra lateral (escritorio) o barra superior + drawer
// (móvil) y el contenido a la derecha. El padding superior en móvil deja sitio a la barra fija.
export default function WorkspaceShell({ children }) {
  return <div className="mx-auto flex max-w-[1440px] gap-5 px-4 pb-5 pt-[4.5rem] md:pt-5 transition-[gap,padding] duration-200 lg:px-6"><WorkspaceSidebar /><div className="min-w-0 flex-1 transition-[opacity] duration-200">{children}</div></div>;
}
