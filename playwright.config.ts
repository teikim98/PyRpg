import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

// 클라우드 환경에는 Chromium이 /opt/pw-browsers에 미리 설치되어 있다.
// 그 경로가 없으면(로컬 PC) `npx playwright install chromium`으로 받은 브라우저를 쓴다.
const preinstalled = "/opt/pw-browsers/chromium";
const executablePath = process.env.PW_CHROMIUM_PATH ?? (existsSync(preinstalled) ? preinstalled : undefined);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:4173",
    launchOptions: executablePath ? { executablePath } : {},
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
