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

### Alta de clubes: solo por invitación

La herramienta es para clubes seleccionados, así que `resolveWorkspaceContext` **no crea workspaces**: devuelve `null` si el usuario no tiene membresía activa ni una invitación pendiente. Un `null` se ve como 401 en las rutas API, como `/acceso` en las páginas (`WorkspaceShell` redirige) y como error en `/mcp`. Un club nuevo se da de alta con `bun run club:invite` (`lib/club-invite.js`, `scripts/invite-club.mjs`): crea el workspace y deja invitado a su primer propietario. La invitación (ese flujo y la de «Compartir workspace») solo se activa si el email de la cuenta está **verificado** (`user.emailVerification`; Google llega verificado): sin esa comprobación, cualquiera podría registrarse en Appwrite con el email de un invitado y entrar. Por la misma razón, invitar a un email con cuenta sin verificar la deja como "invited" en vez de activa. Las membresías que ya existían no cambian. **Email de onboarding** (`lib/onboarding.js`): al invitar (`club:invite` o «Compartir workspace») a alguien que aún no puede entrar, `sendOnboardingEmail` pide a Appwrite un enlace mágico (`Account.createMagicURLToken`; crea la cuenta sin contraseña si el email es nuevo). El enlace lleva a `/onboarding?userId&secret`: nombre + contraseña → `POST /api/auth/onboarding` canjea el secreto por sesión (abrirlo verifica el email, que activa la invitación), guarda nombre y contraseña y pone la cookie. Si el email no sale, la invitación queda creada y la respuesta lleva `emailSent: false`. `/onboarding` sin enlace válido pide otro (`POST /api/auth/onboarding/resend`, solo manda a emails con invitación pendiente y responde siempre igual). Los errores viajan como códigos (`ONBOARDING_ERRORS`), nunca como texto en la URL. Requiere SMTP en Appwrite y el dominio de la app como plataforma web. Tests en `tests/workspace-isolation.test.js` y `tests/onboarding.test.js`.

### Acceso por carpeta

Dentro de un workspace, una carpeta puede ser `restricted` con una lista `allowedUserIds` (migración `014_folder_access`). Entran owner/admin, quien la creó y los usuarios listados; la restricción se hereda por las subcarpetas. La regla pura está en `lib/folder-access.js` y se aplica en `lib/workspace.js` (`listFolders`, `getFolder`, `findFolder`): **no leas carpetas ni documentos por id sin pasar por ellos**, y para saber si una carpeta existe aunque no se pueda ver usa `loadAllFolders`. Una carpeta sin acceso responde 404, igual que una inexistente. Las filas anteriores a la migración no tienen los campos y cuentan como abiertas. Tests en `tests/folder-access.test.js` y `tests/workspace-isolation.test.js`. Borrar una carpeta (clic derecho → Eliminar, editor+) elimina toda su rama con sus archivos y binarios; exige acceso a TODA la rama (si algo dentro está restringido para ti, responde 403).

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
| `lib/upload-*.js`, `lib/document-files.js`, `lib/use-folder-files.js` | Subida de archivos por partes y lectura con `Range` (ver "Subida de archivos"). |
| `lib/recovery.js` | Recuperación de contraseña por OTP. |
| `components/` | UI. `ui/` son piezas shadcn; el resto son componentes de la app. |
| `db/migrations/` | Esquema de Appwrite, versionado y numerado. |
| `scripts/` | Utilidades de entorno (`migrate`, `bootstrap`, `sync-news`…). |
| `app/mcp`, `app/api/mcp/oauth`, `app/.well-known` | Endpoint MCP remoto y su servidor OAuth (ver "MCP"). |
| `lib/coach.js`, `components/coach` | Lógica de decisión técnica (alertas, equilibrio, alineación, matriz e informe de jugador) y el informe de la ficha. Sirve al MCP y a la ficha de jugador (ver "Cuerpo técnico"). |
| `lib/mcp-*.js` | Núcleo OAuth (tokens firmados, PKCE), herramientas MCP y manejador HTTP. |
| `tests/` | `bun test`: fórmulas, utilidades, OAuth, endpoint MCP y puerta de calidad. |
| `scripts/verify.mjs` | Puerta de calidad previa al push (ver "Calidad"). |

