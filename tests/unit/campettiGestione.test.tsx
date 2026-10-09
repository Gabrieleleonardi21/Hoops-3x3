// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CampettoForm } from "../../src/components/campetti/CampettoForm";
import { CampettiPage } from "../../src/pages/CampettiPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useCampettiStore } from "../../src/stores/useCampettiStore";
import { campettiApi } from "../../src/services/campettiApi";
import { ApiError } from "../../src/services/api";
import { coordinateDa, inquadra, proietta } from "../../src/utils/geo";
import { MAX_CITTA_CAMPETTO, MAX_INDIRIZZO_CAMPETTO, MAX_NOME_CAMPETTO, MAX_NOTE_CAMPETTO } from "../../src/constants/rules";
import type { Campetto, CampettoInput } from "../../src/types/campetto";
import type { User } from "../../src/types";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

/* T5.5: il form con cui si aggiunge o si corregge un campetto (D6), con i tre modi di dare la posizione (D4), e la pagina che lo apre:
 * chi aggiunge (ogni registrato), chi modifica ed elimina (autore o ADMIN, D3), l'ospite in sola lettura. La mappa è quella
 * schematica (senza chiave): la chiave vera, se è nella shell, non deve entrare nei test. */

// Si sostituisce solo la rete: store e pagina sono quelli veri
vi.mock("../../src/services/campettiApi", async (importOriginal) => {
  const reale = await importOriginal<typeof import("../../src/services/campettiApi")>();
  return { ...reale, campettiApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});
const api = vi.mocked(campettiApi);

/** Il lato del sistema di coordinate della mappa (`size=640x640` della Maps Static API) */
const LATO = 640;
/** Dove sta chi compila il form: il centro di Torino */
const UTENTE = { lat: 45.0703, lng: 7.6869 };
const [ruffini] = CAMPETTI_DEMO;

/** Il browser finto: concede la posizione, oppure la nega (PERMISSION_DENIED = 1) */
function geolocalizzazione(esito: "concessa" | "negata") {
  const getCurrentPosition = vi.fn((ok: PositionCallback, ko: PositionErrorCallback) => {
    if (esito === "concessa") ok({ coords: { latitude: UTENTE.lat, longitude: UTENTE.lng } } as GeolocationPosition);
    else ko({ code: 1 } as GeolocationPositionError);
  });
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

const campo = (etichetta: string) => screen.getByLabelText(etichetta) as HTMLInputElement;
const scrivi = (etichetta: string, valore: string) => fireEvent.change(campo(etichetta), { target: { value: valore } });
const salva = () => fireEvent.click(screen.getByRole("button", { name: "Salva il campetto" }));
/** Il messaggio d'errore del form (null se non c'è) */
const errore = () => screen.queryByRole("alert")?.textContent ?? null;

/** Il form di un campetto nuovo, con la mappa dei sei campetti di Torino, e la funzione di salvataggio finta */
function formNuovo(onSave = vi.fn(async (_input: CampettoInput) => {})) {
  render(<CampettoForm campetti={CAMPETTI_DEMO} onSave={onSave} onAnnulla={() => {}} />);
  return onSave;
}

/** Un clic sulla mappa schematica, disegnata a 320×320 px nella pagina (metà del sistema 640), con le coordinate attese */
function clicSullaMappa(x: number, y: number) {
  const livello = document.querySelector("[role='presentation']") as HTMLElement;
  livello.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 320, right: 320, bottom: 320, x: 0, y: 0, toJSON: () => ({}) });
  fireEvent.click(livello, { clientX: x, clientY: y });
  const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
  return coordinateDa(x * 2, y * 2, centro, zoom, LATO);
}

beforeEach(() => {
  vi.stubEnv("MAPS_API_KEY", "");
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  vi.unstubAllEnvs();
  Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
});

