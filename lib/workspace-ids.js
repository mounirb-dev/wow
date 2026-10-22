import { createHash } from "node:crypto";

// IDs deterministas: crear el workspace/miembro es idempotente (dos peticiones simultáneas no duplican
// filas; la segunda choca con 409 controlado). Appwrite limita los IDs a 36 caracteres, de ahí el
// prefijo + hash truncado. Sin dependencias de Next para poder usarlos también desde scripts.
const hash = (value) => createHash("sha256").update(value).digest("hex").slice(0, 28);

export const workspaceMemberId = (workspaceId, userId) => `member_${hash(`${workspaceId}:${userId}`)}`;
// Workspace de un club dado de alta por invitación: sale del email del primer administrador.
export const clubWorkspaceId = (email) => `ws_${hash(`club:${email}`)}`;
