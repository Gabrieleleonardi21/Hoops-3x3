import { defineConfig } from "@playwright/test";

// I test end-to-end girano sulla build di produzione servita da `vite preview` (porta dedicata), non sul dev server: così provano
// anche la Content-Security-Policy (vite.config.ts, la stessa di render.yaml), che il dev server non può avere. La build parte da
// sola prima del server; in CI è già fatta e si ripete in pochi secondi. Senza proxy: le chiamate a /api le decidono i test
// (page.route), e una senza risposta finta riceve dal preview la pagina dell'app, non un errore di rete.
// `MAPS_API_KEY=` davanti alla build: la chiave della mappa, se è nella shell di chi lancia i test (lo è in quella di Gabriele),
// entrerebbe in dist/ per via di envPrefix (vite.config.ts) e l'URL con la chiave finirebbe negli screenshot e nei log di un test
// fallito. Vite dà la precedenza a process.env sui file .env anche quando il valore è vuoto: i test girano sempre con la mappa schematica
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 15000,
  reporter: "list",
  use: { baseURL: "http://localhost:5199" },
  webServer: {
    command: "MAPS_API_KEY= npx vite build && npx vite preview --port 5199 --strictPort",
    url: "http://localhost:5199",
    reuseExistingServer: false,
    timeout: 120000,
  },
});
