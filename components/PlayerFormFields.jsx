// Etiqueta visible + control, común a los formularios de jugador (alta y edición).
export function Field({ label, className = "", children }) {
  return <label className={`grid gap-1.5 text-sm font-medium ${className}`}><span>{label}</span>{children}</label>;
}
