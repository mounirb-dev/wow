"use client";

import { useRef } from "react";
import { Play } from "lucide-react";
import { MediaControls } from "@/components/media/MediaControls";
import { useMediaLifecycle, useMediaState } from "@/components/media/use-media-state";

// Segundos que saltan las flechas ← / → del teclado.
const SEEK_STEP_SECONDS = 5;

// Entra o sale de pantalla completa sobre el contenedor (no sobre el <video>) para que los
// controles propios sigan visibles. Los rechazos del navegador (p. ej. sin gesto del usuario) se ignoran.
function toggleFullscreen(container) {
  if (document.fullscreenElement) {
    document.exitFullscreen?.()?.catch(() => undefined);
  } else {
    container?.requestFullscreen?.()?.catch(() => undefined);
  }
}

// Zona del vídeo: el <video> con una capa transparente encima que hace de botón reproducir/pausar,
// el icono de play cuando está parado y un mensaje accesible (role="alert") si el archivo no carga.
function VideoStage({ videoRef, src, state }) {
  return (
    <div className="relative min-h-0 flex-1">
      <video
        ref={videoRef}
        src={src}
        preload="metadata"
        playsInline
        className="max-h-[calc(100dvh-18.5rem)] w-full [:fullscreen_&]:h-full [:fullscreen_&]:max-h-full"
      >
        <track kind="captions" />
      </video>
      {state.error ? (
        <p role="alert" className="absolute inset-0 flex items-center justify-center p-4 text-center text-sm text-white">
          No se puede reproducir este vídeo.
        </p>
      ) : (
        <>
          <button
            type="button"
            aria-label="Reproducir/Pausar"
            onClick={state.toggle}
            className="absolute inset-0 h-full w-full cursor-pointer bg-transparent"
          />
          {state.playing ? null : (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-black/60 text-white">
                <Play aria-hidden="true" className="size-8" />
              </span>
            </span>
          )}
        </>
      )}
    </div>
  );
}

// Reproductor de vídeo del visor de archivos. `active` indica si es la diapositiva visible: al dejar
// de serlo el vídeo se pausa (useMediaLifecycle). `onError` avisa al visor de que el archivo no se puede
// reproducir. Atajos con el contenedor enfocado: espacio/k reproduce, ←/→ salta 5 s, f pantalla completa.
export default function VideoPlayer({ src, name, active = true, onError }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const state = useMediaState(videoRef);
  useMediaLifecycle(videoRef, { error: state.error, active, onError });

  const fullscreen = () => toggleFullscreen(containerRef.current);

  const handleKeyDown = (event) => {
    // Solo con el contenedor enfocado (no con el foco en un control hijo, que ya gestiona sus teclas) y
    // sin modificadores, para no pisar atajos del navegador como Ctrl+F.
    if (event.target !== event.currentTarget) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const actions = new Map([
      [" ", state.toggle],
      ["k", state.toggle],
      ["arrowleft", () => state.skip(-SEEK_STEP_SECONDS)],
      ["arrowright", () => state.skip(SEEK_STEP_SECONDS)],
      ["f", fullscreen],
    ]);
    const run = actions.get(event.key.toLowerCase());
    if (!run) return;
    event.preventDefault();
    run();
  };

  return (
    <div
      ref={containerRef}
      role="group"
      aria-label={`Reproductor de vídeo: ${name}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="relative flex flex-col overflow-hidden rounded-lg bg-black"
    >
      <VideoStage videoRef={videoRef} src={src} state={state} />
      {state.error ? null : (
        <MediaControls state={state} onFullscreen={fullscreen} className="border-t" />
      )}
    </div>
  );
}
