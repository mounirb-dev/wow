import Link from "next/link";

export default function PageHeader({ eyebrow, title, description }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5 border-b pb-6">
      <div><p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{eyebrow}</p><h1 className="editorial-heading mt-3 text-4xl">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>
      <Link href="/" className="rounded-md border bg-card px-3 py-2 text-sm transition hover:bg-secondary">Volver al resumen</Link>
    </header>
  );
}
