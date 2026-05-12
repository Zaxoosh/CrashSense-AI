import { createDiscordReply, createGithubIssue } from "./formatters";
import { matchRules } from "./rules";
import type { AnalysisResult, Confidence, LogType, RuleMatch } from "./types";

const CONFIDENCE_WEIGHT: Record<Confidence, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export function analyzeLog(log: string, logType: LogType): AnalysisResult {
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
  };

  return {
    ...base,
    discordReply: createDiscordReply(base),
    githubIssue: createGithubIssue(base, logType),
  };
}

function choosePrimaryMatch(matches: RuleMatch[]): RuleMatch | undefined {
  return [...matches].sort((left, right) => {
    const confidenceDiff = CONFIDENCE_WEIGHT[right.confidence] - CONFIDENCE_WEIGHT[left.confidence];

    if (confidenceDiff !== 0) {
      return confidenceDiff;
    }

    return right.evidence.length - left.evidence.length;
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

export type { AnalysisRequest, AnalysisResult, Confidence, LogType, RuleId } from "./types";
