"use client";;
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { animate, m, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

const GLOW = { duration: 0.5, ease: [0.22, 1, 0.36, 1] };
const ICON = { type: "spring", duration: 0.34, bounce: 0.2 };
const TAP = { type: "spring", duration: 0.25, bounce: 0.3 };
const INSTANT = { duration: 0 };

const PLAYING_GLOW = 0.62;

const SPEEDS = [1, 1.5, 2];

// all proportional to the bar height, so every size keeps the same look
const CONTROL_RATIO = 0.76;
const ICON_RATIO = 0.72;
const BLUR_RATIO = 0.32;
const PEAK_RATIO = 0.68;

const PULSE_SPEED = 0.6;

// seconds for the orbit to reach full speed, and to coast back down
const SPIN_UP = 0.45;

const MIDDLE_MASK =
  "linear-gradient(to bottom, #000 0%, rgba(0,0,0,0.3) 46%, rgba(0,0,0,0.3) 54%, #000 100%)";

// each light is centred on the outline, so the clip keeps only its inner half
const BLOBS = [
  { size: 2, alpha: 0.5, lap: 11, offset: 0.04, pulse: 0.12 },
  { size: 1.5, alpha: 0.4, lap: 17, offset: 0.19, pulse: 0.14 },
  { size: 2.3, alpha: 0.45, lap: 23, offset: 0.47, pulse: 0.1 },
  { size: 1.2, alpha: 0.35, lap: 13, offset: 0.71, pulse: 0.16 }
];

// the laps only pull the lights apart over time, so the clock starts mid flow rather than lined up
const START_AT = 6.2;

// walks the outline of a pill: top edge, right cap, bottom edge, left cap
const pointOnPill = (distance, width, height) => {
  const radius = height / 2;
  const straight = Math.max(0, width - height);
  const arc = Math.PI * radius;
  const perimeter = 2 * straight + 2 * arc;

  let d = distance % perimeter;
  if (d < 0) d += perimeter;

  if (d < straight) return [radius + d, 0];
  d -= straight;
  if (d < arc) {
    const a = -Math.PI / 2 + d / radius;
    return [
      width - radius + radius * Math.cos(a),
      radius + radius * Math.sin(a),
    ];
  }
  d -= arc;
  if (d < straight) return [width - radius - d, height];
  d -= straight;
  const a = Math.PI / 2 + d / radius;
  return [radius + radius * Math.cos(a), radius + radius * Math.sin(a)];
};

// the triangle is split down the middle, giving it the same two four-point quads as the bars
const PLAY_SHAPE = [
  7.7, 5.8, 13, 8.9, 13, 15.1, 7.7, 18.2, 13, 8.9, 18.3, 12, 18.3, 12, 13, 15.1,
];
const PAUSE_SHAPE = [
  8.2, 6.8, 10.9, 6.8, 10.9, 17.2, 8.2, 17.2, 13.1, 6.8, 15.8, 6.8, 15.8, 17.2,
  13.1, 17.2,
];

const toPath = (shape) => {
  let d = "";
  for (let quad = 0; quad < shape.length; quad += 8) {
    d += `M${shape[quad]} ${shape[quad + 1]}`;
    for (let point = 2; point < 8; point += 2) {
      d += ` L${shape[quad + point]} ${shape[quad + point + 1]}`;
    }
    d += " Z";
  }
  return d;
};

const morph = (from, to, t) =>
  toPath(from.map((value, i) => value + (to[i] - value) * t));

const PLAY_PATH = toPath(PLAY_SHAPE);
const PAUSE_PATH = toPath(PAUSE_SHAPE);

// stroke rounds the corners the path leaves sharp
const ICON_PAINT = {
  fill: "currentColor",
  stroke: "currentColor",
  strokeWidth: 1.2,
  strokeLinejoin: "round",
  strokeLinecap: "round"
};

const SIZES = {
  sm: { height: 40, gap: 8, bar: 2, barGap: 2, pad: 12, text: "text-[11px]" },
  md: { height: 52, gap: 10, bar: 3, barGap: 3, pad: 14, text: "text-xs" },
  lg: { height: 64, gap: 12, bar: 3, barGap: 4, pad: 16, text: "text-sm" }
};

const SEEK_STEP = 5;
const MIN_AMPLITUDE = 0.14;

const clamp = (value, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

const formatTime = (seconds) => {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

// sin and ** are not bit identical across engines, so the result is rounded to survive hydration
const buildWaveform = (count, seed) => {
  let state = (seed >>> 0) + 0x9e3779b9;
  return Array.from({ length: count }, (_, i) => {
    state = (state * 1664525 + 1013904223) >>> 0;
    const noise = state / 0x100000000;
    const envelope = Math.sin((Math.PI * (i + 0.5)) / count) ** 0.55;
    const swell = 0.5 + 0.5 * Math.sin(i * 0.9 + seed);
    const amplitude = envelope * (0.3 + 0.5 * noise + 0.2 * swell);
    return Math.round(clamp(amplitude, MIN_AMPLITUDE, 1) * 1000) / 1000;
  });
};

const VoiceNoteGroupContext = createContext(null);

// keeps the map out of state, so claiming a turn never re-renders the other notes
function VoiceNoteGroup({
  children
}) {
  const notes = useRef(new Map());

  const claim = useCallback((id, pause) => {
    notes.current.set(id, pause);
    notes.current.forEach((stop, other) => other !== id && stop());
  }, []);

  const value = useMemo(() => ({ claim }), [claim]);

  return (
    <VoiceNoteGroupContext.Provider value={value}>
      {children}
    </VoiceNoteGroupContext.Provider>
  );
}

// the clip, the frame loop and the audio element all live here, so the component only has to lay things out
function usePlayback({
  src,
  duration,
  speeds,
  playing,
  defaultPlaying,
  onPlayingChange,
  onEnded,
  onSpeedChange
}) {
  const audioRef = useRef(null);
  // performance.now() baseline for the clip that has no audio file behind it
  const startedAt = useRef(0);

  const [metaDuration, setMetaDuration] = useState(null);
  const [playingState, setPlayingState] = useState(defaultPlaying);
  const [elapsed, setElapsed] = useState(0);
  const [failed, setFailed] = useState(false);
  const [speed, setSpeed] = useState(speeds[0] ?? 1);

  const id = useId();
  const group = useContext(VoiceNoteGroupContext);

  // a file has to report its length before the bar can be trusted, or pressed
  const loading = !!src && metaDuration === null && !failed;

  const total = metaDuration ?? duration;
  const isControlled = playing !== undefined;
  const isPlaying = isControlled ? playing : playingState;

  const progress = useMotionValue(0);

  // a new callback identity would otherwise restart the running clip
  const callbacks = useRef({ onEnded, onPlayingChange });
  useEffect(() => {
    callbacks.current = { onEnded, onPlayingChange };
  }, [onEnded, onPlayingChange]);

  const commitPlaying = useCallback(
    (next) => {
      if (!isControlled) setPlayingState(next);
      callbacks.current.onPlayingChange?.(next);
    },
    [isControlled],
  );

  const seekTo = useCallback(
    (ratio) => {
      const next = clamp(ratio);
      progress.set(next);
      setElapsed(Math.floor(next * total));
      startedAt.current = performance.now() - (next * total * 1000) / speed;
      const audio = audioRef.current;
      if (audio && Number.isFinite(total)) audio.currentTime = next * total;
    },
    [progress, total, speed],
  );

  const reset = useCallback(() => {
    // the frame loop and the audio element can both report the end of the same clip
    if (progress.get() === 0) return;
    progress.set(0);
    setElapsed(0);
    const audio = audioRef.current;
    if (audio) audio.currentTime = 0;
    commitPlaying(false);
    callbacks.current.onEnded?.();
  }, [progress, commitPlaying]);

  const pause = useEffectEvent(() => commitPlaying(false));
  const finish = useEffectEvent(() => reset());

  useEffect(() => {
    if (!isPlaying || total <= 0) return;

    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
    audio?.play().catch(pause);
    startedAt.current =
      performance.now() - (progress.get() * total * 1000) / speed;

    let frame = 0;
    const tick = (now) => {
      const seconds = audio
        ? audio.currentTime
        : ((now - startedAt.current) / 1000) * speed;
      const ratio = clamp(seconds / total);
      progress.set(ratio);
      // whole seconds only, so the label is the one thing that re-renders
      setElapsed(Math.floor(seconds));
      if (ratio < 1) {
        frame = requestAnimationFrame(tick);
        return;
      }
      finish();
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      audio?.pause();
    };
  }, [isPlaying, total, speed, progress]);

  const toggle = () => {
    if (isPlaying) {
      commitPlaying(false);
      return;
    }
    commitPlaying(true);
    // taking a turn stops whatever else is playing in the same group
    group?.claim(id, () => commitPlaying(false));
  };

  const cycleSpeed = () => {
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    onSpeedChange?.(next);
    const audio = audioRef.current;
    if (audio) audio.playbackRate = next;
  };

  return {
    audioRef,
    progress,
    elapsed,
    total,
    speed,
    isPlaying,
    loading,
    failed,
    seekTo,
    reset,
    toggle,
    cycleSpeed,
    onLoaded: (length) => setMetaDuration(Number.isFinite(length) ? length : duration),
    onFailed: () => setFailed(true),
  };
}

function Control({
  size,
  iconSize,
  playing,
  blocked,
  reduced,
  onToggle
}) {
  return (
    <m.button
      data-slot="voice-note-control"
      type="button"
      onClick={onToggle}
      disabled={blocked}
      aria-label={playing ? "Pausar audio" : "Reproducir audio"}
      whileTap={reduced || blocked ? undefined : { scale: 0.9 }}
      transition={reduced ? INSTANT : TAP}
      style={{ width: size, height: size }}
      className="z-10 flex shrink-0 cursor-pointer touch-manipulation items-center justify-center rounded-full bg-white text-black outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#868593] disabled:cursor-default disabled:opacity-40 dark:bg-[#0E0E0E] dark:text-white"
    >
      <TransportIcon playing={playing} size={iconSize} reduced={reduced} />
    </m.button>
  );
}

// the waveform, which is also the seek bar
function Track({
  amplitudes,
  metrics,
  progress,
  total,
  elapsed,
  seekable,
  blocked,
  onSeek
}) {
  const trackRef = useRef(null);
  const scrubbing = useRef(false);
  const clipPath = useTransform(
    progress,
    (p) => `inset(0 ${(1 - p) * 100}% 0 0)`,
  );

  const scrub = (event) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect?.width) onSeek((event.clientX - rect.left) / rect.width);
  };

  const handlePointerDown = (event) => {
    if (!seekable || blocked) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    scrubbing.current = true;
    scrub(event);
  };

  const handleKeyDown = (event) => {
    if (!seekable || blocked || total <= 0) return;
    const at = progress.get() * total;
    const to = {
      ArrowLeft: at - SEEK_STEP,
      ArrowRight: at + SEEK_STEP,
      Home: 0,
      End: total,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    onSeek(to / total);
  };

  const slider = seekable
    ? {
        role: "slider",
        tabIndex: 0,
        "aria-label": "Posición",
        "aria-valuemin": 0,
        "aria-valuemax": Math.round(total),
        "aria-valuenow": elapsed,
        "aria-valuetext": `${formatTime(elapsed)} de ${formatTime(total)}`,
      }
    : undefined;

  return (
    <div
      ref={trackRef}
      data-slot="voice-note-track"
      {...slider}
      onPointerDown={handlePointerDown}
      onPointerMove={(event) => scrubbing.current && scrub(event)}
      onPointerUp={() => (scrubbing.current = false)}
      onPointerCancel={() => (scrubbing.current = false)}
      onKeyDown={handleKeyDown}
      className={cn(
        "relative h-full flex-1 touch-none rounded-sm outline-none transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#868593]",
        seekable && !blocked && "cursor-pointer",
        blocked && "opacity-40",
      )}
    >
      <Bars
        amplitudes={amplitudes}
        metrics={metrics}
        className="bg-black/30 dark:bg-white/40"
      />
      <m.div
        aria-hidden
        className="absolute inset-0"
        style={{ clipPath }}
      >
        <Bars
          amplitudes={amplitudes}
          metrics={metrics}
          className="bg-black dark:bg-white"
        />
      </m.div>
    </div>
  );
}

function VoiceNote({
  src,
  duration = 53,
  waveform,
  bars = 40,
  seed = 7,
  playing,
  defaultPlaying = false,
  onPlayingChange,
  onEnded,
  onError,
  accent = "#FC4C01",
  size = "md",
  seekable = true,
  speeds = SPEEDS,
  onSpeedChange,
  className,
  style,
  ...props
}) {
  const metrics = SIZES[size];
  const control = Math.round(metrics.height * CONTROL_RATIO);
  // the control sits as far from the left edge as it does from the top and bottom
  const inset = Math.round((metrics.height - control) / 2);
  const reduced = !!useReducedMotion();

  const amplitudes = useMemo(
    () => waveform ?? buildWaveform(Math.max(1, bars), seed),
    [waveform, bars, seed],
  );

  const player = usePlayback({
    src,
    duration,
    speeds,
    playing,
    defaultPlaying,
    onPlayingChange,
    onEnded,
    onSpeedChange,
  });
  const { isPlaying, loading, failed } = player;
  const blocked = loading || failed;

  return (
    <div
      data-slot="voice-note"
      data-playing={isPlaying || undefined}
      data-loading={loading || undefined}
      data-error={failed || undefined}
      className={cn(
        "relative isolate inline-flex select-none items-center",
        className,
      )}
      style={{
        height: metrics.height,
        gap: metrics.gap,
        paddingLeft: inset,
        paddingRight: metrics.pad,
        ...style,
      }}
      {...props}
    >
      <div className="absolute inset-0 -z-10 rounded-full bg-[#F4F4F9] dark:bg-[#1C1C1C]" />
      <Aurora
        accent={accent}
        height={metrics.height}
        glow={isPlaying ? PLAYING_GLOW : 0}
        playing={isPlaying}
        reduced={reduced}
      />

      <Control
        size={control}
        iconSize={Math.round(control * ICON_RATIO)}
        playing={isPlaying}
        blocked={blocked}
        reduced={reduced}
        onToggle={player.toggle}
      />

      <Track
        amplitudes={amplitudes}
        metrics={metrics}
        progress={player.progress}
        total={player.total}
        elapsed={player.elapsed}
        seekable={seekable}
        blocked={blocked}
        onSeek={player.seekTo}
      />

      <TimeLabel
        speed={player.speed}
        text={metrics.text}
        onCycle={speeds.length > 1 ? player.cycleSpeed : undefined}
      >
        {formatTime(player.total - player.elapsed)}
      </TimeLabel>

      {src && (
        <audio
          ref={player.audioRef}
          className="hidden"
          src={src}
          preload="metadata"
          onLoadedMetadata={(event) => player.onLoaded(event.currentTarget.duration)}
          onError={() => {
            player.onFailed();
            onError?.();
          }}
          // a file can stop just short of its own duration, so the frame loop may never reach the end
          onEnded={player.reset}
        />
      )}
    </div>
  );
}

function Aurora({
  accent,
  height,
  glow,
  playing,
  reduced
}) {
  // lap time, advanced only while the clip runs, so pausing leaves every light where it is
  const clock = useRef(START_AT);
  const rate = useRef(0);
  const fieldRef = useRef(null);
  const nodes = useRef([]);
  const width = useRef(0);

  // an effect event: it always reads the latest height without restarting the loop that calls it
  const place = useEffectEvent((t) => {
    if (width.current === 0) return;
    const perimeter =
      2 * Math.max(0, width.current - height) + Math.PI * height;

    BLOBS.forEach((blob, i) => {
      const node = nodes.current[i];
      if (!node) return;
      const travelled = blob.offset + t / blob.lap;
      const [x, y] = pointOnPill(
        travelled * perimeter,
        width.current,
        height,
      );
      const phase = blob.offset * Math.PI * 2;
      const scale = 1 + Math.sin(t * PULSE_SPEED + phase) * blob.pulse;
      node.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    });
  });

  useEffect(() => {
    const node = fieldRef.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => {
      width.current = entry.contentRect.width;
      // place them at once, so a resize or a reduced motion viewer never sees them stacked
      place(clock.current);
    });
    observer.observe(node);
    return () => observer.disconnect();
    // observing again on a new height places the lights again
  }, [height]);

  useEffect(() => {
    if (reduced) return;

    let frame = 0;
    let last = performance.now();
    const loop = (now) => {
      // a long frame gap, from a background tab, must not throw the lights across the bar
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;

      const target = playing ? 1 : 0;
      rate.current +=
        (target - rate.current) * (1 - Math.exp(-delta / SPIN_UP));
      clock.current += delta * rate.current;
      place(clock.current);

      if (playing || rate.current > 0.002) {
        frame = requestAnimationFrame(loop);
        return;
      }
      rate.current = 0;
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, reduced]);

  return (
    <div
      data-slot="voice-note-glow"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-full mix-blend-multiply dark:mix-blend-screen"
    >
      <m.div
        ref={fieldRef}
        aria-hidden
        className="absolute inset-0"
        style={{
          filter: `blur(${height * BLUR_RATIO}px)`,
          maskImage: MIDDLE_MASK,
          WebkitMaskImage: MIDDLE_MASK,
        }}
        // without this the field paints at full strength for a frame before the first animation
        initial={false}
        animate={{ opacity: glow }}
        transition={reduced ? INSTANT : GLOW}
      >
        <span
          className="absolute inset-0"
          style={{
            background: `radial-gradient(70% 170% at 8% 115%, ${accent} 0%, transparent 62%), radial-gradient(55% 150% at 40% 130%, ${accent} 0%, transparent 58%)`,
          }}
        />
        {BLOBS.map((blob, i) => (
          <span
            key={i}
            ref={(node) => {
              nodes.current[i] = node;
            }}
            className="absolute left-0 top-0 rounded-full"
            style={{
              width: blob.size * height,
              height: blob.size * height,
              marginLeft: (-blob.size * height) / 2,
              marginTop: (-blob.size * height) / 2,
              background: accent,
              opacity: blob.alpha,
            }}
          />
        ))}
      </m.div>
    </div>
  );
}

function TransportIcon({
  playing,
  size,
  reduced
}) {
  const shape = useMotionValue(playing ? PAUSE_PATH : PLAY_PATH);
  const previous = useRef(playing);

  useEffect(() => {
    if (previous.current === playing) return;
    previous.current = playing;
    shape.set(playing ? PAUSE_PATH : PLAY_PATH);
    if (reduced) return;

    const from = playing ? PLAY_SHAPE : PAUSE_SHAPE;
    const to = playing ? PAUSE_SHAPE : PLAY_SHAPE;
    const controls = animate(0, 1, {
      ...ICON,
      onUpdate: (t) => shape.set(morph(from, to, clamp(t))),
      // the spring can overshoot, so land on the exact path
      onComplete: () => shape.set(playing ? PAUSE_PATH : PLAY_PATH),
    });
    return () => controls.stop();
  }, [playing, reduced, shape]);

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
    >
      <m.path d={shape} {...ICON_PAINT} />
    </svg>
  );
}

function TimeLabel({
  speed,
  text,
  onCycle,
  children
}) {
  const className = cn(
    "flex shrink-0 items-center gap-1 font-semibold tabular-nums text-[#868593]",
    text,
  );

  if (!onCycle) {
    return (
      <span data-slot="voice-note-time" className={className}>
        {children}
      </span>
    );
  }

  return (
    <button
      data-slot="voice-note-time"
      type="button"
      onClick={onCycle}
      aria-label={`Velocidad de reproducción ${speed}×. Pulsa para cambiarla`}
      className={cn(
        className,
        "cursor-pointer rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#868593]",
      )}
    >
      {children}
      {speed !== 1 && (
        <span className="rounded-full bg-black/10 px-1 py-px text-[0.85em] leading-none text-black/70 dark:bg-white/15 dark:text-white/80">
          {speed}×
        </span>
      )}
    </button>
  );
}

const Bars = memo(function Bars({
  amplitudes,
  metrics,
  className
}) {
  return (
    <div
      className="flex h-full w-full items-center"
      style={{ gap: metrics.barGap }}
    >
      {amplitudes.map((amplitude, i) => (
        <span
          key={i}
          className={cn("flex-1 rounded-full", className)}
          style={{
            minWidth: metrics.bar,
            height: `${(amplitude * PEAK_RATIO * 100).toFixed(2)}%`,
          }}
        />
      ))}
    </div>
  );
});

export { VoiceNote, VoiceNoteGroup };
export default VoiceNote;
