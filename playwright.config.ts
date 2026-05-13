import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3010",
    trace: "on-first-retry",
  },
  webServer: {
    command: "npx next dev --hostname 127.0.0.1 --port 3010",
    env: {
      CRASHSENSE_AI_BASE_URL: "http://127.0.0.1:9/v1",
      CRASHSENSE_AI_MODE: "fallback",
      CRASHSENSE_AI_MODEL: "gemma4:e4b",
      CRASHSENSE_AI_TIMEOUT_MS: "5000",
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: "http://127.0.0.1:3010",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
