import { describe, expect, it } from "vitest";
import { analyzeLog } from "./index";

describe("analyzeLog", () => {
  it("detects Java version mismatch", () => {
    const result = analyzeLog("java.lang.UnsupportedClassVersionError: class file version 61.0", "minecraft");
    expect(result.detectedRules).toContain("java-version-mismatch");
    expect(result.confidence).toBe("high");
  });

  it("detects mod loader mismatch", () => {
    const result = analyzeLog("Incompatible mod set! Mod example requires fabricloader 0.15", "minecraft");
    expect(result.detectedRules).toContain("mod-loader-mismatch");
  });

  it("detects missing dependency", () => {
    const result = analyzeLog("Cannot find module 'sharp'", "github-actions");
    expect(result.detectedRules).toContain("missing-dependency");
  });

  it("detects duplicate mod", () => {
    const result = analyzeLog("DuplicateModsFound: Found duplicate file for same mod id", "minecraft");
    expect(result.detectedRules).toContain("duplicate-mod");
  });

  it("detects permission denied", () => {
    const result = analyzeLog("Error: EACCES: permission denied, open '/data/config.yml'", "docker");
    expect(result.detectedRules).toContain("permission-denied");
  });

  it("detects out of memory", () => {
    const result = analyzeLog("java.lang.OutOfMemoryError: Java heap space", "minecraft");
    expect(result.detectedRules).toContain("out-of-memory");
  });

  it("detects port already in use", () => {
    const result = analyzeLog("listen tcp 0.0.0.0:8080: bind: address already in use", "docker");
    expect(result.detectedRules).toContain("port-in-use");
  });

  it("detects file path not found", () => {
    const result = analyzeLog("ENOENT: no such file or directory, open '/tmp/report.json'", "github-actions");
    expect(result.detectedRules).toContain("path-not-found");
  });

  it("detects GPU/NVIDIA not detected", () => {
    const result = analyzeLog("No NVIDIA GPU detected. nvidia-smi: not found", "docker");
    expect(result.detectedRules).toContain("gpu-nvidia-not-detected");
  });

  it("returns copy-ready Discord and GitHub outputs", () => {
    const result = analyzeLog("Error: EADDRINUSE port already in use", "docker");
    expect(result.discordReply).toContain("CrashSense AI diagnosis");
    expect(result.githubIssue).toContain("## CrashSense AI report");
  });
});
