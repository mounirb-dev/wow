"use client";
import { useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import FluidOrb from "@/components/ui/fluid-orb";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const SUGGESTIONS = ["¿Qué jugador tiene más palanca?", "Resumen de la cartera", "Prepara la negociación de Tomás Koval"];

export default function Copilot({ onFocusPlayer }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const end = useRef(null);

  useEffect(() => {
    const k = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setOpen((o) => !o); } };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function ask(text) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: "user", text }]);
    setInput(""); setBusy(true);
    try {
      const res = await fetch("/api/copilot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
      const data = await res.json();
      setMsgs((m) => [...m, { role: "ai", ...data }]);
      if (data.focus) onFocusPlayer(data.focus);
    } catch {
      setMsgs((m) => [...m, { role: "ai", answer: "No pude conectar con el copiloto.", tools: [] }]);
    } finally { setBusy(false); }
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} size="lg" className="fixed bottom-5 right-5 z-20 rounded-full shadow-xl">
        <FluidOrb size={26} color="#10b981" /> Preguntar al copiloto <kbd className="rounded bg-black/20 px-1.5 font-mono text-[10px]">⌘K</kbd>
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <div className="flex items-center gap-3"><FluidOrb size={44} color="#10b981" /><SheetTitle>Copiloto de cartera</SheetTitle></div>
            <SheetDescription>Pregunta en lenguaje natural. Usa las mismas herramientas que el MCP.</SheetDescription>
          </SheetHeader>
          <ScrollArea className="min-h-0 flex-1 px-4">
            <div className="space-y-3 pb-4 text-sm">
              {!msgs.length && (
                <div className="space-y-2">
                  {SUGGESTIONS.map((s) => <Button key={s} variant="outline" className="h-auto w-full justify-start whitespace-normal py-2 text-left" onClick={() => ask(s)}>{s}</Button>)}
                </div>
              )}
              {msgs.map((m, i) => m.role === "user"
                ? <div key={i} className="ml-10 rounded-xl bg-primary/15 px-3 py-2">{m.text}</div>
                : <div key={i} className="mr-6 space-y-2 rounded-xl border bg-card px-3 py-2">
                    <div className="flex flex-wrap gap-1">{m.tools?.map((t) => <Badge key={t} variant="secondary" className="font-mono text-[10px]">⚙ {t}</Badge>)}</div>
                    <p className="whitespace-pre-line leading-relaxed">{m.answer}</p>
                  </div>)}
              {busy && <p className="animate-pulse text-muted-foreground">Analizando…</p>}
              <div ref={end} />
            </div>
          </ScrollArea>
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }} className="flex gap-2 border-t p-4">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pregunta algo…" autoFocus />
            <Button type="submit" size="icon" disabled={busy}><SendHorizontal /></Button>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
