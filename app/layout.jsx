import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

// Applies the saved theme before first paint so dark mode never flashes light on load.
const themeScript = `try{var t=JSON.parse(localStorage.getItem("agentsolver-ui")).state.theme;document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}`;

export const metadata = { title: "AgentSolver", description: "Tu cartera de jugadores, valorada como activos." };

// Layout raíz: fuente, proveedor de tooltips y toasts globales. Cada página privada monta su
// propio <WorkspaceShell> (barra lateral); esta capa no asume sesión.
export default function RootLayout({ children }) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
