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
  {
    label: "Minecraft mixin failure",
    type: "minecraft",
    log: `[main/ERROR]: Mixin apply failed sodium.mixins.json:features.render.MixinWorldRenderer
org.spongepowered.asm.mixin.injection.throwables.InjectionError: Critical injection failure
Caused by: java.lang.RuntimeException: MixinTransformerError`,
  },
  {
    label: "Minecraft null pointer crash",
    type: "minecraft",
    log: `java.lang.NullPointerException: Cannot invoke "net.minecraft.world.level.block.entity.BlockEntity.getBlockPos()" because "tileEntity" is null
	at com.crashsense.testmod.world.CrashyChunkProcessor.processTileEntities(CrashyChunkProcessor.java:184)
	at com.crashsense.testmod.world.CrashyChunkProcessor.tickChunk(CrashyChunkProcessor.java:112)
	at com.crashsense.testmod.world.CrashyWorldTicker.onWorldTick(CrashyWorldTicker.java:67)
	at net.minecraftforge.eventbus.ASMEventHandler_482_CrashyWorldTicker_onWorldTick_WorldTickEvent.invoke(.dynamic)
	at net.minecraft.server.MinecraftServer.tickServer(MinecraftServer.java:819)
	at java.base/java.lang.Thread.run(Thread.java:1583)`,
  },
  {
    label: "GitHub Actions missing secret",
    type: "github-actions",
    log: `Run docker/login-action@v3
Error: Input required and not supplied: password
Workflow references secrets.REGISTRY_TOKEN but the secret is not available in this context.`,
  },
  {
    label: "Docker volume mapping",
    type: "docker",
    log: `Error response from daemon: invalid mount config for type "bind":
bind source path does not exist: /mnt/user/appdata/crashsense
Container failed to start.`,
  },
  {
    label: "Privacy redaction",
    type: "docker",
    log: `Error: permission denied while opening /home/alex/app/config.yml
api_key=sk-test-secret-value
Webhook: https://discord.com/api/webhooks/123456789/private-token
Failed to connect to 192.168.1.25 for user admin@example.com`,
  },
];
