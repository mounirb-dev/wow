// Demo-only records. External facts stay empty until a verified source is connected.
export const dataRoles = ["Director deportivo", "Scouting", "Entrenador", "Analista", "Administración"];

export const sources = [];

export const newsItems = [];

export const soccerSolverSample = {
  provider: "SoccerSolver connector · sample response",
  playerId: "dsilva",
  currentValue: null,
  projectedValue12m: null,
  risk: "pending",
  expectedRoi: null,
  probability: null,
  ranking: null,
  recommendation: "pending verification",
  updatedAt: null,
  modelVersion: "sample-contract-v0",
};

export const decisions = [
  { id: "decision-1", playerId: "dsilva", action: "Seguir observando", status: "abierta", owner: "Director deportivo", reason: "Esperando datos verificados de rendimiento, contrato y contexto.", updatedAt: "Pendiente" },
];

export const folderDocuments = [
  { name: "Informe de scouting", type: "Sin fuente verificada", status: "pendiente" },
  { name: "Comparativa de mercado", type: "Sin conexión SoccerSolver", status: "pendiente" },
  { name: "Noticias y contexto", type: "Sin RSS/API conectada", status: "pendiente" },
];
