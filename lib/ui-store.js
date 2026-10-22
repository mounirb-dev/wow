"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Preferencias de UI del lado cliente, persistidas en localStorage ("agentsolver-ui"). Solo
// preferencias del dispositivo: los datos del workspace (nombre, carpetas) vienen del servidor
// y NO se guardan aquí. `theme` también lo lee el script de app/layout.jsx antes de pintar
// para evitar el parpadeo. `theme`: "system" (por defecto, sigue al navegador), "light" o "dark".
export const useUiStore = create(persist((set) => ({
  sidebarCollapsed: false,
  theme: "system",
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
}), {
  name: "agentsolver-ui",
  version: 1,
  // v0 guardaba "light" como valor por defecto aunque nadie lo eligiera: se descarta.
  migrate: (state) => ({ ...state, theme: "system" }),
  storage: createJSONStorage(() => localStorage),
}));
