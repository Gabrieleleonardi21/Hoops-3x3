/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Copertura minima (%) della logica dell'app: sotto una di queste soglie `npm test -- --coverage` esce con errore e la CI si ferma.
// Vale per ogni cartella separatamente, così i componenti (che si provano più dal browser) non abbassano la media della logica
const SOGLIA_80 = { lines: 80, functions: 80, branches: 80, statements: 80 };

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In sviluppo /api va al backend Spring (porta 3001): per il browser è la stessa origine. Il proxy però
  // riscrive l'Host, quindi il backend controlla lo stesso l'Origin: la porta di Vite deve essere tra le sue cors.origins
  // Anche /actuator/health, che l'app chiama all'avvio per svegliare il backend (svegliaServer in services/api.ts)
  server: { proxy: { "/api": "http://localhost:3001", "/actuator/health": "http://localhost:3001" } },
  test: {
    // Ambiente node di default; i test che usano il DOM lo dichiarano in testa con il commento @vitest-environment jsdom
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      thresholds: {
        "src/domain/**": SOGLIA_80,
        "src/utils/**": SOGLIA_80,
        "src/stores/**": SOGLIA_80,
        "src/services/**": SOGLIA_80,
      },
    },
  },
});
