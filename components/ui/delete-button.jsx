"use client";;
import { useEffect, useRef, useState } from "react";
import {
  animate,
  AnimatePresence,
  m,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

const HINGE = "3px 6px";
const LID_OPEN = -35;
const WALL_TOP = 6;
const WALL_TOP_OPEN = 13.5;
const WALL_BASE = 20;

const TILE = 48;
const PANEL = 84;
const HOLD = { deleted: 1400, kept: 600 };

const EASE = [0.32, 0.72, 0, 1];
const EASE_LID = [0.34, 1.1, 0.64, 1];

const WIDTH = {
  duration: 0.62,
  ease: EASE
};
const LID = {
  duration: 0.6,
  ease: EASE_LID
};
const WALL = {
  duration: 0.56,
  ease: EASE
};
const IN = {
  duration: 0.44,
  ease: EASE,
  delay: 0.14
};
const OUT = {
  duration: 0.3,
  ease: EASE
};
const TAP = {
  duration: 0.2,
  ease: EASE
};
const SWAP = {
  duration: 0.22,
  ease: EASE
};
const SETTLE = {
  duration: 0.45,
  ease: EASE
};
const PRESS = {
  type: "spring",
  stiffness: 520,
  damping: 18,
  mass: 0.5
};
const INSTANT = {
  duration: 0
};

const SURFACE = "bg-[#F4F4F9] dark:bg-[#262626]";
const RECESS = "bg-[#E7E7EF] dark:bg-[#1B1B1B]";
const GLYPH = "text-[#868593] dark:text-[#9B9AA7]";
const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-[#868593]";
const ACCENT = "#FF5F2E";

const LIFT =
  "shadow-[0_0.5px_1px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.08),inset_0_0.5px_0_rgba(255,255,255,0.9)] dark:shadow-[0_0.5px_1px_rgba(0,0,0,0.35),0_1.5px_4px_rgba(0,0,0,0.25),inset_0_0.5px_0_rgba(255,255,255,0.07)]";

const CIRCLE = `grid h-7 w-7 place-items-center rounded-full transition-colors duration-200 hover:bg-[#FAFAFD] dark:hover:bg-[#2C2C2C] ${FOCUS} ${SURFACE} ${LIFT}`;

const ICON = {
  viewBox: "0 0 24 24",
  fill: "none",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true
};

const panelMotion = {
  hidden: { opacity: 0, x: -6, transition: OUT },
  shown: { opacity: 1, x: 0, transition: { ...IN, staggerChildren: 0.07 } },
};

const circleMotion = {
  hidden: { opacity: 0, scale: 0.9, transition: OUT },
  shown: { opacity: 1, scale: 1, transition: IN },
};

function Circle({
  label,
  onClick,
  children
}) {
  const reduced = useReducedMotion() ?? false;

  return (
    <m.div className="flex" variants={reduced ? undefined : circleMotion}>
      <m.button
        type="button"
        aria-label={label}
        onClick={onClick}
        whileHover={reduced ? undefined : { scale: 1.03 }}
        whileTap={reduced ? undefined : { scale: 0.84 }}
        transition={PRESS}
        className={CIRCLE}
      >
        <svg
          {...ICON}
          width="14"
          height="14"
          stroke="currentColor"
          strokeWidth="3.5"
        >
          {children}
        </svg>
      </m.button>
    </m.div>
  );
}

// the bin draws itself from one value: the walls drop as the lid opens
function useBin(open, reduced) {
  const top = useMotionValue(WALL_TOP);
  const wall = useTransform(top, (y) => WALL_BASE - y);
  const path = useMotionTemplate`M19 ${top}v${wall}a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V${top}`;
  const settle = useMotionValue(1);

  useEffect(() => {
    const walls = animate(
      top,
      open ? WALL_TOP_OPEN : WALL_TOP,
      reduced ? INSTANT : WALL,
    );
    return () => walls.stop();
  }, [open, reduced, top]);

  return { path, settle };
}

// the width is a motion value rather than an animate prop, so it is driven from one place
function useTileWidth(open, reduced) {
  const width = useMotionValue(TILE);

  useEffect(() => {
    const grow = animate(width, open ? TILE + PANEL : TILE, reduced ? INSTANT : WIDTH);
    return () => grow.stop();
  }, [open, reduced, width]);

  return width;
}

// "deleted" and "kept" are shown briefly and then go back to "idle"
function useStatus(reduced, settle) {
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    if (status !== "deleted" && status !== "kept") return;
    const nudge =
      status === "kept" && !reduced
        ? animate(settle, [1, 0.86, 1], SETTLE)
        : null;
    const done = setTimeout(() => setStatus("idle"), HOLD[status]);
    return () => {
      nudge?.stop();
      clearTimeout(done);
    };
  }, [status, reduced, settle]);

  return [status, setStatus];
}

