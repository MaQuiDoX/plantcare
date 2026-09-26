import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    { command: "node tests/fixtures/supabase.mjs", url: "http://127.0.0.1:54329/health", reuseExistingServer: false },
    { command: "npm run dev -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/login", reuseExistingServer: false, timeout: 120_000,
      env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_local_e2e_fixture", APP_URL: "http://127.0.0.1:3100", SUPABASE_SECRET_KEY: "", PLANTNET_API_KEY: "", GEMINI_API_KEY: "", GEMINI_MODEL: "", OPENWEATHER_API_KEY: "", VAPID_PUBLIC_KEY: "", VAPID_PRIVATE_KEY: "", VAPID_SUBJECT: "", RESEND_API_KEY: "", NOTIFICATION_FROM_EMAIL: "", NOTIFICATIONS_ENABLED: "false", CRON_SECRET: "local-e2e-only-secret-longer-than-32-characters", NEXT_PUBLIC_ENABLE_PWA_DEV: "true" } },
  ],
});
