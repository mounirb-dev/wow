# Arquitectura

Guía para entender el código antes de tocarlo. Los comentarios de cada archivo explican el detalle; aquí está el mapa.

## Visión general

Next.js (App Router) + Appwrite (auth, base de datos TablesDB y Storage). No hay base de datos propia: toda la persistencia pasa por `node-appwrite` con la API key de servidor.

```
Navegador ──► páginas (app/*/page.jsx, server components)
          └─► rutas API (app/api/**/route.js) ──► lib/* ──► Appwrite
```

## Multi-tenant: la regla que no se puede romper

Los datos pertenecen a un **workspace**. Appwrite se usa con la API key de admin, que **no aplica permisos por fila**, así que el aislamiento lo hace el código:

1. `getWorkspaceContext()` (`lib/workspace.js`) resuelve usuario, workspace y rol. Devuelve `null` sin sesión.
2. **Toda consulta** filtra por `workspaceId = context.workspace.$id`.
3. Toda fila leída por id se verifica (`row.workspaceId === context.workspace.$id`) antes de usarla.
4. Las rutas que escriben comprueban rol: `canEdit` (editor+) o `canManage` (owner/admin).

Una consulta sin filtro de workspace es una fuga de datos entre clientes.

### Acceso por carpeta

Dentro de un workspace, una carpeta puede ser `restricted` con una lista `allowedUserIds` (migración `014_folder_access`). Entran owner/admin, quien la creó y los usuarios listados; la restricción se hereda por las subcarpetas. La regla pura está en `lib/folder-access.js` y se aplica en `lib/workspace.js` (`listFolders`, `getFolder`, `findFolder`): **no leas carpetas ni documentos por id sin pasar por ellos**, y para saber si una carpeta existe aunque no se pueda ver usa `loadAllFolders`. Una carpeta sin acceso responde 404, igual que una inexistente. Las filas anteriores a la migración no tienen los campos y cuentan como abiertas. Tests en `tests/folder-access.test.js` y `tests/workspace-isolation.test.js`.

## Flujo de una petición

- **Página privada**: `requireUser()` redirige a `/login` si no hay sesión → `loadPlayers()` / helpers de `lib/` → render dentro de `WorkspaceShell`.
- **Ruta API**: `getWorkspaceContext()` → 401 si no hay sesión → 403 si el rol no basta → validar entrada → Appwrite → `revalidate*Cache()` si hay datos cacheados.
- `getUser`, `getWorkspaceContext`, `loadPlayers`, `loadPlayer` y `loadStaffDataByPlayer` están envueltos en `cache()` de React: dentro de una petición se calculan una vez, aunque los llamen varios componentes.

## Mapa de carpetas

| Ruta | Qué hay |
| --- | --- |
| `app/` | Páginas y rutas API. `app/api/auth` = login/OAuth/recuperación; `app/api/workspace` = miembros, carpetas, archivos, icono. |
| `lib/appwrite.js` | Clientes admin/sesión, `listAll` (paginación) y `chunk`. |
| `lib/session.js` | Cookie de sesión, `getUser`, `requireUser`. |
| `lib/workspace.js` | Contexto de workspace, roles y carpetas. |
| `lib/data.js` | Carga de jugadores y pretendientes. |
| `lib/staff-data.js` | Valoraciones y movimientos del staff. |
| `lib/news-sync.js` | Ingesta y lectura de noticias (Google News RSS). |
| `lib/tools.js` | Fórmulas puras: palanca, simulador de negociación, cartera. |
| `lib/recovery.js` | Recuperación de contraseña por OTP. |
| `components/` | UI. `ui/` son piezas shadcn; el resto son componentes de la app. |
| `db/migrations/` | Esquema de Appwrite, versionado y numerado. |
| `scripts/` | Utilidades de entorno (`migrate`, `bootstrap`, `sync-news`…). |
| `app/mcp`, `app/api/mcp/oauth`, `app/.well-known` | Endpoint MCP remoto y su servidor OAuth (ver "MCP"). |
| `lib/coach.js`, `components/coach` | Herramientas del cuerpo técnico: alertas, equilibrio, alineación, matriz de decisión e informe de jugador (ver "Cuerpo técnico"). |
| `lib/mcp-*.js` | Núcleo OAuth (tokens firmados, PKCE), herramientas MCP y manejador HTTP. |
| `tests/` | `bun test`: fórmulas, utilidades, OAuth, endpoint MCP y puerta de calidad. |
| `scripts/verify.mjs` | Puerta de calidad previa al push (ver "Calidad"). |

