import { defineConfig } from "@playwright/test";

/* Test end-to-end con il backend vero (jar di Spring Boot + PostgreSQL), senza risposte finte: tests/e2e-backend/. Si lanciano con
 * `npm run test:e2e:backend` e in CI (job e2e-backend). Avviano da soli il backend e il dev server di Vite su due porte dedicate,
 * diverse da quelle dello sviluppo (3001, 5173) e dei test con il server finto (5199), così possono girare insieme.
 * Variabili d'ambiente (vedi README, «Test end-to-end con il backend vero»):
 * - E2E_BACKEND_JAR (obbligatoria): il jar del backend, per esempio ../hoop3x3-backend/target/hoop-3x3-backend-1.0.0.jar
 * - E2E_DB_NAME, E2E_DB_USERNAME, E2E_DB_PASSWORD: il database di prova (di base hoop3x3_e2e, postgres, vuota). Deve esistere, vuoto
 *   o già usato da questi test: lo schema lo creano le migrazioni di Flyway all'avvio. I test non lo svuotano: ogni test registra un
 *   utente nuovo e lavora solo sui suoi dati */
const JAR = process.env.E2E_BACKEND_JAR;
if (!JAR) {
  throw new Error("Manca E2E_BACKEND_JAR: il percorso del jar del backend (hoop3x3-backend/target/hoop-3x3-backend-*.jar)");
}
const PORTA_BACKEND = 3199;
const PORTA_VITE = 5299;

export default defineConfig({
  testDir: "tests/e2e-backend",
  // Un server vero risponde più lentamente di page.route, e il primo accesso paga BCrypt
  timeout: 30_000,
  reporter: "list",
  use: { baseURL: `http://localhost:${PORTA_VITE}` },
  webServer: [
    {
      command: `java -jar "${JAR}"`,
      // Playwright aspetta un 2xx: /actuator/health risponde 503 finché il database non è pronto
      url: `http://localhost:${PORTA_BACKEND}/actuator/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        PORT: String(PORTA_BACKEND),
        DB_NAME: process.env.E2E_DB_NAME ?? "hoop3x3_e2e",
        DB_USERNAME: process.env.E2E_DB_USERNAME ?? "postgres",
        DB_PASSWORD: process.env.E2E_DB_PASSWORD ?? "",
        // Solo per questi test: almeno 32 caratteri, altrimenti il server non parte
        JWT_SECRET: "segreto-dei-test-end-to-end-con-il-backend-vero-non-usarlo-altrove",
        // Il proxy di Vite riscrive l'host: il backend ammette l'origine della pagina solo se è in elenco (README del backend, «Deploy»)
        CORS_ORIGINS: `http://localhost:${PORTA_VITE}`,
        // Più test insieme registrano e accedono dallo stesso indirizzo: il limite di produzione (10 al minuto) li respingerebbe
        LIMITE_AUTH_AL_MINUTO: "100000",
      },
    },
    {
      command: `npx vite --port ${PORTA_VITE} --strictPort`,
      url: `http://localhost:${PORTA_VITE}`,
      timeout: 60_000,
      reuseExistingServer: false,
      // Il proxy di /api e /actuator/health va al backend di questi test, non a quello dello sviluppo (vite.config.ts)
      env: { BACKEND_URL: `http://localhost:${PORTA_BACKEND}` },
    },
  ],
});
