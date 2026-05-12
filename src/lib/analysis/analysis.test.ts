import { describe, expect, it } from "vitest";
import { analyzeCrashLog, analyzeLog, redactLog } from "./index";

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

  it("detects Minecraft mixin failures", () => {
    const result = analyzeLog("Mixin apply failed example.mixins.json\nCritical injection failure", "minecraft");
    expect(result.detectedRules).toContain("mixin-error");
  });

  it("detects bad config files", () => {
    const result = analyzeLog("Failed to load config: TOML parse error near line 4", "minecraft");
    expect(result.detectedRules).toContain("bad-config-file");
  });

  it("detects client/server mod side mismatches", () => {
    const result = analyzeLog("Attempted to load class net/minecraft/client/Minecraft for invalid dist DEDICATED_SERVER", "minecraft");
    expect(result.detectedRules).toContain("client-server-mod-mismatch");
  });

  it("detects Minecraft null pointer stack traces", () => {
    const result = analyzeLog(
      `java.lang.NullPointerException: Cannot invoke "net.minecraft.world.level.block.entity.BlockEntity.getBlockPos()" because "tileEntity" is null
\tat com.crashsense.testmod.world.CrashyChunkProcessor.processTileEntities(CrashyChunkProcessor.java:184)
\tat com.crashsense.testmod.world.CrashyChunkProcessor.tickChunk(CrashyChunkProcessor.java:112)
\tat net.minecraftforge.eventbus.EventBus.post(EventBus.java:302)
\tat net.minecraft.server.MinecraftServer.tickServer(MinecraftServer.java:819)
\tat java.base/java.lang.Thread.run(Thread.java:1583)`,
      "minecraft",
    );

    expect(result.detectedRules).toContain("null-pointer-exception");
    expect(result.summary).toContain("unexpectedly null");
    expect(result.confidence).toBe("high");
  });

  it("detects Docker volume mapping problems", () => {
    const result = analyzeLog("invalid mount config for type bind: bind source path does not exist", "docker");
    expect(result.detectedRules).toContain("docker-volume-mapping");
  });

  it("detects DNS failures", () => {
    const result = analyzeLog("npm ERR! request to registry failed, reason: getaddrinfo EAI_AGAIN registry.npmjs.org", "github-actions");
    expect(result.detectedRules).toContain("dns-failure");
  });

  it("detects image pull failures", () => {
    const result = analyzeLog("failed to pull image: manifest unknown", "docker");
    expect(result.detectedRules).toContain("image-pull-failure");
  });

  it("detects healthcheck failures", () => {
    const result = analyzeLog("container api is unhealthy: healthcheck failed", "docker");
    expect(result.detectedRules).toContain("healthcheck-failure");
  });

  it("detects missing GitHub Actions secrets", () => {
    const result = analyzeLog("Input required and not supplied: password\nsecrets.REGISTRY_TOKEN", "github-actions");
    expect(result.detectedRules).toContain("github-actions-missing-secret");
  });

  it("detects checkout failures", () => {
    const result = analyzeLog("Run actions/checkout@v4\nfatal: couldn't find remote ref release/missing", "github-actions");
    expect(result.detectedRules).toContain("github-checkout-failure");
  });

  it("detects runtime version mismatches", () => {
    const result = analyzeLog("npm WARN EBADENGINE Unsupported engine: requires Node.js >=20.19.0", "github-actions");
    expect(result.detectedRules).toContain("runtime-version-mismatch");
  });

  it("detects dependency cache corruption", () => {
    const result = analyzeLog("cache hit occurred\nnpm ERR! EINTEGRITY integrity checksum failed", "github-actions");
    expect(result.detectedRules).toContain("dependency-cache-corruption");
  });

  it("includes evidence context and ranked findings", () => {
    const result = analyzeLog("starting\nlisten tcp 0.0.0.0:8080: bind: address already in use\nshutdown", "docker");
    expect(result.evidence[0]).toContain("L2");
    expect(result.findings[0]?.score).toBeGreaterThan(0);
  });

  it("redacts sensitive values before analysis reports", () => {
    const result = analyzeCrashLog({
      logType: "docker",
      log: "api_key=super-secret-token\npermission denied opening /home/alex/config.yml from 192.168.1.25 and admin@example.com",
    });
    expect(result.redactions.length).toBeGreaterThan(0);
    expect(result.githubIssue).not.toContain("admin@example.com");
    expect(result.githubIssue).not.toContain("192.168.1.25");
  });

  it("redacts secrets, IPs, emails, webhooks, and user paths", () => {
    const { redactedLog, redactions } = redactLog(
      "token=abcdefghi admin@example.com 10.0.0.2 https://discord.com/api/webhooks/1/secret C:\\Users\\alex\\app",
    );
    expect(redactedLog).toContain("[REDACTED_SECRET]");
    expect(redactedLog).toContain("[REDACTED_EMAIL]");
    expect(redactedLog).toContain("[REDACTED_IP]");
    expect(redactedLog).toContain("[REDACTED_WEBHOOK_URL]");
    expect(redactedLog).toContain("[REDACTED_USER_PATH]");
    expect(redactions).toHaveLength(5);
  });

  it("returns copy-ready Discord and GitHub outputs", () => {
    const result = analyzeLog("Error: EADDRINUSE port already in use", "docker");
    expect(result.discordReply).toContain("CrashSense AI diagnosis");
    expect(result.githubIssue).toContain("## CrashSense AI report");
    expect(result.markdownReport).toContain("# CrashSense AI report");
    expect(result.jsonReport).toContain("detectedRules");
    expect(result.githubIssueUrl).toContain("https://github.com/new?");
  });
});
