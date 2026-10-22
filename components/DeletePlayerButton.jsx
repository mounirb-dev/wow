"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DeleteButton } from "@/components/ui/delete-button";
import { request } from "@/lib/api-client.js";

// Borra un jugador tras confirmar en el propio botón (papelera → ✓ / ✕). El borrado es real y en cascada
// (noticias, clubes interesados, señales y objetivos del staff), así que no puede volver a aparecer.
// `redirectTo` lleva al listado cuando se borra desde la ficha.
export default function DeletePlayerButton({ id, name, redirectTo = null }) {
  const router = useRouter();

  // Devuelve false si falla, para que el botón no muestre el ✓ de borrado.
  async function remove() {
    try {
      await request(`/api/players/${id}`, { method: "DELETE" });
      toast.success(`${name} borrado`);
      if (redirectTo) router.push(redirectTo);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  }

  return <DeleteButton label={`Borrar ${name}`} title="Se eliminan también sus noticias, clubes interesados y datos del staff. No se puede deshacer." onConfirm={remove} />;
}
