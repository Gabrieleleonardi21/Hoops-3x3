import { defineConfig } from "@playwright/test";

// I test end-to-end avviano da soli il server di sviluppo su una porta dedicata
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 15000,
  reporter: "list",
  use: { baseURL: "http://localhost:5199" },
  webServer: { command: "npx vite --port 5199 --strictPort", url: "http://localhost:5199", reuseExistingServer: false, timeout: 60000 },
});
