// Puerta de calidad ÚNICA: es lo que ejecutan el hook pre-push, el hook de agentes de IA
// (.claude/settings.json), la CI y `bun run verify`. Si algo falla, el push no debe hacerse.
// Corre todos los pasos aunque alguno falle, para que quien arregla vea todo de una vez.
//
//   bun run verify                  # todo
//   VERIFY_ONLY=test,build bun run verify   # subconjunto, para iterar (NO sirve para subir)
//   VERIFY_SKIP=snyk bun run verify # omitir un paso, SOLO en local y con motivo (la CI lo ignora)
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REACT_DOCTOR = "react-doctor@0.9.18"; // fijada: una versión nueva con reglas nuevas no debe romper el push a traición
const SNYK = "snyk@1.1308.2";
const inCI = Boolean(process.env.CI);
const only = new Set((process.env.VERIFY_ONLY ?? "").split(",").filter(Boolean));
const skip = new Set(inCI ? [] : (process.env.VERIFY_SKIP ?? "").split(",").filter(Boolean));

// La build solo necesita que existan estas variables, no que sean reales. Compila en `.next-verify`: con la
// misma carpeta que `next dev` (.next), cada verify le borraba los archivos al servidor de desarrollo abierto
// y la página mostraba "Algo ha fallado".
const buildEnv = { APPWRITE_ENDPOINT: "https://example.invalid/v1", APPWRITE_PROJECT_ID: "ci", APPWRITE_API_KEY: "ci", ...process.env, NEXT_DIST_DIR: ".next-verify" };

// En Windows `npx` es npx.cmd: spawnSync sin shell falla con ENOENT (y el paso se marcaba FALLO
// sin ningún mensaje). Solo en ese caso se usa shell, entrecomillando los argumentos con espacios.
const run = (cmd, args, env = process.env) => {
  const viaShell = process.platform === "win32" && cmd === "npx";
  const result = spawnSync(cmd, viaShell ? args.map((arg) => (/[\s"]/.test(arg) ? `"${arg}"` : arg)) : args, { stdio: "inherit", env, shell: viaShell });
  if (result.error) console.error(`No se pudo ejecutar ${cmd}: ${result.error.message}`);
  return result.status === 0;
};

const steps = [
  ["lockfile", "bun.lock sincronizado con package.json", () => run("bun", ["install", "--frozen-lockfile"])],
  ["test", "tests unitarios y de integración (bun test)", () => run("bun", ["test"])],
  // Next se lanza con node y su binario local, no con `npx next`: el shim .bin/next.exe que deja bun
  // hace que la build cargue otro Next/React desde un node_modules de una carpeta superior y el
  // prerender de /_global-error falla con "useContext de null".
  ["build", "next build compila sin errores", () => {
    try {
      return run(process.execPath, [join(process.cwd(), "node_modules", "next", "dist", "bin", "next"), "build"], buildEnv);
    } finally {
      // Solo hacía falta para comprobar que compila. Se borra: React Doctor analiza el código compilado que
      // encuentre (solo ignora `.next`) y lo puntuaría como si fuera nuestro.
      rmSync(buildEnv.NEXT_DIST_DIR, { recursive: true, force: true });
    }
  }],
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
