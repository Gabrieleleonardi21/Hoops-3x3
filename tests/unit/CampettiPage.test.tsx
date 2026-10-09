// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CampettiPage } from "../../src/pages/CampettiPage";
import { CAMPETTI_DEMO } from "../fixtures/campetti";
import { useAppStore } from "../../src/stores/useAppStore";
import type { User } from "../../src/types";

const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", guest: false };

beforeEach(() => {
  useAppStore.setState({ user: registrato });
  render(<MemoryRouter><CampettiPage /></MemoryRouter>);
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
});

describe("CampettiPage: i dati d'esempio si dicono chiaramente (FU-3)", () => {
  it("in cima alla pagina un avviso dice che i campetti sono d'esempio e non campi reali", () => {
    const avviso = screen.getByRole("note");
    expect(avviso.textContent).toContain("Dati di esempio.");
    expect(avviso.textContent).toContain("non sono campi reali");
  });

  it("l'avviso sta prima del titolo e di tutto il resto, che è l'elenco dei campetti di esempio", () => {
    const avviso = screen.getByRole("note");
    const dopo = (altro: HTMLElement) => Boolean(avviso.compareDocumentPosition(altro) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(dopo(screen.getByRole("heading", { name: "Campetti" }))).toBe(true);
    expect(dopo(screen.getByText(CAMPETTI_DEMO[0].nome))).toBe(true);
  });

  it("l'avviso resta anche quando i filtri non lasciano nessun campetto", () => {
    fireEvent.change(screen.getByPlaceholderText(/Cerca città o campo/), { target: { value: "zzz" } });
    expect(screen.getByText("Nessun campetto con questi filtri.")).toBeTruthy();
    expect(screen.getByRole("note").textContent).toContain("Dati di esempio.");
  });
});