## Modelo de datos (tablas de Appwrite)

`players` y sus `suitors` (clubes interesados); `workspaces` → `workspace_members` (rol y estado `active`/`invited`); `folders` y `documents` (metadatos; el binario está en Storage); `player_staff_signals` (una por jugador y usuario); `transfer_targets`; `news_items`; `recovery_otps`; `migrations` (ledger).

Los IDs de fila suelen ser **deterministas** (hash de las claves) para que crear sea idempotente. Appwrite limita los IDs a 36 caracteres.

## Escalabilidad: convenciones

- Appwrite devuelve como mucho 100 filas por página: usa `listAll`, no `listRows` con `limit`.
- `Query.equal(campo, valores)` admite 100 valores: usa `chunk` para listas largas.
- Evita N+1: carga datos de toda la plantilla con una consulta y agrúpalos en memoria (ver `lib/staff-data.js`).
- Trabajo en lote contra servicios externos: `mapLimit` para limitar la concurrencia.

## Caché

`unstable_cache` solo en noticias (5 min), con etiquetas `news` y `news:<playerId>`. Cualquier escritura que cambie lo cacheado debe llamar a las funciones de `lib/cache-tags.js`.

### Actualización de noticias

Las noticias se actualizan al abrir la bandeja: si lo guardado tiene más de 1 h, se refresca el workspace tras responder (`refreshNewsIfStale`, máximo un intento cada 15 min). No hay cron programado (se quitó `vercel.json`). `POST /api/news/sync` con sesión sincroniza el propio workspace; con `CRON_SECRET` o `NEWS_SYNC_SECRET` en `Authorization: Bearer` sincroniza todos (para un planificador externo). A mano: `bun run news:sync`.

## Cálculo de negocio

`lib/tools.js` es lógica pura y se comparte entre UI y MCP. Los números del simulador (85 % del valor justo como mínimo del jugador, 5 % de comisión, pendiente logística 6 %) son **supuestos del modelo**, no datos. Cambiarlos cambia toda la app.

## Migraciones en producción

Ver `docs/production-appwrite.md`. Las migraciones no se ejecutan en el build de Vercel.

## MCP

`/mcp` expone las herramientas de solo lectura por HTTP. La autenticación es OAuth 2.1 + PKCE con registro dinámico de clientes; clientes, códigos y tokens son JSON firmado con HMAC (`lib/mcp-oauth.js`), sin estado en base de datos. En cada llamada se resuelve de nuevo el workspace del usuario (`resolveWorkspaceContext`), así que la regla multi-tenant se mantiene: el token solo identifica al usuario, nunca da acceso a un workspace concreto. El flujo completo está probado en `tests/mcp-*.test.js`.

## Cuerpo técnico

`lib/coach.js` es lógica pura (testeada en `tests/coach.test.js`) que usan la página `/coach`, el informe de la ficha de jugador y las herramientas MCP. Regla de oro: **no se inventa ningún dato**. Si falta un dato (valoración del staff, minutos…) ese criterio se excluye, el resto se re-normaliza y se informa de la `coverage`. Los por-90 solo se calculan con 450 minutos o más. La recomendación de renovar/no renovar sale de reglas visibles (`DECISION_RULES`), pensadas para priorizar el trabajo del staff y no como decisión automática. La alineación y la matriz se calculan en el cliente y no se guardan.

## Calidad

`bun run verify` (lockfile, tests, build, `bun audit`, Snyk, React Doctor 100/100) es la única puerta antes de subir cambios y la comparten el hook de git, el hook de Claude Code y la CI. Las reglas para agentes están en `AGENTS.md`.

## Limitaciones conocidas

- Los tokens MCP no se pueden revocar individualmente antes de caducar (sin estado). Rotar `MCP_OAUTH_SECRET` los invalida todos.
- El ledger de migraciones de producción usa nombres distintos a los archivos del repo; `bun scripts/migrate.mjs` no es seguro allí sin reconciliarlo.
