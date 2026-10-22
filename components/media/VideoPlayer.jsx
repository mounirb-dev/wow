"use client";

import { useRef } from "react";
import { Play } from "lucide-react";
import { MediaControls } from "@/components/media/MediaControls";
import { useMediaLifecycle, useMediaState } from "@/components/media/use-media-state";

const SEEK_STEP_SECONDS = 5;

function toggleFullscreen(container) {
  if (document.fullscreenElement) {
    document.exitFullscreen?.()?.catch(() => undefined);
  } else {
    container?.requestFullscreen?.()?.catch(() => undefined);
  }
}

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

export default function VideoPlayer({ src, name, active = true, onError }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const state = useMediaState(videoRef);
  useMediaLifecycle(videoRef, { error: state.error, active, onError });

  const fullscreen = () => toggleFullscreen(containerRef.current);

  const handleKeyDown = (event) => {
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
