// Puerta de calidad ÚNICA: es lo que ejecutan el hook pre-push, el hook de agentes de IA
// (.claude/settings.json), la CI y `bun run verify`. Si algo falla, el push no debe hacerse.
// Corre todos los pasos aunque alguno falle, para que quien arregla vea todo de una vez.
//
//   bun run verify                  # todo
//   VERIFY_ONLY=test,build bun run verify   # subconjunto, para iterar (NO sirve para subir)
//   VERIFY_SKIP=snyk bun run verify # omitir un paso, SOLO en local y con motivo (la CI lo ignora)
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REACT_DOCTOR = "react-doctor@0.9.18"; // fijada: una versión nueva con reglas nuevas no debe romper el push a traición
const SNYK = "snyk@1.1308.2";
const inCI = Boolean(process.env.CI);
const only = new Set((process.env.VERIFY_ONLY ?? "").split(",").filter(Boolean));
const skip = new Set(inCI ? [] : (process.env.VERIFY_SKIP ?? "").split(",").filter(Boolean));

// La build solo necesita que existan estas variables, no que sean reales.
const buildEnv = { APPWRITE_ENDPOINT: "https://example.invalid/v1", APPWRITE_PROJECT_ID: "ci", APPWRITE_API_KEY: "ci", ...process.env };

const run = (cmd, args, env = process.env) => spawnSync(cmd, args, { stdio: "inherit", env, shell: false }).status === 0;

const steps = [
  ["lockfile", "bun.lock sincronizado con package.json", () => run("bun", ["install", "--frozen-lockfile"])],
  ["test", "tests unitarios y de integración (bun test)", () => run("bun", ["test"])],
  ["build", "next build compila sin errores", () => run("npx", ["next", "build"], buildEnv)],
  ["audit", "bun audit: ninguna vulnerabilidad conocida en dependencias", () => run("bun", ["audit"])],
  ["snyk", "Snyk: dependencias (SCA) y código (SAST)", () => {
    if (!process.env.SNYK_TOKEN) {
      console.error("Falta SNYK_TOKEN. Créalo en https://app.snyk.io/account (Auth Token) y expórtalo: export SNYK_TOKEN=...");
      return false;
    }
    return run("npx", ["-y", SNYK, "test", "--severity-threshold=low"]) && run("npx", ["-y", SNYK, "code", "test", "--severity-threshold=low"]);
  }],
  ["react-doctor", "React Doctor: puntuación 100/100 y 0 diagnósticos", () => {
    const report = join(mkdtempSync(join(tmpdir(), "rd-")), "report.json");
    // Sin --no-supply-chain: también revisa la salud de las dependencias.
    run("npx", ["-y", REACT_DOCTOR, ".", "--yes", "--json", "--json-out", report]);
    let result;
    try { result = JSON.parse(readFileSync(report, "utf8")); } catch { console.error("React Doctor no generó informe"); return false; }
    const { score, totalDiagnosticCount } = result.summary ?? {};
    console.log(`React Doctor: puntuación ${score}/100, ${totalDiagnosticCount} diagnósticos`);
    for (const d of (result.diagnostics ?? []).slice(0, 30)) console.log(`  ${d.filePath}:${d.line}  [${d.rule}] ${d.title ?? d.message}`);
    if ((result.diagnostics ?? []).length > 30) console.log(`  … y ${result.diagnostics.length - 30} más`);
    return result.ok !== false && !result.error && score === 100 && totalDiagnosticCount === 0;
  }],
];

const results = [];
for (const [id, label, fn] of steps) {
  if (only.size && !only.has(id)) continue;
  if (skip.has(id)) { console.warn(`\n⚠️  OMITIDO ${id} (VERIFY_SKIP). Documenta el motivo en el commit.`); results.push([id, "skip"]); continue; }
  console.log(`\n━━ ${id}: ${label}`);
  results.push([id, fn() ? "ok" : "FALLO"]);
}

console.log("\n━━ Resumen");
for (const [id, status] of results) console.log(`${status === "ok" ? "✅" : status === "skip" ? "⚠️ " : "❌"} ${id} ${status === "ok" ? "" : status}`);
if (only.size) console.warn("\nVERIFY_ONLY activo: esto NO es una validación completa.");
process.exit(results.some(([, status]) => status === "FALLO") || only.size ? 1 : 0);
