// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GiocatoreCard } from "../../src/components/anagrafe/GiocatoreCard";
import { GiocatoreModal } from "../../src/components/anagrafe/GiocatoreModal";
import { SquadraAnagrafeCard } from "../../src/components/anagrafe/SquadraAnagrafeCard";
import { SquadraAnagrafeModal } from "../../src/components/anagrafe/SquadraAnagrafeModal";
import type { RegGiocatore, RegSquadra, User } from "../../src/types";

// Le due voci le ha scritte Anna (id "u1")
const giocatore: RegGiocatore = {
  id: "g1", nome: "Mario", cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "Italia",
  altezza: "", peso: "", ruolo: "Guardia", numero: "7", squadra: "", esperienza: "", note: "",
  autore: "Anna", autoreId: "u1", ts: 1,
};
const squadra: RegSquadra = {
  id: "s1", nome: "Ballers", citta: "", anno: "", rank: "", referente: "", roster: [], logo: "", website: "",
  instagram: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
};

// Chi guarda la voce: l'autore; un omonimo (stesso nome visualizzato, altra persona); un ADMIN; un ospite che si
// chiama come l'autore
const autore: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const omonimo: User = { id: "u2", name: "Anna", email: "anna.bis@example.it", ruolo: "USER", guest: false };
const admin: User = { id: "u9", name: "Responsabile", email: "admin@example.it", ruolo: "ADMIN", guest: false };
const ospite: User = { name: "Anna", guest: true };

const nulla = () => {};

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
});

// I componenti della voce, mostrati a un utente. Le card e la modale del giocatore hanno dei Link: servono dentro un router
const mostraGiocatoreCard = (user: User) => {
  render(<MemoryRouter><GiocatoreCard g={giocatore} user={user} onRemove={nulla} onOpen={nulla} /></MemoryRouter>);
};
const mostraGiocatoreModal = (user: User) => {
  render(<MemoryRouter><GiocatoreModal g={giocatore} user={user} onClose={nulla} onRemove={nulla} onUpdate={nulla} /></MemoryRouter>);
};
const mostraSquadraCard = (user: User) => {
  render(<SquadraAnagrafeCard s={squadra} giocatori={[]} user={user} onRemove={nulla} onOpen={nulla} />);
};
const mostraSquadraModal = (user: User) => {
  render(<SquadraAnagrafeModal s={squadra} giocatori={[]} user={user} onClose={nulla} onRemove={nulla} onUpdate={nulla} />);
};

/** Un componente dell'anagrafe che mostra i comandi di modifica o di eliminazione solo a chi può usarli */
interface Caso {
  nome: string;
  mostra: (user: User) => void;
  /** Nomi accessibili dei pulsanti riservati ad autore e ADMIN */
  comandi: string[];
}

const casi: Caso[] = [
  { nome: "GiocatoreCard", mostra: mostraGiocatoreCard, comandi: ["Elimina Mario Rossi"] },
  { nome: "GiocatoreModal", mostra: mostraGiocatoreModal, comandi: ["Modifica", "Elimina"] },
  { nome: "SquadraAnagrafeCard", mostra: mostraSquadraCard, comandi: ["Elimina Ballers"] },
  { nome: "SquadraAnagrafeModal", mostra: mostraSquadraModal, comandi: ["Modifica", "Elimina"] },
];

const pulsante = (nome: string) => screen.queryByRole("button", { name: nome });

describe.each(casi)("$nome: comandi di modifica (FS-7)", ({ mostra, comandi }) => {
  it("l'autore li vede", () => {
    mostra(autore);
    for (const nome of comandi) expect(pulsante(nome), nome).not.toBeNull();
  });

  it("un omonimo che non è l'autore non li vede: conta l'id, non il nome", () => {
    mostra(omonimo);
    for (const nome of comandi) expect(pulsante(nome), nome).toBeNull();
  });

  it("l'ADMIN li vede anche sulle voci altrui", () => {
    mostra(admin);
    for (const nome of comandi) expect(pulsante(nome), nome).not.toBeNull();
  });

  it("l'ospite non li vede, nemmeno se si chiama come l'autore", () => {
    mostra(ospite);
    for (const nome of comandi) expect(pulsante(nome), nome).toBeNull();
  });
});
