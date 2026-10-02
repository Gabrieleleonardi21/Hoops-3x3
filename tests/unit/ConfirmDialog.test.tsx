// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmDialog } from "../../src/components/ui/ConfirmDialog";

// Senza le globali di Vitest, Testing Library non smonta da sola i componenti alla fine di ogni test
afterEach(cleanup);

const TESTO = "2 tappe hanno modifiche non salvate: uscendo andranno perse.";

function apri() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmDialog title="Uscire senza salvare?" onConfirm={onConfirm} onCancel={onCancel}>{TESTO}</ConfirmDialog>);
  return { onConfirm, onCancel };
}

describe("ConfirmDialog (finestra di conferma)", () => {
  it("dice che cosa si perde e procede solo con «Conferma»", () => {
    const { onConfirm, onCancel } = apri();
    expect(screen.getByRole("dialog", { name: "Uscire senza salvare?" }).textContent).toContain(TESTO);
    fireEvent.click(screen.getByRole("button", { name: "Conferma" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("«Annulla», Esc e la X della modale annullano", () => {
    const { onConfirm, onCancel } = apri();
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(onCancel).toHaveBeenCalledTimes(3);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
