"use client";

import { useState } from "react";
import { Music, Play } from "lucide-react";
import { previewKind, viewPath } from "@/lib/files.js";
import { MacFileIcon } from "../MacIcons.jsx";

const boxSize = { grid: "w-16 h-16", list: "size-7", strip: "size-14" };
const iconSize = { grid: "h-16", list: "h-7 w-6", strip: "h-14" };
const badgeSize = { grid: "size-6", list: "size-3.5", strip: "size-5" };
const playSize = { grid: "size-3", list: "size-2", strip: "size-2.5" };
const musicSize = { grid: "size-7", list: "size-4", strip: "size-6" };

function Box({ size, children }) {
  return <span aria-hidden="true" className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted ${boxSize[size]}`}>{children}</span>;
}

function VideoBadge({ size }) {
  return <span className={`absolute flex items-center justify-center rounded-full bg-black/60 text-white ${badgeSize[size]}`}><Play className={`fill-current ${playSize[size]}`} /></span>;
}

// Miniatura real del archivo: foto, fotograma de vídeo o tile de audio. Si el medio no carga (p. ej. un
// JSON con extensión .png) cae al icono de documento. Sin vista previa posible, devuelve el icono tal cual.
export default function MediaThumb({ file, size = "grid" }) {
  const [failed, setFailed] = useState(false);
  const kind = previewKind(file);
  if (kind === null || failed) return <MacFileIcon name={file.name} className={`${iconSize[size]} shrink-0`} />;
  if (kind === "audio") return <Box size={size}><Music className={`text-muted-foreground ${musicSize[size]}`} /></Box>;
  const src = viewPath(file);
  if (kind === "video") {
    return <Box size={size}>
      <video src={`${src}#t=0.1`} muted playsInline preload="metadata" onError={() => setFailed(true)} className="size-full object-cover" />
      <VideoBadge size={size} />
    </Box>;
  }
  return <Box size={size}>
    <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover" />
  </Box>;
}
