"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { exampleLogs } from "@/lib/examples";
import { redactLog } from "@/lib/analysis/redaction";
import type { AnalysisResult, LogType } from "@/lib/analysis";

const logTypeOptions: Array<{ value: LogType; label: string }> = [
  { value: "minecraft", label: "Minecraft" },
  { value: "docker", label: "Docker / Unraid" },
  { value: "github-actions", label: "GitHub Actions" },
  { value: "unknown", label: "Unknown" },
];

type ProgressItem = {
  id: string;
  label: string;
  message: string;
  status: "active" | "done" | "skipped" | "failed";
};

type SetupConfig = {
  apiKeyConfigured: boolean;
  baseUrl: string;
  mode: "fallback" | "always" | "off";
  model: string;
  provider: "local" | "remote" | "off";
  timeoutMs: number;
};

type SetupHealth = {
  ok: boolean;
  status: "off" | "not-configured" | "reachable" | "model-missing" | "unreachable" | "unauthorized" | "error";
  message: string;
  model?: string;
  models?: string[];
};

const defaultSetup: SetupConfig = {
  apiKeyConfigured: false,
  baseUrl: "http://localhost:11434/v1",
  mode: "fallback",
  model: "gemma4:e4b",
  provider: "local",
  timeoutMs: 120000,
};

