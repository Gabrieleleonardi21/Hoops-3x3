// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GiocatoreForm } from "../../src/components/anagrafe/GiocatoreForm";
import { GiocatoreModal } from "../../src/components/anagrafe/GiocatoreModal";
import { SquadraAnagrafeForm } from "../../src/components/anagrafe/SquadraAnagrafeForm";
import { SquadraAnagrafeModal } from "../../src/components/anagrafe/SquadraAnagrafeModal";
import type { RegGiocatore, RegSquadra, User } from "../../src/types";

afterEach(cleanup);

const autore: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const giocatore: RegGiocatore = {
  id: "g1", nome: "Luca", cognome: "Verdi", soprannome: "", nascita: "", citta: "", nazionalita: "Italia", altezza: "", peso: "",
  ruolo: "Universale", numero: "", squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
};
const squadra: RegSquadra = {
  id: "s1", nome: "Alfa", citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "", note: "",
  autore: "Anna", autoreId: "u1", ts: 1,
};
const riuscita = async () => {};
const nulla = () => {};

/** Etichetta (senza l'asterisco dei campi obbligatori) e maxlength di ogni campo con un'etichetta */
function campi(): [string, string | null][] {
  return [...document.body.querySelectorAll("label")].map((l) => {
    const etichetta = (l.childNodes[0]?.textContent ?? "").trim().replace(/ \*$/, "");
    const campo = l.querySelector("input, select, textarea");
    return [etichetta, campo?.getAttribute("maxlength") ?? null];
  });
}

describe("anagrafe: creazione e modifica hanno gli stessi campi, con i limiti del server", () => {
  it("giocatore: stesse etichette e stessi maxlength nel form e nella scheda in modifica", () => {
    render(<GiocatoreForm squadre={[]} onSave={riuscita} />);
    const nelForm = campi();
    cleanup();
    render(<MemoryRouter><GiocatoreModal g={giocatore} user={autore} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(campi()).toEqual(nelForm);
    // I limiti di GiocatoreRequestDTO: soprannome 80, note 2000 (prima il form di creazione li tagliava a 50 e 500)
    expect(nelForm).toContainEqual(["Soprannome", "80"]);
    expect(nelForm).toContainEqual(["Note sportive", "2000"]);
  });

  it("squadra: stesse etichette e stessi maxlength nel form e nella scheda in modifica", () => {
    render(<SquadraAnagrafeForm giocatori={[]} onSave={riuscita} />);
    const nelForm = campi();
    cleanup();
    render(<SquadraAnagrafeModal s={squadra} giocatori={[]} user={autore} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} />);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(campi()).toEqual(nelForm);
    // I limiti di SquadraRequestDTO: nome, città e referente 120, note 2000
    expect(nelForm).toContainEqual(["Nome squadra", "120"]);
    expect(nelForm).toContainEqual(["Note", "2000"]);
  });
});
