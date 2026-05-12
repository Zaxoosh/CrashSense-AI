import { createDiscordReply, createGithubIssue, createGithubIssueUrl, createMarkdownReport } from "./formatters";
import type { AnalysisResult, LogType } from "./types";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

type AiPatch = Partial<Pick<AnalysisResult, "summary" | "likelyCause" | "fixSteps">>;

export async function enrichWithOpenAI(result: AnalysisResult, logType: LogType, log: string): Promise<AnalysisResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return result;
  }

  try {
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
    const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You improve crash-log diagnosis wording. Return JSON with summary, likelyCause, and fixSteps. Only use the supplied evidence. Do not invent evidence, change confidence, add new root causes, or include secrets.",
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
              logExcerpt: log.slice(0, 12000),
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return result;
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return result;
    }

    const patch = JSON.parse(content) as AiPatch;
    const enriched = {
      ...result,
      summary: typeof patch.summary === "string" ? patch.summary : result.summary,
      likelyCause: typeof patch.likelyCause === "string" ? patch.likelyCause : result.likelyCause,
      fixSteps: Array.isArray(patch.fixSteps) && patch.fixSteps.length > 0 ? patch.fixSteps.slice(0, 6) : result.fixSteps,
    };

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
