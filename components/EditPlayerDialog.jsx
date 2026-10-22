"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { request } from "@/lib/api-client.js";
import { Field } from "./PlayerFormFields.jsx";
import { POSITIONS, selectClass } from "./player-form-styles.js";

const text = (value) => value ?? "";
const amount = (value) => (value ? String(value) : "");

const Section = ({ title, children }) => <fieldset className="grid gap-3"><legend className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</legend>{children}</fieldset>;

// Edición de todos los datos de un jugador desde la ficha: básicos, económicos, contacto y
// representación. Se envían todos los campos; el servidor valida cada uno y un campo opcional
// vacío borra el dato.
export default function EditPlayerDialog({ player }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    setSaving(true);
    try {
      await request(`/api/players/${player.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      toast.success("Datos guardados");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline" size="sm"><Pencil aria-hidden="true" /> Editar jugador</Button></DialogTrigger>
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit} className="flex min-h-0 flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Editar a {player.name}</DialogTitle>
          <DialogDescription>Los campos opcionales se pueden dejar vacíos para borrar el dato.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 gap-5 overflow-y-auto pr-1">
          <Section title="Datos básicos">
            <Field label="Nombre"><Input name="name" required maxLength={120} autoComplete="off" defaultValue={player.name} /></Field>
            <Field label="Club"><Input name="club" required maxLength={120} autoComplete="off" defaultValue={player.club} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Posición"><select name="pos" defaultValue={player.pos} className={selectClass}>{POSITIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
              <Field label="Edad"><Input name="age" type="number" required min={14} max={50} inputMode="numeric" defaultValue={player.age} /></Field>
            </div>
            <Field label="Fin de contrato"><Input name="contractEnd" type="date" required defaultValue={String(player.contractEnd).slice(0, 10)} /></Field>
          </Section>
          <Section title="Economía (millones de €)">
            <div className="grid grid-cols-3 gap-3">
              <Field label="Valor"><Input name="value" type="number" min={0} step="any" inputMode="decimal" defaultValue={amount(player.value)} /></Field>
              <Field label="Salario"><Input name="salary" type="number" min={0} step="any" inputMode="decimal" defaultValue={amount(player.salary)} /></Field>
              <Field label="Mercado"><Input name="fair" type="number" min={0} step="any" inputMode="decimal" defaultValue={amount(player.fair)} /></Field>
            </div>
          </Section>
          <Section title="Contacto">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Teléfono"><Input name="phone" type="tel" maxLength={30} autoComplete="off" placeholder="+34 600 000 000" defaultValue={text(player.phone)} /></Field>
              <Field label="Email"><Input name="email" type="email" maxLength={255} autoComplete="off" defaultValue={text(player.email)} /></Field>
            </div>
            <Field label="Ubicación"><Input name="location" maxLength={120} autoComplete="off" placeholder="Sevilla, España" defaultValue={text(player.location)} /></Field>
          </Section>
          <Section title="Representación">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Representante"><Input name="agentName" maxLength={120} autoComplete="off" defaultValue={text(player.agentName)} /></Field>
              <Field label="Teléfono del representante"><Input name="agentPhone" type="tel" maxLength={30} autoComplete="off" defaultValue={text(player.agentPhone)} /></Field>
            </div>
          </Section>
          <Section title="Fuente">
            <Field label="Enlace (https)"><Input name="sourceUrl" type="url" maxLength={500} autoComplete="off" placeholder="https://…" defaultValue={text(player.sourceUrl)} /></Field>
          </Section>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
