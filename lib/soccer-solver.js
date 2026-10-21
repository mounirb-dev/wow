export function normalizeSoccerSolverOutput(payload = {}) {
  return {
    provider: "SoccerSolver",
    playerId: payload.playerId ?? null,
    currentValue: payload.currentValue ?? null,
    projectedValue12m: payload.projectedValue12m ?? null,
    risk: payload.risk ?? "pending",
    expectedRoi: payload.expectedRoi ?? null,
    probability: payload.probability ?? null,
    ranking: payload.ranking ?? null,
    recommendation: payload.recommendation ?? "pending verification",
    updatedAt: payload.updatedAt ?? null,
    modelVersion: payload.modelVersion ?? null,
    isSample: payload.provider?.includes("sample") ?? false,
  };
}

export async function getSoccerSolverOutput(playerId) {
  // Replace this boundary with the authorised API/export connector later.
  return normalizeSoccerSolverOutput({ provider: "SoccerSolver connector · sample response", playerId, modelVersion: "sample-contract-v0" });
}
