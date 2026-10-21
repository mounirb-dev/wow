import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS = {
  ok: { label: "Cubierta", className: "text-emerald-700 dark:text-emerald-300" },
  low: { label: "Corta", className: "text-amber-700 dark:text-amber-300" },
  empty: { label: "Vacía", className: "text-red-700 dark:text-red-300" },
};

// Equilibrio de la plantilla por línea y cuánto dato real hay detrás (ver squadBalance).
export default function BalancePanel({ balance }) {
  return <Card>
    <CardHeader>
      <CardTitle className="text-base">Equilibrio de la plantilla</CardTitle>
      <p className="text-sm text-muted-foreground">{balance.total} jugadores{balance.unclassified ? ` · ${balance.unclassified} sin posición reconocida` : ""}.</p>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{balance.lines.map((line) => <div key={line.group} className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">{line.label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{line.count}<span className="text-sm font-normal text-muted-foreground"> / {line.recommended}</span></p>
        <p className={`text-xs font-medium ${STATUS[line.status].className}`}>{STATUS[line.status].label}</p>
        <p className="mt-2 text-xs text-muted-foreground">Edad media: {line.averageAge ?? "sin dato"}</p>
        <p className="text-xs text-muted-foreground">Vencen en 12 m: {line.expiring12}</p>
      </div>)}</div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Con valoración técnica del staff</dt><dd className="mt-1 font-medium tabular-nums">{balance.dataCompleteness.rated}%</dd></div>
        <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Con minutos registrados</dt><dd className="mt-1 font-medium tabular-nums">{balance.dataCompleteness.withMinutes}%</dd></div>
      </dl>
      <p className="text-xs text-muted-foreground">Cuantos más jugadores valorados y con minutos, más fiables son la alineación y la matriz de decisión. «Recomendado» es la profundidad mínima habitual por línea (porteros 2, defensas 5, centrocampistas 5, delanteros 4).</p>
    </CardContent>
  </Card>;
}
