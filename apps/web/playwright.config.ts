import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const port = 3100;
export default defineConfig({
  testDir: "./e2e", use: { baseURL: `http://127.0.0.1:${port}`, trace: "on-first-retry" },
  webServer: {
    command: `pnpm --dir ../.. import:sample && pnpm dev --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { ...process.env, NEXT_DIST_DIR: ".next-e2e", NEORA_LOCAL_DEMO: "true", NEORA_RESET_DEMO_DATA: "true", NEORA_DEMO_DATA_DIR: resolve(process.cwd(), "../../data/e2e-runtime") }
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }]
});
