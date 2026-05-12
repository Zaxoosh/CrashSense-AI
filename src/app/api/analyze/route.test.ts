import { describe, expect, it, vi } from "vitest";
import { POST } from "./route";

describe("POST /api/analyze", () => {
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
    vi.stubEnv("OPENAI_API_KEY", "");
    const response = await POST(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        body: JSON.stringify({ logType: "unknown", log: "process exited unexpectedly" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.confidence).toBe("low");
  });
});
