import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = { title: "AgentSolver", description: "Tu cartera de jugadores, valorada como activos." };

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={cn("font-sans", geist.variable)}>
      <body>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster theme="light" />
      </body>
    </html>
  );
}
