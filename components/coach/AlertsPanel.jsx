import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SEVERITY = {
  high: { label: "Urgente", icon: OctagonAlert, className: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300" },
  medium: { label: "Atención", icon: AlertTriangle, className: "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300" },
  low: { label: "Aviso", icon: Info, className: "border-sky-500/40 bg-sky-500/10 text-sky-800 dark:text-sky-300" },
};

// Lista priorizada de lo que el cuerpo técnico debería revisar (ver squadAlerts en lib/coach.js).
export default function AlertsPanel({ alerts }) {
  const counts = ["high", "medium", "low"].map((severity) => [severity, alerts.filter((alert) => alert.severity === severity).length]);
  return <Card>
    <CardHeader>
      <CardTitle className="text-base">Alertas del cuerpo técnico</CardTitle>
      <p className="text-sm text-muted-foreground">{alerts.length ? counts.filter(([, n]) => n).map(([severity, n]) => `${n} ${SEVERITY[severity].label.toLowerCase()}`).join(" · ") : "Sin alertas con los datos actuales."}</p>
    </CardHeader>
    <CardContent>
      {!alerts.length && <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />Nada urgente que revisar.</p>}
      <ul className="space-y-2">{alerts.map((alert) => {
        const { label, icon: Icon, className } = SEVERITY[alert.severity];
        return <li key={`${alert.playerId ?? "equipo"}-${alert.title}`} className="flex items-start gap-3 rounded-lg border p-3">
          <span className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${className}`}><Icon className="size-3.5" aria-hidden="true" />{label}</span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">{alert.player ? <Link href={`/players/${alert.playerId}`} className="hover:underline">{alert.player}</Link> : "Plantilla"} · {alert.title}</p>
            <p className="text-muted-foreground">{alert.detail}</p>
          </div>
        </li>;
      })}</ul>
    </CardContent>
  </Card>;
}
