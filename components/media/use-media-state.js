"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const SYNC_EVENTS = [
  "play",
  "pause",
  "timeupdate",
  "durationchange",
  "loadedmetadata",
  "volumechange",
  "ended",
];

const INITIAL_SNAPSHOT = { playing: false, time: 0, duration: 0, volume: 1, muted: false };

function readElement(el) {
  return {
    playing: !el.paused && !el.ended,
    time: el.currentTime || 0,
    duration: Number.isFinite(el.duration) ? el.duration : 0,
    volume: el.volume,
    muted: el.muted,
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Estado y acciones de un <video> o <audio> a partir de su ref.
 * Devuelve { playing, time, duration, volume, muted, error,
 *            toggle, seek, skip, setVolume, toggleMute }.
 */
export function useMediaState(ref) {
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const sync = () => setSnapshot(readElement(el));
    const fail = () => setError(true);
    const reset = () => setError(false);

    SYNC_EVENTS.forEach((name) => el.addEventListener(name, sync));
    el.addEventListener("error", fail);
    el.addEventListener("loadstart", reset);

    // Por si el elemento ya cargó metadatos antes de suscribirnos.
    const frame = requestAnimationFrame(sync);

    return () => {
      cancelAnimationFrame(frame);
      SYNC_EVENTS.forEach((name) => el.removeEventListener(name, sync));
      el.removeEventListener("error", fail);
      el.removeEventListener("loadstart", reset);
    };
  }, [ref]);

  const toggle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      el.play()?.catch(() => undefined);
    } else {
      el.pause();
    }
  }, [ref]);

  const seek = useCallback(
    (seconds) => {
      const el = ref.current;
      if (!el || !Number.isFinite(seconds)) return;
      const max = Number.isFinite(el.duration) ? el.duration : seconds;
      const next = clamp(seconds, 0, max);
      el.currentTime = next;
      setSnapshot((prev) => ({ ...prev, time: next }));
    },
    [ref],
  );

  const skip = useCallback(
    (delta) => {
      const el = ref.current;
      if (el) seek(el.currentTime + delta);
    },
    [ref, seek],
  );

  const setVolume = useCallback(
    (level) => {
      const el = ref.current;
      if (!el || !Number.isFinite(level)) return;
      el.volume = clamp(level, 0, 1);
      el.muted = level <= 0;
    },
    [ref],
  );

  const toggleMute = useCallback(() => {
    const el = ref.current;
    if (el) el.muted = !el.muted;
  }, [ref]);

  return { ...snapshot, error, toggle, seek, skip, setVolume, toggleMute };
}

/**
 * Comportamiento común de los reproductores: pausa cuando `active` es false
 * y avisa una vez a `onError` cuando el elemento falla.
 */
export function useMediaLifecycle(ref, { error, active, onError }) {
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    if (!active) ref.current?.pause();
  }, [active, ref]);

  useEffect(() => {
    if (error) onErrorRef.current?.();
  }, [error]);
}
