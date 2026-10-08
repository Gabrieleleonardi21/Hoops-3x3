import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { CSP } from "../../vite.config";

/** Il valore dell'intestazione `nome` del sito statico in render.yaml (la prima voce con quel nome) */
function intestazioneDiRender(nome: string): string | undefined {
  const righe = readFileSync(new URL("../../render.yaml", import.meta.url), "utf8").split("\n");
  const i = righe.findIndex((r) => r.trim() === `name: ${nome}`);
  if (i < 0) return undefined;
  return righe[i + 1].trim().replace(/^value:\s*/, "").replace(/^"(.*)"$/, "$1");
}

describe("Content-Security-Policy: una sola policy, in produzione (render.yaml) e nei test end-to-end (vite preview)", () => {
  it("render.yaml e vite.config.ts hanno la stessa policy, carattere per carattere", () => {
    expect(intestazioneDiRender("Content-Security-Policy")).toBe(CSP);
  });

  it("la policy è restrittiva: niente inline negli script, oggetti e frame esterni vietati, embed dei video solo senza cookie", () => {
    const direttive = Object.fromEntries(CSP.split("; ").map((d) => {
      const [nome, ...valori] = d.split(" ");
      return [nome, valori];
    }));
    expect(direttive["default-src"]).toEqual(["'self'"]);
    expect(direttive["script-src"]).toEqual(["'self'"]);
    expect(direttive["object-src"]).toEqual(["'none'"]);
    expect(direttive["frame-ancestors"]).toEqual(["'none'"]);
    expect(direttive["frame-src"]).toEqual(["https://www.youtube-nocookie.com"]);
    expect(direttive["connect-src"]).toEqual(["'self'"]); // le API passano dalla rewrite, sulla stessa origine
    expect(CSP).not.toContain("unsafe-inline");
    expect(CSP).not.toContain("unsafe-eval");
  });
});
