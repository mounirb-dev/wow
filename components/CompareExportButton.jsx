"use client";

import { FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button.jsx";

export default function CompareExportButton({ players, rows }) {
  function exportComparison() {
    const header = ["Criterio", ...players.map((player) => player.name)];
    const sheetRows = [
      header,
      ...rows.map(([label, values]) => [label, ...values]),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(sheetRows);
    worksheet["!cols"] = [
      { wch: 22 },
      ...players.map(() => ({ wch: 24 })),
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Comparación");
    XLSX.writeFile(workbook, `comparacion-jugadores-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  return (
    <Button type="button" variant="outline" onClick={exportComparison}>
      <FileDown aria-hidden="true" />
      Exportar Excel
    </Button>
  );
}
