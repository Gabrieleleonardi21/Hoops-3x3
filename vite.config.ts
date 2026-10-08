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

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In sviluppo /api va al backend Spring (porta 3001, o BACKEND_URL: i test con il backend vero ne avviano uno su un'altra porta):
  // per il browser è la stessa origine. Il proxy però riscrive l'Host, quindi il backend controlla lo stesso l'Origin: la porta di
  // Vite deve essere tra le sue cors.origins. Anche /actuator/health, che l'app chiama all'avvio per svegliare il backend
  // (svegliaServer in services/api.ts)
  server: { proxy: { "/api": BACKEND_URL, "/actuator/health": BACKEND_URL } },
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
