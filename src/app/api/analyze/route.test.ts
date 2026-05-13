import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { POST as STREAM_POST } from "./stream/route";

describe("POST /api/analyze", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("returns an analysis for valid input", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          logType: "docker",
          log: "listen tcp 0.0.0.0:8080: bind: address already in use",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.detectedRules).toContain("port-in-use");
    expect(body.markdownReport).toContain("CrashSense AI report");
  });

  it("rejects empty logs", async () => {
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ logType: "unknown", log: "" }),
      }),
    );

    expect(response.status).toBe(400);
  });

  it("handles unknown logs without AI configuration", async () => {
    vi.stubEnv("CRASHSENSE_AI_MODE", "off");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ logType: "unknown", log: "process exited unexpectedly" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.confidence).toBe("low");
    expect(body.aiStatus).toBe("not-configured");
    expect(body.likelyCause).toContain("AI fallback was needed");
    expect(body.fixSteps[0]).toContain("npm run setup");
  });

  it("redacts sensitive values before returning evidence", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          logType: "docker",
          log: "permission denied opening /home/alex/config.yml with token=supersecretvalue",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.githubIssue).not.toContain("supersecretvalue");
    expect(body.redactions.length).toBeGreaterThan(0);
  });

  it("does not call AI for a specific rule match in fallback mode", async () => {
    vi.stubEnv("CRASHSENSE_AI_MODE", "fallback");
    vi.stubEnv("CRASHSENSE_AI_BASE_URL", "http://localhost:11434/v1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          logType: "docker",
          log: "listen tcp 0.0.0.0:8080: bind: address already in use",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.detectedRules).toContain("port-in-use");
    expect(body.aiUsed).toBe(false);
    expect(body.aiStatus).toBe("not-needed");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses AI fallback for generic unknown crashes when configured", async () => {
    vi.stubEnv("CRASHSENSE_AI_MODE", "fallback");
    vi.stubEnv("CRASHSENSE_AI_BASE_URL", "http://localhost:11434/v1");
    vi.stubEnv("CRASHSENSE_AI_MODEL", "gemma4:e4b");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "The app crashed inside an unclassified handler.",
                  likelyCause: "The stack trace points to application code that is not covered by the current rule database.",
                  confidence: "medium",
                  evidence: ["RuntimeException: handler failed"],
                  fixSteps: ["Inspect the first application stack frame.", "Check recent changes to that handler."],
                }),
              },
            },
          ],
        }),
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          logType: "unknown",
          log: "RuntimeException: handler failed",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.aiUsed).toBe(true);
    expect(body.aiMode).toBe("fallback");
    expect(body.aiStatus).toBe("used");
    expect(body.aiModel).toBe("gemma4:e4b");
    expect(body.summary).toBe("The app crashed inside an unclassified handler.");
  });

  it("surfaces AI provider failure for generic crashes", async () => {
    vi.stubEnv("CRASHSENSE_AI_MODE", "fallback");
    vi.stubEnv("CRASHSENSE_AI_BASE_URL", "http://localhost:11434/v1");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "model backend failed",
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          logType: "unknown",
          log: "RuntimeException: handler failed",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.aiStatus).toBe("failed");
    expect(body.aiError).toContain("HTTP 500");
    expect(body.likelyCause).toContain("AI fallback was needed");
  });

  it("forces AI triage for a specific rule match", async () => {
    vi.stubEnv("CRASHSENSE_AI_MODE", "fallback");
    vi.stubEnv("CRASHSENSE_AI_BASE_URL", "http://localhost:11434/v1");
    vi.stubEnv("CRASHSENSE_AI_MODEL", "gemma4:e4b");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  summary: "The port conflict is blocking startup.",
                  likelyCause: "Another service is already bound to the requested host port.",
                  confidence: "high",
                  evidence: ["listen tcp 0.0.0.0:8080: bind: address already in use"],
                  fixSteps: ["Find and stop the process using port 8080.", "Change the host port mapping if both services are needed."],
                }),
              },
            },
          ],
        }),
      }),
    );

    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          forceAi: true,
          logType: "docker",
          log: "listen tcp 0.0.0.0:8080: bind: address already in use",
        }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.aiUsed).toBe(true);
    expect(body.aiMode).toBe("enrichment");
    expect(body.summary).toBe("The port conflict is blocking startup.");
  });

  it("streams progress events and a final result", async () => {
    vi.stubEnv("CRASHSENSE_AI_MODE", "off");

    const response = await STREAM_POST(
      new Request("http://localhost/api/analyze/stream", {
        method: "POST",
        body: JSON.stringify({
          logType: "docker",
          log: "listen tcp 0.0.0.0:8080: bind: address already in use",
        }),
      }),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain("event: stage");
    expect(body).toContain("event: result");
    expect(body).toContain("port-in-use");
  });
});
