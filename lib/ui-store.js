"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export const useUiStore = create(persist((set) => ({
  sidebarCollapsed: false,
  theme: "light",
  workspaceName: "AgentSolver Club",
  workspaceLoaded: false,
  customFolders: [],
  foldersLoaded: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setTheme: (theme) => set({ theme }),
  setWorkspaceName: (workspaceName) => set({ workspaceName, workspaceLoaded: true }),
  addFolder: (folder) => set((state) => ({ customFolders: [...state.customFolders, folder] })),
  setFolders: (folders) => set({ customFolders: folders, foldersLoaded: true }),
  renameFolder: (id, name) => set((state) => ({ customFolders: state.customFolders.map((folder) => folder.id === id ? { ...folder, name } : folder) })),
}), { name: "agentsolver-ui", storage: createJSONStorage(() => localStorage) }));
