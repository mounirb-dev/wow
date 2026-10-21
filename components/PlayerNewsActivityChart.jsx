import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Últimos 6 meses (el actual incluido) con el nº de noticias publicadas en cada uno.
function buildData(news) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, month: date.toLocaleDateString("es-ES", { month: "short" }), noticias: 0 };
  });
  const byKey = new Map(months.map((month) => [month.key, month]));
  news.forEach((item) => {
    const date = new Date(item.publishedAt);
    const month = byKey.get(`${date.getFullYear()}-${date.getMonth()}`);
    if (month) month.noticias += 1;
  });
  return months;
}

// Gráfico de barras en HTML/CSS (sin librería de gráficos: 6 barras no justifican ~100 kB de
// JavaScript). Es un componente de servidor y expone los datos como lista para lectores de pantalla.
export default function PlayerNewsActivityChart({ news }) {
  const data = buildData(news);
  const max = Math.max(1, ...data.map((item) => item.noticias));
  return <Card>
    <CardHeader className="pb-2"><CardTitle className="text-base">Actividad de noticias</CardTitle><p className="text-sm text-muted-foreground">Menciones encontradas en los últimos 6 meses.</p></CardHeader>
    <CardContent className="pb-3">
      <ul className="flex h-[150px] items-end gap-2" aria-label="Noticias por mes">
        {data.map((item) => <li key={item.key} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1" aria-label={`${item.month}: ${item.noticias} noticias`}>
          <span className="text-xs tabular-nums text-muted-foreground" aria-hidden="true">{item.noticias}</span>
          <div className="flex w-full flex-1 items-end" aria-hidden="true"><span className="w-full rounded-t bg-[var(--chart-3)]" style={{ height: `${(item.noticias / max) * 100}%`, minHeight: 2 }} /></div>
          <span className="text-xs text-muted-foreground" aria-hidden="true">{item.month}</span>
        </li>)}
      </ul>
    </CardContent>
  </Card>;
}
