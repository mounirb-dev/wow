"use client";

import { Folder } from "./ui/folder-component.jsx";
import Link from "next/link";

export default function FolderCard({ title, description, count, tone = "green", onClick, href }) {
  const content = <>
    <Folder color="black" size="sm" className="h-[132px] w-full origin-top scale-[0.76]" />
    <div className="-mt-3 text-center">
      <p className="truncate text-sm font-medium text-foreground">{title}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{description} · {count} elementos</p>
    </div>
  </>;
  if (href) return <Link href={href} className="group block w-full max-w-[220px] text-left" aria-label={`Abrir carpeta ${title}`}>{content}</Link>;
  return <button onClick={onClick} className="group w-full max-w-[220px] text-left" aria-label={`Abrir carpeta ${title}`}>{content}</button>;
}
