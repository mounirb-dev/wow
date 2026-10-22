"use client";

import { useState } from "react";
import { VoiceNote } from "@/components/ui/voice-note";

// La onda es decorativa (no se analiza el audio): sale del nombre del archivo para que cada audio tenga la suya
// y siempre la misma.
const seedOf = (name) => Array.from(name).reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 9973, 7);

// Audio del visor con el reproductor `voice-note`. Si el audio no carga avisa con `onError` (el visor enseña
// entonces la explicación y la descarga). Al salir de su diapositiva se pausa.
export default function AudioSlide({ src, name, active, onError }) {
  const [playing, setPlaying] = useState(false);
  if (!active && playing) setPlaying(false);
  return <VoiceNote src={src} seed={seedOf(name)} size="lg" playing={playing} onPlayingChange={setPlaying} onError={onError} aria-label={`Audio ${name}`} className="w-full" />;
}
