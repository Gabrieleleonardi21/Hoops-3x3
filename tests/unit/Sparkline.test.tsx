// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Sparkline } from "../../src/components/profile/Sparkline";

afterEach(cleanup);

/** x e larghezza di ogni barra, come numeri */
const barre = (container: HTMLElement) =>
  [...container.querySelectorAll("rect")].map((r) => ({ x: Number(r.getAttribute("x")), w: Number(r.getAttribute("width")) }));

describe("Sparkline: una barra per partita, sempre visibile", () => {
  it("con una partita la barra prende quasi tutta la larghezza", () => {
    const { container } = render(<Sparkline values={[12]} label="Punti" />);
    expect(barre(container)).toEqual([{ x: 0, w: 98.5 }]);
  });

  it("oltre le 67 partite le barre restano larghe e dentro il grafico (prima la larghezza diventava negativa)", () => {
    const valori = Array.from({ length: 150 }, (_, i) => (i * 7) % 21);
    const { container } = render(<Sparkline values={valori} label="Punti" />);
    const rect = barre(container);
    expect(rect).toHaveLength(150);
    // Ogni barra è larga almeno tre quarti del suo spazio (100 / 150) e l'ultima finisce entro il bordo destro
    for (const b of rect) expect(b.w).toBeGreaterThanOrEqual(0.5);
    const ultima = rect[rect.length - 1];
    expect(ultima.x + ultima.w).toBeLessThanOrEqual(100);
  });

  it("senza valori non disegna niente", () => {
    const { container } = render(<Sparkline values={[]} label="Punti" />);
    expect(container.childElementCount).toBe(0);
  });
});
