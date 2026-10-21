"use client";

import { useState } from "react";
import { Save, UserRoundPlus } from "lucide-react";

export default function StaffInterestEditor({ player, initialSignal = null, initialTargets = [], onSignalSaved }) {
  const [interest, setInterest] = useState(initialSignal?.interest || "pending");
  const [notes, setNotes] = useState(initialSignal?.notes || "");
  const [club, setClub] = useState("");
  const [fee, setFee] = useState("");
  const [salary, setSalary] = useState("");
  const [contractYears, setContractYears] = useState("");
  const [direction, setDirection] = useState("in");
  const [targetNotes, setTargetNotes] = useState("");
  const [targets, setTargets] = useState(initialTargets);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveSignal(event) {
    event.preventDefault();
    setSaving(true);
    setStatus("Guardando…");

    try {
      const response = await fetch(`/api/players/${player.id}/staff`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ interest, notes }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = response.status === 401
          ? "Inicia sesión para guardar tu valoración"
          : response.status === 403
            ? "Tu rol solo permite consultar"
            : payload.error || `No se pudo guardar (${response.status})`;
        throw new Error(message);
      }

      onSignalSaved?.(payload.signal);
      setStatus("Guardado para el workspace");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function addTarget(event) {
    event.preventDefault();
    if (!club.trim()) return;

    const response = await fetch("/api/transfer-targets", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ playerId: player.id, club, fee, salary, contractYears, direction, notes: targetNotes }),
    });
    const payload = await response.json();

    if (response.ok) {
      setTargets((current) => [payload.target, ...current]);
      setClub("");
      setFee("");
      setSalary("");
      setContractYears("");
      setTargetNotes("");
      setStatus("Movimiento añadido");
    } else {
      setStatus(payload.error || "No se pudo añadir");
    }
  }

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={saveSignal} className="rounded-lg border bg-background p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Mi valoración</p>
            <p className="text-xs text-muted-foreground">Tu opinión queda separada de la fuente externa.</p>
          </div>
          <select value={interest} onChange={(event) => setInterest(event.target.value)} className="rounded-md border bg-background px-2 py-1.5 text-xs">
            <option value="pending">Por revisar</option>
            <option value="interested">Me interesa</option>
            <option value="not-interested">No interesa</option>
          </select>
        </div>
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="2" placeholder="Motivo, encaje o siguiente paso" className="mt-3 w-full rounded-md border bg-background px-3 py-2 text-sm" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">{status}</span>
          <button type="submit" disabled={saving} aria-busy={saving} className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-xs text-primary-foreground">
            <Save className="size-3.5" />
            {saving ? "Guardando…" : "Guardar opinión"}
          </button>
        </div>
      </form>

      <div className="rounded-lg border bg-background p-4">
        <p className="text-sm font-medium">Añadir fichaje o movimiento</p>
        <p className="text-xs text-muted-foreground">Registra una propuesta propia sin alterar el dato importado.</p>
        <form onSubmit={addTarget} className="mt-3 grid gap-2 sm:grid-cols-2">
          <select value={direction} onChange={(event) => setDirection(event.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
            <option value="in">Fichar para el club</option>
            <option value="out">Salida / venta</option>
          </select>
          <input value={club} onChange={(event) => setClub(event.target.value)} required placeholder="Club o destino" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={fee} onChange={(event) => setFee(event.target.value)} type="number" min="0" step="0.1" placeholder="Coste estimado (M)" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={salary} onChange={(event) => setSalary(event.target.value)} type="number" min="0" step="0.1" placeholder="Salario (M/año)" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={contractYears} onChange={(event) => setContractYears(event.target.value)} type="number" min="0" max="10" placeholder="Años de contrato" className="rounded-md border bg-background px-3 py-2 text-sm" />
          <input value={targetNotes} onChange={(event) => setTargetNotes(event.target.value)} placeholder="Nota del fichaje" className="rounded-md border bg-background px-3 py-2 text-sm sm:col-span-2" />
          <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-secondary sm:col-span-2">
            <UserRoundPlus className="size-3.5" />
            Añadir movimiento
          </button>
        </form>
        {targets.length > 0 && <div className="mt-3 space-y-2">{targets.map((target) => <div key={target.$id} className="rounded-md bg-secondary px-3 py-2 text-xs"><div className="flex justify-between gap-2"><span className="font-medium">{target.direction === "out" ? "Salida" : "Entrada"} · {target.club}</span><span>{target.fee ? `€${target.fee}M` : "Coste pendiente"}</span></div>{target.notes && <p className="mt-1 text-muted-foreground">{target.notes}</p>}</div>)}</div>}
      </div>
    </div>
  );
}
