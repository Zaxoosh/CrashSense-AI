import { NextResponse } from "next/server";
import { analyzeCrashLog, type AnalysisRequest, type LogType } from "@/lib/analysis";
import { analyzeWithAi, markAiNotConfigured, shouldUseAi } from "@/lib/analysis/openai";
import { redactLog } from "@/lib/analysis/redaction";

const logTypes: LogType[] = ["minecraft", "docker", "github-actions", "unknown"];

export async function POST(request: Request) {
  let body: Partial<AnalysisRequest>;

  try {
    body = (await request.json()) as Partial<AnalysisRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const log = typeof body.log === "string" ? body.log.trim() : "";
  const logType = logTypes.includes(body.logType as LogType) ? (body.logType as LogType) : "unknown";
  const forceAi = body.forceAi === true;

  if (!log) {
    return NextResponse.json({ error: "Paste a crash log before analysing." }, { status: 400 });
  }

  if (log.length > 200_000) {
    return NextResponse.json({ error: "Log is too large for the MVP analyzer. Please paste the relevant crash section." }, { status: 413 });
  }

  const { redactedLog } = redactLog(log);
  const ruleBasedResult = analyzeCrashLog({ log, logType });
  const result = shouldUseAi(ruleBasedResult, { forceAi })
    ? await analyzeWithAi(ruleBasedResult, logType, redactedLog, { forceAi })
    : markAiNotConfigured(ruleBasedResult, { forceAi });

  return NextResponse.json(result);
}
