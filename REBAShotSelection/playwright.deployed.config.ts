import { defineConfig } from "@playwright/test";

const baseURL = process.env.DEPLOYED_URL || "https://YOUR-APP.run.app";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  retries: 1,
  use: {
    baseURL,
    headless: false,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
