"use client";

import { Moon, Sun } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useUiStore } from "@/lib/ui-store.js";
import { useDark } from "@/lib/use-dark.js";

export default function ThemeToggle({ compact = false }) {
  const setTheme = useUiStore((state) => state.setTheme);
  const dark = useDark();

  function toggle() {
    const next = !dark;
    document.documentElement.classList.add("theme-transition");
    window.setTimeout(() => document.documentElement.classList.remove("theme-transition"), 280);
    setTheme(next ? "dark" : "light");
  }

  return <button type="button" onClick={toggle} className={`grid size-8 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-[background-color,border-color,color,transform] duration-200 hover:bg-secondary hover:text-foreground active:scale-95 ${compact ? "" : "ml-auto"}`} aria-label={dark ? "Activar modo claro" : "Activar modo oscuro"} title={dark ? "Modo claro" : "Modo oscuro"} aria-pressed={dark}>
    <AnimatePresence mode="wait" initial={false}>
      <m.span key={dark ? "sun" : "moon"} initial={{ opacity: 0, rotate: -45, scale: 0.7 }} animate={{ opacity: 1, rotate: 0, scale: 1 }} exit={{ opacity: 0, rotate: 45, scale: 0.7 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }} className="grid place-items-center">
        {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </m.span>
    </AnimatePresence>
  </button>;
}
