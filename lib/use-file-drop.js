"use client";

import { useState } from "react";

// Arrastrar y soltar archivos sobre un contenedor. `onFiles(fileList)` recibe lo soltado; si
// `enabled` es false no se registra ningún manejador. `dropProps` se esparce en el contenedor.
export function useFileDrop(enabled, onFiles) {
  const [dragging, setDragging] = useState(false);
  const dropProps = enabled
    ? {
      onDragOver: (event) => { event.preventDefault(); setDragging(true); },
      onDragLeave: () => setDragging(false),
      onDrop: (event) => { event.preventDefault(); setDragging(false); onFiles(event.dataTransfer.files); },
    }
    : {};
  return { dragging, dropProps };
}
