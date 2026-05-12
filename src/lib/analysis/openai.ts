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

export async function analyzeWithAi(result: AnalysisResult, logType: LogType, redactedLog: string): Promise<AnalysisResult> {
  const config = getAiConfig();

  if (config.mode === "off") {
    return result;
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
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return result;
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return result;
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
    } satisfies AnalysisResult;

    const githubIssue = createGithubIssue(enriched, logType);
    const markdownReport = createMarkdownReport(enriched, logType);

    return {
      ...enriched,
      discordReply: createDiscordReply(enriched),
      githubIssue,
      markdownReport,
      jsonReport: JSON.stringify(enriched, null, 2),
      githubIssueUrl: createGithubIssueUrl(githubIssue),
    };
  } catch {
    return result;
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
  const timeoutMs = Number(process.env.CRASHSENSE_AI_TIMEOUT_MS ?? "20000");

  return {
    apiKey: apiKey || undefined,
    baseUrl,
    mode,
    model,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : 20000,
  };
}

function parseMode(value?: string): AiMode {
  if (value === "always" || value === "off") {
    return value;
  }

  return "fallback";
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
