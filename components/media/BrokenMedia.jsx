"use client";

import { Download, FileWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { downloadPath } from "@/lib/files.js";

const WORDS = { image: ["la imagen", "una imagen válida"], video: ["el vídeo", "un vídeo que el navegador pueda reproducir"], audio: ["el audio", "un audio que el navegador pueda reproducir"] };

// Lo que ve quien abre un archivo que no se puede mostrar (p. ej. un «.png» que en realidad no es una imagen,
// o un vídeo con un códec que el navegador no soporta): una explicación clara y la descarga, en vez del icono de
// imagen rota del navegador.
export default function BrokenMedia({ file, kind }) {
  const [what, valid] = WORDS[kind] ?? WORDS.image;
  return <div className="grid size-full place-items-center p-6">
    <Alert variant="destructive" className="max-w-md">
      <FileWarning aria-hidden="true" />
      <AlertTitle>No se puede mostrar {what}</AlertTitle>
      <AlertDescription>
        <p>«{file.name}» no es {valid} o está dañado. Puedes descargarlo para revisarlo con otro programa.</p>
        <Button asChild variant="outline" size="sm" className="mt-3 text-foreground">
          <a href={downloadPath(file)}><Download aria-hidden="true" /> Descargar archivo</a>
        </Button>
      </AlertDescription>
    </Alert>
  </div>;
}
