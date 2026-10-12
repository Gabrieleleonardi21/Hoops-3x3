// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { PiePagina } from "../../src/components/layout/PiePagina";

afterEach(() => {
  cleanup();
});

describe("PiePagina: la riga che dice chi ha creato il sito", () => {
  it("è un piè di pagina (footer) con il testo «Sito creato da Gabriele Leonardi», senza link né email", () => {
    render(<PiePagina />);
    const piede = screen.getByRole("contentinfo");
    expect(piede.tagName).toBe("FOOTER");
    expect(piede.textContent).toContain("Sito creato da Gabriele Leonardi");
    expect(piede.querySelector("a")).toBeNull();
    expect(piede.textContent).not.toMatch(/@/);
  });
});
