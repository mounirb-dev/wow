"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Error({ reset }) {
  return <main className="grid min-h-dvh place-items-center px-4"><div className="max-w-sm text-center">
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">error</p>
    <h1 className="editorial-heading mt-3 text-3xl">Algo ha fallado</h1>
    <p className="mt-2 text-sm text-muted-foreground">No hemos podido cargar esta página. Inténtalo de nuevo o vuelve al resumen.</p>
    <div className="mt-6 flex justify-center gap-2"><Button onClick={reset}>Reintentar</Button><Button asChild variant="outline"><Link href="/">Resumen</Link></Button></div>
  </div></main>;
}
