import { redirect } from "next/navigation";
import { getUser } from "@/lib/session.js";
import FluidOrb from "@/components/ui/fluid-orb";

export const metadata = { title: "AgentSolver · Acceso" };

export default async function Login({ searchParams }) {
  if (await getUser()) redirect("/");
  const { error } = await searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm">
        <FluidOrb size={72} color="#10b981" />
        <p className="mt-5 font-mono text-xs uppercase tracking-[0.3em] text-emerald-400">AgentSolver</p>
        <h1 className="mt-3 text-3xl font-semibold leading-tight">Tu cartera, valorada como activos.</h1>
        <p className="mt-2 text-sm text-neutral-400">Accede al terminal del agente.</p>
        <div className="mt-8 space-y-3">
          <a href="/api/auth/oauth/google" className="block rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-center text-sm transition hover:bg-white/10">Continuar con Google</a>
          <div className="flex items-center gap-3 text-xs text-neutral-600"><span className="h-px flex-1 bg-white/10" />o<span className="h-px flex-1 bg-white/10" /></div>
          <form action="/api/auth/demo" method="post">
            <button className="w-full rounded-lg bg-emerald-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300">Entrar como agente demo</button>
          </form>
        </div>
        {error && <p className="mt-4 rounded-md border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">{decodeURIComponent(error)}</p>}
        <p className="mt-6 text-xs text-neutral-600">Datos ficticios de demostración.</p>
      </div>
    </main>
  );
}
