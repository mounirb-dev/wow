import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DECISION_RULES, GROUP_LABEL } from "@/lib/coach.js";

// `TONE`: color del texto de la recomendación según su tono; `fmt`: un dato ausente se muestra como
// "sin dato" en lugar de un 0 que pasaría por real.
const TONE = { positive: "text-emerald-700 dark:text-emerald-300", negative: "text-red-700 dark:text-red-300", neutral: "text-foreground" };
const fmt = (value) => (value === null || value === undefined ? "sin dato" : value);

// Informe técnico de un jugador (ver playerReport en lib/coach.js): qué sabemos, qué falta y la
// recomendación con sus motivos y las reglas que la generan.
export default function PlayerReportCard({ report }) {
  const { decision, per90 } = report;
  return <Card>
    <CardHeader><CardTitle className="text-base">Informe técnico</CardTitle><p className="text-sm text-muted-foreground">{report.group ? GROUP_LABEL[report.group] : "Posición sin clasificar"} · {report.months} meses de contrato</p></CardHeader>
    <CardContent className="space-y-4">
      <div><p className="text-xs text-muted-foreground">Recomendación</p><p className={`text-lg font-semibold ${TONE[decision.tone]}`}>{decision.label}</p><ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">{decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul></div>

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Valoración técnica</dt><dd className="mt-1 font-medium tabular-nums">{report.suitability === null ? "sin valorar" : `${report.suitability}/100`}</dd><dd className="text-xs text-muted-foreground">Cobertura {report.suitabilityCoverage}%</dd></div>
        <div className="rounded-lg border p-3"><dt className="text-muted-foreground">Por 90 minutos</dt>{per90.available
          ? <dd className="mt-1 text-xs"><span className="block">Goles {fmt(per90.goals)}</span><span className="block">Asistencias {fmt(per90.assists)}</span><span className="block">Progresivas {fmt(per90.progressive)}</span></dd>
          : <dd className="mt-1 text-xs text-muted-foreground">{per90.reason}</dd>}</div>
      </dl>

      {report.alerts.length > 0 && <div><p className="text-sm font-medium">Alertas</p><ul className="mt-1 space-y-1 text-sm text-muted-foreground">{report.alerts.map((alert) => <li key={alert.title}>{alert.title}: {alert.detail}</li>)}</ul></div>}
      {report.missing.length > 0 && <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">Falta para un informe completo: {report.missing.join(", ")}.</p>}

      <details className="text-xs text-muted-foreground"><summary className="cursor-pointer font-medium">Cómo se decide</summary><ul className="mt-2 list-disc space-y-1 pl-5">{DECISION_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul><p className="mt-2">Es una ayuda para priorizar el trabajo del staff, no una decisión automática.</p></details>
    </CardContent>
  </Card>;
}
