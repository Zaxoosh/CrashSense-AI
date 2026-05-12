import { createDiscordReply, createGithubIssue, createGithubIssueUrl, createMarkdownReport } from "./formatters";
import type { AnalysisResult, Confidence, LogType } from "./types";

type AiMode = "fallback" | "always" | "off";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type AiPatch = Partial<Pick<AnalysisResult, "summary" | "likelyCause" | "fixSteps" | "evidence" | "confidence">>;

type AiConfig = {
  apiKey?: string;
  baseUrl: string;
  mode: AiMode;
  model: string;
  timeoutMs: number;
};

const GENERIC_ONLY_RULES = new Set(["generic-crash"]);
const DEFAULT_AI_TIMEOUT_MS = 120000;
const GENERIC_FALLBACK_MESSAGE =
  "AI fallback was needed for this log, but no AI provider is configured or the configured provider could not be reached. Run `npm run setup` to configure local Ollama/Gemma 4 or a remote OpenAI-compatible API key.";

export function shouldUseAi(result: AnalysisResult): boolean {
  const mode = getAiConfig().mode;

  if (mode === "off") {
    return false;
  }

  if (mode === "always") {
    return true;
  }

  return result.detectedRules.length === 0 || result.detectedRules.every((rule) => GENERIC_ONLY_RULES.has(rule));
}

export function markAiNotConfigured(result: AnalysisResult): AnalysisResult {
  if (!needsAiTriage(result)) {
    return {
      ...result,
      aiStatus: "not-needed",
    };
  }

  return rebuildResult({
    ...result,
    likelyCause: `${result.likelyCause} ${GENERIC_FALLBACK_MESSAGE}`,
    fixSteps: [
      "Configure AI fallback with `npm run setup`.",
      "Choose local Ollama/Gemma 4 or a remote OpenAI-compatible API provider.",
      "Rerun the same log so AI can triage the unknown crash.",
      ...result.fixSteps.slice(0, 3),
    ],
    aiStatus: "not-configured",
    aiError: "AI fallback is not configured.",
  });
}

export async function analyzeWithAi(result: AnalysisResult, logType: LogType, redactedLog: string): Promise<AnalysisResult> {
  const config = getAiConfig();

  if (config.mode === "off") {
    return markAiNotConfigured(result);
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You diagnose crash logs for Minecraft modpacks, Docker/Unraid containers, GitHub Actions, and general apps.",
              "Return JSON with summary, likelyCause, confidence, evidence, and fixSteps.",
              "Use only the supplied redacted log and rule result.",
              "Evidence must be exact lines or exact short excerpts copied from the redacted log.",
              "Do not invent files, mods, services, versions, or evidence.",
              "If unsure, say what to inspect next and use low confidence.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify({
              logType,
              ruleBasedResult: {
                summary: result.summary,
                likelyCause: result.likelyCause,
                confidence: result.confidence,
                evidence: result.evidence,
                fixSteps: result.fixSteps,
                detectedRules: result.detectedRules,
              },
              redactedLog: redactedLog.slice(0, 16000),
            }),
          },
        ],
      }),
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      return markAiFailed(result, await describeHttpFailure(response, config));
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return markAiFailed(result, "AI provider returned an empty response.");
    }

    const patch = JSON.parse(content) as AiPatch;
    const evidence = normalizeEvidence(patch.evidence, redactedLog);
    const mode = shouldUseAi(result) && result.detectedRules.every((rule) => GENERIC_ONLY_RULES.has(rule)) ? "fallback" : config.mode === "always" ? "enrichment" : "fallback";
    const enriched = {
      ...result,
      summary: typeof patch.summary === "string" ? patch.summary : result.summary,
      likelyCause: typeof patch.likelyCause === "string" ? patch.likelyCause : result.likelyCause,
      confidence: isConfidence(patch.confidence) ? patch.confidence : result.confidence,
      evidence: evidence.length > 0 ? evidence : result.evidence,
      fixSteps: Array.isArray(patch.fixSteps) && patch.fixSteps.length > 0 ? patch.fixSteps.slice(0, 6) : result.fixSteps,
      aiUsed: true,
      aiMode: mode,
      aiModel: config.model,
      aiStatus: "used",
      aiError: undefined,
    } satisfies AnalysisResult;

    return rebuildResult(enriched, logType);
  } catch (error) {
    return markAiFailed(result, describeThrownFailure(error, config));
  }
}

