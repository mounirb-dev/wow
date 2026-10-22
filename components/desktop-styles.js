// Estilo común de un icono del escritorio (carpeta, archivo o carpeta nueva en edición).
export const itemClass = (selected) => `group relative flex w-full flex-col items-center gap-1.5 rounded-lg p-2 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-primary/15" : "hover:bg-foreground/5"}`;
