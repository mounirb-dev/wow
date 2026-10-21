"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TaskCard({ task, onSelect }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const selectOnEnter = (event) => { if (event.key === "Enter") onSelect?.(); };
  // role/tabIndex explícitos (dnd-kit también los añade): la tarjeta es un botón que se selecciona con clic o Enter y se arrastra con el puntero.
  return <div role="button" tabIndex={0} ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} {...attributes} {...listeners} onClick={onSelect} onKeyDown={selectOnEnter} className={cn("flex w-full cursor-grab select-none items-start gap-2 rounded-xl border bg-card p-3 shadow-sm touch-none active:cursor-grabbing", isDragging && "ring-2 ring-primary/30")}>
    <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-card-foreground">{task.content}</p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{task.meta}</p>
    </div>
  </div>;
}