function getAiConfig(): AiConfig {
  const explicitMode = process.env.CRASHSENSE_AI_MODE ?? process.env.AI_MODE;
  const hasExplicitConfig = Boolean(
    explicitMode ??
      process.env.CRASHSENSE_AI_BASE_URL ??
      process.env.AI_BASE_URL ??
      process.env.OPENAI_BASE_URL ??
      process.env.CRASHSENSE_AI_MODEL ??
      process.env.AI_MODEL ??
      process.env.OPENAI_MODEL ??
      process.env.CRASHSENSE_AI_API_KEY ??
      process.env.AI_API_KEY ??
      process.env.OPENAI_API_KEY,
  );
  const mode = hasExplicitConfig ? parseMode(explicitMode) : "off";
  const baseUrl = process.env.CRASHSENSE_AI_BASE_URL ?? process.env.AI_BASE_URL ?? process.env.OPENAI_BASE_URL ?? "http://localhost:11434/v1";
  const model = process.env.CRASHSENSE_AI_MODEL ?? process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? "gemma4:e4b";
  const apiKey = process.env.CRASHSENSE_AI_API_KEY ?? process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  const timeoutMs = Number(process.env.CRASHSENSE_AI_TIMEOUT_MS ?? `${DEFAULT_AI_TIMEOUT_MS}`);

  return {
    apiKey: apiKey || undefined,
    baseUrl,
    mode,
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_AI_TIMEOUT_MS,
  };
}

function parseMode(value?: string): AiMode {
  if (value === "always" || value === "off") {
    return value;
  }

  return "fallback";
}

function needsAiTriage(result: AnalysisResult): boolean {
  return result.detectedRules.length === 0 || result.detectedRules.every((rule) => GENERIC_ONLY_RULES.has(rule));
}

function markAiFailed(result: AnalysisResult, aiError: string): AnalysisResult {
  if (!needsAiTriage(result)) {
    return {
      ...result,
      aiStatus: "failed",
      aiError,
    };
  }

  return rebuildResult({
    ...result,
    likelyCause: `${result.likelyCause} ${GENERIC_FALLBACK_MESSAGE}`,
    fixSteps: [
      "Check the AI fallback status card for the provider error.",
      "For Ollama, install it from https://ollama.com/download, reopen your terminal, then run `ollama --version`.",
      "Pull the configured model with `npm run ai:ollama:pull`.",
      "If this timed out on first load, set `CRASHSENSE_AI_TIMEOUT_MS=120000` or higher in `.env.local`.",
      "Confirm `.env.local` has `CRASHSENSE_AI_MODE=fallback` and the correct base URL/model.",
      ...result.fixSteps.slice(0, 3),
    ],
    aiStatus: "failed",
    aiError,
  });
}

async function describeHttpFailure(response: Response, config: AiConfig): Promise<string> {
  const body = await response.text().catch(() => "");
  const detail = body ? ` Provider response: ${body.slice(0, 400)}` : "";

  if (response.status === 404) {
    return `AI provider returned HTTP 404 for model "${config.model}". For Ollama, run \`ollama pull ${config.model}\` and verify the model name in .env.local.${detail}`;
  }

  if (response.status === 401 || response.status === 403) {
    return `AI provider rejected the request with HTTP ${response.status}. Check CRASHSENSE_AI_API_KEY and provider permissions.${detail}`;
  }

  return `AI provider returned HTTP ${response.status}.${detail}`;
}

function describeThrownFailure(error: unknown, config: AiConfig): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return `AI request timed out after ${config.timeoutMs}ms. Local models can take a while to load on first use; increase CRASHSENSE_AI_TIMEOUT_MS or start the model once with \`npm run ai:ollama:run\`.`;
  }

  if (error instanceof Error && /aborted/i.test(error.message)) {
    return `AI request was aborted after ${config.timeoutMs}ms. Local models can take a while to load on first use; increase CRASHSENSE_AI_TIMEOUT_MS or start the model once with \`npm run ai:ollama:run\`.`;
  }

  if (error instanceof TypeError && /fetch failed/i.test(error.message)) {
    return `Could not reach AI provider at ${config.baseUrl}. For local Ollama, install it, run \`ollama --version\`, and make sure the Ollama app/server is running.`;
  }

  return error instanceof Error ? error.message : "AI fallback failed.";
}

function rebuildResult(result: AnalysisResult, logType: LogType = "unknown"): AnalysisResult {
  const githubIssue = createGithubIssue(result, logType);
  const markdownReport = createMarkdownReport(result, logType);

  return {
    ...result,
    discordReply: createDiscordReply(result),
    githubIssue,
    markdownReport,
    jsonReport: JSON.stringify(result, null, 2),
    githubIssueUrl: createGithubIssueUrl(githubIssue),
  };
}

function isConfidence(value: unknown): value is Confidence {
  return value === "low" || value === "medium" || value === "high";
}

function normalizeEvidence(value: unknown, redactedLog: string): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && redactedLog.includes(line))
    .slice(0, 6);
}
