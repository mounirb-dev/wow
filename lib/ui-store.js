"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Preferencias de UI del lado cliente, persistidas en localStorage ("agentsolver-ui"). Solo
// preferencias del dispositivo: los datos del workspace (nombre, carpetas) vienen del servidor
// y NO se guardan aquí. `theme` también lo lee el script de app/layout.jsx antes de pintar
// para evitar el parpadeo.
export const useUiStore = create(persist((set) => ({
  sidebarCollapsed: false,
  theme: "light",
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
}), { name: "agentsolver-ui", storage: createJSONStorage(() => localStorage) }));
