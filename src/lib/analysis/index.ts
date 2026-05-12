import { createDiscordReply, createGithubIssue, createGithubIssueUrl, createMarkdownReport } from "./formatters";
import { redactLog } from "./redaction";
import { matchRules } from "./rules";
import type { AnalysisRequest, AnalysisResult, Confidence, LogType, RedactionSummary, RuleMatch } from "./types";

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function analyzeLog(log: string, logType: LogType): AnalysisResult {
  return createAnalysis(log, logType, []);
}

export function analyzeCrashLog(request: AnalysisRequest): AnalysisResult {
  const { redactedLog, redactions } = redactLog(request.log);

  return createAnalysis(redactedLog, request.logType, redactions);
}

function createAnalysis(log: string, logType: LogType, redactions: RedactionSummary[]): AnalysisResult {
  const matches = matchRules(log, logType);
  const primary = choosePrimaryMatch(matches);

  const base = {
    summary: primary?.summary ?? "No known crash signature was detected in the provided log.",
    likelyCause:
      primary?.cause ??
      "CrashSense AI could not identify a specific root cause. More surrounding log context may be needed.",
    confidence: primary?.confidence ?? "low",
    evidence: collectEvidence(matches),
    fixSteps:
      primary?.fixSteps ??
      [
        "Paste a longer log section that includes the first error and stack trace.",
        "Include environment details such as app version, OS, runtime, and recent changes.",
        "Search for the first occurrence of `error`, `exception`, or `failed` before the final shutdown lines.",
      ],
    detectedRules: matches.map((match) => match.id),
    findings: matches.map(({ id, title, cause, confidence, evidence, fixSteps, firstLine, score }) => ({
      id,
      title,
      cause,
      confidence,
      evidence,
      fixSteps,
      firstLine,
      score,
    })),
    redactions,
    aiUsed: false,
    aiMode: "none" as const,
  };
  const githubIssue = createGithubIssue(base, logType);
  const markdownReport = createMarkdownReport(base, logType);

  return {
    ...base,
    discordReply: createDiscordReply(base),
    githubIssue,
    markdownReport,
    jsonReport: JSON.stringify(base, null, 2),
    githubIssueUrl: createGithubIssueUrl(githubIssue),
  };
}

function choosePrimaryMatch(matches: RuleMatch[]): RuleMatch | undefined {
  return [...matches].sort((left, right) => {
    const scoreDiff = right.score - left.score;

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const confidenceDiff = CONFIDENCE_WEIGHT[right.confidence] - CONFIDENCE_WEIGHT[left.confidence];

    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    return left.firstLine - right.firstLine;
  })[0];
}

function collectEvidence(matches: RuleMatch[]): string[] {
  const evidence: string[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    for (const line of match.evidence) {
      if (!seen.has(line)) {
        evidence.push(line);
        seen.add(line);
      }

      if (evidence.length >= 6) {
        return evidence;
      }
    }
  }

  return evidence;
}

export { redactLog } from "./redaction";
export type { AnalysisFinding, AnalysisRequest, AnalysisResult, Confidence, LogType, RedactionSummary, RuleId } from "./types";
