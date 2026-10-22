"use client";

import { useCallback, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { downloadPath, formatDate, formatSize, previewKind, viewPath, viewableFiles } from "@/lib/files.js";
import AudioPlayer from "./media/AudioPlayer.jsx";
import BrokenMedia from "./media/BrokenMedia.jsx";
import ImageSlide from "./media/ImageSlide.jsx";
import MediaThumb from "./media/MediaThumb.jsx";
import VideoPlayer from "./media/VideoPlayer.jsx";

// Una diapositiva: foto con zoom, vídeo o audio. Si el archivo no se puede mostrar (no es una imagen válida, el
// navegador no reproduce ese vídeo…) enseña una explicación con la descarga en vez de una imagen rota.
function Slide({ file, active, onZoomChange }) {
  const kind = previewKind(file);
  const [failed, setFailed] = useState(false);
  const fail = useCallback(() => setFailed(true), []);
  if (failed) return <BrokenMedia file={file} kind={kind} />;
  const src = viewPath(file);
  if (kind === "image") return <ImageSlide src={src} name={file.name} onError={fail} onZoomChange={active ? onZoomChange : undefined} />;
  if (kind === "video") return <div className="grid size-full place-items-center"><div className="w-full"><VideoPlayer src={src} name={file.name} active={active} onError={fail} /></div></div>;
  return <div className="grid size-full place-items-center p-6"><div className="w-full max-w-xl"><AudioPlayer src={src} name={file.name} active={active} onError={fail} /></div></div>;
}

// Tira de miniaturas para saltar a cualquier archivo de la carpeta.
function ThumbStrip({ files, current, onSelect }) {
  return <ScrollArea className="w-full">
    <ul className="flex gap-2 p-2" aria-label="Archivos de la carpeta">
      {files.map((file, index) => <li key={file.$id}>
        <button
          type="button"
          onClick={() => onSelect(index)}
          aria-label={`Ver ${file.name}`}
          aria-current={index === current ? "true" : undefined}
          className={`block rounded-md outline-none ring-offset-background transition focus-visible:ring-2 focus-visible:ring-ring ${index === current ? "ring-2 ring-primary" : "opacity-70 hover:opacity-100"}`}
        >
          <MediaThumb file={file} size="strip" />
        </button>
      </li>)}
    </ul>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>;
}

// Contenido del visor. Se monta de nuevo (key) al abrir otro archivo, así el carrusel empieza en el elegido.
function ViewerBody({ files, startIndex }) {
  const carousel = useRef(null);
  // `picked` = el archivo al que se ha saltado; hasta entonces es el que se abrió.
  const [picked, setPicked] = useState(null);
  const [zoomed, setZoomed] = useState(false);
  const current = picked ?? startIndex;
  // Al cambiar de archivo el zoom del anterior ya no cuenta.
  const select = useCallback((index) => { setPicked(index); setZoomed(false); }, []);

  const active = files[current] ?? files[0];
  const many = files.length > 1;
  const details = [formatSize(active.size), formatDate(active.$createdAt)].filter(Boolean).join(" · ");

  return <>
    <div className="flex items-start justify-between gap-3 pr-8">
      <DialogHeader className="min-w-0 pr-0">
        <DialogTitle className="truncate">{active.name}</DialogTitle>
        <DialogDescription className="flex items-center gap-2">{details}{many && <Badge variant="secondary">{current + 1} de {files.length}</Badge>}</DialogDescription>
      </DialogHeader>
      <Button asChild variant="outline" size="sm" className="shrink-0"><a href={downloadPath(active)}><Download aria-hidden="true" /> Descargar</a></Button>
    </div>
    {/* Mientras se está acercando una foto se desactiva el deslizamiento: arrastrar mueve la foto, no cambia de archivo. */}
    <Carousel ref={carousel} opts={{ startIndex, watchDrag: !zoomed }} onIndexChange={select} className="h-[calc(100dvh-15rem)] min-h-64 overflow-hidden">
      <CarouselContent>
        {/* Las vecinas se precargan para que el deslizamiento sea fluido, pero no son alcanzables con teclado ni lector de pantalla. */}
        {files.map((file, index) => <CarouselItem key={file.$id} inert={index !== current}>
          {Math.abs(index - current) <= 1 && <Slide file={file} active={index === current} onZoomChange={setZoomed} />}
        </CarouselItem>)}
      </CarouselContent>
      {many && <><CarouselPrevious /><CarouselNext /></>}
    </Carousel>
    {many && <ThumbStrip files={files} current={current} onSelect={(index) => carousel.current?.scrollTo(index)} />}
  </>;
}

// Visor de fotos, vídeos y audio sin salir de la página. `file` = el archivo que se abre (null = cerrado) y `files`
// = la lista de la que sale (carpeta o «Todos los archivos»): con ella se puede pasar al anterior y al siguiente
// con las flechas, el teclado o la tira de miniaturas.
export default function FileViewer({ file, files = [], onClose }) {
  const viewable = file ? viewableFiles(files.some((item) => item.$id === file.$id) ? files : [file, ...files]) : [];
  const startIndex = file ? Math.max(0, viewable.findIndex((item) => item.$id === file.$id)) : 0;

  return <Dialog open={viewable.length > 0} onOpenChange={(next) => { if (!next) onClose(); }}>
    <DialogContent className="sm:max-w-6xl">
      {viewable.length > 0 && <ViewerBody key={file.$id} files={viewable} startIndex={startIndex} />}
    </DialogContent>
  </Dialog>;
}
