"use client";

import { useRef } from "react";
import { Music } from "lucide-react";
import { MediaControls } from "@/components/media/MediaControls";
import { useMediaLifecycle, useMediaState } from "@/components/media/use-media-state";

export default function AudioPlayer({ src, name, active = true, onError }) {
  const audioRef = useRef(null);
  const state = useMediaState(audioRef);
  useMediaLifecycle(audioRef, { error: state.error, active, onError });

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex items-center gap-3">
        <Music aria-hidden="true" className="size-10 shrink-0 text-muted-foreground" />
        <p className="min-w-0 truncate font-medium" title={name}>
          {name}
        </p>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" className="hidden">
        <track kind="captions" />
      </audio>
      {state.error ? (
        <p role="alert" className="text-sm text-muted-foreground">
          No se puede reproducir este audio.
        </p>
      ) : (
        <MediaControls state={state} className="rounded-md border" />
      )}
    </div>
  );
}
