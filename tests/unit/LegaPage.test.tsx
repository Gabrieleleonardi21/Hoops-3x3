// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LegaPage } from "../../src/pages/LegaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import type { User } from "../../src/types";

const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };

/** Apre la pagina della lega; dopo la creazione l'app va alla pagina della tappa, qui un segnaposto */
function apriLega() {
  useAppStore.setState({ user: ospite, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 0 }], legaName: "Lega", tappe: [] });
  render(
    <MemoryRouter initialEntries={["/lega"]}>
      <Routes>
        <Route path="/lega" element={<LegaPage />} />
        <Route path="/lega/tappa/:id" element={<p>Pagina della tappa</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const scrivi = (etichetta: string, testo: string) =>
  fireEvent.change(screen.getByLabelText(etichetta), { target: { value: testo } });
const crea = () => fireEvent.click(screen.getByRole("button", { name: "Crea la tappa" }));

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();
  localStorage.clear();
});

describe("LegaPage: «Crea la tappa» con gli stessi limiti del Coach (R8)", () => {
  it("un numero di gironi non intero (FD-9: «2,5» arriva come 2.5) non crea la tappa e dice perché", () => {
    apriLega();
    scrivi("Numero gironi", "2.5");
    crea();
    expect(screen.getByRole("alert").textContent).toBe("Numero di gironi non valido: con 8 squadre deve essere un intero da 1 a 4.");
    expect(store().tappe).toEqual([]);
    expect((screen.getByLabelText("Numero gironi") as HTMLInputElement).value).toBe("2.5"); // resta da correggere
  });

  it("più di 64 squadre non crea la tappa e dice perché", () => {
    apriLega();
    scrivi("Numero squadre", "65");
    crea();
    expect(screen.getByRole("alert").textContent).toBe("Una tappa ha da 2 a 64 squadre.");
    expect(store().tappe).toEqual([]);
  });

  it("un nome oltre i 120 caratteri (il limite del server) non crea la tappa e dice perché", () => {
    apriLega();
    scrivi("Nome tappa", "N".repeat(121));
    crea();
    expect(screen.getByRole("alert").textContent).toBe("Il nome della tappa può avere al massimo 120 caratteri.");
    expect(store().tappe).toEqual([]);
  });

  it("nome e luogo non si possono scrivere oltre 120 e 160 caratteri, i limiti del server", () => {
    apriLega();
    expect((screen.getByLabelText("Nome tappa") as HTMLInputElement).maxLength).toBe(120);
    expect((screen.getByLabelText("Luogo") as HTMLInputElement).maxLength).toBe(160);
  });

  it("con dati validi crea la tappa e la apre", () => {
    apriLega();
    scrivi("Nome tappa", "Napoli Open");
    crea();
    expect(store().tappe).toHaveLength(1);
    expect(store().tappe[0]).toMatchObject({ nome: "Napoli Open", nGironi: 2 });
    expect(store().tappe[0].squadre).toHaveLength(8);
    expect(screen.getByText("Pagina della tappa")).toBeTruthy();
  });
});
