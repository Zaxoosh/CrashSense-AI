import type { AnalysisResult, LogType } from "./types";

type ReportInput = Omit<AnalysisResult, "discordReply" | "githubIssue" | "githubIssueUrl" | "jsonReport" | "markdownReport">;

export function createDiscordReply(result: ReportInput): string {
  const evidence = result.evidence.length > 0 ? result.evidence.map((line) => `> ${line}`).join("\n") : "> No exact evidence line captured.";
  const steps = result.fixSteps.map((step, index) => `${index + 1}. ${step}`).join("\n");

  return [
    `**CrashSense AI diagnosis (${result.confidence} confidence)**`,
    `**Summary:** ${result.summary}`,
    `**Likely cause:** ${result.likelyCause}`,
    "",
    "**Evidence:**",
    evidence,
    "",
    "**Fix steps:**",
    steps,
  ].join("\n");
}

export function createGithubIssue(result: ReportInput, logType: LogType): string {
  const evidence = result.evidence.length > 0 ? result.evidence.map((line) => `- \`${line.replaceAll("`", "'")}\``).join("\n") : "- No exact evidence line captured.";
  const steps = result.fixSteps.map((step, index) => `${index + 1}. ${step}`).join("\n");
  const redactions = result.redactions.length > 0 ? result.redactions.map((redaction) => `- ${redaction.type}: ${redaction.count}`).join("\n") : "- none";

  return [
    "## CrashSense AI report",
    "",
    `**Log type:** ${logType}`,
    `**Confidence:** ${result.confidence}`,
    "",
    "### Summary",
    result.summary,
    "",
    "### Likely cause",
    result.likelyCause,
    "",
    "### Evidence",
    evidence,
    "",
    "### Suggested fixes",
    steps,
    "",
    "### Redactions applied",
    redactions,
    "",
    "### Detected rules",
    result.detectedRules.length > 0 ? result.detectedRules.map((rule) => `- ${rule}`).join("\n") : "- none",
    "",
    "### Environment",
    "- App/modpack/container version:",
    "- OS or host:",
    "- Java/Docker/runner version:",
    "- Recent changes:",
  ].join("\n");
}

export function createMarkdownReport(result: ReportInput, logType: LogType): string {
  return [
    "# CrashSense AI report",
    "",
    `- Log type: ${logType}`,
    `- Confidence: ${result.confidence}`,
    `- Detected rules: ${result.detectedRules.join(", ") || "none"}`,
    "",
    "## Summary",
    result.summary,
    "",
    "## Likely cause",
    result.likelyCause,
    "",
    "## Evidence",
    result.evidence.length > 0 ? result.evidence.map((line) => `\`\`\`text\n${line}\n\`\`\``).join("\n\n") : "No exact evidence line captured.",
    "",
    "## Fix steps",
    result.fixSteps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
    "",
    "## Findings",
    result.findings.map((finding) => `- ${finding.title} (${finding.confidence}, score ${finding.score})`).join("\n") || "- none",
  ].join("\n");
}

export function createGithubIssueUrl(issueBody: string): string {
  const params = new URLSearchParams({
    title: "Crash log diagnosis",
    body: issueBody,
    labels: "bug,crash",
  });

  return `https://github.com/new?${params.toString()}`;
}
