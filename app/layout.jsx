import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import MotionProvider from "@/components/MotionProvider.jsx";
import ThemeSync from "@/components/ThemeSync.jsx";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

// Applies the theme before first paint so it never flashes: saved choice, else the browser preference.
const themeScript = `var t;try{var s=JSON.parse(localStorage.getItem("agentsolver-ui"));t=s.version>=1?s.state.theme:"system"}catch(e){}document.documentElement.classList.toggle("dark",t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches))`;

export const metadata = { title: "wow", description: "Tu cartera de jugadores, valorada como activos.", icons: { icon: "/web.webp" } };

// Layout raíz: fuente, proveedor de tooltips y toasts globales. Cada página privada monta su
// propio <WorkspaceShell> (barra lateral); esta capa no asume sesión.
export default function RootLayout({ children }) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>
        <MotionProvider><TooltipProvider delayDuration={150}>{children}</TooltipProvider></MotionProvider>
        <Toaster />
        <ThemeSync />
      </body>
    </html>
  );
}
