import { ruleDefinitions } from "./rule-definitions";
import type { LogType, RuleMatch } from "./types";

const MAX_EVIDENCE_PER_RULE = 3;
const CONTEXT_RADIUS = 2;

const compiledRules = ruleDefinitions.map((rule) => ({
  ...rule,
  patterns: rule.patterns.map((pattern) => new RegExp(pattern, "i")),
}));

export function matchRules(log: string, logType: LogType): RuleMatch[] {
  const lines = log.split(/\r?\n/);

  return compiledRules
    .filter((rule) => !rule.appliesTo || rule.appliesTo.includes(logType) || logType === "unknown")
    .map((rule) => {
      const evidenceMatches = collectEvidence(lines, rule.patterns);

      if (evidenceMatches.length === 0) {
        return null;
      }

      const firstLine = evidenceMatches[0].lineNumber;
      const evidence = evidenceMatches.map((match) => match.context.join("\n"));
      const score = scoreRule(rule.confidence, rule.specificity, evidence.length, firstLine);

      return {
        id: rule.id,
        title: rule.title,
        cause: rule.cause,
        summary: rule.summary,
        confidence: rule.confidence,
        evidence,
        firstLine,
        score,
        fixSteps: rule.fixSteps,
      };
    })
    .filter((match): match is RuleMatch => match !== null);
}

function collectEvidence(lines: string[], patterns: RegExp[]): Array<{ lineNumber: number; context: string[] }> {
  const evidence: Array<{ lineNumber: number; context: string[] }> = [];
  const seen = new Set<string>();

  for (const [index, line] of lines.entries()) {
    const trimmed = line.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    if (patterns.some((pattern) => pattern.test(trimmed))) {
      evidence.push({
        lineNumber: index + 1,
        context: collectContext(lines, index),
      });
      seen.add(trimmed);
    }

    if (evidence.length >= MAX_EVIDENCE_PER_RULE) {
      break;
    }
  }

  return evidence;
}

function collectContext(lines: string[], matchedIndex: number): string[] {
  const start = Math.max(0, matchedIndex - CONTEXT_RADIUS);
  const end = Math.min(lines.length - 1, matchedIndex + CONTEXT_RADIUS);

  return lines
    .slice(start, end + 1)
    .map((line, offset) => {
      const lineNumber = start + offset + 1;
      const marker = lineNumber === matchedIndex + 1 ? ">" : " ";

      return `${marker} L${lineNumber}: ${line.trim().slice(0, 280)}`;
    })
    .filter((line) => !line.endsWith(": "));
}

function scoreRule(confidence: RuleMatch["confidence"], specificity: number, evidenceCount: number, firstLine: number): number {
  const confidenceWeight = { low: 10, medium: 30, high: 50 }[confidence];
  const earlyLineBonus = Math.max(0, 20 - Math.floor(firstLine / 5));

  return confidenceWeight + specificity * 5 + Math.min(evidenceCount, 3) * 4 + earlyLineBonus;
}
