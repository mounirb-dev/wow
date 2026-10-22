// Acceso a carpetas (lógica pura, sin Appwrite). Una carpeta `restricted` solo la ven owner/admin,
// su creador y los usuarios de `allowedUserIds`. La restricción se hereda: lo que cuelga de una
// carpeta restringida exige poder entrar también en ella. Las filas anteriores a la migración 014
// no tienen estos campos y cuentan como abiertas a todo el workspace.
const MAX_ALLOWED = 100;

const isManager = (member) => ["owner", "admin"].includes(member?.role);

const passes = (folder, userId) => !folder.restricted || folder.createdBy === userId || (folder.allowedUserIds ?? []).includes(userId);

// Ids de las carpetas a las que puede entrar `member`. `folders` = todas las del workspace.
export function accessibleFolderIds(member, folders) {
  if (isManager(member)) return new Set(folders.map((folder) => folder.$id));
  const byId = new Map(folders.map((folder) => [folder.$id, folder]));
  const memo = new Map();
  const allowed = (folder, seen = new Set()) => {
    if (memo.has(folder.$id)) return memo.get(folder.$id);
    // Un ciclo de padres nunca debería existir; si lo hubiera, se deniega en vez de iterar sin fin.
    if (seen.has(folder.$id)) return false;
    seen.add(folder.$id);
    const parent = folder.parentId ? byId.get(folder.parentId) : null;
    const result = passes(folder, member?.userId) && (!parent || allowed(parent, seen));
    memo.set(folder.$id, result);
    return result;
  };
  return new Set(folders.filter((folder) => allowed(folder)).map((folder) => folder.$id));
}

// Quién puede cambiar la restricción de una carpeta: owner/admin o quien la creó.
export const canConfigureAccess = (member, folder) => Boolean(isManager(member) || (member?.userId && folder.createdBy === member.userId));

// Lista de usuarios permitida que llega del cliente -> solo ids de miembros activos del workspace,
// sin duplicados. Devuelve null si el formato no es válido.
export function sanitizeAllowedUserIds(value, members) {
  if (!Array.isArray(value) || value.length > MAX_ALLOWED || value.some((id) => typeof id !== "string")) return null;
  const valid = new Set(members.filter((member) => member.status === "active").map((member) => member.userId));
  return [...new Set(value)].filter((id) => valid.has(id));
}
