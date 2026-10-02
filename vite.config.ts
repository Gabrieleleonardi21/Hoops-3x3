/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In sviluppo /api va al backend Spring (porta 3001): per il browser è la stessa origine. Il proxy però
  // riscrive l'Host, quindi il backend controlla lo stesso l'Origin: la porta di Vite deve essere tra le sue cors.origins
  server: { proxy: { "/api": "http://localhost:3001" } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
