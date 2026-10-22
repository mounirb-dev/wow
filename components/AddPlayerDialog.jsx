"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { request } from "@/lib/api-client.js";
import { Field } from "./PlayerFormFields.jsx";
import { POSITIONS, selectClass } from "./player-form-styles.js";

// Alta rápida de un jugador: solo los cinco datos que el sistema necesita. El resto (valor,
// salario, rendimiento…) queda vacío hasta que haya una fuente; nunca se inventa.
export default function AddPlayerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const player = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      await request("/api/players", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(player) });
      toast.success(`${player.name} añadido`);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm"><Plus aria-hidden="true" /> Añadir jugador</Button></DialogTrigger>
    <DialogContent className="sm:max-w-md">
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Añadir jugador</DialogTitle>
          <DialogDescription>Solo lo imprescindible. Valor, salario y rendimiento se completan cuando haya una fuente.</DialogDescription>
        </DialogHeader>
        <Field label="Nombre"><Input name="name" required maxLength={120} autoComplete="off" placeholder="Bukayo Saka" /></Field>
        <Field label="Club"><Input name="club" required maxLength={120} autoComplete="off" placeholder="Arsenal" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Posición"><select name="pos" defaultValue="MF" className={selectClass}>{POSITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
          <Field label="Edad"><Input name="age" type="number" required min={14} max={50} inputMode="numeric" placeholder="25" /></Field>
        </div>
        <Field label="Fin de contrato"><Input name="contractEnd" type="date" required /></Field>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Añadiendo…" : "Añadir"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
