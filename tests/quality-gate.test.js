import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";

// La puerta de calidad es lo que protege main: se prueba que bloquea y que no se puede esquivar en CI.
const run = (file, args, { env = {}, input } = {}) => spawnSync("node", [file, ...args], { cwd: process.cwd(), input, encoding: "utf8", env: { ...process.env, CI: "", VERIFY_ONLY: "", VERIFY_SKIP: "", ...env } });
const hook = (tool, command, env) => run(".claude/hooks/verify-before-push.mjs", [], { input: JSON.stringify({ tool_name: tool, tool_input: { command }, cwd: process.cwd() }), env });

describe("hook de agentes (.claude/hooks/verify-before-push.mjs)", () => {
  test.each([
    "ls -la",
    "git status",
    "git log --oneline",
    'echo "recuerda hacer git push luego"',
    "git commit -m 'antes de git push'",
    "cat <<'EOF'\n  texto con git push en medio\nEOF",
  ])("deja pasar %p (no es un git push)", (command) => expect(hook("Bash", command).status).toBe(0));

  test.each([
    "git push",
    "git push -u origin main",
    "git -c x=y push origin HEAD:main",
    "cd repo && git push --force",
    "echo listo; git push",
    "VERIFY_SKIP=snyk git push",
    "echo hecho\ngit push origin main",
  ])("intercepta %p y bloquea si la validación falla", (command) => {
    const result = hook("Bash", command, { VERIFY_ONLY: "nonexistent" }); // VERIFY_ONLY nunca devuelve éxito
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("BLOQUEADO");
  });

  test("intercepta las escrituras del MCP de GitHub", () => {
    for (const tool of ["mcp__github__push_files", "mcp__github__create_or_update_file", "mcp__github__merge_pull_request"]) expect(hook(tool, "", { VERIFY_ONLY: "nonexistent" }).status).toBe(2);
    expect(hook("mcp__github__get_file_contents", "").status).toBe(0);
  });
});

describe("scripts/verify.mjs", () => {
  test("snyk falla sin SNYK_TOKEN (no se omite en silencio)", () => {
    const result = run("scripts/verify.mjs", [], { env: { VERIFY_ONLY: "snyk", SNYK_TOKEN: "" } });
    expect(result.status).toBe(1);
    expect(result.stdout + result.stderr).toContain("Falta SNYK_TOKEN");
  });
  test("VERIFY_SKIP omite un paso en local, avisando", () => {
    const result = run("scripts/verify.mjs", [], { env: { VERIFY_ONLY: "snyk", VERIFY_SKIP: "snyk" } });
    expect(result.stdout + result.stderr).toContain("OMITIDO snyk");
  });
  test("en CI VERIFY_SKIP se ignora: el paso se ejecuta y falla", () => {
    const result = run("scripts/verify.mjs", [], { env: { CI: "true", VERIFY_ONLY: "snyk", VERIFY_SKIP: "snyk", SNYK_TOKEN: "" } });
    expect(result.stdout + result.stderr).not.toContain("OMITIDO");
    expect(result.stdout + result.stderr).toContain("Falta SNYK_TOKEN");
  });
  // Ejecuta `bun install --frozen-lockfile` de verdad (red/disco): con el límite por defecto de 5 s fallaba a veces.
  test("una ejecución parcial nunca devuelve éxito", () => expect(run("scripts/verify.mjs", [], { env: { VERIFY_ONLY: "lockfile" } }).status).toBe(1), 60000);
});
