import type { LogType } from "@/lib/analysis";

export type ExampleLog = {
  label: string;
  type: LogType;
  log: string;
};

export const exampleLogs: ExampleLog[] = [
  {
    label: "Minecraft Java mismatch",
    type: "minecraft",
    log: `[main/ERROR]: Failed to start Minecraft
java.lang.UnsupportedClassVersionError: net/fabricmc/loader/impl/launch/knot/KnotClient has been compiled by a more recent version of the Java Runtime (class file version 61.0), this version only recognizes class file versions up to 55.0`,
  },
  {
    label: "Minecraft missing dependency",
    type: "minecraft",
    log: `[main/ERROR]: Incompatible mod set!
Mod 'Create' requires mod 'Flywheel' 0.6.10 or later, but it is not installed.
Loading errors encountered: missing dependency`,
  },
  {
    label: "Docker port conflict",
    type: "docker",
    log: `Error response from daemon: driver failed programming external connectivity on endpoint web:
Bind for 0.0.0.0:8080 failed: port is already allocated
listen tcp 0.0.0.0:8080: bind: address already in use`,
  },
  {
    label: "Unraid NVIDIA missing",
    type: "docker",
    log: `Starting container with GPU acceleration
nvidia-smi: not found
RuntimeError: No NVIDIA GPU detected. CUDA driver library libcuda.so cannot open shared object file`,
  },
  {
    label: "GitHub Actions missing path",
    type: "github-actions",
    log: `Run npm test
Error: ENOENT: no such file or directory, open '/home/runner/work/app/coverage/lcov.info'
Process completed with exit code 1.`,
  },
];
