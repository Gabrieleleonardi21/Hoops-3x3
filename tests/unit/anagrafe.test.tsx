// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { GiocatoreCard } from "../../src/components/anagrafe/GiocatoreCard";
import { GiocatoreForm } from "../../src/components/anagrafe/GiocatoreForm";
import { GiocatoreModal } from "../../src/components/anagrafe/GiocatoreModal";
import { SquadraAnagrafeCard } from "../../src/components/anagrafe/SquadraAnagrafeCard";
import { SquadraAnagrafeModal } from "../../src/components/anagrafe/SquadraAnagrafeModal";
import { AnagrafePage } from "../../src/pages/AnagrafePage";
import { GiocatorePage } from "../../src/pages/GiocatorePage";
import { useAnagrafeStore } from "../../src/stores/useAnagrafeStore";
import { useAppStore } from "../../src/stores/useAppStore";
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

  it.each([
    ["con il sito porta al sito", { website: "https://ballers.it", instagram: "https://instagram.com/ballers" }, "Vai al sito di Ballers"],
    ["senza sito porta a Instagram", { instagram: "https://instagram.com/ballers" }, "Instagram di Ballers"],
    ["senza sito né Instagram cerca la squadra su Google", {}, 'Cerca "Ballers" su Google'],
  ])("il logo della scheda %s, e il titolo lo dice", (_caso, campi, titolo) => {
    render(<SquadraAnagrafeModal s={{ ...squadra, logo: "/logos/ballers.svg", ...campi }} giocatori={[]} user={autore}
      onClose={nulla} onRemove={riuscita} onUpdate={riuscita} />);
    expect(screen.getByTitle(titolo).tagName).toBe("A");
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

// ── Voci in forma pubblica (T2.15): lette senza account, con i dati personali vuoti e autoreId null ──
// Il server manda le stesse chiavi: restano nome, cognome, soprannome, ruolo, numero e squadra (per la squadra, anche roster, città e note)
const giocatorePubblico: RegGiocatore = { ...giocatore, soprannome: "Il Mago", nazionalita: "", autore: "", autoreId: null };
const squadraPubblica: RegSquadra = { ...squadra, autore: "", autoreId: null };

/** Un componente dell'anagrafe che mostra la voce in forma pubblica, e le righe che con i dati nascosti non devono comparire */
interface CasoPubblico {
  nome: string;
  mostra: (user: User) => void;
  /** Etichette delle righe dei dati personali: senza valore la riga non c'è, nemmeno con la sola etichetta */
  righe: string[];
}
const casiPubblici: CasoPubblico[] = [
  {
    nome: "GiocatoreCard",
    mostra: (user) => render(<MemoryRouter><GiocatoreCard g={giocatorePubblico} user={user} onRemove={nulla} onOpen={nulla} /></MemoryRouter>),
    righe: ["Nato il", "cm", "kg", "anni di esperienza"],
  },
  {
    nome: "GiocatoreModal",
    mostra: (user) => render(<MemoryRouter><GiocatoreModal g={giocatorePubblico} user={user} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} /></MemoryRouter>),
    righe: ["Nato il", "Città", "Nazionalità", "Fisico", "Esperienza"],
  },
  {
    nome: "SquadraAnagrafeCard",
    mostra: (user) => render(<SquadraAnagrafeCard s={squadraPubblica} giocatori={[]} user={user} onRemove={nulla} onOpen={nulla} />),
    righe: ["Referente"],
  },
  {
    nome: "SquadraAnagrafeModal",
    mostra: (user) => render(<SquadraAnagrafeModal s={squadraPubblica} giocatori={[]} user={user} onClose={nulla} onRemove={riuscita} onUpdate={riuscita} />),
    righe: ["Referente"],
  },
];

describe.each(casiPubblici)("$nome: la voce in forma pubblica", ({ mostra, righe }) => {
  it("non mostra «Registrato da» senza il nome, né righe con la sola etichetta", () => {
    mostra(autore);
    expect(screen.queryByText(/Registrat[oa] da/)).toBeNull();
    for (const etichetta of righe) expect(document.body.textContent, etichetta).not.toContain(etichetta);
  });

  it("non mostra niente di strano al posto dei dati nascosti (NaN, undefined, null, età)", () => {
    mostra(autore);
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null|\d+ anni(?! di esperienza)/);
  });

  it("nemmeno l'ADMIN può modificarla o eliminarla: il form partirebbe da campi vuoti e li scriverebbe sul server", () => {
    mostra(admin);
    for (const nome of ["Modifica", "Elimina", "Elimina Mario Rossi", "Elimina Ballers"]) expect(pulsante(nome), nome).toBeNull();
  });

  it("l'autore (anche con la cache vecchia) non vede i comandi: senza autoreId non si è autori di niente", () => {
    mostra(autore);
    for (const nome of ["Modifica", "Elimina", "Elimina Mario Rossi", "Elimina Ballers"]) expect(pulsante(nome), nome).toBeNull();
  });
});