## Modelo de datos (tablas de Appwrite)

`players` y sus `suitors` (clubes interesados); `workspaces` → `workspace_members` (rol y estado `active`/`invited`); `folders` y `documents` (metadatos; los bytes están en Storage, ver "Subida de archivos"); `player_staff_signals` (una por jugador y usuario); `transfer_targets`; `news_items`; `recovery_otps`; `migrations` (ledger).

Los IDs de fila suelen ser **deterministas** (hash de las claves) para que crear sea idempotente. Appwrite limita los IDs a 36 caracteres.

## Escalabilidad: convenciones

- Appwrite devuelve como mucho 100 filas por página: usa `listAll`, no `listRows` con `limit`.
- `Query.equal(campo, valores)` admite 100 valores: usa `chunk` para listas largas.
- Evita N+1: carga datos de toda la plantilla con una consulta y agrúpalos en memoria (ver `lib/staff-data.js`).
- Trabajo en lote contra servicios externos: `mapLimit` para limitar la concurrencia.

## Caché

`unstable_cache` solo en noticias (5 min), con etiquetas `news` y `news:<playerId>`. Cualquier escritura que cambie lo cacheado debe llamar a las funciones de `lib/cache-tags.js`.

### Actualización de noticias

Las noticias se actualizan al abrir la bandeja: si lo guardado tiene más de 1 h, se refresca el workspace tras responder (`refreshNewsIfStale`, máximo un intento cada 15 min). No hay ningún cron programado. `POST /api/news/sync` con sesión sincroniza el propio workspace; con `CRON_SECRET` o `NEWS_SYNC_SECRET` en `Authorization: Bearer` sincroniza todos (para un planificador externo). A mano: `bun run news:sync`.

## Subida de archivos

Fotos, vídeos y cualquier tipo de archivo (tope por archivo: `MAX_UPLOAD_MB`, 1024 por defecto). Vercel limita el cuerpo de una función a ~4,5 MB, así que el archivo no puede subirse de una vez: el navegador lo corta en partes de 4 MB (`PART_SIZE`, `lib/upload-limits.js`) y el servidor guarda cada parte como un archivo de Storage (id `p<documento>_<n>`). La fila de `documents` las enumera en `partIds` y guarda `size`.

Flujo (cliente en `lib/upload-client.js`, hook `lib/use-folder-files.js`):

1. `POST /api/workspace/folders/:id/files` (editor+) valida nombre y tamaño (413 si supera el límite) y devuelve un **token firmado** (`lib/upload-token.js`): HMAC sin estado, caduca a las 6 h, lleva usuario, workspace, carpeta, nombre, tamaño y tipo. Clave: `UPLOAD_SECRET`, o `MCP_OAUTH_SECRET`, o `APPWRITE_API_KEY` (por ese orden), con separación de dominio.
2. `PUT .../files/upload?part=N` (cabecera `x-upload-token`) sube la parte N; se comprueba su tamaño exacto y un reintento la rehace entera.
3. `POST .../files/upload` cierra: comprueba que están TODAS las partes y crea la fila `documents`. Cerrar dos veces devuelve el mismo documento. `DELETE .../files/upload` cancela y borra las partes subidas.
4. `GET .../files/:fileId` sirve el archivo leyendo una parte cada vez (nunca entero en memoria) y admite `Range` (206/416) para adelantar vídeos. `PATCH .../files/:fileId` (editor+, `{ name }`) cambia solo el nombre de la fila (limpiado con `cleanFileName`; los bytes y el tipo guardado no cambian). `DELETE .../files/:fileId` borra todas las partes y después la fila. Los ids de Storage no salen del servidor (`publicFile`).

