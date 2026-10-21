import WorkspaceSidebar from "./WorkspaceSidebar.jsx";

export default function WorkspaceShell({ children }) {
  return <div className="mx-auto flex max-w-[1440px] gap-5 px-4 py-5 transition-[gap,padding] duration-200 lg:px-6"><WorkspaceSidebar /><div className="min-w-0 flex-1 transition-[opacity] duration-200">{children}</div></div>;
}
