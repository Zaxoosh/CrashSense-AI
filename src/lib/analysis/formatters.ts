import type { AnalysisResult, LogType } from "./types";

export function createDiscordReply(result: Omit<AnalysisResult, "discordReply" | "githubIssue">): string {
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

export function createGithubIssue(result: Omit<AnalysisResult, "discordReply" | "githubIssue">, logType: LogType): string {
  const evidence = result.evidence.length > 0 ? result.evidence.map((line) => `- \`${line.replaceAll("`", "'")}\``).join("\n") : "- No exact evidence line captured.";
  const steps = result.fixSteps.map((step, index) => `${index + 1}. ${step}`).join("\n");

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
