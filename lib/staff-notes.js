// Comentarios del staff sobre un jugador (lógica pura, sin I/O). Cada miembro tiene como mucho UNA
// valoración por jugador (player_staff_signals) y cualquiera puede proponer movimientos
// (transfer_targets). Todo se comparte dentro del workspace; esto solo ordena y presenta.
export const INTEREST_LABEL = { pending: "Por revisar", interested: "Me interesa", "not-interested": "No interesa" };

// La valoración del propio usuario (o null). Nunca la de otro miembro: cada uno edita la suya.
export const ownSignal = (signals, userId) => (userId ? (signals ?? []).find((signal) => signal.userId === userId) ?? null : null);

// Más reciente primero; lo que no tiene fecha va al final.
const newestFirst = (a, b) => String(b.date ?? "").localeCompare(String(a.date ?? ""));

// { opinions, moves } listos para mostrar. Una valoración "por revisar" y sin nota no aporta nada y
// se omite; los movimientos muestran su autor cuando ese usuario también ha dejado una valoración.
export function staffComments({ signals = [], targets = [] } = {}) {
  const names = new Map(signals.map((signal) => [signal.userId, signal.userName]));
  const opinions = signals
    .filter((signal) => signal.notes || (signal.interest && signal.interest !== "pending"))
    .map((signal) => {
      const interest = INTEREST_LABEL[signal.interest] ? signal.interest : "pending";
      return { id: signal.$id, author: signal.userName || "Miembro del staff", interest, label: INTEREST_LABEL[interest], notes: signal.notes || null, date: signal.updatedAt ?? signal.$updatedAt ?? null };
    })
    .sort(newestFirst);
  const moves = targets
    .map((target) => ({ id: target.$id, direction: target.direction === "out" ? "out" : "in", club: target.club, fee: target.fee || null, notes: target.notes || null, author: names.get(target.createdBy) ?? null, date: target.createdAt ?? target.$createdAt ?? null }))
    .sort(newestFirst);
  return { opinions, moves };
}
