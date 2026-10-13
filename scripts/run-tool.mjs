import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const env = {
  ...process.env,
  PLAYWRIGHT_BROWSERS_PATH: join(tmpdir(), "signflow-browsers"),
};
const tasks = {
  "browser-test": ["@playwright/test/cli.js", ["test"]],
  "browser-install": ["@playwright/test/cli.js", ["install", "chromium"]],
  "e2e-api": [
    "tsx/dist/cli.mjs",
    ["--tsconfig", "apps/api/tsconfig.json", "scripts/e2e-server.ts"],
  ],
  "e2e-web": [
    "next/dist/bin/next",
    ["dev", "apps/web", "--hostname", "localhost", "--port", "3100"],
  ],
};
const mode = process.argv[2];
const task = tasks[mode];
if (!task) throw new Error("Comando de teste desconhecido");
if (mode.startsWith("e2e-")) {
  Object.assign(env, {
    NODE_ENV: mode === "e2e-api" ? "test" : "development",
    E2E: "true",
    WEB_ORIGIN: "http://localhost:3100",
    API_URL: "http://localhost:3101",
    EVIDENCE_SECRET: "ephemeral-e2e-evidence-secret-32-characters",
    JOB_SECRET: "ephemeral-e2e-job-secret-32-characters",
  });
}
const child = spawn(
  process.execPath,
  [join(root, "node_modules", task[0]), ...task[1], ...process.argv.slice(3)],
  { cwd: root, env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