Qué se ve dentro de la página: solo fotos raster (JPEG, PNG, WebP, GIF, AVIF), vídeo (MP4, WebM, QuickTime) y audio, con `?inline=1` (visor `components/FileViewer.jsx`: galería con carrusel de shadcn, zoom con `react-zoom-pan-pinch`, reproductor propio para vídeo, `voice-note` de shadcn (`components/ui/voice-note.jsx`, con la onda decorativa generada a partir del nombre) para audio y un aviso con descarga si el archivo no se puede mostrar; miniaturas en `components/media/MediaThumb.jsx`). **Nunca SVG ni HTML.** Esas respuestas llevan `X-Content-Type-Options: nosniff` y `Content-Security-Policy: sandbox`; todo lo demás se descarga como adjunto. Los documentos anteriores, de un único binario (`storageFileId`, sin `partIds`), siguen funcionando.

Limitación: si el navegador se cierra a mitad de una subida, las partes ya subidas quedan **huérfanas en Storage** hasta que se borren a mano; no hay limpieza automática. Cancelar desde la interfaz sí las borra.

## Cálculo de negocio

`lib/tools.js` es lógica pura y se comparte entre UI y MCP. Los números del simulador (85 % del valor justo como mínimo del jugador, 5 % de comisión, pendiente logística 6 %) son **supuestos del modelo**, no datos. Cambiarlos cambia toda la app.

## Migraciones en producción

Ver `docs/production-appwrite.md`. Las migraciones no se ejecutan en el build de Vercel.

Pendientes de aplicar en cualquier Appwrite (ninguna se ha ejecutado todavía): `014_folder_access` (acceso por carpeta), `015_player_contact` (teléfono, email, ubicación y representante en `players`) y `016_document_parts` (`documents.size`, `documents.partIds` y bucket sin lista de extensiones). En local basta `bun run db:migrate`. En producción **no lo ejecutes sin reconciliar el ledger** (el runner compara por nombre de archivo): sigue el orden de `docs/production-appwrite.md`. La subida por partes no funciona sin la 016 y el acceso por carpeta no se aplica sin la 014.

## MCP

`/mcp` expone por HTTP las herramientas de lectura y dos de escritura (`add_player`, `delete_player` con `confirm: true`, que respetan el rol). La autenticación es OAuth 2.1 + PKCE con registro dinámico de clientes; clientes, códigos y tokens son JSON firmado con HMAC (`lib/mcp-oauth.js`), sin estado en base de datos. En cada llamada se resuelve de nuevo el workspace del usuario (`resolveWorkspaceContext`), así que la regla multi-tenant se mantiene: el token solo identifica al usuario, nunca da acceso a un workspace concreto. El flujo completo está probado en `tests/mcp-*.test.js`.

## Cuerpo técnico

`lib/coach.js` es lógica pura (testeada en `tests/coach.test.js`) que usan el informe de la ficha de jugador y las herramientas MCP. Regla de oro: **no se inventa ningún dato**. Si falta un dato (valoración del staff, minutos…) ese criterio se excluye, el resto se re-normaliza y se informa de la `coverage`. Los por-90 solo se calculan con 450 minutos o más. La recomendación de renovar/no renovar sale de reglas visibles (`DECISION_RULES`), pensadas para priorizar el trabajo del staff y no como decisión automática.

## Calidad

`bun run verify` (lockfile, tests, build, `bun audit`, Snyk, React Doctor 100/100) es la única puerta antes de subir cambios y la comparten el hook de git, el hook de Claude Code y la CI. Las reglas para agentes están en `AGENTS.md`.

## Limitaciones conocidas

- Los tokens MCP no se pueden revocar individualmente antes de caducar (sin estado). Rotar `MCP_OAUTH_SECRET` los invalida todos.
- El ledger de migraciones de producción usa nombres distintos a los archivos del repo; `bun scripts/migrate.mjs` no es seguro allí sin reconciliarlo.