function Done({ reduced }) {
  return (
    <m.svg
      key="done"
      {...ICON}
      width="20"
      height="20"
      stroke={ACCENT}
      strokeWidth="2.5"
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.6 }}
      transition={reduced ? INSTANT : SWAP}
    >
      <m.path
        d="M4 12.5 9.5 18 20 7"
        initial={reduced ? undefined : { pathLength: 0 }}
        animate={reduced ? undefined : { pathLength: 1 }}
        transition={SETTLE}
      />
    </m.svg>
  );
}

function Bin({ path, settle, open, reduced }) {
  return (
    <m.svg
      key="bin"
      {...ICON}
      width="20"
      height="20"
      stroke="currentColor"
      strokeWidth="2"
      className="overflow-visible"
      style={{ scale: settle }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={reduced ? INSTANT : SWAP}
    >
      <m.path d={path} />
      <m.g
        style={{ transformBox: "view-box", transformOrigin: HINGE }}
        animate={{ rotate: open ? LID_OPEN : 0 }}
        transition={reduced ? INSTANT : LID}
      >
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </m.g>
    </m.svg>
  );
}

function Confirm({ reduced, onConfirm, onCancel }) {
  return (
    <m.div
      key="panel"
      style={{ width: PANEL }}
      className={cn(
        "absolute inset-y-0 right-0 flex items-center justify-center gap-2 rounded-2xl",
        RECESS,
      )}
      variants={reduced ? undefined : panelMotion}
      initial="hidden"
      animate="shown"
      exit="hidden"
    >
      <span
        aria-hidden
        className={cn(
          "absolute -left-1.25 top-1/2 z-20 h-2.5 w-1.5 -translate-y-1/2 [clip-path:polygon(100%_0,0_50%,100%_100%)]",
          RECESS,
        )}
      />
      <Circle label="Confirmar borrado" onClick={onConfirm}>
        <path d="M4 12.5 9.5 18 20 7" stroke={ACCENT} />
      </Circle>
      <Circle label="Cancelar" onClick={onCancel}>
        <path d="M6 6 18 18M18 6 6 18" />
      </Circle>
    </m.div>
  );
}

// `label` names the trigger for screen readers. `onConfirm` may be async: the check mark only shows when it does
// not resolve to `false`, so a failed delete does not look like a successful one.
export function DeleteButton({
  className,
  label = "Borrar",
  onConfirm,
  onCancel,
  ...props
}) {
  const reduced = useReducedMotion() ?? false;
  const [open, setOpen] = useState(false);
  const trigger = useRef(null);

  const { path, settle } = useBin(open, reduced);
  const width = useTileWidth(open, reduced);
  const [status, setStatus] = useStatus(reduced, settle);

  const resolve = async (next) => {
    setOpen(false);
    trigger.current?.focus();
    if (next === "kept") {
      setStatus("kept");
      onCancel?.();
      return;
    }
    setStatus("busy");
    const ok = (await onConfirm?.()) !== false;
    setStatus(ok ? "deleted" : "idle");
  };

  const toggle = () => {
    if (open) return resolve("kept");
    setStatus("idle");
    setOpen(true);
  };

  return (
    <m.div
      data-slot="delete-button"
      data-state={open ? "open" : "closed"}
      data-status={status}
      className={cn("relative h-12 rounded-2xl", SURFACE, GLYPH, className)}
      style={{ width }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) resolve("kept");
      }}
      {...props}
    >
      <m.button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        disabled={status === "busy"}
        onClick={toggle}
        whileTap={reduced ? undefined : { scale: 0.94 }}
        transition={TAP}
        className={cn(
          "relative z-10 grid h-12 w-12 place-items-center rounded-2xl",
          FOCUS,
        )}
      >
        <AnimatePresence mode="wait" initial={false}>
          {status === "deleted" ? (
            <Done key="done" reduced={reduced} />
          ) : (
            <Bin key="bin" path={path} settle={settle} open={open} reduced={reduced} />
          )}
        </AnimatePresence>
      </m.button>

      <span role="status" aria-live="polite" className="sr-only">
        {status === "deleted" ? "Borrado" : status === "kept" ? "Conservado" : ""}
      </span>

      <AnimatePresence>
        {open && (
          <Confirm
            key="panel"
            reduced={reduced}
            onConfirm={() => resolve("deleted")}
            onCancel={() => resolve("kept")}
          />
        )}
      </AnimatePresence>
    </m.div>
  );
}

export default DeleteButton;
