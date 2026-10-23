import { Skeleton } from "@/components/ui/skeleton";

// Fallback de las páginas privadas: vive dentro del layout (workspace), así que al navegar solo el
// contenido muestra el esqueleto y la barra lateral se queda quieta.
export default function Loading() {
  return (
    <div className="space-y-6 px-2 py-5">
      <Skeleton className="h-16 w-72" />
      <Skeleton className="h-20 w-full" />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-3 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-32" />)}</div>
        <Skeleton className="h-[34rem]" />
      </div>
    </div>
  );
}
