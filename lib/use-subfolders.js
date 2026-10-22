"use client";

import { useState } from "react";
import { toast } from "sonner";
import { request } from "./api-client.js";

const JSON_HEADERS = { "content-type": "application/json" };

// Subcarpetas de una carpeta (o las raíz si `parentId` es null): crear, renombrar y actualizar el
// acceso en el estado local. `refresh` pide al servidor los datos frescos tras escribir.
export function useSubfolders({ parentId, initialFolders, refresh }) {
  const [folders, setFolders] = useState(initialFolders);

  // Devuelve la carpeta creada (o null si no se creó) para que quien llama pueda seleccionarla.
  async function createFolder(label) {
    const name = label.trim();
    if (!name) return null;
    try {
      const { folder } = await request("/api/workspace/folders", { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ name, parentId }) });
      setFolders((current) => [...current, folder]);
      refresh();
      return folder;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  }

  // Renombra cualquier carpeta en el servidor y en el estado local.
  async function renameFolder(id, label) {
    const name = label.trim();
    if (!name) return;
    try {
      await request(`/api/workspace/folders/${id}`, { method: "PATCH", headers: JSON_HEADERS, body: JSON.stringify({ name }) });
      setFolders((current) => current.map((folder) => (folder.$id === id ? { ...folder, name } : folder)));
      refresh();
    } catch (error) { toast.error(error.message); }
  }

  // Borra la carpeta (y todo lo que contiene) en el servidor y la quita del estado local.
  async function removeFolder(id) {
    try {
      await request(`/api/workspace/folders/${id}`, { method: "DELETE" });
      setFolders((current) => current.filter((folder) => folder.$id !== id));
      refresh();
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  }

  const patchFolder = (id, patch) => setFolders((current) => current.map((folder) => (folder.$id === id ? { ...folder, ...patch } : folder)));

  return { folders, createFolder, renameFolder, removeFolder, patchFolder };
}
