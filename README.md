# CrashSense AI

CrashSense AI is an open-source web app that turns crash logs into plain-English diagnosis. It is built for Minecraft modpacks, Docker and Unraid containers, GitHub Actions, and general application logs.

The app is privacy-first for the MVP: local rules always run before optional AI enrichment, sensitive values are redacted before analysis output, and no database is used.

![CrashSense AI desktop analysis](docs/screenshots/desktop.png)

## Features

- Mobile-first dark UI for pasting logs and choosing Minecraft, Docker/Unraid, GitHub Actions, or Unknown.
- Ranked findings with summary, likely cause, confidence, evidence context, and fix steps.
- Rule coverage for common failures:
  - Java version mismatch
  - Fabric, Forge, or NeoForge mod mismatch
  - missing dependency
  - duplicate mod
  - mixin transformation errors
  - bad config files
  - client/server-only mod mismatch
  - Java null pointer crashes
  - permission denied and PUID/PGID mismatches
  - out of memory
  - port already in use
  - file path not found
  - GPU/NVIDIA runtime not detected
  - Docker volume mapping issues
  - DNS failures
  - image pull failures
  - container healthcheck failures
  - missing GitHub Actions secrets
  - checkout failures
  - runtime version mismatches
  - dependency cache corruption
- Privacy redaction for tokens, secret-like values, emails, IP addresses, webhook URLs, and user filesystem paths.
- Copy-ready Discord replies and GitHub issue templates.
- Export markdown and JSON reports.
- Open a prefilled GitHub issue URL.
- Optional OpenAI-compatible enrichment controlled by environment variables.

![CrashSense AI mobile view](docs/screenshots/mobile.png)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Optional AI Enrichment

Local rule-based analysis always runs first. AI enrichment is disabled unless `OPENAI_API_KEY` is set.

Create `.env.local`:

```bash
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o-mini
```

Any OpenAI-compatible chat completions provider can be used by changing `OPENAI_BASE_URL` and `OPENAI_MODEL`. The AI prompt is constrained to improve wording only from supplied evidence; it must not invent evidence, change confidence, or add unsupported root causes.

## Example Logs

Sample logs live in [`examples`](examples):

- `minecraft-java-mismatch.log`
- `minecraft-missing-dependency.log`
- `minecraft-mixin-error.log`
- `minecraft-null-pointer.log`
- `docker-port-in-use.log`
- `docker-volume-mapping.log`
- `unraid-nvidia-missing.log`
- `github-actions-missing-path.log`
- `github-actions-missing-secret.log`
- `privacy-redaction.log`

The web UI also includes built-in examples.

## Architecture

```text
src/app/page.tsx                    Web UI
src/app/api/analyze/route.ts        Server-side analysis API
src/lib/analysis                    Parser, rule definitions, redaction, formatters, AI enrichment
src/lib/crashsense.ts               Bot/App-friendly analyzer export
src/lib/examples.ts                 Built-in example logs
examples                            Standalone test logs
.github/workflows/ci.yml            Lint, test, build, and production audit
```

The analyzer core is independent from the UI. A Discord bot, GitHub App, CLI, or worker can import:

```ts
import { analyzeCrashLog } from "@/lib/crashsense";

const result = analyzeCrashLog({
  logType: "minecraft",
  log: crashLog,
});
```

## API

`POST /api/analyze`

```json
{
  "logType": "minecraft",
  "log": "paste crash log here"
}
```

Response:

```json
{
  "summary": "The log points to a Java runtime or bytecode version mismatch.",
  "likelyCause": "The app or modpack was built for a different Java version than the one currently running it.",
  "confidence": "high",
  "evidence": ["> L2: java.lang.UnsupportedClassVersionError..."],
  "fixSteps": ["Check the required Java version..."],
  "discordReply": "...",
  "githubIssue": "...",
  "markdownReport": "...",
  "jsonReport": "...",
  "githubIssueUrl": "https://github.com/new?...",
  "detectedRules": ["java-version-mismatch"],
  "findings": [],
  "redactions": []
}
```

## Rule Authoring

Rules live in [`src/lib/analysis/rule-definitions.ts`](src/lib/analysis/rule-definitions.ts). Add a structured rule definition rather than changing matcher logic.

Each rule should include:

1. Stable `id`.
2. Human-readable `title`, `summary`, and `cause`.
3. Regex `patterns` as strings.
4. `confidence` and `specificity`.
5. `fixSteps`.
6. Optional `appliesTo`.
7. Tests in [`src/lib/analysis/analysis.test.ts`](src/lib/analysis/analysis.test.ts).

Evidence context, scoring, ranking, and report formatting are handled by the shared analyzer.

## Development

```bash
npm test
npm run lint
npm run build
npm audit --omit=dev
```

CI runs the same checks on push and pull requests to `main`.

## Contributing

Contributions are welcome. Good first issues include:

- Add more real-world crash signatures and example logs.
- Improve fix steps for specific launchers, mod loaders, containers, or CI runners.
- Add hosted deployment configuration.
- Build a Discord bot or GitHub App around `analyzeCrashLog`.
- Add private paste redaction previews and user-controlled redaction toggles.

## Roadmap

- Hosted demo.
- More Minecraft launcher-specific diagnostics.
- Unraid template rule packs.
- GitHub issue comment helper.
- Discord bot command.
- Optional redaction preview before AI enrichment.

## License

MIT
