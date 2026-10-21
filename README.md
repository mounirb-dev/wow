# AgentSolver · Terminal del agente

Workspace para gestionar una cartera de fútbol, negociaciones, documentos y criterio del staff.

- **Cartera:** cada jugador con valor, evolución, vencimiento de contrato y *palanca* (0-100: cuánta fuerza tienes para negociar ahora).
- **Simulador de negociación:** eliges club y salario; ves probabilidad de cierre y comisión esperada, y calculas la petición óptima.
- **MCP:** las mismas herramientas disponibles para Claude Desktop u otros clientes MCP.
- **Backend:** Appwrite sobre **PostgreSQL**, con migraciones versionadas, Appwrite Storage y login con Google/Apple.

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

Abre <http://localhost:3000> y entra con una cuenta real de Appwrite.
La consola de Appwrite está en <http://localhost:8080> (`admin@agentsolver.local` / `AgentSolver#2026!`, solo para desarrollo local).

## Login con Google y Apple (Appwrite)

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials) crea un *ID de cliente de OAuth* de tipo **Aplicación web**.
2. Añade como **URI de redireccionamiento autorizado**:
   `http://localhost:8080/v1/account/sessions/oauth2/callback/google/agentsolver`
3. Copia el ID y el secreto a `.env.local` (plantilla en `.env.example`):
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
4. Ejecuta `bun run appwrite:configure` y reinicia `bun run dev`.

Sin estas credenciales el botón de Google devuelve al login con un error.

Para Apple añade también `APPLE_SERVICE_ID`, `APPLE_KEY_ID`, `APPLE_TEAM_ID` y `APPLE_P8_FILE` al entorno. Appwrite valida Google/Apple y mantiene sus sesiones; AgentSolver solo guarda la sesión de Appwrite en una cookie HTTP-only.

## Servidor MCP (remoto, con OAuth)

El MCP es un endpoint HTTP en **`/mcp`** (Streamable HTTP, sin estado) protegido con OAuth 2.1 + PKCE. Cada usuario autoriza el acceso con su cuenta y solo ve los datos de su workspace. Herramientas (solo lectura): `list_clients`, `portfolio_summary`, `valuation`, `negotiation_brief`.

**Conectar Claude** (web, escritorio o móvil): Ajustes → Conectores → *Añadir conector personalizado* → URL `https://TU-DOMINIO/mcp`. Claude descubre el OAuth solo (`/.well-known/oauth-*`), te lleva a `/mcp/oauth` para iniciar sesión y pulsar *Autorizar acceso*.

Cómo funciona (código en `lib/mcp-oauth.js`, `lib/mcp-http.js`, `app/mcp`, `app/api/mcp/oauth`):

- Registro dinámico de clientes (RFC 7591), consentimiento en `/mcp/oauth`, canje de código con PKCE S256 y refresh tokens.
- Tokens firmados con HMAC, sin tablas nuevas. La clave es `MCP_OAUTH_SECRET`; si no existe se deriva de `APPWRITE_API_KEY`. Rotarla invalida todos los accesos. Access token 1 h, refresh 30 días.
- En cada llamada se vuelve a resolver la membresía del workspace del usuario: si lo expulsan, deja de ver datos aunque su token no haya caducado.

Probar en local: `bunx @modelcontextprotocol/inspector` y apuntar a `http://localhost:3000/mcp`.

> El antiguo servidor `stdio` (`bun run mcp`) se eliminó: no tenía sesión de usuario y no podía saber de qué workspace leer.

Herramientas: `list_clients`, `portfolio_summary`, `valuation`, `negotiation_brief`. Leen de la misma base de datos que la web.

## Scripts

| Comando | Qué hace |
| --- | --- |
| `bun run dev` | Next.js en desarrollo (puerto 3000) |
| `bun run build` / `start` | Build y servidor de producción |
| `bun run appwrite:install` | Genera y arranca el stack de Appwrite (PostgreSQL) en `./appwrite` |
| `bun run appwrite:up` / `appwrite:down` | Arranca / para el stack ya instalado |
| `bun run appwrite:bootstrap` | Admin + proyecto + API key → `.env.local` |
| `bun run appwrite:configure` | Plataforma web y Google OAuth (si hay credenciales) |
| `bun run db:migrate` | Aplica migraciones pendientes (idempotente) |
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
