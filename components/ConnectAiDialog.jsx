"use client";

import { useState, useSyncExternalStore } from "react";
import { Check, Copy, ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Dónde se añade un conector propio en cada asistente (según su documentación). Si cambian los menús, lo
// importante es la URL de wow y el tipo de conector: «personalizado», con inicio de sesión (OAuth).
const ASSISTANTS = {
  claude: {
    name: "Claude",
    href: "https://claude.ai/customize/connectors",
    steps: [
      "Pulsa «Abrir Claude»: se abre Personalizar → Conectores.",
      "Pulsa «+ Añadir» y elige añadir un conector personalizado.",
      "Pon de nombre «wow» y pega la dirección de arriba. Continúa.",
      "Elige iniciar sesión ahora y pulsa «Añadir». Se abrirá wow para que autorices.",
    ],
    note: "En un plan de equipo, quien administra la organización añade el conector una vez (Ajustes de la organización → Conectores) y después cada persona pulsa «Conectar».",
  },
  chatgpt: {
    name: "ChatGPT",
    href: "https://chatgpt.com/plugins",
    steps: [
      "Pulsa «Abrir ChatGPT» (en la versión web): se abre la página de plugins y conectores.",
      "Pulsa «+» y elige «Añadir servidor MCP personalizado».",
      "Pon de nombre «wow», pega la dirección de arriba y elige autenticación OAuth.",
      "Acepta el aviso de riesgo y pulsa «Crear». Instálalo y se abrirá wow para que autorices. Úsalo escribiendo @wow.",
    ],
    note: "Según tu plan, ChatGPT puede pedir activar antes el modo desarrollador o que lo haga quien administra el espacio de trabajo.",
  },
};

const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|$)/;
const noSubscribe = () => () => {};

// Modal «Conecta tu IA»: explica cómo conectar Claude o ChatGPT con wow (por MCP) y lleva al usuario a la pantalla
// del asistente donde se añade el conector. La dirección es la de este mismo sitio (`/mcp`). Al autorizar, cada
// persona elige si la IA solo puede leer o también editar (ver app/mcp/oauth).
export default function ConnectAiDialog({ collapsed = false }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  // El origen solo existe en el navegador: en el servidor es "" y el cliente lo corrige al hidratar.
  const origin = useSyncExternalStore(noSubscribe, () => window.location.origin, () => "");
  const url = origin ? `${origin}/mcp` : "";

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* sin permiso de portapapeles: la dirección se puede seleccionar a mano */ }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} title={collapsed ? "Conectar mi IA" : undefined} className={`flex h-8 w-full min-w-0 items-center gap-3 rounded-md text-left text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground ${collapsed ? "justify-center px-0" : "px-3"}`}>
      <Sparkles className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">Conectar mi IA</span> : <span className="min-w-0 truncate">Conectar mi IA</span>}
    </button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Conecta tu IA con wow</DialogTitle>
          <DialogDescription>Pregúntale a Claude o a ChatGPT por tus jugadores, tus contratos y tus negociaciones, y que te conteste con tus datos.</DialogDescription>
        </DialogHeader>

        <section aria-labelledby="mcp-url-title" className="space-y-2">
          <h3 id="mcp-url-title" className="text-sm font-medium">1. Copia esta dirección</h3>
          <div className="flex items-center gap-2">
            <input readOnly value={url} aria-label="Dirección de wow para conectar la IA" onFocus={(event) => event.currentTarget.select()} className="h-9 min-w-0 flex-1 rounded-md border bg-muted/40 px-2.5 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            <Button type="button" size="sm" variant="outline" onClick={copy} disabled={!url}>{copied ? <><Check aria-hidden="true" /> Copiada</> : <><Copy aria-hidden="true" /> Copiar</>}</Button>
          </div>
          {LOCAL.test(url) && <p role="note" className="text-xs text-muted-foreground">Estás en local: Claude y ChatGPT no pueden llegar a esta dirección. Usa la dirección pública de wow.</p>}
        </section>

        <section aria-labelledby="mcp-steps-title" className="space-y-2">
          <h3 id="mcp-steps-title" className="text-sm font-medium">2. Elige tu asistente</h3>
          <Tabs defaultValue="claude">
            <TabsList className="w-full">
              {Object.entries(ASSISTANTS).map(([key, assistant]) => <TabsTrigger key={key} value={key}>{assistant.name}</TabsTrigger>)}
            </TabsList>
            {Object.entries(ASSISTANTS).map(([key, assistant]) => <TabsContent key={key} value={key} className="space-y-3 pt-2">
              <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground">{assistant.steps.map((step) => <li key={step}>{step}</li>)}</ol>
              <Button asChild className="w-full"><a href={assistant.href} target="_blank" rel="noopener noreferrer">Abrir {assistant.name} <ExternalLink aria-hidden="true" /></a></Button>
              <p className="text-xs text-muted-foreground">{assistant.note}</p>
            </TabsContent>)}
          </Tabs>
        </section>

        <section aria-labelledby="mcp-perms-title" className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
          <h3 id="mcp-perms-title" className="text-sm font-medium">Tú decides qué puede hacer</h3>
          <p className="text-xs text-muted-foreground">Al autorizar, wow te pregunta si la IA solo puede <b className="text-foreground">leer</b> (consultar y analizar, la opción recomendada) o también <b className="text-foreground">editar</b> (añadir jugadores, apuntar datos y opiniones). Cada persona conecta con su propia cuenta y solo ve los datos de su workspace.</p>
        </section>
      </DialogContent>
    </Dialog>
  </>;
}