describe("CampettoForm: i campi obbligatori si controllano prima dell'invio", () => {
  it("senza nome non si invia e il messaggio lo dice", async () => {
    const onSave = formNuovo();
    scrivi("Latitudine", "45.07");
    scrivi("Longitudine", "7.68");
    salva();
    expect(errore()).toBe("Il nome è obbligatorio.");
    await waitFor(() => expect(onSave).not.toHaveBeenCalled());
  });

  it("senza posizione non si invia: il messaggio dice i tre modi per darla", () => {
    const onSave = formNuovo();
    scrivi("Nome *", "Campo nuovo");
    salva();
    expect(errore()).toMatch(/^La posizione è obbligatoria/);
    expect(errore()).toMatch(/la tua posizione/);
    expect(errore()).toMatch(/clic sulla mappa/);
    expect(errore()).toMatch(/latitudine e longitudine/);
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each([
    ["latitudine oltre 90", "91", "7.68", /latitudine.*tra −90 e 90/i],
    ["latitudine sotto −90", "-90.5", "7.68", /latitudine.*tra −90 e 90/i],
    ["latitudine non numerica", "quarantacinque", "7.68", /latitudine.*tra −90 e 90/i],
    ["longitudine oltre 180", "45.07", "180.1", /longitudine.*tra −180 e 180/i],
    ["longitudine sotto −180", "45.07", "-181", /longitudine.*tra −180 e 180/i],
    ["longitudine mancante", "45.07", "", /longitudine.*tra −180 e 180/i],
  ])("coordinate fuori intervallo o non numeriche (%s) sono rifiutate prima dell'invio, con il campo nel messaggio", (_caso, lat, lng, atteso) => {
    const onSave = formNuovo();
    scrivi("Nome *", "Campo nuovo");
    scrivi("Latitudine", lat);
    scrivi("Longitudine", lng);
    salva();
    expect(errore()).toMatch(atteso);
    expect(onSave).not.toHaveBeenCalled();
  });

  it.each(["0", "9", "2.5", ""])("canestri «%s»: non è un intero da 1 a 8, si rifiuta prima dell'invio", (valore) => {
    const onSave = formNuovo();
    scrivi("Nome *", "Campo nuovo");
    scrivi("Latitudine", "45.07");
    scrivi("Longitudine", "7.68");
    scrivi("Canestri", valore);
    salva();
    expect(errore()).toBe("I canestri devono essere un numero intero da 1 a 8.");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("i campi di testo hanno i limiti del server (CampettoRequestDTO)", () => {
    formNuovo();
    expect(campo("Nome *").maxLength).toBe(MAX_NOME_CAMPETTO);
    expect(campo("Indirizzo").maxLength).toBe(MAX_INDIRIZZO_CAMPETTO);
    expect(campo("Città").maxLength).toBe(MAX_CITTA_CAMPETTO);
    expect(campo("Note").maxLength).toBe(MAX_NOTE_CAMPETTO);
  });
});

describe("CampettoForm: i tre modi di dare la posizione (D4)", () => {
  it("coordinate scritte a mano, anche con la virgola italiana: all'invio sono numeri, e i campi non scritti hanno i valori di base", async () => {
    const onSave = formNuovo();
    scrivi("Nome *", "  Campo nuovo  ");
    scrivi("Latitudine", "45,0703");
    scrivi("Longitudine", "7.6869");
    salva();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const input = onSave.mock.calls[0][0];
    expect(input).toEqual({
      nome: "Campo nuovo", indirizzo: "", citta: "", lat: 45.0703, lng: 7.6869, superficie: "Asfalto", canestri: 2,
      illuminato: false, coperto: false, gratuito: true, retine: false, linee: false, fontanella: false, stato: "buono", note: "",
    });
    expect(input).not.toHaveProperty("versione"); // un campetto nuovo non ha una versione: la decide il server
  });

  it("«Usa la mia posizione» (usePosizione) scrive le coordinate dell'utente nei campi e disegna il pin provvisorio", async () => {
    const getCurrentPosition = geolocalizzazione("concessa");
    formNuovo();
    expect(getCurrentPosition).not.toHaveBeenCalled(); // mai all'apertura (D7)
    fireEvent.click(screen.getByRole("button", { name: "Usa la mia posizione" }));
    await waitFor(() => expect(campo("Latitudine").value).toBe(String(UTENTE.lat)));
    expect(campo("Longitudine").value).toBe(String(UTENTE.lng));
    expect(screen.getByText("Posizione scelta")).toBeTruthy();
  });

  it("posizione negata: il messaggio lo dice e rimanda agli altri due modi; i campi restano vuoti", () => {
    geolocalizzazione("negata");
    formNuovo();
    fireEvent.click(screen.getByRole("button", { name: "Usa la mia posizione" }));
    expect(screen.getByRole("status").textContent).toMatch(/Posizione negata/);
    expect(screen.getByRole("status").textContent).toMatch(/mappa/);
    expect(campo("Latitudine").value).toBe("");
  });

  it("un clic sulla mappa scrive le coordinate del punto (coordinateDa, sei decimali) e mette il pin provvisorio lì", () => {
    formNuovo();
    expect(screen.queryByText("Posizione scelta")).toBeNull();
    const atteso = clicSullaMappa(160, 80);
    expect(Number(campo("Latitudine").value)).toBeCloseTo(atteso.lat, 5);
    expect(Number(campo("Longitudine").value)).toBeCloseTo(atteso.lng, 5);
    const pin = screen.getByText("Posizione scelta").closest("[style]") as HTMLElement;
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    const p = proietta(Number(campo("Latitudine").value), Number(campo("Longitudine").value), centro, zoom, LATO);
    expect(pin.style.left).toBe(`${(p.x / LATO) * 100}%`);
    expect(pin.style.top).toBe(`${(p.y / LATO) * 100}%`);
    expect(pin.closest("button")).toBeNull(); // non è un pin cliccabile
  });

  it("un clic su un pin di un campetto esistente non cambia la posizione", () => {
    formNuovo();
    scrivi("Latitudine", "45.07");
    fireEvent.click(screen.getByRole("button", { name: ruffini.nome }));
    expect(campo("Latitudine").value).toBe("45.07");
  });
});

describe("CampettoForm: l'esito del salvataggio", () => {
  it("se il server rifiuta, il motivo compare e i dati restano (come GiocatoreForm)", async () => {
    const onSave = vi.fn(async (_input: CampettoInput) => { throw new ApiError(400, "Il campo «nome» è troppo lungo"); });
    formNuovo(onSave);
    scrivi("Nome *", "Campo nuovo");
    scrivi("Città", "Torino");
    scrivi("Latitudine", "45.07");
    scrivi("Longitudine", "7.68");
    salva();
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Salvataggio non riuscito: Il campo «nome» è troppo lungo");
    expect(campo("Nome *").value).toBe("Campo nuovo");
    expect(campo("Città").value).toBe("Torino");
    expect(campo("Latitudine").value).toBe("45.07");
  });

  it("durante l'invio «Salva il campetto» è fermo: un secondo clic non manda due volte", async () => {
    let fine: () => void = () => {};
    const onSave = vi.fn((_input: CampettoInput) => new Promise<void>((ok) => { fine = ok; }));
    formNuovo(onSave);
    scrivi("Nome *", "Campo nuovo");
    scrivi("Latitudine", "45.07");
    scrivi("Longitudine", "7.68");
    salva();
    await waitFor(() => expect((screen.getByRole("button", { name: "Salva il campetto" }) as HTMLButtonElement).disabled).toBe(true));
    salva();
    fine();
    await waitFor(() => expect((screen.getByRole("button", { name: "Salva il campetto" }) as HTMLButtonElement).disabled).toBe(false));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("«Annulla» chiama onAnnulla senza salvare", () => {
    const onAnnulla = vi.fn();
    const onSave = vi.fn(async (_input: CampettoInput) => {});
    render(<CampettoForm campetti={[]} onSave={onSave} onAnnulla={onAnnulla} />);
    fireEvent.click(screen.getByRole("button", { name: "Annulla" }));
    expect(onAnnulla).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("CampettoForm in modifica: precompilato dal campetto, manda la versione", () => {
  it("i campi partono dai valori del campetto; il salvataggio manda i soli campi compilabili più la versione", async () => {
    const onSave = vi.fn(async (_input: CampettoInput) => {});
    render(<CampettoForm campetto={{ ...ruffini, versione: 3 }} campetti={CAMPETTI_DEMO} onSave={onSave} onAnnulla={() => {}} />);
    expect(campo("Nome *").value).toBe(ruffini.nome);
    expect(campo("Indirizzo").value).toBe(ruffini.indirizzo);
    expect(campo("Latitudine").value).toBe(String(ruffini.lat));
    expect(campo("Longitudine").value).toBe(String(ruffini.lng));
    expect(campo("Canestri").value).toBe("2");
    expect(campo("Illuminato").checked).toBe(true);
    expect(campo("Coperto").checked).toBe(false);
    expect((screen.getByLabelText("Stato del campo") as HTMLSelectElement).value).toBe("buono");
    expect(screen.getByText("Posizione scelta")).toBeTruthy(); // il pin provvisorio sta dove è il campetto
    scrivi("Nome *", "Parco Ruffini — Campo 3");
    fireEvent.click(campo("Coperto"));
    fireEvent.change(screen.getByLabelText("Stato del campo"), { target: { value: "discreto" } });
    salva();
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    const input = onSave.mock.calls[0][0];
    expect(input).toMatchObject({ nome: "Parco Ruffini — Campo 3", coperto: true, stato: "discreto", lat: ruffini.lat, lng: ruffini.lng, versione: 3 });
    for (const campoDelServer of ["id", "tipo", "autore", "autoreId", "ts"]) expect(input).not.toHaveProperty(campoDelServer);
  });

  it("il campetto in modifica non compare tra i pin della mappa (al suo posto c'è il pin provvisorio)", () => {
    render(<CampettoForm campetto={ruffini} campetti={CAMPETTI_DEMO} onSave={async () => {}} onAnnulla={() => {}} />);
    expect(screen.queryByRole("button", { name: ruffini.nome })).toBeNull();
    expect(screen.getByRole("button", { name: CAMPETTI_DEMO[1].nome })).toBeTruthy();
  });
});

/* ── La pagina: chi può fare che cosa (D3) ── */

// Chi guarda la pagina: Anna (autrice di un campetto), un altro registrato, un ADMIN, l'ospite
const anna: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const altro: User = { id: "u2", name: "Luca", email: "luca@example.it", ruolo: "USER", guest: false };
const admin: User = { id: "u9", name: "Responsabile", email: "admin@example.it", ruolo: "ADMIN", guest: false };
const ospite: User = { name: "Ospite", guest: true };

/** Tre campetti: uno di Anna, uno di Luca e uno il cui autore non esiste più (autoreId null, come li vede anche l'ospite) */
const diAnna: Campetto = { ...CAMPETTI_DEMO[0], autore: "Anna", autoreId: "u1" };
const diLuca: Campetto = { ...CAMPETTI_DEMO[1], autore: "Luca", autoreId: "u2" };
const orfano: Campetto = { ...CAMPETTI_DEMO[2], autore: "", autoreId: null };
const TRE = [diAnna, diLuca, orfano];

const card = (c: Campetto) => screen.getByRole("article", { name: c.nome });
const comando = (verbo: "Modifica" | "Elimina", c: Campetto) => within(card(c)).queryByRole("button", { name: `${verbo} ${c.nome}` });
const aggiungi = () => screen.getByRole("button", { name: /Aggiungi un campetto/ }) as HTMLButtonElement;

/** Apre la pagina per `user` e aspetta le card */
async function apriPagina(user: User) {
  useAppStore.setState({ user, tappe: [] });
  render(<CampettiPage />);
  await screen.findByRole("article", { name: diAnna.nome });
}

describe("CampettiPage: «Aggiungi», «Modifica» ed «Elimina» secondo chi guarda (D3)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    api.list.mockResolvedValue(TRE);
    useCampettiStore.setState({ campetti: null, ricerca: null, errore: null, inCorso: false, epoca: 0, svuotata: 0 });
  });

  afterEach(() => {
    useAppStore.getState().reset();
  });

  it("l'autrice vede «Modifica» ed «Elimina» solo sul suo campetto; «Aggiungi un campetto» è attivo", async () => {
    await apriPagina(anna);
    expect(aggiungi().disabled).toBe(false);
    expect(comando("Modifica", diAnna)).not.toBeNull();
    expect(comando("Elimina", diAnna)).not.toBeNull();
    for (const c of [diLuca, orfano]) {
      expect(comando("Modifica", c), c.nome).toBeNull();
      expect(comando("Elimina", c), c.nome).toBeNull();
    }
  });

  it("l'ADMIN li vede su tutti, anche sul campetto il cui autore non esiste più", async () => {
    await apriPagina(admin);
    for (const c of TRE) {
      expect(comando("Modifica", c), c.nome).not.toBeNull();
      expect(comando("Elimina", c), c.nome).not.toBeNull();
    }
  });

  it("l'ospite non li vede, e «Aggiungi un campetto» è disattivato con il titolo che dice perché", async () => {
    await apriPagina(ospite);
    for (const c of TRE) {
      expect(comando("Modifica", c), c.nome).toBeNull();
      expect(comando("Elimina", c), c.nome).toBeNull();
    }
    expect(aggiungi().disabled).toBe(true);
    expect(aggiungi().title).toMatch(/account/i);
    expect(aggiungi().title).not.toBe("In arrivo");
  });

  it("«Aggiungi un campetto» apre la finestra con il form; il salvataggio crea sul server, chiude la finestra e la card compare", async () => {
    await apriPagina(anna);
    fireEvent.click(aggiungi());
    const finestra = screen.getByRole("dialog", { name: "Nuovo campetto" });
    fireEvent.change(within(finestra).getByLabelText("Nome *"), { target: { value: "Campo nuovo" } });
    fireEvent.change(within(finestra).getByLabelText("Latitudine"), { target: { value: "45.07" } });
    fireEvent.change(within(finestra).getByLabelText("Longitudine"), { target: { value: "7.68" } });
    api.create.mockResolvedValue({ ...diAnna, id: "nuovo", nome: "Campo nuovo", lat: 45.07, lng: 7.68, versione: 0 });
    fireEvent.click(within(finestra).getByRole("button", { name: "Salva il campetto" }));
    await screen.findByRole("article", { name: "Campo nuovo" });
    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ nome: "Campo nuovo", lat: 45.07, lng: 7.68 }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getAllByRole("article")).toHaveLength(4);
  });

  it("se il server rifiuta la creazione la finestra resta, con il motivo e i dati", async () => {
    await apriPagina(anna);
    fireEvent.click(aggiungi());
    const finestra = screen.getByRole("dialog", { name: "Nuovo campetto" });
    fireEvent.change(within(finestra).getByLabelText("Nome *"), { target: { value: "Campo nuovo" } });
    fireEvent.change(within(finestra).getByLabelText("Latitudine"), { target: { value: "45.07" } });
    fireEvent.change(within(finestra).getByLabelText("Longitudine"), { target: { value: "7.68" } });
    api.create.mockRejectedValue(new ApiError(503, "Servizio non disponibile"));
    fireEvent.click(within(finestra).getByRole("button", { name: "Salva il campetto" }));
    expect((await within(finestra).findByRole("alert")).textContent).toBe("Salvataggio non riuscito: Servizio non disponibile");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect((within(finestra).getByLabelText("Nome *") as HTMLInputElement).value).toBe("Campo nuovo");
  });

  it("«Modifica» apre lo stesso form precompilato; il salvataggio manda la versione e la card si aggiorna", async () => {
    await apriPagina(anna);
    fireEvent.click(comando("Modifica", diAnna)!);
    const finestra = screen.getByRole("dialog", { name: `Modifica campetto ${diAnna.nome}` });
    expect((within(finestra).getByLabelText("Nome *") as HTMLInputElement).value).toBe(diAnna.nome);
    fireEvent.change(within(finestra).getByLabelText("Nome *"), { target: { value: "Ruffini rinnovato" } });
    api.update.mockResolvedValue({ ...diAnna, nome: "Ruffini rinnovato", versione: 1 });
    fireEvent.click(within(finestra).getByRole("button", { name: "Salva il campetto" }));
    await screen.findByRole("article", { name: "Ruffini rinnovato" });
    expect(api.update).toHaveBeenCalledWith(diAnna.id, expect.objectContaining({ nome: "Ruffini rinnovato", versione: diAnna.versione }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("article", { name: diAnna.nome })).toBeNull();
  });

  it("409 in modifica: la finestra si chiude, l'elenco si ricarica dal server e l'avviso dice «modificato da un altro dispositivo»", async () => {
    await apriPagina(anna);
    fireEvent.click(comando("Modifica", diAnna)!);
    const finestra = screen.getByRole("dialog");
    fireEvent.change(within(finestra).getByLabelText("Nome *"), { target: { value: "Il mio nome" } });
    api.update.mockRejectedValue(new ApiError(409, "I dati sono stati modificati o eliminati da un'altra richiesta: ricarica"));
    api.list.mockResolvedValue([{ ...diAnna, nome: "Nome dell'altro", versione: 1 }, diLuca, orfano]);
    fireEvent.click(within(finestra).getByRole("button", { name: "Salva il campetto" }));
    await screen.findByRole("article", { name: "Nome dell'altro" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const avviso = screen.getByRole("alert");
    expect(avviso.textContent).toContain("«Il mio nome» è stato modificato da un altro dispositivo");
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it("«Elimina» chiede conferma dicendo che cosa si perde; «Conferma» elimina sul server e la card sparisce, «Annulla» non fa niente", async () => {
    await apriPagina(anna);
    fireEvent.click(comando("Elimina", diAnna)!);
    let conferma = screen.getByRole("alertdialog", { name: "Eliminare il campetto?" });
    expect(conferma.textContent).toContain(`Verrà eliminato il campetto «${diAnna.nome}»`);
    fireEvent.click(within(conferma).getByRole("button", { name: "Annulla" }));
    expect(api.remove).not.toHaveBeenCalled();
    expect(card(diAnna)).toBeTruthy();

    api.remove.mockResolvedValue(undefined);
    fireEvent.click(comando("Elimina", diAnna)!);
    conferma = screen.getByRole("alertdialog", { name: "Eliminare il campetto?" });
    fireEvent.click(within(conferma).getByRole("button", { name: "Conferma" }));
    await waitFor(() => expect(screen.queryByRole("article", { name: diAnna.nome })).toBeNull());
    expect(api.remove).toHaveBeenCalledWith(diAnna.id);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("se il server rifiuta l'eliminazione il motivo compare nella pagina e la card resta", async () => {
    await apriPagina(admin);
    api.remove.mockRejectedValue(new ApiError(403, "Non puoi eliminare questo campetto"));
    fireEvent.click(comando("Elimina", diLuca)!);
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Conferma" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Eliminazione non riuscita: Non puoi eliminare questo campetto");
    expect(card(diLuca)).toBeTruthy();
  });

  it("la cache svuotata sotto la pagina aperta (accesso o uscita in un'altra scheda) si riscarica da sola", async () => {
    await apriPagina(anna);
    expect(api.list).toHaveBeenCalledTimes(1);
    useCampettiStore.getState().svuota();
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    await screen.findByRole("article", { name: diAnna.nome });
  });
});
