// @vitest-environment jsdom
/** Button: le classi passate dall'esterno vincono su quelle della variante e della misura (FU-2). Con le classi semplicemente in
 *  fila, quale vince tra `text-court` e `text-chalk-muted` lo decide l'ordine delle regole nel CSS generato, non l'ordine delle
 *  classi: in produzione «Correggi» e gli altri restavano arancioni. Qui si guardano le classi che finiscono sull'elemento; che
 *  l'effetto in pagina sia quello giusto lo guarda l'e2e (tests/e2e/pulsanti.spec.ts), sul CSS vero. */
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { Button } from "../../src/components/ui/Button";

afterEach(cleanup); // senza le globali di Vitest, Testing Library non smonta da sola

/** Le classi dell'unico pulsante nella pagina */
const classi = () => screen.getByRole("button").className.split(/\s+/);

describe("Button: le classi dell'esterno vincono su variante e misura", () => {
  it("il colore dei collegamenti attenuati: «Correggi» (text-chalk-muted) non resta arancione", () => {
    render(<Button variant="link" className="text-chalk-muted">Correggi</Button>);
    expect(classi()).toContain("text-chalk-muted");
    expect(classi()).not.toContain("text-court");
  });

  it("«Rimuovi squadra» (text-chalk-dim, con un margine) non resta arancione, e il margine resta", () => {
    render(<Button variant="link" className="mt-2 text-chalk-dim">Rimuovi squadra</Button>);
    expect(classi()).toContain("text-chalk-dim");
    expect(classi()).toContain("mt-2");
    expect(classi()).not.toContain("text-court");
  });

  it("padding e grandezza del testo dei pulsanti del timer: px-4 e text-xl prendono il posto di px-5 e text-[15px]", () => {
    render(<Button className="h-11 min-w-11 px-4 font-display text-xl">+1</Button>);
    expect(classi()).toEqual(expect.arrayContaining(["h-11", "min-w-11", "px-4", "text-xl"]));
    expect(classi()).not.toContain("px-5");
    expect(classi()).not.toContain("text-[15px]");
    expect(classi()).not.toContain("h-10");
  });

  it("anche sfondo e hover: lo STOP rosso prende il posto del primario arancione", () => {
    render(<Button className="h-12 px-8 text-xl bg-loss text-chalk hover:bg-loss">STOP</Button>);
    expect(classi()).toEqual(expect.arrayContaining(["bg-loss", "text-chalk", "hover:bg-loss"]));
    for (const via of ["bg-court", "text-asphalt-950", "hover:bg-court-hover"]) expect(classi()).not.toContain(via);
  });

  it("il testo rosso di «Elimina» (ghost) vince sul grigio della variante, che continua a valere con il mouse", () => {
    render(<Button variant="ghost" size="sm" className="text-loss">Elimina</Button>);
    expect(classi()).toContain("text-loss");
    expect(classi()).not.toContain("text-chalk-muted");
    expect(classi()).toContain("hover:text-chalk"); // un'altra variante di stato: non è in conflitto
  });

  it("ciò che non è in conflitto resta tutto: il colore del link accanto alla sua grandezza del testo e alle classi di layout", () => {
    render(<Button variant="link" className="self-start">Aggiungi giocatore</Button>);
    expect(classi()).toEqual(expect.arrayContaining(["text-court", "text-[13px]", "px-0", "h-auto", "self-start"]));
  });

  it("senza classi dall'esterno la variante e la misura restano com'erano", () => {
    render(<Button size="sm">Annulla</Button>);
    expect(classi()).toEqual(expect.arrayContaining(["h-8", "px-3", "text-sm", "bg-court", "text-asphalt-950", "hover:bg-court-hover"]));
  });
});
