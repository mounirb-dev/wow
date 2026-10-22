import { useId } from "react";
import { extensionOf } from "@/lib/files.js";

// Iconos planos al estilo del Finder de macOS: carpeta azul y hoja de documento con etiqueta de tipo.
export function MacFolderIcon({ className = "w-16" }) {
  const id = useId();
  return <svg viewBox="0 0 64 52" className={className} aria-hidden="true" fill="none">
    <defs>
      <linearGradient id={`${id}-back`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3b8fd9" /><stop offset="1" stopColor="#2f7ec4" /></linearGradient>
      <linearGradient id={`${id}-front`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8fd0ff" /><stop offset="1" stopColor="#4aa3f2" /></linearGradient>
    </defs>
    <path d="M4 8a4 4 0 0 1 4-4h14.5a4 4 0 0 1 2.8 1.2L29 9h27a4 4 0 0 1 4 4v31a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" fill={`url(#${id}-back)`} />
    <rect x="2" y="14" width="60" height="34" rx="5" fill={`url(#${id}-front)`} />
    <rect x="2.5" y="14.5" width="59" height="33" rx="4.5" stroke="white" strokeOpacity=".35" />
  </svg>;
}

const kinds = [
  { match: /^(pdf)$/, color: "#e5484d" },
  { match: /^(xls|xlsx|csv|numbers)$/, color: "#2f9e5b" },
  { match: /^(doc|docx|pages|rtf)$/, color: "#3b82f6" },
  { match: /^(png|jpe?g|webp|gif|heic|svg)$/, color: "#8b5cf6" },
];

export function MacFileIcon({ name, className = "w-12" }) {
  const extension = extensionOf(name);
  const color = kinds.find((kind) => kind.match.test(extension))?.color ?? "#6b7280";
  return <svg viewBox="0 0 48 60" className={className} aria-hidden="true" fill="none">
    <path d="M6 4a4 4 0 0 1 4-4h20l12 12v44a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#f4f4f5" stroke="#d4d4d8" />
    <path d="M30 0v8a4 4 0 0 0 4 4h8z" fill="#e4e4e7" stroke="#d4d4d8" />
    {extension && <><rect x="10" y="38" width="28" height="12" rx="3" fill={color} /><text x="24" y="47" textAnchor="middle" fontSize="8" fontWeight="700" fill="white" fontFamily="ui-sans-serif, system-ui">{extension.slice(0, 4).toUpperCase()}</text></>}
    <rect x="12" y="20" width="24" height="2.5" rx="1.25" fill="#d4d4d8" /><rect x="12" y="26" width="18" height="2.5" rx="1.25" fill="#e4e4e7" />
  </svg>;
}
