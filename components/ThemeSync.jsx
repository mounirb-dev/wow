"use client";

import { useEffect } from "react";
import { useDark } from "@/lib/use-dark.js";

// Mantiene la clase `dark` de <html> alineada con el tema efectivo en todas las páginas
// (el script de app/layout.jsx solo cubre el primer pintado).
export default function ThemeSync() {
  const dark = useDark();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return null;
}
