import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: { baseURL: "http://127.0.0.1:8765" },
  webServer: {
    command: "python -m http.server 8765 --bind 127.0.0.1",
    url: "http://127.0.0.1:8765",
    reuseExistingServer: false,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});
