/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In sviluppo /api va al backend Spring (porta 3001): per il browser è la stessa origine. Il proxy però
  // riscrive l'Host, quindi il backend controlla lo stesso l'Origin: la porta di Vite deve essere tra le sue cors.origins
  server: { proxy: { "/api": "http://localhost:3001" } },
  test: {
    // Ambiente node di default; i test che usano il DOM lo dichiarano in testa con il commento @vitest-environment jsdom
    environment: "node",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", include: ["src/**/*.{ts,tsx}"] },
  },
});
