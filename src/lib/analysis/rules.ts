import type { Confidence, LogType, RuleId, RuleMatch } from "./types";

type RuleDefinition = {
  id: RuleId;
  title: string;
  cause: string;
  summary: string;
  confidence: Confidence;
  patterns: RegExp[];
  fixSteps: string[];
  appliesTo?: LogType[];
};

const MAX_EVIDENCE_PER_RULE = 3;

const rules: RuleDefinition[] = [
  {
    id: "java-version-mismatch",
    title: "Java version mismatch",
    summary: "The log points to a Java runtime or bytecode version mismatch.",
    cause: "The app or modpack was built for a different Java version than the one currently running it.",
    confidence: "high",
    appliesTo: ["minecraft", "unknown"],
    patterns: [
      /UnsupportedClassVersionError/i,
      /class file version \d+/i,
      /compiled by a more recent version of the Java Runtime/i,
      /requires Java (?:version )?(?:17|21|22)/i,
      /Java \d+ is required/i,
    ],
    fixSteps: [
      "Check the required Java version for the Minecraft/modpack version.",
      "Install the required Java runtime, usually Java 17 for modern 1.18-1.20 packs or Java 21 for newer packs.",
      "Update the launcher, container image, or PATH/JAVA_HOME so the required runtime is used.",
      "Restart and rerun the same log after confirming `java -version`.",
    ],
  },
  {
    id: "mod-loader-mismatch",
    title: "Mod loader mismatch",
    summary: "The log shows a Fabric, Forge, or NeoForge compatibility problem.",
    cause: "At least one mod appears to target a different loader or loader version than the current instance.",
    confidence: "high",
    appliesTo: ["minecraft", "unknown"],
    patterns: [
      /Incompatible mod set/i,
      /requires (?:fabricloader|forge|neoforge)/i,
      /wrong mod loader/i,
      /only supports (?:Fabric|Forge|NeoForge)/i,
      /Mod File .* needs language provider/i,
      /Loading errors encountered.*(?:fabric|forge|neoforge)/i,
    ],
    fixSteps: [
      "Confirm whether the instance is Fabric, Forge, or NeoForge.",
      "Replace mods built for the wrong loader with matching versions.",
      "Check loader version requirements on the mod page.",
      "Remove one suspect mod at a time if the log lists several candidates.",
    ],
  },
  {
    id: "missing-dependency",
    title: "Missing dependency",
    summary: "A required dependency or companion mod is missing.",
    cause: "A mod, container, or app component depends on another package that is not installed or not visible at runtime.",
    confidence: "high",
    patterns: [
      /missing (?:required )?(?:dependency|mod|library|module|package)/i,
      /requires .* but it is not installed/i,
      /Could not find required/i,
      /Cannot find module/i,
      /No module named/i,
      /depends on .* which is missing/i,
    ],
    fixSteps: [
      "Read the evidence line for the missing dependency name.",
      "Install the required dependency at the version requested by the failing component.",
      "For modpacks, download dependencies from the same loader and Minecraft version.",
      "Restart after clearing stale build or launcher caches if the dependency was recently added.",
    ],
  },
  {
    id: "duplicate-mod",
    title: "Duplicate mod",
    summary: "The log suggests the same mod or plugin is installed more than once.",
    cause: "Duplicate jar files or duplicate package definitions can make the loader abort startup.",
    confidence: "high",
    appliesTo: ["minecraft", "unknown"],
    patterns: [
      /duplicate mod/i,
      /Mod .* is present multiple times/i,
      /DuplicateModsFound/i,
      /Found duplicate file/i,
      /same mod id/i,
    ],
    fixSteps: [
      "Open the mods or plugins folder and sort by name.",
      "Remove older duplicate jars, especially files with copy suffixes or multiple versions.",
      "Keep only one version of each mod for the active loader and game version.",
      "Start again and confirm the duplicate warning is gone.",
    ],
  },
  {
    id: "permission-denied",
    title: "Permission denied",
    summary: "The process failed because it could not access a required file, directory, device, or socket.",
    cause: "The runtime user does not have enough permissions for the path or resource named in the log.",
    confidence: "high",
    patterns: [/permission denied/i, /EACCES/i, /access is denied/i, /operation not permitted/i],
    fixSteps: [
      "Identify the path or resource in the evidence line.",
      "Fix ownership and permissions for the runtime user, not just your interactive user.",
      "For Docker or Unraid, verify volume mappings, PUID/PGID, and host path permissions.",
      "Restart the service after applying the permission change.",
    ],
  },
  {
    id: "out-of-memory",
    title: "Out of memory",
    summary: "The log contains an out-of-memory failure.",
    cause: "The process exhausted its memory limit or Java heap allocation.",
    confidence: "high",
    patterns: [
      /OutOfMemoryError/i,
      /Java heap space/i,
      /Cannot allocate memory/i,
      /Killed process .* out of memory/i,
      /container killed due to memory usage/i,
      /exit code 137/i,
    ],
    fixSteps: [
      "Increase the memory limit for the process, container, or CI job.",
      "For Java apps, set a realistic `-Xmx` value below the host/container limit.",
      "Close competing workloads or reduce modpack/server load.",
      "If the issue repeats, capture memory usage around startup to find the spike.",
    ],
  },
  {
    id: "port-in-use",
    title: "Port already in use",
    summary: "The app could not bind to a network port because something else is already using it.",
    cause: "Another process or container is bound to the same host port.",
    confidence: "high",
    patterns: [
      /address already in use/i,
      /EADDRINUSE/i,
      /port .* already in use/i,
      /bind.*(?:failed|failure).*in use/i,
      /port is already allocated/i,
    ],
    fixSteps: [
      "Find which process or container is using the port.",
      "Stop the conflicting service or change one of the port mappings.",
      "For Docker, check both container port and host port mappings.",
      "Restart the service and confirm the bind error no longer appears.",
    ],
  },
  {
    id: "path-not-found",
    title: "File path not found",
    summary: "The log references a missing file or directory.",
    cause: "A configured path, mounted volume, working directory, or generated artifact does not exist at runtime.",
    confidence: "medium",
    patterns: [
      /No such file or directory/i,
      /ENOENT/i,
      /file not found/i,
      /path not found/i,
      /Cannot find path/i,
      /does not exist/i,
    ],
    fixSteps: [
      "Check the exact missing path from the evidence line.",
      "Create the directory or correct the configured path.",
      "For containers, verify the host path exists before it is mounted.",
      "For CI, ensure the artifact is generated before later steps reference it.",
    ],
  },
  {
    id: "gpu-nvidia-not-detected",
    title: "GPU or NVIDIA runtime not detected",
    summary: "The log indicates NVIDIA GPU access is unavailable.",
    cause: "The app expected an NVIDIA GPU, driver, or container runtime, but the runtime cannot see it.",
    confidence: "high",
    appliesTo: ["docker", "unknown"],
    patterns: [
      /nvidia-smi.*not found/i,
      /No NVIDIA GPU detected/i,
      /could not select device driver.*gpu/i,
      /CUDA driver.*not found/i,
      /libcuda\.so.*(?:not found|cannot open)/i,
      /NVIDIA-SMI has failed/i,
    ],
    fixSteps: [
      "Confirm the host can see the GPU with `nvidia-smi`.",
      "Install or repair the NVIDIA driver on the host.",
      "For Docker or Unraid, configure the NVIDIA container runtime and pass GPU access into the container.",
      "Restart the container after confirming the runtime exposes the GPU device.",
    ],
  },
  {
    id: "generic-crash",
    title: "Generic crash",
    summary: "The log shows a crash, but no specific known signature was detected.",
    cause: "The failure needs a closer read of the stack trace or surrounding configuration.",
    confidence: "low",
    patterns: [/exception/i, /fatal/i, /crash/i, /failed/i, /error/i],
    fixSteps: [
      "Look for the first error line, not just the final shutdown message.",
      "Check recent config, dependency, image, or mod changes.",
      "Rerun with debug logging if the current log omits the root error.",
      "Share the full log and environment details when opening an issue.",
    ],
  },
];

export function matchRules(log: string, logType: LogType): RuleMatch[] {
  const lines = log.split(/\r?\n/);

  return rules
    .filter((rule) => !rule.appliesTo || rule.appliesTo.includes(logType) || logType === "unknown")
    .map((rule) => {
      const evidence = collectEvidence(lines, rule.patterns);

      if (evidence.length === 0) {
        return null;
      }

      return {
        id: rule.id,
        title: rule.title,
        cause: rule.cause,
        summary: rule.summary,
        confidence: rule.confidence,
        evidence,
        fixSteps: rule.fixSteps,
      };
    })
    .filter((match): match is RuleMatch => match !== null);
}

function collectEvidence(lines: string[], patterns: RegExp[]): string[] {
  const evidence: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || seen.has(trimmed)) {
      continue;
    }

    if (patterns.some((pattern) => pattern.test(trimmed))) {
      evidence.push(trimmed.slice(0, 280));
      seen.add(trimmed);
    }

    if (evidence.length >= MAX_EVIDENCE_PER_RULE) {
      break;
    }
  }

  return evidence;
}
