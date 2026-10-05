// @vitest-environment jsdom
/** Il blocco dello scroll con più finestre aperte insieme (per esempio la conferma sopra la scheda dell'anagrafe): lo scroll
 *  torna solo quando si chiude l'ultima, in qualunque ordine React smonti le finestre. */
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Modal } from "../../src/components/ui/Modal";
import { ConfirmDialog } from "../../src/components/ui/ConfirmDialog";

const nulla = () => {};

/** La scheda (una Modal) con dentro, se `conferma`, la conferma (ConfirmDialog, un'altra Modal): com'è GiocatoreModal */
function Pila({ aperta, conferma }: { aperta: boolean; conferma: boolean }) {
  if (!aperta) return null;
  return (
    <Modal label="Scheda" onClose={nulla}>
      {conferma && <ConfirmDialog title="Eliminare il giocatore?" onConfirm={nulla} onCancel={nulla}>testo</ConfirmDialog>}
    </Modal>
  );
}

/** Due finestre separate, una accanto all'altra: A (la più vecchia) e B */
function Due({ a, b }: { a: boolean; b: boolean }) {
  return (
    <>
      {a && <Modal label="A" onClose={nulla}>finestra A</Modal>}
      {b && <Modal label="B" onClose={nulla}>finestra B</Modal>}
    </>
  );
}

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  document.body.style.overflow = "";
});

describe("blocco dello scroll con le finestre una sopra l'altra", () => {
  it.each(["", "scroll"])(
    "scheda e conferma si smontano nello stesso commit (per esempio «Indietro» del browser): lo scroll torna com'era («%s»)",
    (prima) => {
      document.body.style.overflow = prima;
      const { rerender } = render(<Pila aperta conferma={false} />);
      rerender(<Pila aperta conferma />);
      expect(document.body.style.overflow).toBe("hidden");
      rerender(<Pila aperta={false} conferma={false} />); // tutte e due insieme
      expect(document.body.style.overflow).toBe(prima);
    },
  );

  it("se prima si chiude la conferma lo scroll resta bloccato finché la scheda è aperta, poi torna", () => {
    const { rerender } = render(<Pila aperta conferma={false} />);
    rerender(<Pila aperta conferma />);
    rerender(<Pila aperta conferma={false} />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Pila aperta={false} conferma={false} />);
    expect(document.body.style.overflow).toBe("");
  });

  it.each([
    ["la più vecchia", { a: false, b: true }, { a: false, b: false }],
    ["la più recente", { a: true, b: false }, { a: false, b: false }],
  ])("due finestre separate: chiudendo per prima %s lo scroll resta bloccato finché l'altra è aperta", (_prima, dopoUna, dopoDue) => {
    const { rerender } = render(<Due a b />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Due {...dopoUna} />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Due {...dopoDue} />);
    expect(document.body.style.overflow).toBe("");
  });

  it("una finestra sola blocca e sblocca come prima", () => {
    const { rerender } = render(<Due a={false} b={false} />);
    expect(document.body.style.overflow).toBe("");
    rerender(<Due a b={false} />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<Due a={false} b={false} />);
    expect(document.body.style.overflow).toBe("");
  });
});
