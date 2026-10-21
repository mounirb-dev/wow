"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartConfig = { noticias: { label: "Noticias", color: "var(--chart-3)" } };

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

export default function PlayerNewsActivityChart({ news }) {
  const data = buildData(news);
  return <Card>
    <CardHeader className="pb-2"><CardTitle className="text-base">Actividad de noticias</CardTitle><p className="text-sm text-muted-foreground">Menciones encontradas en los últimos seis meses.</p></CardHeader>
    <CardContent className="pb-3"><ChartContainer config={chartConfig} className="h-[150px] w-full"><BarChart accessibilityLayer data={data} margin={{ top: 4, right: 4, left: -22, bottom: 0 }}><CartesianGrid vertical={false} /><XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} /><ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} /><Bar dataKey="noticias" fill="var(--color-noticias)" radius={3} /></BarChart></ChartContainer></CardContent>
  </Card>;
}
