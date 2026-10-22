"use client";

import { useMemo, useRef, useState } from "react";
import { closestCorners, DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Circle, CircleCheck, CircleDot } from "lucide-react";
import { Card } from "@/components/ui/card";
import KanbanColumn from "@/components/shadcn-space/blocks/kanban-application-01/kanban-column";
import { ownSignal, staffComments, teamSummary } from "@/lib/staff-notes.js";
import StaffCommentsCard from "./StaffCommentsCard.jsx";
import StaffInterestEditor from "./StaffInterestEditor.jsx";

// Tablero de interés del staff: tres columnas (por revisar / me interesa / no interesa).
// Arrastrar una tarjeta guarda la valoración del usuario vía /api/players/:id/staff.
const columnConfig = [
  { id: "pending", title: "Por revisar", icon: Circle, iconClassName: "text-muted-foreground" },
  { id: "interested", title: "Me interesa", icon: CircleDot, iconClassName: "text-emerald-600 dark:text-emerald-400" },
  { id: "not-interested", title: "No interesa", icon: CircleCheck, iconClassName: "text-rose-600 dark:text-rose-400" },
];

const toTask = (player) => ({ id: player.id, content: player.name, meta: `${player.club} · ${player.pos} · ${player.age} años`, player });

// `staffData` = { [playerId]: { signals, targets } } (ver lib/staff-data.js). Cada usuario ve SU
// tablero: la columna inicial de cada jugador sale de su propia valoración (`userId`); sin ella, "pending".
export default function NegotiationKanban({ players, staffData, userId, initialPlayerId = null }) {
  const initialSignals = useMemo(() => Object.fromEntries(players.map((player) => [player.id, ownSignal(staffData[player.id]?.signals, userId) || { interest: "pending", notes: "" }])), [players, staffData, userId]);
  const [signals, setSignals] = useState(initialSignals);
  const [columns, setColumns] = useState(() => columnConfig.map((column) => ({ ...column, tasks: players.filter((player) => (initialSignals[player.id]?.interest || "pending") === column.id).map(toTask) })));
  const [activeTask, setActiveTask] = useState(null);
  const [selectedId, setSelectedId] = useState(initialPlayerId);
  const sourceColumn = useRef(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const selected = players.find((player) => player.id === selectedId);

  // Valoraciones de los demás miembros (compartidas en el workspace). Solo lectura aquí: cada uno
  // edita la suya en "Mi valoración".
  const othersOf = (playerId) => (staffData[playerId]?.signals ?? []).filter((signal) => signal.userId !== userId);
  // La tarjeta muestra además cómo está el equipo: las de los demás más la mía, la de ahora mismo.
  const withTeam = (task) => {
    const summary = teamSummary([...othersOf(task.id), signals[task.id]].filter(Boolean));
    return summary ? { ...task, meta: `${task.meta} · ${summary}` } : task;
  };
  const shownColumns = columns.map((column) => ({ ...column, tasks: column.tasks.map(withTeam) }));

  const findColumn = (id, current = columns) => current.find((column) => column.id === id) || current.find((column) => column.tasks.some((task) => task.id === id));

  const handleDragStart = ({ active }) => {
    const column = findColumn(active.id);
    sourceColumn.current = column?.id || null;
    setActiveTask(column?.tasks.find((task) => task.id === active.id) || null);
  };

  const handleDragOver = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setColumns((current) => {
      const activeColumn = findColumn(active.id, current);
      const overColumn = findColumn(over.id, current);
      if (!activeColumn || !overColumn || activeColumn.id === overColumn.id) return current;
      const task = activeColumn.tasks.find((item) => item.id === active.id);
      if (!task) return current;
      const overIndex = overColumn.tasks.findIndex((item) => item.id === over.id);
      const insertAt = overIndex < 0 ? overColumn.tasks.length : overIndex;
      return current.map((column) => {
        if (column.id === activeColumn.id) return { ...column, tasks: column.tasks.filter((item) => item.id !== active.id) };
        if (column.id === overColumn.id) return { ...column, tasks: [...column.tasks.slice(0, insertAt), task, ...column.tasks.slice(insertAt)] };
        return column;
      });
    });
  };

  async function persistMove(playerId, interest) {
    const previous = signals[playerId];
    setSignals((current) => ({ ...current, [playerId]: { ...current[playerId], interest } }));
    const response = await fetch(`/api/players/${playerId}/staff`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ interest, notes: previous?.notes || "" }) });
    if (!response.ok) setSignals((current) => ({ ...current, [playerId]: previous }));
  }

  function applySignal(playerId, signal) {
    setSignals((current) => ({ ...current, [playerId]: signal }));
    setColumns((current) => current
      .map((column) => ({ ...column, tasks: column.tasks.filter((task) => task.id !== playerId) }))
      .map((column) => column.id === signal.interest
        ? { ...column, tasks: [...column.tasks, toTask(players.find((player) => player.id === playerId))] }
        : column));
  }

  const handleDragEnd = ({ active, over }) => {
    const current = columns;
    const activeColumn = findColumn(active.id, current);
    const overColumn = over ? findColumn(over.id, current) : null;
    const originalColumn = sourceColumn.current;
    setActiveTask(null);
    sourceColumn.current = null;
    if (!activeColumn || !overColumn) return;
    if (activeColumn.id === overColumn.id && over.id !== overColumn.id) {
      const from = activeColumn.tasks.findIndex((task) => task.id === active.id);
      const to = overColumn.tasks.findIndex((task) => task.id === over.id);
      if (from !== to) setColumns((value) => value.map((column) => column.id === activeColumn.id ? { ...column, tasks: arrayMove(column.tasks, from, to) } : column));
    }
    if (originalColumn && originalColumn !== overColumn.id) persistMove(active.id, overColumn.id);
  };

  return <>
    <Card className="w-full overflow-x-auto rounded-xl border bg-card p-4 ring-0 sm:p-6">
      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex min-w-[760px] items-start gap-4">
          {shownColumns.map((column) => <KanbanColumn key={column.id} column={column} onSelect={setSelectedId} />)}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask ? <div className="w-72 rounded-xl border bg-card p-3 text-card-foreground shadow-xl"><p className="text-sm font-medium">{activeTask.content}</p><p className="mt-1 text-xs text-muted-foreground">{withTeam(activeTask).meta}</p></div> : null}
        </DragOverlay>
      </DndContext>
    </Card>
    {selected && <section className="mt-4 rounded-xl border bg-card p-4"><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">Detalle de trabajo</p><h2 className="mt-1 text-base font-medium">{selected.name}</h2></div><button type="button" onClick={() => setSelectedId(null)} className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">Cerrar</button></div><StaffInterestEditor player={selected} initialSignal={signals[selected.id]} initialTargets={staffData[selected.id]?.targets || []} onSignalSaved={(signal) => applySignal(selected.id, signal)} /><div className="mt-3"><StaffCommentsCard playerId={selected.id} comments={{ opinions: staffComments({ signals: othersOf(selected.id) }).opinions, moves: [] }} title="Valoraciones del equipo" showLink={false} emptyText="Nadie más ha valorado a este jugador todavía." /></div></section>}
  </>;
}