export default function Home() {
  const [logType, setLogType] = useState<LogType>("minecraft");
  const [log, setLog] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<"discord" | "github" | "markdown" | "json" | null>(null);
  const [progress, setProgress] = useState<ProgressItem[]>([]);
  const [setup, setSetup] = useState<SetupConfig>(defaultSetup);
  const [setupApiKey, setSetupApiKey] = useState("");
  const [setupHealth, setSetupHealth] = useState<SetupHealth | null>(null);
  const [setupMessage, setSetupMessage] = useState("");
  const [isSavingSetup, setIsSavingSetup] = useState(false);
  const [isCheckingSetup, setIsCheckingSetup] = useState(false);

  const selectedExample = useMemo(() => exampleLogs.find((example) => example.log === log), [log]);
  const redactionPreview = useMemo(() => (log.trim() ? redactLog(log) : { redactedLog: "", redactions: [] }), [log]);

  useEffect(() => {
    void loadSetup(false);
  }, []);

  async function loadSetup(check: boolean) {
    try {
      if (check) {
        setIsCheckingSetup(true);
      }

      const response = await fetch(`/api/setup${check ? "?check=1" : ""}`);
      const data = (await response.json()) as { config: SetupConfig; health: SetupHealth | null };

      setSetup(data.config);
      setSetupHealth(data.health);
      setSetupMessage("");
    } catch (setupError) {
      setSetupMessage(setupError instanceof Error ? setupError.message : "Setup check failed.");
    } finally {
      setIsCheckingSetup(false);
    }
  }

  async function saveSetup() {
    setIsSavingSetup(true);
    setSetupMessage("");

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...setup, apiKey: setupApiKey }),
      });
      const data = (await response.json()) as { config?: SetupConfig; error?: string };

      if (!response.ok || !data.config) {
        throw new Error(data.error ?? "Setup save failed.");
      }

      setSetup(data.config);
      setSetupApiKey("");
      setSetupMessage("Saved .env.local and updated the current server process.");
    } catch (setupError) {
      setSetupMessage(setupError instanceof Error ? setupError.message : "Setup save failed.");
    } finally {
      setIsSavingSetup(false);
    }
  }

  async function analyze(forceAi = false) {
    setError("");
    setCopied(null);
    setProgress([]);

    if (!log.trim()) {
      setResult(null);
      setError("Paste a crash log or load an example first.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/analyze/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logType, log, forceAi }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data.error === "string" ? data.error : "Analysis failed.");
      }

      if (!response.body || !response.headers.get("content-type")?.includes("text/event-stream")) {
        await analyzeWithoutStream(forceAi);
        return;
      }

      await readAnalysisStream(response.body);
    } catch (analysisError) {
      setResult(null);
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  async function analyzeWithoutStream(forceAi: boolean) {
    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logType, log, forceAi }),
    });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error ?? "Analysis failed.");
    }

    setResult(data as AnalysisResult);
  }

  async function readAnalysisStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const rawEvent of events) {
        handleStreamEvent(rawEvent);
      }
    }

    if (buffer.trim()) {
      handleStreamEvent(buffer);
    }
  }

  function handleStreamEvent(rawEvent: string) {
    const lines = rawEvent.split(/\r?\n/);
    const event = lines.find((line) => line.startsWith("event: "))?.slice(7).trim();
    const dataLine = lines.find((line) => line.startsWith("data: "));

    if (!event || !dataLine) {
      return;
    }

    const data = JSON.parse(dataLine.slice(6));

    if (event === "stage") {
      const item = data as ProgressItem;
      setProgress((items) => {
        const withoutCurrent = items.filter((existing) => existing.id !== item.id);

        return [...withoutCurrent, item];
      });
    }

    if (event === "result") {
      setResult(data as AnalysisResult);
    }

    if (event === "error") {
      setError(typeof data.message === "string" ? data.message : "Analysis failed.");
    }
  }

  function loadExample(index: number) {
    const example = exampleLogs[index];
    setLogType(example.type);
    setLog(example.log);
    setResult(null);
    setError("");
    setCopied(null);
    setProgress([]);
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();

      if (!text.trim()) {
        setError("Clipboard is empty.");
        return;
      }

      setLog(text);
      setResult(null);
      setError("");
    } catch {
      setError("Clipboard access was blocked by the browser.");
    }
  }

  async function loadLogFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const text = await file.text();
    setLog(text);
    setResult(null);
    setError("");
    event.target.value = "";
  }

  async function copyOutput(kind: "discord" | "github" | "markdown" | "json", value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.setAttribute("readonly", "true");
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }

    setCopied(kind);
  }

  function downloadReport(filename: string, content: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.22em] text-accent">Open-source crash diagnosis</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal text-white sm:text-5xl">CrashSense AI</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-300">
              Paste a crash log and get a plain-English diagnosis, evidence, fixes, and support-ready replies.
            </p>
          </div>
          <div className="rounded border border-line bg-panel px-3 py-2 text-sm text-slate-300">
            Local rules first · Optional AI
          </div>
        </header>

        <SetupPanel
          config={setup}
          health={setupHealth}
          message={setupMessage}
          apiKey={setupApiKey}
          isChecking={isCheckingSetup}
          isSaving={isSavingSetup}
          onApiKeyChange={setSetupApiKey}
          onChange={setSetup}
          onCheck={() => loadSetup(true)}
          onSave={saveSetup}
        />

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="min-w-0 rounded-lg border border-line bg-panel/88 p-4 shadow-glow">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Log type
                <select
                  value={logType}
                  onChange={(event) => setLogType(event.target.value as LogType)}
                  className="h-11 rounded border border-line bg-ink px-3 text-slate-100 outline-none focus:border-accent"
                >
                  {logTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
                Example logs
                <select
                  value={selectedExample ? exampleLogs.indexOf(selectedExample).toString() : ""}
                  onChange={(event) => {
                    if (event.target.value) {
                      loadExample(Number(event.target.value));
                    }
                  }}
                  className="h-11 rounded border border-line bg-ink px-3 text-slate-100 outline-none focus:border-accent"
                >
                  <option value="">Load an example</option>
                  {exampleLogs.map((example, index) => (
                    <option key={example.label} value={index}>
                      {example.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={pasteFromClipboard}
                data-testid="paste-button"
                className="rounded border border-line px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-accent hover:text-accent"
              >
                Paste from clipboard
              </button>
              <label className="cursor-pointer rounded border border-line px-3 py-2 text-sm font-semibold text-slate-100 transition hover:border-accent hover:text-accent">
                Upload log file
                <input type="file" accept=".log,.txt,.out,.err,text/*" onChange={loadLogFile} data-testid="file-input" className="sr-only" />
              </label>
            </div>

            <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-200">
              Crash log
              <textarea
                value={log}
                onChange={(event) => setLog(event.target.value)}
                placeholder="Paste the first error, stack trace, or container/CI failure here..."
                data-testid="log-input"
                className="min-h-[360px] resize-y rounded border border-line bg-ink p-3 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent"
              />
            </label>

            <PrivacyPreview redactedLog={redactionPreview.redactedLog} redactions={redactionPreview.redactions} />

            {error ? (
              <p data-testid="error-alert" className="mt-3 rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
                {error}
              </p>
            ) : null}

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => analyze(false)}
                disabled={isLoading}
                data-testid="analyze-button"
                className="inline-flex h-11 w-full items-center justify-center rounded bg-accent px-5 text-sm font-semibold text-ink transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isLoading ? "Analysing..." : "Analyse log"}
              </button>
              <button
                onClick={() => analyze(true)}
                disabled={isLoading}
                data-testid="force-ai-button"
                className="inline-flex h-11 w-full items-center justify-center rounded border border-line px-5 text-sm font-semibold text-slate-100 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Force AI triage
              </button>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {isLoading ? (
              <AnalysisProgress items={progress} />
            ) : result ? (
              <>
                <ResultCard title="Summary">
                  <p>{result.summary}</p>
                </ResultCard>
                <ResultCard title="Likely cause">
                  <p>{result.likelyCause}</p>
                </ResultCard>
                <ResultCard title="Evidence">
                  {result.evidence.length > 0 ? (
                    <ul className="space-y-2">
                      {result.evidence.map((line) => (
                        <li key={line} className="min-w-0 whitespace-pre-wrap break-words rounded border border-line bg-ink p-2 font-mono text-xs leading-5 text-slate-300 [overflow-wrap:anywhere]">
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No exact evidence line captured.</p>
                  )}
                </ResultCard>
                <ResultCard title="Fix steps">
                  <ol className="list-decimal space-y-2 pl-5">
                    {result.fixSteps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </ResultCard>
                <ResultCard title="Ranked findings">
                  <div className="space-y-2">
                    {result.findings.slice(0, 5).map((finding) => (
                      <div key={finding.id} className="rounded border border-line bg-ink p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold text-slate-100">{finding.title}</p>
                          <p className="text-xs uppercase tracking-[0.18em] text-accent">score {finding.score}</p>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {finding.confidence} confidence · first evidence near line {finding.firstLine}
                        </p>
                      </div>
                    ))}
                  </div>
                </ResultCard>
                {result.redactions.length > 0 ? (
                  <ResultCard title="Redactions">
                    <ul className="space-y-1">
                      {result.redactions.map((redaction) => (
                        <li key={redaction.type}>
                          {redaction.type}: {redaction.count}
                        </li>
                      ))}
                    </ul>
                  </ResultCard>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-line bg-panel p-4">
                    <p className="text-sm text-slate-400">Confidence</p>
                    <p className="mt-1 text-lg font-semibold capitalize text-warn">{result.confidence}</p>
                  </div>
                  <div className="rounded-lg border border-line bg-panel p-4" data-testid="ai-status">
                    <p className="text-sm text-slate-400">AI fallback</p>
                    <p className="mt-1 text-sm font-semibold text-slate-100">
                      {result.aiUsed ? `${result.aiMode}${result.aiModel ? ` · ${result.aiModel}` : ""}` : result.aiStatus}
                    </p>
                    {result.aiError ? <p className="mt-2 text-xs text-red-200">{result.aiError}</p> : null}
                  </div>
                  <CopyButton label={copied === "discord" ? "Discord copied" : "Copy Discord reply"} onClick={() => copyOutput("discord", result.discordReply)} />
                  <CopyButton label={copied === "github" ? "Issue copied" : "Copy GitHub issue"} onClick={() => copyOutput("github", result.githubIssue)} />
                  <CopyButton label={copied === "markdown" ? "Markdown copied" : "Copy markdown"} onClick={() => copyOutput("markdown", result.markdownReport)} />
                  <CopyButton label={copied === "json" ? "JSON copied" : "Copy JSON"} onClick={() => copyOutput("json", result.jsonReport)} />
                  <CopyButton label={result.aiStatus === "failed" ? "Retry AI" : "Run AI triage"} onClick={() => analyze(true)} />
                  <CopyButton label="Download .md" onClick={() => downloadReport("crashsense-report.md", result.markdownReport, "text/markdown")} />
                  <CopyButton label="Download .json" onClick={() => downloadReport("crashsense-report.json", result.jsonReport, "application/json")} />
                  <a
                    href={result.githubIssueUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-16 rounded-lg border border-line bg-panel px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:border-accent hover:text-accent"
                  >
                    Open GitHub issue
                  </a>
                </div>
              </>
            ) : (
              <div className="rounded-lg border border-line bg-panel p-5 text-slate-300">
                <h2 className="text-xl font-semibold text-white">Analysis output</h2>
                <p className="mt-3 leading-7">
                  Results will appear here with a summary, likely cause, evidence, confidence, and copy-ready support text.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function SetupPanel({
  apiKey,
  config,
  health,
  isChecking,
  isSaving,
  message,
  onApiKeyChange,
  onChange,
  onCheck,
  onSave,
}: {
  apiKey: string;
  config: SetupConfig;
  health: SetupHealth | null;
  isChecking: boolean;
  isSaving: boolean;
  message: string;
  onApiKeyChange: (value: string) => void;
  onChange: (value: SetupConfig) => void;
  onCheck: () => void;
  onSave: () => void;
}) {
  return (
    <section data-testid="setup-panel" className="rounded-lg border border-line bg-panel/88 p-4 shadow-glow">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-200">
          AI mode
          <select
            value={config.mode}
            onChange={(event) => onChange({ ...config, mode: event.target.value as SetupConfig["mode"] })}
            className="h-11 rounded border border-line bg-ink px-3 text-slate-100 outline-none focus:border-accent"
          >
            <option value="fallback">Fallback only</option>
            <option value="always">Always enrich</option>
            <option value="off">Rules only</option>
          </select>
        </label>
        <TextInput label="Base URL" value={config.baseUrl} onChange={(value) => onChange({ ...config, baseUrl: value })} />
        <TextInput label="Model" value={config.model} onChange={(value) => onChange({ ...config, model: value })} />
        <TextInput label="Timeout" value={String(config.timeoutMs)} onChange={(value) => onChange({ ...config, timeoutMs: Number(value) || 120000 })} />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
        <label className="flex flex-col gap-2 text-sm font-medium text-slate-200">
          API key
          <input
            value={apiKey}
            onChange={(event) => onApiKeyChange(event.target.value)}
            placeholder={config.apiKeyConfigured ? "Configured. Leave blank to keep it." : "Blank for local Ollama"}
            type="password"
            className="h-11 rounded border border-line bg-ink px-3 text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent"
          />
        </label>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving}
          className="min-h-11 rounded bg-accent px-4 py-2 text-sm font-semibold text-ink transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 lg:self-end"
        >
          {isSaving ? "Saving..." : "Save setup"}
        </button>
        <button
          type="button"
          onClick={onCheck}
          disabled={isChecking}
          className="min-h-11 rounded border border-line px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-60 lg:self-end"
        >
          {isChecking ? "Checking..." : "Check provider"}
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-2 text-sm text-slate-300 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Current: <span className="font-semibold text-slate-100">{config.mode}</span> · {config.provider} · {config.model}
        </p>
        <p className={health?.ok ? "text-accent" : health ? "text-warn" : "text-slate-400"}>{health?.message ?? message}</p>
      </div>
      {health?.models && health.models.length > 0 ? <p className="mt-2 text-xs text-slate-500">Visible models: {health.models.join(", ")}</p> : null}
    </section>
  );
}

function TextInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="flex flex-1 flex-col gap-2 text-sm font-medium text-slate-200">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded border border-line bg-ink px-3 text-slate-100 outline-none focus:border-accent"
      />
    </label>
  );
}

function PrivacyPreview({ redactedLog, redactions }: { redactedLog: string; redactions: Array<{ type: string; count: number }> }) {
  if (!redactedLog) {
    return null;
  }

  return (
    <section className="mt-4 rounded border border-line bg-ink/70 p-3 text-sm text-slate-300">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-semibold text-white">Privacy preview</h2>
        <p className="text-xs text-slate-400">
          {redactions.length > 0 ? redactions.map((redaction) => `${redaction.type}: ${redaction.count}`).join(" · ") : "No redactions detected"}
        </p>
      </div>
      <pre className="mt-3 max-h-44 overflow-auto whitespace-pre-wrap break-words rounded border border-line bg-panel p-3 font-mono text-xs leading-5 text-slate-400 [overflow-wrap:anywhere]">
        {redactedLog.slice(0, 2200)}
        {redactedLog.length > 2200 ? "\n..." : ""}
      </pre>
    </section>
  );
}

function AnalysisProgress({ items }: { items: ProgressItem[] }) {
  const visibleItems = items.length > 0 ? items : [{ id: "start", label: "Starting analysis", message: "Waiting for server progress.", status: "active" as const }];

  return (
    <section data-testid="progress-panel" className="min-w-0 rounded-lg border border-line bg-panel p-4 text-sm leading-6 text-slate-300">
      <h2 className="text-lg font-semibold text-white">Analysis in progress</h2>
      <ol className="mt-4 space-y-3">
        {visibleItems.map((stage) => (
          <li key={stage.id} className="flex items-start gap-3">
            <span
              className={[
                "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                stage.status === "done"
                  ? "border-accent bg-accent text-ink"
                  : stage.status === "failed"
                    ? "border-red-400 text-red-200"
                    : stage.status === "skipped"
                      ? "border-line text-slate-500"
                      : "animate-pulse border-warn text-warn",
              ].join(" ")}
            >
              {stage.status === "done" ? "OK" : stage.status === "skipped" ? "-" : "..."}
            </span>
            <span>
              <span className={stage.status === "active" ? "block font-semibold text-slate-100" : "block text-slate-300"}>{stage.label}</span>
              <span className="block text-xs text-slate-500">{stage.message}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ResultCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel p-4 text-sm leading-6 text-slate-300">
      <h2 className="mb-2 text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function CopyButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="min-h-16 rounded-lg border border-line bg-panel px-4 py-3 text-left text-sm font-semibold text-slate-100 transition hover:border-accent hover:text-accent"
    >
      {label}
    </button>
  );
}
