"use client";

import { useEffect, useMemo, useState } from "react";
import { exampleLogs } from "@/lib/examples";
import type { AnalysisResult, LogType } from "@/lib/analysis";

const logTypeOptions: Array<{ value: LogType; label: string }> = [
  { value: "minecraft", label: "Minecraft" },
  { value: "docker", label: "Docker / Unraid" },
  { value: "github-actions", label: "GitHub Actions" },
  { value: "unknown", label: "Unknown" },
];

const analysisStages = [
  "Preparing log",
  "Running rule parser",
  "Checking AI fallback",
  "Contacting AI provider",
  "Waiting for local model",
  "Formatting report",
];

export default function Home() {
  const [logType, setLogType] = useState<LogType>("minecraft");
  const [log, setLog] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<"discord" | "github" | "markdown" | "json" | null>(null);
  const [activeStage, setActiveStage] = useState(0);

  const selectedExample = useMemo(() => exampleLogs.find((example) => example.log === log), [log]);

  useEffect(() => {
    if (!isLoading) {
      setActiveStage(0);
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveStage((stage) => Math.min(stage + 1, analysisStages.length - 1));
    }, 1800);

    return () => window.clearInterval(interval);
  }, [isLoading]);

  async function analyze() {
    setError("");
    setCopied(null);

    if (!log.trim()) {
      setResult(null);
      setError("Paste a crash log or load an example first.");
      return;
    }

    setIsLoading(true);
    setActiveStage(0);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logType, log }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Analysis failed.");
      }

      setResult(data as AnalysisResult);
    } catch (analysisError) {
      setResult(null);
      setError(analysisError instanceof Error ? analysisError.message : "Analysis failed.");
    } finally {
      setIsLoading(false);
    }
  }

  function loadExample(index: number) {
    const example = exampleLogs[index];
    setLogType(example.type);
    setLog(example.log);
    setResult(null);
    setError("");
    setCopied(null);
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

            <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-200">
              Crash log
              <textarea
                value={log}
                onChange={(event) => setLog(event.target.value)}
                placeholder="Paste the first error, stack trace, or container/CI failure here..."
                className="min-h-[360px] resize-y rounded border border-line bg-ink p-3 font-mono text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 focus:border-accent"
              />
            </label>

            {error ? <p className="mt-3 rounded border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">{error}</p> : null}

            <button
              onClick={analyze}
              disabled={isLoading}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded bg-accent px-5 text-sm font-semibold text-ink transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isLoading ? "Analysing..." : "Analyse log"}
            </button>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {isLoading ? (
              <AnalysisProgress activeStage={activeStage} />
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
                  <div className="rounded-lg border border-line bg-panel p-4">
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

function AnalysisProgress({ activeStage }: { activeStage: number }) {
  return (
    <section className="min-w-0 rounded-lg border border-line bg-panel p-4 text-sm leading-6 text-slate-300">
      <h2 className="text-lg font-semibold text-white">Analysis in progress</h2>
      <p className="mt-2 text-slate-400">CrashSense AI is checking rules first, then using AI only if fallback triage is needed.</p>
      <ol className="mt-4 space-y-3">
        {analysisStages.map((stage, index) => {
          const isActive = index === activeStage;
          const isDone = index < activeStage;

          return (
            <li key={stage} className="flex items-center gap-3">
              <span
                className={[
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  isDone ? "border-accent bg-accent text-ink" : isActive ? "animate-pulse border-warn text-warn" : "border-line text-slate-500",
                ].join(" ")}
              >
                {isDone ? "OK" : index + 1}
              </span>
              <span className={isActive ? "font-semibold text-slate-100" : "text-slate-400"}>{stage}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ResultCard({ title, children }: { title: string; children: React.ReactNode }) {
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
