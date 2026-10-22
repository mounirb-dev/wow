# wow · Terminal del agente

Workspace para gestionar una cartera de fútbol, negociaciones, documentos y criterio del staff.

- **Cartera:** cada jugador con valor, evolución, vencimiento de contrato y *palanca* (0-100: cuánta fuerza tienes para negociar ahora).
- **Simulador de negociación:** eliges club y salario; ves probabilidad de cierre y comisión esperada, y calculas la petición óptima.
- **Jugadores:** añadir y borrar desde la interfaz o el MCP (`add_player`, `delete_player` con `confirm: true`), y editar teléfono, email, ubicación y representante desde la ficha.
- **Staff:** comentarios y valoraciones compartidas entre los miembros del workspace (Negociaciones → "Mi valoración").
- **Archivos:** carpetas con acceso restringible; subida de fotos, vídeos y cualquier archivo por partes (hasta `MAX_UPLOAD_MB`, 1024 por defecto), vista previa de fotos, vídeo y audio, y borrado de carpetas con clic derecho.
- **MCP:** las mismas herramientas disponibles para Claude Desktop u otros clientes MCP.
- **Backend:** Appwrite sobre **PostgreSQL**, con migraciones versionadas, Appwrite Storage y login con Google.

Los perfiles, noticias, valoraciones, carpetas y archivos se leen de Appwrite. La aplicación no crea registros de prueba automáticamente.

Stack: Next.js (App Router, JSX) · Bun · Tailwind CSS 4 · shadcn/ui · Appwrite (`node-appwrite`).

> Para entender cómo está organizado el código (multi-tenant, flujo de peticiones, convenciones), empieza por [`docs/arquitectura.md`](docs/arquitectura.md).

## Requisitos

