# AgentSolver · Terminal del agente

Demo para el reto "de la página en blanco al wow": la cartera de un agente de fútbol vista como una cartera de inversión.

- **Cartera:** cada jugador con valor, evolución, vencimiento de contrato y *palanca* (0-100: cuánta fuerza tienes para negociar ahora).
- **Simulador de negociación:** eliges club y salario; ves probabilidad de cierre y comisión esperada, y calculas la petición óptima.
- **MCP:** las mismas herramientas disponibles para Claude Desktop u otros clientes MCP.
- **Backend:** Appwrite autoalojado sobre **PostgreSQL**, con migraciones versionadas y login con Google.

> Todos los jugadores, clubes y cifras son **ficticios**. La probabilidad de cierre y la comisión (5 % × 3 años) son un modelo ilustrativo, no asesoramiento.

Stack: Next.js (App Router, JSX) · Bun · Tailwind CSS 4 · shadcn/ui · Appwrite (`node-appwrite`).

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

# 3. Aplica las migraciones (tablas, índices, datos de ejemplo)
bun run db:migrate

# 4. Crea el usuario demo y registra localhost como plataforma web
bun run appwrite:demo-user
bun run appwrite:configure

# 5. Arranca la app
bun run dev
```

Abre <http://localhost:3000> y pulsa **Entrar como agente demo**.
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

Sin estas credenciales el botón de Google devuelve al login con un error; el acceso demo funciona igualmente.

Para Apple añade también `APPLE_SERVICE_ID`, `APPLE_KEY_ID`, `APPLE_TEAM_ID` y `APPLE_P8_FILE` al entorno. Appwrite valida Google/Apple y mantiene sus sesiones; AgentSolver solo guarda la sesión de Appwrite en una cookie HTTP-only.

La página de conexión MCP lee `NEXT_PUBLIC_MCP_URL` durante el build. Usa la URL HTTPS pública del servidor, por ejemplo `https://mcp.tudominio.com`.

## Servidor MCP

El servidor MCP usa transporte `stdio`, por lo que funciona con clientes de escritorio como Claude Desktop sin exponer un endpoint público. En esta versión no hay una página OAuth ni un endpoint HTTP del MCP. Para añadir OAuth real habría que migrarlo a transporte HTTP y definir proveedor, callback y scopes.

```bash
bun run mcp
```

Ejemplo para Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agentsolver": {
      "command": "bun",
      "args": ["--env-file=.env.local", "mcp/server.ts"],
      "cwd": "/ruta/al/repo"
    }
  }
}
```

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
| `bun run appwrite:demo-user` | Crea el usuario de la demo |
| `bun run db:migrate` | Aplica migraciones pendientes (idempotente) |
| `bun run mcp` | Servidor MCP TypeScript por stdio |

## Estructura

```
app/            páginas, login y rutas API (auth)
components/     Terminal, simulador y shadcn en components/ui
lib/            datos, cálculos compartidos (tools.js), cliente Appwrite, sesión
mcp/server.ts   servidor MCP TypeScript
db/migrations/    migraciones (001 esquema, 002 índices, 003 datos)
scripts/        instalación, bootstrap, configuración y migrador
```

## Problemas habituales

- **`429 Too Many Requests` al bajar imágenes de Docker Hub:** límite de descargas anónimas. Haz `docker login` o espera unos minutos.
- **El puerto 8080/8443 está ocupado:** cámbialo en `scripts/appwrite-install.sh` y en `APPWRITE_ENDPOINT`.
- **`fetch failed` al entrar:** Appwrite no está levantado; ejecuta `bun run appwrite:up`.
- **Entornos sandbox/CI sin IPv6 o con `ulimit -n` bajo:** la consola de Appwrite escucha en IPv6 y ClickHouse pide 262144 descriptores de archivo. Hay que ajustarlo con un `docker-compose.override.yml` local (no incluido).
- **Reiniciar desde cero:** `bun run appwrite:down`, borra `./appwrite` y los volúmenes de Docker `appwrite-*`, y repite los pasos.
