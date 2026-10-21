"use client";

import { LazyMotion } from "motion/react";

// Carga el motor de animación de forma diferida (≈30 kB menos en la carga inicial). Los
// componentes usan `m.*` en vez de `motion.*`, que solo funcionan dentro de este proveedor.
const loadFeatures = () => import("./motion-features.js").then((module) => module.default);

export default function MotionProvider({ children }) {
  return <LazyMotion features={loadFeatures}>{children}</LazyMotion>;
}
