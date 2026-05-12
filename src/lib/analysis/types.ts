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
  | "mixin-error"
  | "bad-config-file"
  | "client-server-mod-mismatch"
  | "permission-denied"
  | "uid-gid-mismatch"
  | "out-of-memory"
  | "port-in-use"
  | "path-not-found"
  | "gpu-nvidia-not-detected"
  | "docker-volume-mapping"
  | "dns-failure"
  | "image-pull-failure"
  | "healthcheck-failure"
  | "github-actions-missing-secret"
  | "github-checkout-failure"
  | "runtime-version-mismatch"
  | "dependency-cache-corruption"
  | "generic-crash";

export type RedactionType = "secret" | "ip-address" | "email" | "filesystem-user" | "webhook-url";

export type RedactionSummary = {
  type: RedactionType;
  count: number;
};

export type RuleMatch = {
  id: RuleId;
  title: string;
  cause: string;
  summary: string;
  confidence: Confidence;
  evidence: string[];
  firstLine: number;
  score: number;
  fixSteps: string[];
};

export type AnalysisFinding = Pick<RuleMatch, "id" | "title" | "cause" | "confidence" | "evidence" | "fixSteps" | "firstLine" | "score">;

export type AnalysisResult = {
  summary: string;
  likelyCause: string;
  confidence: Confidence;
  evidence: string[];
  fixSteps: string[];
  discordReply: string;
  githubIssue: string;
  markdownReport: string;
  jsonReport: string;
  githubIssueUrl: string;
  detectedRules: RuleId[];
  findings: AnalysisFinding[];
  redactions: RedactionSummary[];
};
