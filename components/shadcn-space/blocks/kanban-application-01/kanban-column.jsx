"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TaskCard from "@/components/shadcn-space/blocks/kanban-application-01/task-card";

export default function KanbanColumn({ column, onSelect }) {
  const { setNodeRef } = useDroppable({ id: column.id });
  const Icon = column.icon;

  return <section className="flex min-h-72 min-w-0 flex-1 flex-col items-start rounded-2xl border border-border bg-muted p-2">
    <header className="flex w-full shrink-0 items-center gap-2 px-2 py-1.5">
      <Icon className={column.iconClassName} aria-hidden="true" />
      <h2 className="min-w-0 flex-1 truncate text-sm font-medium text-muted-foreground">{column.title}</h2>
      <span className="text-xs tabular-nums text-muted-foreground">{String(column.tasks.length).padStart(2, "0")}</span>
    </header>
    <div ref={setNodeRef} className="flex min-h-2 w-full flex-1 flex-col gap-2">
      <SortableContext items={column.tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        {column.tasks.map((task) => <TaskCard key={task.id} task={task} onSelect={() => onSelect(task.id)} />)}
      </SortableContext>
      {column.tasks.length === 0 && <p className="grid min-h-24 w-full place-items-center rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted-foreground">Arrastra aquí un jugador</p>}
    </div>
  </section>;
}
