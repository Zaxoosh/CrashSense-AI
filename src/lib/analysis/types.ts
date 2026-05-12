export type LogType = "minecraft" | "docker" | "github-actions" | "unknown";

export type Confidence = "low" | "medium" | "high";

export type AnalysisRequest = {
  logType: LogType;
  log: string;
};

export type RuleId =
  | "java-version-mismatch"
  | "mod-loader-mismatch"
  | "missing-dependency"
  | "duplicate-mod"
  | "permission-denied"
  | "out-of-memory"
  | "port-in-use"
  | "path-not-found"
  | "gpu-nvidia-not-detected"
  | "generic-crash";

export type RuleMatch = {
  id: RuleId;
  title: string;
  cause: string;
  summary: string;
  confidence: Confidence;
  evidence: string[];
  fixSteps: string[];
};

export type AnalysisResult = {
  summary: string;
  likelyCause: string;
  confidence: Confidence;
  evidence: string[];
  fixSteps: string[];
  discordReply: string;
  githubIssue: string;
  detectedRules: RuleId[];
};
