/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Copertura minima (%) della logica dell'app: sotto una di queste soglie `npm test -- --coverage` esce con errore e la CI si ferma.
// Vale per ogni file di queste cartelle, uno per uno (perFile): con la media della cartella un file piccolo senza test (safeUrl, che
// è l'unica difesa contro gli URL javascript:) restava nascosto dietro i file grandi ben provati. I componenti si provano più dal
// browser e non hanno soglia
const SOGLIA_80 = { lines: 80, functions: 80, branches: 80, statements: 80 };
/** Backend a cui il dev server inoltra /api e /actuator/health (vedi `server.proxy`) */
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3001";

/** La Content-Security-Policy del sito pubblicato: la stessa di render.yaml (un test unitario le confronta), applicata qui da
 *  `vite preview`, su cui girano i test end-to-end: così una risorsa esterna nuova che la policy non ammette si scopre nei test, non
 *  in produzione. Solo in preview: il dev server ha bisogno degli script e degli stili inline dell'HMR */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Oltre alle VITE_*, al browser arriva MAPS_API_KEY: la chiave della Maps Static API tiene il nome che ha nella shell di Gabriele e
  // tra le variabili di Render, senza una copia rinominata da tenere allineata. Sta nella pagina per costruzione (ogni chiave di
  // Google Maps lato browser lo è): la proteggono le restrizioni per referrer e per API impostate in Google Cloud Console, non il
  // nome (README, «Campetti»). Nessuna altra variabile senza prefisso entra nella build. Il prefisso vale per ogni nome che ci inizia:
  // una futura chiave riservata al server (per esempio MAPS_API_KEY_SERVER) finirebbe nel browser, quindi quella va chiamata senza prefisso
  envPrefix: ["VITE_", "MAPS_API_KEY"],
  // In sviluppo /api va al backend Spring (porta 3001, o BACKEND_URL: i test con il backend vero ne avviano uno su un'altra porta):
  // per il browser è la stessa origine. Il proxy però riscrive l'Host, quindi il backend controlla lo stesso l'Origin: la porta di
  // Vite deve essere tra le sue cors.origins. Anche /actuator/health, che l'app chiama all'avvio per svegliare il backend
  // (svegliaServer in services/api.ts)
  server: { proxy: { "/api": BACKEND_URL, "/actuator/health": BACKEND_URL } },
  preview: { headers: { "Content-Security-Policy": CSP } },
  test: {
    // Ambiente node di default; i test che usano il DOM lo dichiarano in testa con il commento @vitest-environment jsdom
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        perFile: true,
        "src/domain/**": SOGLIA_80,
        "src/utils/**": SOGLIA_80,
        "src/stores/**": SOGLIA_80,
        "src/services/**": SOGLIA_80,
      },
    },
  },
});
