"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const norm = (value) => value.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
// Coincidencia sin acentos ni may\u00fasculas; `needle` ya viene normalizado.
const hit = (text, needle) => norm(text).includes(needle);

// Pop up para elegir el club del workspace entre los equipos europeos de OpenFootball
// (/api/clubs). `onSelect(nombre, { club })` devuelve una promesa: el diálogo se cierra si resuelve a true.
export default function ClubPicker({ open, onOpenChange, current, busy, onSelect }) {
  const [leagues, setLeagues] = useState(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState("");
  const searchInput = useRef(null);

  // Se descarga una sola vez, la primera vez que se abre; "Reintentar" repite tras un fallo.
  useEffect(() => {
    if (!open || leagues) return;
    let cancelled = false;
    setError(false);
    fetch("/api/clubs")
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => { if (!cancelled) setLeagues(data.leagues); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [open, leagues, attempt]);

  const groups = useMemo(() => {
    const needle = norm(query.trim());
    if (!leagues) return [];
    return leagues
      .map((league) => ({ ...league, clubs: !needle || hit(league.league, needle) ? league.clubs : league.clubs.filter((club) => hit(club, needle)) }))
      .filter((league) => league.clubs.length);
  }, [leagues, query]);
  const total = groups.reduce((sum, league) => sum + league.clubs.length, 0);

  // `club` = true si viene de la lista (se busca también su escudo); false para un nombre propio.
  async function choose(name, club) {
    if (await onSelect(name, { club })) { setQuery(""); setCustom(""); }
  }

  function submitCustom(event) {
    event.preventDefault();
    const name = custom.trim();
    if (name) choose(name, false);
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="h-[min(40rem,calc(100dvh-2rem))] sm:max-w-xl" onOpenAutoFocus={(event) => { event.preventDefault(); searchInput.current?.focus(); }}>
      <DialogHeader>
        <DialogTitle>Elige tu club</DialogTitle>
        <DialogDescription>El club elegido pasa a ser el nombre de tu workspace y su escudo, el icono.</DialogDescription>
      </DialogHeader>
      <div className="flex h-9 shrink-0 items-center gap-2 rounded-md border bg-background px-2.5">
        <Search aria-hidden="true" className="size-4 text-muted-foreground" />
        <input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar club o liga…" aria-label="Buscar club o liga" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        {leagues && <span className="text-[10px] text-muted-foreground">{total} clubes</span>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-md border" role="region" aria-label="Clubes europeos" aria-busy={!leagues && !error}>
        {error && <div className="grid h-full place-items-center p-6 text-center"><div><p className="text-sm">No se pudo cargar la lista de clubes.</p><Button className="mt-3" size="sm" variant="outline" onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button></div></div>}
        {!error && !leagues && <p className="p-6 text-center text-sm text-muted-foreground" role="status">Cargando clubes…</p>}
        {leagues && !total && <p className="p-6 text-center text-sm text-muted-foreground">Ningún club coincide con “{query}”.</p>}
        {groups.map((league) => <section key={league.id} aria-label={league.league}>
          <h3 className="sticky top-0 z-10 border-b bg-popover px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{league.league}</h3>
          <ul>{league.clubs.map((club) => <li key={club}>
            <button type="button" disabled={busy} onClick={() => choose(club, true)} aria-current={club === current ? "true" : undefined} className="flex h-9 w-full items-center gap-2 px-3 text-left text-sm transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none disabled:opacity-60">
              <span className="min-w-0 flex-1 truncate">{club}</span>{club === current && <Check aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />}
            </button>
          </li>)}</ul>
        </section>)}
      </div>
      <form onSubmit={submitCustom} className="flex shrink-0 gap-2">
        <input value={custom} onChange={(event) => setCustom(event.target.value)} placeholder="Usar otro nombre…" aria-label="Otro nombre para el workspace" maxLength={160} className="h-9 min-w-0 flex-1 rounded-md border bg-background px-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button type="submit" size="sm" className="h-9" disabled={busy || !custom.trim()}>Guardar</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
