import Link from "next/link";

export default function PageHeader({ eyebrow, title, description, showBack = true, actions = null }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b pb-6">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p><h1 className="editorial-heading mt-3 text-3xl sm:text-4xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {showBack && <Link href="/" className="rounded-md border bg-card px-3 py-2 text-sm transition hover:bg-secondary">Volver al resumen</Link>}
      </div>
    </header>
  );
}
