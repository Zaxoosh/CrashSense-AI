import { analyzeCrashLog, type AnalysisRequest, type LogType } from "@/lib/analysis";
import { analyzeWithAi, markAiNotConfigured, shouldUseAi } from "@/lib/analysis/openai";
import { redactLog } from "@/lib/analysis/redaction";

const logTypes: LogType[] = ["minecraft", "docker", "github-actions", "unknown"];

type StageStatus = "active" | "done" | "skipped" | "failed";

type StreamStage = {
  id: string;
  label: string;
  message: string;
  status: StageStatus;
};

export async function POST(request: Request) {
  let body: Partial<AnalysisRequest>;

  try {
    body = (await request.json()) as Partial<AnalysisRequest>;
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const log = typeof body.log === "string" ? body.log.trim() : "";
  const logType = logTypes.includes(body.logType as LogType) ? (body.logType as LogType) : "unknown";
  const forceAi = body.forceAi === true;

  if (!log) {
    return Response.json({ error: "Paste a crash log before analysing." }, { status: 400 });
  }

  if (log.length > 200_000) {
    return Response.json({ error: "Log is too large for the MVP analyzer. Please paste the relevant crash section." }, { status: 413 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const stage = (payload: StreamStage) => send("stage", payload);

      try {
        stage({ id: "prepare", label: "Preparing log", message: "Log accepted by the server.", status: "active" });

        const { redactedLog } = redactLog(log);
        stage({ id: "prepare", label: "Preparing log", message: "Sensitive values redacted before AI use.", status: "done" });

        stage({ id: "rules", label: "Running rule parser", message: "Checking known crash signatures.", status: "active" });
        const ruleBasedResult = analyzeCrashLog({ log, logType });
        stage({
          id: "rules",
          label: "Running rule parser",
          message: ruleBasedResult.detectedRules.length > 0 ? `Matched ${ruleBasedResult.detectedRules.length} rule(s).` : "No rule matched.",
          status: "done",
        });

        stage({ id: "ai-check", label: "Checking AI triage", message: forceAi ? "AI triage was requested." : "Checking whether fallback AI is needed.", status: "active" });
        const useAi = shouldUseAi(ruleBasedResult, { forceAi });
        stage({
          id: "ai-check",
          label: "Checking AI triage",
          message: useAi ? "AI triage will run if a provider is configured." : "Specific rule result is enough for fallback mode.",
          status: useAi ? "done" : "skipped",
        });

        if (useAi) {
          stage({
            id: "ai",
            label: "AI provider",
            message: "Sending the redacted log to the configured AI provider.",
            status: "active",
          });
        }

        const result = useAi ? await analyzeWithAi(ruleBasedResult, logType, redactedLog, { forceAi }) : markAiNotConfigured(ruleBasedResult, { forceAi });

        stage({
          id: "ai",
          label: "AI provider",
          message: result.aiUsed ? `Used ${result.aiModel ?? "configured model"}.` : result.aiError ?? result.aiStatus,
          status: result.aiStatus === "failed" ? "failed" : result.aiStatus === "not-needed" ? "skipped" : "done",
        });

        stage({ id: "format", label: "Formatting report", message: "Preparing copy-ready outputs.", status: "done" });
        send("result", result);
      } catch (error) {
        send("error", { message: error instanceof Error ? error.message : "Analysis failed." });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
    },
  });
}