- [Bun](https://bun.sh) 1.3 o superior
- [Docker](https://docs.docker.com/get-docker/) con Docker Compose v2 (Appwrite necesita ~4 GB de RAM)

## Puesta en marcha

```bash
bun install

# 1. Levanta Appwrite en local con PostgreSQL (primera vez: descarga imágenes, tarda unos minutos)
bun run appwrite:install        # espera ~1 min a que los contenedores estén "healthy"

# 2. Crea el admin, el proyecto y la API key de Appwrite → escribe .env.local
bun run appwrite:bootstrap

# 3. Aplica las migraciones (tablas, índices y Storage)
bun run db:migrate

# 4. Registra localhost como plataforma web y configura OAuth si procede
bun run appwrite:configure

# 5. Arranca la app
bun run dev
```

> Las migraciones `014_folder_access`, `015_player_contact` y `016_document_parts` son nuevas y aún no están aplicadas en ningún Appwrite: ejecuta `bun run db:migrate`. **En producción no lo hagas a ciegas**: el ledger remoto usa otros nombres y el runner intentaría reaplicar todo. Sigue [`docs/production-appwrite.md`](docs/production-appwrite.md).

Abre <http://localhost:3000> y entra con una cuenta real de Appwrite.
La consola de Appwrite está en <http://localhost:8080> (`admin@agentsolver.local` / `AgentSolver#2026!`, solo para desarrollo local).

## Login con Google (Appwrite)

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un *ID de cliente de OAuth* de tipo **Aplicación web**.
2. Añade como **URI de redireccionamiento autorizado**:
   `http://localhost:8080/v1/account/sessions/oauth2/callback/google/<ID_DEL_PROYECTO>` (el ID de `APPWRITE_PROJECT_ID`; `bun run appwrite:configure` imprime la URL exacta)
3. Copia el ID y el secreto a `.env.local` (plantilla en `.env.example`):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
4. Ejecuta `bun run appwrite:configure` y reinicia `bun run dev`.

Sin estas credenciales el botón de Google devuelve al login con un error.

Appwrite valida Google y mantiene sus sesiones; wow solo guarda la sesión de Appwrite en una cookie HTTP-only.

## Alta de clubes (solo por invitación)

wow es para clubes seleccionados: iniciar sesión **no** crea ningún workspace. Quien entra sin invitación ve «Todavía no tienes acceso» (`/acceso`). El proceso:

1. El club te pide acceso (email de su primer administrador + nombre del club).
2. Lo das de alta con un comando (en producción, con las variables de producción cargadas):
   ```bash
   bun run club:invite -- persona@club.com "Nombre del club"
   # producción: bun --env-file=<entorno de producción> scripts/invite-club.mjs persona@club.com "Nombre del club"
   ```
   Crea el workspace del club y deja invitado a esa persona como propietaria. Repetirlo no duplica nada.
3. A esa persona le llega **un email** con un enlace: pone su nombre y una contraseña (`/onboarding`) y entra directamente a su workspace. También puede entrar con **Google** con ese mismo email. Desde ahí invita a su equipo desde «Compartir workspace»: cada invitado recibe el mismo email para crear su cuenta.

El email lo envía Appwrite (enlace mágico): sale de su SMTP y su plantilla se edita en la consola de Appwrite → Auth → Plantillas (Magic URL), p. ej. para ponerle tu marca y un texto de invitación. El enlace caduca a la hora y solo vale una vez; quien llegue tarde pide otro en `/onboarding`. La invitación solo se activa con el email **verificado** (abrir el enlace lo verifica): así nadie entra creando una cuenta con el email de otro. Para quitar el acceso a alguien (o cancelar una invitación pendiente), pulsa la papelera junto a su nombre en «Compartir workspace» y confirma; no se puede quitar al propietario ni a uno mismo. Su cuenta de Appwrite no se borra: solo pierde el acceso. Variable opcional `ACCESS_CONTACT_EMAIL`: el email que se muestra en la pantalla de acceso para pedir invitación.

## Servidor MCP (remoto, con OAuth)

El MCP es un endpoint HTTP en **`/mcp`** (Streamable HTTP, sin estado) protegido con OAuth 2.1 + PKCE. Cada usuario autoriza el acceso con su cuenta y solo ve los datos de su workspace. Herramientas de lectura: `list_clients`, `portfolio_summary`, `valuation`, `negotiation_brief` y, para el cuerpo técnico, `squad_alerts`, `squad_balance`, `lineup_suggestion`, `decision_matrix` y `player_report`. Herramientas de escritura (solo con permiso de edición, y respetan el rol: un viewer no puede usarlas): `add_player` (nombre, club, posición, edad y fin de contrato; rechaza duplicados), `update_player` (rendimiento: minutos, goles, asistencias, acciones progresivas; valoración técnica 0-100: encaje, disponibilidad, riesgo de adaptación; valor, salario, contacto…, con `null` para borrar un dato), `save_staff_opinion` (tu opinión y nota sobre un jugador), `add_suitor` / `remove_suitor` (clubes interesados y cuánto lo necesitan, 0-100) y `delete_player` (borrado real en cascada; exige `confirm: true`). Los datos que escriben `update_player` y `add_suitor` son los que alimentan las analíticas (`decision_matrix`, `player_report`, `lineup_suggestion`, `negotiation_brief`): sin ellos salen vacías, y nunca se estiman.

**Conectar Claude** (web, escritorio o móvil): Ajustes → Conectores → *Añadir conector personalizado* → URL `https://TU-DOMINIO/mcp`. Claude descubre el OAuth solo (`/.well-known/oauth-*`), te lleva a `/mcp/oauth` para iniciar sesión y elegir el permiso — **Solo lectura** (por defecto: consulta y análisis, sin ninguna herramienta de escritura) o **Lectura y edición** — y pulsar *Autorizar acceso*. El permiso va dentro del token firmado y lo impone el servidor. Las conexiones hechas antes de esto no llevan permiso y siguen con edición; para limitarlas, vuelve a conectar el cliente y elige solo lectura.

Cómo funciona (código en `lib/mcp-oauth.js`, `lib/mcp-http.js`, `app/mcp`, `app/api/mcp/oauth`):

- Registro dinámico de clientes (RFC 7591), consentimiento en `/mcp/oauth`, canje de código con PKCE S256 y refresh tokens.
- Tokens firmados con HMAC, sin tablas nuevas. La clave es `MCP_OAUTH_SECRET`; si no existe se deriva de `APPWRITE_API_KEY`. Rotarla invalida todos los accesos. Access token 1 h, refresh 30 días.
- En cada llamada se vuelve a resolver la membresía del workspace del usuario: si lo expulsan, deja de ver datos aunque su token no haya caducado.

Probar en local: `bunx @modelcontextprotocol/inspector` y apuntar a `http://localhost:3000/mcp`.

> El antiguo servidor `stdio` (`bun run mcp`) se eliminó: no tenía sesión de usuario y no podía saber de qué workspace leer.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Next.js en desarrollo (puerto 3000) |
| `bun run build` / `start` | Build y servidor de producción |
| `bun run appwrite:install` | Genera y arranca el stack de Appwrite (PostgreSQL) en `./appwrite` |
| `bun run appwrite:up` / `appwrite:down` | Arranca / para el stack ya instalado |
| `bun run appwrite:bootstrap` | Admin + proyecto + API key → `.env.local` |
| `bun run appwrite:configure` | Plataforma web y Google OAuth (si hay credenciales) |
| `bun run db:migrate` | Aplica migraciones pendientes (idempotente; ver aviso de producción arriba) |
| `bun run news:sync` | Refresca las noticias a mano (también se refrescan al abrir la bandeja) |
| `bun test` | Tests unitarios y de integración |
| `bun run verify` | Puerta de calidad completa (ver abajo) |

## Estructura

```
app/            páginas, login, rutas API y endpoint /mcp
components/     Terminal, simulador y shadcn en components/ui
lib/            acceso a Appwrite, cálculos, caché, sesión, MCP y OAuth
tests/          tests (bun test)
db/migrations/    migraciones versionadas de Appwrite (incluye Storage)
scripts/        instalación, bootstrap, configuración y migrador
```

## Problemas habituales

- **`429 Too Many Requests` al bajar imágenes de Docker Hub:** límite de descargas anónimas. Haz `docker login` o espera unos minutos.
- **El puerto 8080/8443 está ocupado:** cámbialo en `scripts/appwrite-install.sh` y en `APPWRITE_ENDPOINT`.
- **`fetch failed` al entrar:** Appwrite no está levantado; ejecuta `bun run appwrite:up`.
- **Entornos sandbox/CI sin IPv6 o con `ulimit -n` bajo:** la consola de Appwrite escucha en IPv6 y ClickHouse pide 262144 descriptores de archivo. Hay que ajustarlo con un `docker-compose.override.yml` local (no incluido).
- **Reiniciar desde cero:** `bun run appwrite:down`, borra `./appwrite` y los volúmenes de Docker `appwrite-*`, y repite los pasos.

## Validación antes de subir cambios

`bun run verify` es la **única puerta de calidad**: la ejecutan el hook `pre-push` (se instala solo con `bun install`), el hook de Claude Code (`.claude/settings.json`, que bloquea `git push` y las escrituras del MCP de GitHub) y la CI (`.github/workflows/verify.yml`). Pasos: lockfile, `bun test`, `next build`, `bun audit`, **Snyk** (`SNYK_TOKEN`) y **React Doctor 100/100 con 0 diagnósticos**. Detalles y reglas para agentes de IA en [`AGENTS.md`](AGENTS.md).

Para que sea obligatoria de verdad: añade `SNYK_TOKEN` como secreto del repositorio y exige el check `verify` en la protección de la rama `main` (Settings → Branches).