describe("Anagrafe: «Registrato da» c'è solo se c'è l'autore", () => {
  it("con la forma completa l'etichetta compare con il nome (giocatore e squadra, scheda e modale)", () => {
    for (const mostra of [mostraGiocatoreCard, mostraGiocatoreModal]) {
      mostra(autore);
      expect(screen.getByText("Registrato da Anna")).toBeTruthy();
      cleanup();
    }
    for (const mostra of [mostraSquadraCard, mostraSquadraModal]) {
      mostra(autore);
      expect(screen.getByText("Registrata da Anna")).toBeTruthy();
      cleanup();
    }
  });

  it("le modali in forma pubblica non hanno nemmeno la striscia del piede, vuota: senza autore e senza comandi non c'è niente da mostrarci", () => {
    for (const { mostra } of casiPubblici.filter((c) => c.nome.endsWith("Modal"))) {
      mostra(admin);
      expect(screen.getByRole("dialog").querySelector(".border-t")).toBeNull();
      cleanup();
    }
  });
});

describe("GiocatorePage: il giocatore in forma pubblica", () => {
  afterEach(() => {
    useAppStore.getState().reset();
    useAnagrafeStore.setState({ giocatori: null, squadre: null, errore: null, caricata: false });
  });

  it("non mostra «Registrato da» senza il nome, né età, altezza o peso al posto dei dati nascosti", () => {
    useAppStore.setState({ user: autore, tappe: [] });
    useAnagrafeStore.setState({ giocatori: [giocatorePubblico], squadre: [], errore: null, caricata: true });
    render(
      <MemoryRouter initialEntries={["/giocatore/g1"]}>
        <Routes><Route path="/giocatore/:id" element={<GiocatorePage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { name: /Mario Rossi/ })).toBeTruthy();
    expect(screen.queryByText(/Registrato da/)).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|undefined|null|\d+ anni|\d+ cm|\d+ kg/);
  });
});

describe("AnagrafePage: l'avviso sulla riservatezza dei dati", () => {
  afterEach(() => {
    useAppStore.getState().reset();
    useAnagrafeStore.setState({ giocatori: null, squadre: null, errore: null, caricata: false });
  });

  it("dice che i dati personali li vede solo chi ha un account e che nome, squadra, ruolo e numero sono visibili a tutti", () => {
    useAppStore.setState({ user: autore, tappe: [] });
    useAnagrafeStore.setState({ giocatori: [], squadre: [], errore: null, caricata: true });
    render(<MemoryRouter><AnagrafePage /></MemoryRouter>);
    const avviso = screen.getByText(/L'anagrafe è condivisa/);
    expect(avviso.textContent).toMatch(/dati personali/);
    expect(avviso.textContent).toMatch(/solo chi ha un account/);
    expect(avviso.textContent).toMatch(/nome, squadra, ruolo e numero/);
    // Il testo di prima prometteva dati «visibili a tutti gli utenti» e «che possono essere rese pubbliche»: non è più vero
    expect(avviso.textContent).not.toMatch(/visibili a tutti gli utenti/);
    expect(avviso.textContent).not.toMatch(/rese pubbliche/);
  });
});

