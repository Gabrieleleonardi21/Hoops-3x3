/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // In sviluppo /api va al backend Spring (porta 3001): stessa origine, niente CORS
  server: { proxy: { "/api": "http://localhost:3001" } },
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
});
