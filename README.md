# CrashSense AI

CrashSense AI is an open-source web app that turns crash logs into plain-English diagnosis. It is built for Minecraft modpacks, Docker and Unraid containers, GitHub Actions, and general application logs.

The MVP runs local rules first, does not use a database, and can optionally enrich wording through an OpenAI-compatible API when environment variables are configured.

## Features

- Paste crash logs directly into a mobile-first dark UI.
- Choose Minecraft, Docker/Unraid, GitHub Actions, or Unknown log type.
- Detect common causes:
  - Java version mismatch
  - Fabric, Forge, or NeoForge mod mismatch
  - missing dependency
  - duplicate mod
  - permission denied
  - out of memory
  - port already in use
  - file path not found
  - GPU/NVIDIA not detected
- Return summary, likely cause, confidence, evidence lines, and fix steps.
- Generate copy-ready Discord replies and GitHub issue templates.
- Keep analyzer logic reusable for a future GitHub App or Discord bot.

## Screenshots

Screenshots will be added after the first hosted preview.

- Desktop: `docs/screenshots/desktop.png`
- Mobile: `docs/screenshots/mobile.png`

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

Any OpenAI-compatible chat completions provider can be used by changing `OPENAI_BASE_URL` and `OPENAI_MODEL`.

## Example Logs

Sample logs live in [`examples`](examples):

- `minecraft-java-mismatch.log`
- `minecraft-missing-dependency.log`
- `docker-port-in-use.log`
- `unraid-nvidia-missing.log`
- `github-actions-missing-path.log`

The web UI also includes built-in examples.

## Architecture

```text
src/app/page.tsx              Web UI
src/app/api/analyze/route.ts  Server-side analysis API
src/lib/analysis              Reusable parser, formatters, and AI enrichment
src/lib/examples.ts           Built-in example logs
examples                      Standalone test logs
```

The analyzer core is intentionally independent from the UI. A Discord bot, GitHub App, CLI, or hosted worker can call the same `analyzeLog` function and reuse the Discord/GitHub formatters.

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
  "evidence": ["java.lang.UnsupportedClassVersionError..."],
  "fixSteps": ["Check the required Java version..."],
  "discordReply": "...",
  "githubIssue": "...",
  "detectedRules": ["java-version-mismatch"]
}
```

## Development

```bash
npm test
npm run lint
npm run build
```

## Contributing

Contributions are welcome. Useful first issues include:

- Add more crash signatures and tests.
- Improve fix steps for specific Minecraft loaders or container platforms.
- Add more example logs.
- Add export/share actions.
- Build a Discord bot or GitHub App around the reusable analyzer core.

When adding a rule, include:

1. A concise rule id.
2. Specific regex patterns.
3. Evidence extraction expectations.
4. Fix steps that are safe and actionable.
5. A focused test case.

## Roadmap

- Hosted demo.
- Screenshot gallery.
- Rule packs for common Minecraft launchers and Unraid templates.
- GitHub issue comment helper.
- Discord bot command.
- Optional private paste redaction before AI enrichment.

## License

MIT
