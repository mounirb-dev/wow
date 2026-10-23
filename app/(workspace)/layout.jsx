import WorkspaceShell from "@/components/WorkspaceShell.jsx";

// Layout compartido de las páginas privadas. La barra lateral vive aquí, no en cada página,
// para que Next la conserve montada al cambiar de pantalla (el logo y el estado no se recargan).
export default function WorkspaceLayout({ children }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
