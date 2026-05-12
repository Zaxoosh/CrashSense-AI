import type { RedactionSummary, RedactionType } from "./types";

type RedactionRule = {
  type: RedactionType;
  pattern: RegExp;
  replacement: string;
};

const redactionRules: RedactionRule[] = [
  {
    type: "webhook-url",
    pattern: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[^\s"'<>]+/gi,
    replacement: "[REDACTED_WEBHOOK_URL]",
  },
  {
    type: "secret",
    pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{20,}\b/g,
    replacement: "[REDACTED_GITHUB_TOKEN]",
  },
  {
    type: "secret",
    pattern: /\b(?:api[_-]?key|token|secret|password|passwd|pwd)\s*[:=]\s*["']?[^"'\s]{8,}/gi,
    replacement: "[REDACTED_SECRET]",
  },
  {
    type: "email",
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    type: "ip-address",
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
    replacement: "[REDACTED_IP]",
  },
  {
    type: "filesystem-user",
    pattern: /\b(?:C:\\Users\\|\/home\/|\/Users\/)[A-Za-z0-9._-]+/g,
    replacement: "[REDACTED_USER_PATH]",
  },
];

export function redactLog(log: string): { redactedLog: string; redactions: RedactionSummary[] } {
  const counts = new Map<RedactionType, number>();
  let redactedLog = log;

  for (const rule of redactionRules) {
    redactedLog = redactedLog.replace(rule.pattern, () => {
      counts.set(rule.type, (counts.get(rule.type) ?? 0) + 1);

      return rule.replacement;
    });
  }

  return {
    redactedLog,
    redactions: Array.from(counts.entries()).map(([type, count]) => ({ type, count })),
  };
}
