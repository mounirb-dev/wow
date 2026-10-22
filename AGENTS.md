<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Reglas obligatorias antes de subir cambios (agentes de IA y personas)

**Nunca hagas `git push` (ni uses las herramientas de escritura del MCP de GitHub) sin que `bun run verify` termine en verde.** Es una única puerta de calidad, la misma que ejecutan el hook `pre-push`, el hook de Claude Code (`.claude/settings.json`) y la CI (`.github/workflows/verify.yml`). Pasos:

1. `bun install --frozen-lockfile` — el lockfile coincide con `package.json`.
2. `bun test` — tests unitarios y de integración (incluye el flujo OAuth y el endpoint `/mcp`).
3. `next build` — compila sin errores.
4. `bun audit` — sin vulnerabilidades conocidas.
5. **Snyk** (`snyk test` + `snyk code test`) — necesita `SNYK_TOKEN` en el entorno.
6. **React Doctor** (`react-doctor@0.9.18`) — **100/100 y 0 diagnósticos**. No termines hasta conseguirlo.

Reglas:

- Si un paso falla, **arregla la causa**. No bajes el listón: no desactives reglas, no silencies diagnósticos con comentarios, no borres tests, no uses `--no-verify`, no cambies la versión fijada de React Doctor para esquivar reglas.
- Cada cambio de comportamiento lleva su test en `tests/`. Los bugs se arreglan con un test que los reproduce primero.
- Itera con `VERIFY_ONLY=test,build bun run verify`, pero esa ejecución parcial **no vale para subir**.
- Si el cambio toca la interfaz, la subida de archivos o el borrado de datos, **pruébalo en el navegador antes de subir**: sigue `docs/pruebas-navegador.md` con el navegador integrado (sin Playwright) y borra después lo que hayas creado.
- `VERIFY_SKIP=<paso>` solo existe para un fallo de entorno ajeno al código (p. ej. no hay `SNYK_TOKEN` en una sesión local). Hay que escribirlo delante del comando a la vista, justificarlo en el mensaje del commit y decírselo al usuario. La CI lo ignora siempre.
- Si no tienes `SNYK_TOKEN`, no lo inventes ni lo pidas por chat: avisa al usuario de que Snyk no se ha podido ejecutar.
- Lee `docs/arquitectura.md` antes de tocar datos: toda consulta debe filtrar por workspace.
