// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SquadraAnagrafeForm } from "../../src/components/anagrafe/SquadraAnagrafeForm";
import { GiocatoreForm } from "../../src/components/anagrafe/GiocatoreForm";
import { AVVISO_VOCE_OMONIMA } from "../../src/utils/testi";
import type { RegGiocatore, RegSquadra } from "../../src/types";

afterEach(cleanup);

// Le voci esistenti le ha scritte Gabriele
const roma: RegSquadra = {
  id: "s1", nome: "Roma", citta: "Torino", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "",
  autore: "Gabriele", autoreId: "u1", ts: 1,
};
const mario: RegGiocatore = {
  id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "Italia", altezza: "", peso: "",
  ruolo: "", numero: "", squadra: "Roma Kings", esperienza: "", note: "", autore: "Gabriele", autoreId: "u1", ts: 1,
};

const salva = () => screen.getByRole("button", { name: "Salva nell'anagrafe" });

describe("SquadraAnagrafeForm: una squadra con lo stesso nome avvisa e si registra al secondo Salva", () => {
  it("il primo Salva avvisa con città e autore e non salva; il secondo salva", async () => {
    const onSave = vi.fn(async () => {});
    render(<SquadraAnagrafeForm giocatori={[]} squadre={[roma]} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Nome squadra *"), { target: { value: " roma " } });
    fireEvent.click(salva());
    expect(screen.getByRole("status").textContent).toBe(AVVISO_VOCE_OMONIMA("«Roma» (Torino, di Gabriele)", "squadra"));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(salva());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("cambiare il nome azzera l'avviso: il nome nuovo si salva subito", async () => {
    const onSave = vi.fn(async () => {});
    render(<SquadraAnagrafeForm giocatori={[]} squadre={[roma]} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Nome squadra *"), { target: { value: "Roma" } });
    fireEvent.click(salva());
    fireEvent.change(screen.getByLabelText("Nome squadra *"), { target: { value: "Milano" } });
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(salva());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });
});

describe("GiocatoreForm: un giocatore con lo stesso nome e cognome avvisa e si registra al secondo Salva", () => {
  it("l'ordine dei campi non conta: «Rossi» nel nome e «Mario» nel cognome sono lo stesso giocatore", async () => {
    const onSave = vi.fn(async () => {});
    render(<GiocatoreForm squadre={[]} giocatori={[mario]} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Rossi" } });
    fireEvent.change(screen.getByLabelText("Cognome *"), { target: { value: "Mario" } });
    fireEvent.click(salva());
    expect(screen.getByRole("status").textContent).toBe(AVVISO_VOCE_OMONIMA("Mario Rossi (Roma Kings)", "giocatore"));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(salva());
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
  });

  it("l'avviso dice la squadra del roster, non il testo della scheda («Roma Kings»)", () => {
    const romaDelRoster: RegSquadra = { ...roma, id: "sr", nome: "Roma", roster: ["g1"] };
    render(<GiocatoreForm squadre={[romaDelRoster]} giocatori={[mario]} onSave={vi.fn(async () => {})} />);
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Mario" } });
    fireEvent.change(screen.getByLabelText("Cognome *"), { target: { value: "Rossi" } });
    fireEvent.click(salva());
    expect(screen.getByRole("status").textContent).toBe(AVVISO_VOCE_OMONIMA("Mario Rossi (Roma)", "giocatore"));
  });

  it("cambiare il cognome azzera l'avviso", () => {
    render(<GiocatoreForm squadre={[]} giocatori={[mario]} onSave={vi.fn(async () => {})} />);
    fireEvent.change(screen.getByLabelText("Nome *"), { target: { value: "Mario" } });
    fireEvent.change(screen.getByLabelText("Cognome *"), { target: { value: "Rossi" } });
    fireEvent.click(salva());
    expect(screen.getByRole("status")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Cognome *"), { target: { value: "Rossini" } });
    expect(screen.queryByRole("status")).toBeNull();
  });
});

describe("SquadraAnagrafeForm: il roster mostra la squadra del roster accanto al giocatore (fase 12)", () => {
  it("la scelta del giocatore dice «Roma» se è nel roster di Roma, anche con «Roma Kings» scritto nella scheda", () => {
    const romaDelRoster: RegSquadra = { ...roma, id: "sr", nome: "Roma", roster: ["g1"] };
    render(<SquadraAnagrafeForm giocatori={[mario]} squadre={[romaDelRoster]} onSave={vi.fn(async () => {})} />);
    expect(screen.getByRole("option", { name: "Mario Rossi (Roma)" })).toBeTruthy();
  });
});
