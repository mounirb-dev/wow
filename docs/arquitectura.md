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
| `mcp/server.ts` | Servidor MCP local (stdio). Ver "Limitaciones". |

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

## Cálculo de negocio

`lib/tools.js` es lógica pura y se comparte entre UI y MCP. Los números del simulador (85 % del valor justo como mínimo del jugador, 5 % de comisión, pendiente logística 6 %) son **supuestos del modelo**, no datos. Cambiarlos cambia toda la app.

## Migraciones en producción

Ver `docs/production-appwrite.md`. Las migraciones no se ejecutan en el build de Vercel.

## Limitaciones conocidas

- `mcp/server.ts` llama a `loadPlayers()`, que necesita cookies de una petición web; en el proceso stdio no hay ninguna, así que sus herramientas fallan hasta decidir de qué workspace leer.
- El ledger de migraciones de producción usa nombres distintos a los archivos del repo; `bun scripts/migrate.mjs` no es seguro allí sin reconciliarlo.
