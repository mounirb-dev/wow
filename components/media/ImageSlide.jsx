"use client";

import { useState } from "react";
import { RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { TransformComponent, TransformWrapper, useControls } from "react-zoom-pan-pinch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

// Botones de zoom sobre la imagen. Van dentro del TransformWrapper porque usan su contexto.
function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();
  return <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border bg-background/85 p-1 shadow-sm backdrop-blur" role="group" aria-label="Zoom">
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => zoomOut()} aria-label="Alejar"><ZoomOut /></Button>
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => resetTransform()} aria-label="Restablecer zoom"><RotateCcw /></Button>
    <Button type="button" variant="ghost" size="icon-sm" onClick={() => zoomIn()} aria-label="Acercar"><ZoomIn /></Button>
  </div>;
}

// Foto con zoom (rueda, pellizco, doble clic y botones) y desplazamiento al arrastrar. Mientras carga muestra un
// esqueleto; si falla avisa con `onError` (el visor enseña entonces una explicación y la descarga).
// `onZoomChange(true)` se llama al acercar: el visor desactiva entonces el deslizamiento entre archivos para
// que arrastrar mueva la foto y no cambie de archivo.
export default function ImageSlide({ src, name, onError, onZoomChange }) {
  const [loaded, setLoaded] = useState(false);
  return <div className="relative size-full">
    {!loaded && <Skeleton className="absolute inset-4 rounded-lg" />}
    <TransformWrapper
      minScale={1}
      maxScale={6}
      doubleClick={{ mode: "toggle", step: 2.5 }}
      onTransform={(_ref, state) => onZoomChange?.(state.scale > 1.01)}
    >
      <ZoomControls />
      <TransformComponent wrapperClass="!size-full" contentClass="!size-full !items-center !justify-center">
        <img
          src={src}
          alt={name}
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={onError}
          className={`size-full object-contain transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      </TransformComponent>
    </TransformWrapper>
  </div>;
}
