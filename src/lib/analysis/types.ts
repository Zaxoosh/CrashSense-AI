export type LogType = "minecraft" | "docker" | "github-actions" | "unknown";

export type Confidence = "low" | "medium" | "high";

export type AnalysisRequest = {
  logType: LogType;
  log: string;
  forceAi?: boolean;
};

export type RuleId =
  | "java-version-mismatch"
  | "mod-loader-mismatch"
  | "missing-dependency"
  | "duplicate-mod"
  | "mixin-error"
  | "class-not-found"
  | "mod-version-conflict"
  | "world-save-corruption"
  | "datapack-resource-error"
  | "bad-config-file"
  | "client-server-mod-mismatch"
  | "null-pointer-exception"
  | "permission-denied"
  | "uid-gid-mismatch"
  | "out-of-memory"
  | "disk-full"
  | "port-in-use"
  | "connection-refused"
  | "database-connection-failure"
  | "path-not-found"
  | "gpu-nvidia-not-detected"
  | "docker-volume-mapping"
  | "dns-failure"
  | "tls-certificate-error"
  | "image-pull-failure"
  | "healthcheck-failure"
  | "github-actions-missing-secret"
  | "github-checkout-failure"
  | "github-actions-permission-scope"
  | "package-install-failure"
  | "test-failure"
  | "runtime-version-mismatch"
  | "dependency-cache-corruption"
  | "segmentation-fault"
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
  aiUsed: boolean;
  aiMode: "none" | "fallback" | "enrichment";
  aiModel?: string;
  aiStatus: "not-configured" | "not-needed" | "used" | "failed";
  aiError?: string;
};
