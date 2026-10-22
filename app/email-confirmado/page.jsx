import Link from "next/link";
import BrandLogo from "@/components/BrandLogo.jsx";
import { Button } from "@/components/ui/button";

export const metadata = { title: "wow · Confirmación de email" };

// Resultado de abrir el enlace de verificación del email (ver app/api/account/email/verify). El texto sale del
// código `ok` de la URL, solo hay dos posibles.
export default async function EmailConfirmed({ searchParams }) {
  const ok = (await searchParams).ok === "1";
  return <main className="grid min-h-dvh place-items-center px-4"><div className="max-w-md text-center">
    <BrandLogo className="mx-auto mb-6 h-16" />
    <h1 className="editorial-heading text-3xl">{ok ? "Email confirmado" : "Este enlace ya no vale"}</h1>
    <p className="mt-3 text-sm text-muted-foreground">{ok ? "Tu email ya está verificado. Puedes seguir usando wow con normalidad." : "Caduca a la hora y solo se usa una vez. Entra en Ajustes y pide uno nuevo."}</p>
    <Button asChild className="mt-6"><Link href="/">Ir a wow</Link></Button>
  </div></main>;
}
