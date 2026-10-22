"use client";

import { useSyncExternalStore } from "react";
import { useUiStore } from "@/lib/ui-store.js";

const query = "(prefers-color-scheme: dark)";

function subscribe(onChange) {
  const media = window.matchMedia(query);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Tema efectivo: la elección explícita del usuario ("light" | "dark") y, si no hay ninguna
// ("system"), la preferencia del navegador, que se sigue en vivo.
export function useDark() {
  const theme = useUiStore((state) => state.theme);
  const system = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
  return theme === "system" ? system : theme === "dark";
}
