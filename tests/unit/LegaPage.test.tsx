// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LegaPage } from "../../src/pages/LegaPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa, User } from "../../src/types";

const store = () => useAppStore.getState();
const ospite: User = { name: "Ospite", guest: true };

/** Apre la pagina della lega con le tappe già nello store; dopo la creazione l'app va alla pagina della tappa, qui un segnaposto */
function apriLega() {
  useAppStore.setState({ user: ospite, legaId: "l1", leghe: [{ id: "l1", nome: "Lega", ts: 1, nTappe: 0 }], legaName: "Lega" });
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
  useAppStore.setState({ tappe: [] });
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  store().reset();
  localStorage.clear();
});

/** La tappa «Roma» con queste squadre (nome e punti ranking), senza partite */
const tappaCon = (squadre: [string, string][]): Tappa => ({
  id: "t1", nome: "Roma", luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, gironi: null, partite: [], video: [],
  squadre: squadre.map(([nome, rank], i) => ({ id: `s${i}`, nome, rank, giocatori: [] })),
});

describe("LegaPage: la classifica del circuito", () => {
  it("non elenca le squadre segnaposto né quelle senza punti ranking, e con nessuna classificata non compare", () => {
    useAppStore.setState({ tappe: [tappaCon([["Squadra 1", "50"], ["Alfa", ""], ["Beta", "30"], ["Gamma", "0"]])] });
    apriLega();
    const tabella = screen.getByRole("table", { name: "Classifica circuito" });
    expect(within(tabella).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual(["1Beta301"]);

    cleanup();
    useAppStore.setState({ tappe: [tappaCon([["Squadra 1", "50"], ["Alfa", ""]])] });
    apriLega();
    expect(screen.queryByText("Classifica circuito")).toBeNull();
  });

  it("per ogni squadra vale il rank più alto tra le tappe e si contano le tappe giocate", () => {
    const t2 = { ...tappaCon([["alfa", "40"], ["Beta", "10"]]), id: "t2" };
    useAppStore.setState({ tappe: [tappaCon([["Alfa", "25"], ["Beta", "30"]]), t2] });
    apriLega();
    const tabella = screen.getByRole("table", { name: "Classifica circuito" });
    expect(within(tabella).getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual(["1Alfa402", "2Beta302"]);
  });
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

  it("nome e luogo non si possono scrivere oltre 120 e 160 caratteri, i limiti del server; il nome della lega oltre 120", () => {
    apriLega();
    expect((screen.getByLabelText("Nome tappa") as HTMLInputElement).maxLength).toBe(120);
    expect((screen.getByLabelText("Luogo") as HTMLInputElement).maxLength).toBe(160);
    expect((screen.getByLabelText(/La tua lega/) as HTMLInputElement).maxLength).toBe(120);
  });

  it("la centunesima tappa non si crea: il tetto del server si dice prima della POST", () => {
    useAppStore.setState({ tappe: Array.from({ length: 100 }, (_, i) => ({ ...tappaCon([]), id: `t${i}` })) });
    apriLega();
    crea();
    expect(screen.getByRole("alert").textContent).toBe("Una lega può avere al massimo 100 tappe.");
    expect(store().tappe).toHaveLength(100);
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
