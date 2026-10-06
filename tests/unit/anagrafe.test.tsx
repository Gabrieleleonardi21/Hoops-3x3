// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { GiocatoreCard } from "../../src/components/anagrafe/GiocatoreCard";
import { GiocatoreForm } from "../../src/components/anagrafe/GiocatoreForm";
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
// Le modali aspettano l'esito di modifica ed eliminazione: i gestori rispondono con una promessa
const riuscita = async () => {};

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
});

// I componenti della voce, mostrati a un utente. Le card e la modale del giocatore hanno dei Link: servono dentro un router
const mostraGiocatoreCard = (user: User) => {
  render(<MemoryRouter><GiocatoreCard g={giocatore} user={user} onRemove={nulla} onOpen={nulla} /></MemoryRouter>);
};
const mostraGiocatoreModal = (user: User) => {
  render(<MemoryRouter><GiocatoreModal g={giocatore} user={user} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} /></MemoryRouter>);
};
const mostraSquadraCard = (user: User) => {
  render(<SquadraAnagrafeCard s={squadra} giocatori={[]} user={user} onRemove={nulla} onOpen={nulla} />);
};
const mostraSquadraModal = (user: User) => {
  render(<SquadraAnagrafeModal s={squadra} giocatori={[]} user={user} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} />);
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

describe("Anagrafe: i campi di testo non accettano più caratteri del server (TR-3)", () => {
  /** Quanti caratteri accetta il campo con questa etichetta (-1 = nessun limite) */
  const limite = (etichetta: string) => (screen.getByLabelText(etichetta) as HTMLInputElement).maxLength;

  it("GiocatoreForm: nome e cognome al massimo 80 caratteri (GiocatoreRequestDTO)", () => {
    render(<GiocatoreForm squadre={[]} onSave={async () => {}} />);
    expect(limite("Nome *")).toBe(80);
    expect(limite("Cognome *")).toBe(80);
  });

  it("GiocatoreModal in modifica: nome e cognome 80, note 2000 (GiocatoreRequestDTO)", () => {
    mostraGiocatoreModal(autore);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(limite("Nome")).toBe(80);
    expect(limite("Cognome")).toBe(80);
    expect(limite("Note sportive")).toBe(2000);
  });

  it("SquadraAnagrafeModal in modifica: note 2000 (SquadraRequestDTO)", () => {
    mostraSquadraModal(autore);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(limite("Note")).toBe(2000);
  });
});

describe("Anagrafe: il focus nelle schede (modali)", () => {
  it("la scheda del giocatore atterra sul blocco informativo e non sul collegamento «Profilo»: un Invio dato di riflesso non cambia pagina", () => {
    mostraGiocatoreModal(autore);
    const blocco = document.querySelector("[data-focus-iniziale]");
    expect(blocco).not.toBeNull();
    expect(document.activeElement).toBe(blocco);
    expect(blocco!.getAttribute("tabindex")).toBe("-1"); // si prende il focus per programma, ma non entra nell'ordine di Tab
    expect(blocco!.textContent).toContain("Guardia"); // i dati del giocatore: è ciò che il lettore di schermo legge all'apertura
    expect(document.activeElement).not.toBe(screen.getByRole("link", { name: /Profilo e statistiche/ }));
  });

  it("la scheda della squadra atterra sul blocco dei dati e non sul collegamento del logo o del sito: un Invio di riflesso non apre il sito", () => {
    const conLogoESito = { ...squadra, citta: "Roma", logo: "/logos/ballers.svg", website: "https://ballers.it" };
    render(<SquadraAnagrafeModal s={conLogoESito} giocatori={[]} user={autore} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} />);
    const blocco = document.querySelector("[data-focus-iniziale]");
    expect(blocco).not.toBeNull();
    expect(document.activeElement).toBe(blocco);
    expect(blocco!.getAttribute("tabindex")).toBe("-1"); // si prende il focus per programma, ma non entra nell'ordine di Tab
    expect(blocco!.textContent).toContain("Roma"); // i dati della squadra: è ciò che il lettore di schermo legge all'apertura
    // Il collegamento del logo, il primo elemento raggiungibile, e quello del sito ci sono: nessuno dei due ha il focus
    const collegamenti = screen.getAllByRole("link");
    expect(collegamenti.length).toBeGreaterThanOrEqual(2);
    expect(collegamenti).not.toContain(document.activeElement);
  });

  it("la scheda di una squadra con il solo nome (l'unico campo obbligatorio) non ha un blocco vuoto da mettere a fuoco: il focus va al primo elemento raggiungibile", () => {
    mostraSquadraModal(autore); // la squadra di prova ha solo il nome
    expect(document.querySelector("[data-focus-iniziale]")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Modifica" }));
  });

  it.each([
    ["la città", { citta: "Roma" }],
    ["l'anno di fondazione", { anno: "2019" }],
    ["il referente", { referente: "Mario Rossi" }],
    ["il sito", { website: "https://ballers.it" }],
    ["Instagram", { instagram: "https://instagram.com/ballers" }],
    ["le note", { note: "campioni 2025" }],
    ["il roster", { roster: ["g1"] }],
  ])("basta %s perché ci sia il blocco dei dati, e il focus va lì", (_dato, campi) => {
    render(<SquadraAnagrafeModal s={{ ...squadra, ...campi }} giocatori={[giocatore]} user={autore} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} />);
    const blocco = document.querySelector("[data-focus-iniziale]");
    expect(blocco).not.toBeNull();
    expect(document.activeElement).toBe(blocco);
  });

  it("dopo «Modifica» il focus va al primo campo del form: il pulsante premuto sparisce e il focus non resta nel vuoto (giocatore)", () => {
    mostraGiocatoreModal(autore);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Nome"));
  });

  it("dopo «Modifica» il focus va al primo campo del form (squadra)", () => {
    mostraSquadraModal(autore);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Nome squadra"));
  });

  // Il form e la vista dei dati si danno il cambio: il pulsante premuto sparisce con la sua vista, e il focus non deve cadere su body
  it.each([
    ["giocatore", mostraGiocatoreModal],
    ["squadra", mostraSquadraModal],
  ])("%s: uscendo dalla modifica con «Annulla» il focus torna a «Modifica»", (_tipo, mostra) => {
    mostra(autore);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.queryByRole("button", { name: "Modifica" })).toBeNull(); // la vista dei dati non c'è più
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Modifica" }));
  });

  it.each([
    ["giocatore", mostraGiocatoreModal],
    ["squadra", mostraSquadraModal],
  ])("%s: anche dopo un «Salva modifiche» riuscito il focus torna a «Modifica»", async (_tipo, mostra) => {
    mostra(autore);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    fireEvent.click(screen.getByRole("button", { name: "Salva modifiche" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Salva modifiche" })).toBeNull()); // il server ha accettato: si esce dal form
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Modifica" }));
  });

  it("se il server rifiuta il salvataggio il form resta e con lui il focus non si sposta da «Salva modifiche»", async () => {
    const onUpdate = () => Promise.reject(new Error("no"));
    render(<MemoryRouter><GiocatoreModal g={giocatore} user={autore} onClose={nulla} onRemove={riuscita} onUpdate={onUpdate} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Modifica" }));
    const salva = screen.getByRole("button", { name: "Salva modifiche" });
    salva.focus();
    fireEvent.click(salva);
    expect((await screen.findByRole("alert")).textContent).toContain("Modifica non riuscita");
    expect(screen.getByRole("button", { name: "Salva modifiche" })).toBe(salva); // il form c'è ancora
    expect(document.activeElement).toBe(salva);
  });
});
