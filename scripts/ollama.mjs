import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const model = process.env.CRASHSENSE_AI_MODEL || process.env.AI_MODEL || process.env.OPENAI_MODEL || "gemma4:e4b";

if (args.length === 0) {
  printUsage();
  process.exit(0);
}

if (!hasOllama()) {
  console.error(
    [
      "Ollama is not installed or is not available on PATH.",
      "",
      "Install Ollama first:",
      "  Windows/macOS/Linux: https://ollama.com/download",
      "",
      "After installing:",
      "  1. Close and reopen your terminal.",
      "  2. Run: ollama --version",
      `  3. Run: npm run ai:ollama:pull`,
      "",
      `CrashSense AI is configured to use local model: ${model}`,
    ].join("\n"),
  );
  process.exit(1);
}

const command = args[0];
const commandArgs = command === "pull" || command === "run" ? [command, model] : args;
const result = spawnSync("ollama", commandArgs, { stdio: "inherit", shell: process.platform === "win32" });

process.exit(result.status ?? 1);

function hasOllama() {
  const result = spawnSync("ollama", ["--version"], { stdio: "ignore", shell: process.platform === "win32" });

  return result.status === 0;
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/ollama.mjs pull",
      "  node scripts/ollama.mjs run",
      "  node scripts/ollama.mjs list",
    ].join("\n"),
  );
}
