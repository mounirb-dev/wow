// Hook PreToolUse para agentes de IA (Claude Code): antes de cualquier push ejecuta la puerta
// de calidad completa y BLOQUEA la acción (exit 2) si falla, devolviendo el motivo al agente.
// Cubre `git push` por terminal (aunque use --no-verify) y las herramientas del MCP de GitHub
// que escriben en el repositorio sin pasar por git. Es lo mismo que ejecutan el hook pre-push
// y la CI: scripts/verify.mjs.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const input = JSON.parse(readFileSync(0, "utf8"));
const command = input.tool_input?.command ?? "";
// `git push` solo cuenta si es un COMANDO: al inicio, tras ; && || | ( o un salto de línea, con
// variables de entorno opcionales delante. Así no salta con texto citado (echo "git push", un
// mensaje de commit o un heredoc que lo menciona a mitad de línea).
const GIT_PUSH = /(?:^|[;&|(\n])\s*(?:\w+=\S+\s+)*git\s+(?:(?:-c|-C)\s+\S+\s+|--?[\w-]+(?:=\S+)?\s+)*push\b/;
const isGitPush = input.tool_name === "Bash" && GIT_PUSH.test(command);
const isGithubWrite = /^mcp__github__(push_files|create_or_update_file|delete_file|merge_pull_request)$/.test(input.tool_name ?? "");
if (!isGitPush && !isGithubWrite) process.exit(0);

// Misma semántica que en el hook de git: un `VERIFY_SKIP=paso` escrito delante del comando es la
// única forma de omitir un paso, queda a la vista en el historial y la CI la ignora.
const env = { ...process.env };
const skip = /(?:^|[\s;&|(])VERIFY_SKIP=([\w,-]+)/.exec(command);
if (skip) env.VERIFY_SKIP = skip[1];

const result = spawnSync("node", ["scripts/verify.mjs"], { cwd: input.cwd ?? process.cwd(), env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (result.status === 0) process.exit(0);

const tail = `${result.stdout ?? ""}${result.stderr ?? ""}`.split("\n").slice(-60).join("\n");
console.error(`BLOQUEADO: la validación previa al push ha fallado. Arregla la causa y vuelve a intentarlo.\nNo uses --no-verify ni omitas pasos para saltarte esta comprobación.\n\n${tail}`);
process.exit(2);
