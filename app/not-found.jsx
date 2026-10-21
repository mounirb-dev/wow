import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <main className="grid min-h-dvh place-items-center px-4"><div className="max-w-sm text-center">
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">404</p>
    <h1 className="editorial-heading mt-3 text-3xl">Página no encontrada</h1>
    <p className="mt-2 text-sm text-muted-foreground">El enlace no existe o ya no tienes acceso a este contenido.</p>
    <Button asChild className="mt-6"><Link href="/">Volver al resumen</Link></Button>
  </div></main>;
}
