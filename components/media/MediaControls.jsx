"use client";

import { Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { formatTime } from "@/lib/files";

function PlayButton({ playing, onToggle }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={playing ? "Pausar" : "Reproducir"}
      onClick={onToggle}
    >
      {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
    </Button>
  );
}

function SeekBar({ time, duration, onSeek }) {
  return (
    <Slider
      aria-label="Posición"
      className="min-w-0 flex-1"
      min={0}
      max={duration || 0}
      step={0.1}
      value={[Math.min(time, duration || 0)]}
      disabled={!duration}
      onValueChange={([next]) => onSeek(next)}
    />
  );
}

function VolumeControl({ muted, volume, onToggleMute, onVolume }) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={muted ? "Activar sonido" : "Silenciar"}
        onClick={onToggleMute}
      >
        {muted ? <VolumeX aria-hidden="true" /> : <Volume2 aria-hidden="true" />}
      </Button>
      <Slider
        aria-label="Volumen"
        className="hidden w-20 sm:flex"
        min={0}
        max={1}
        step={0.05}
        value={[muted ? 0 : volume]}
        onValueChange={([next]) => onVolume(next)}
      />
    </>
  );
}

/** Barra de controles presentacional; `state` viene de useMediaState. */
export function MediaControls({ state, onFullscreen = null, className = "" }) {
  const base = "flex items-center gap-2 bg-background/80 px-3 py-2 text-foreground backdrop-blur";
  return (
    <div className={className ? `${base} ${className}` : base}>
      <PlayButton playing={state.playing} onToggle={state.toggle} />
      <SeekBar time={state.time} duration={state.duration} onSeek={state.seek} />
      <span className="shrink-0 text-xs tabular-nums text-foreground">
        {formatTime(state.time)} / {formatTime(state.duration)}
      </span>
      <VolumeControl
        muted={state.muted}
        volume={state.volume}
        onToggleMute={state.toggleMute}
        onVolume={state.setVolume}
      />
      {onFullscreen ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Pantalla completa"
          onClick={onFullscreen}
        >
          <Maximize aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}

export default MediaControls;
