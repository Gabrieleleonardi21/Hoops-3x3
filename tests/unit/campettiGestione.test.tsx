// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CampettoForm } from "../../src/components/campetti/CampettoForm";
import { ApiError } from "../../src/services/api";
import { coordinateDa, inquadra, proietta } from "../../src/utils/geo";
import { MAX_CITTA_CAMPETTO, MAX_INDIRIZZO_CAMPETTO, MAX_NOME_CAMPETTO, MAX_NOTE_CAMPETTO } from "../../src/constants/rules";
import type { CampettoInput } from "../../src/types/campetto";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

/* T5.5: il form con cui si aggiunge o si corregge un campetto (D6), con i tre modi di dare la posizione (D4). La mappa dentro il form è
 * quella schematica (senza chiave): la chiave vera, se è nella shell, non deve entrare nei test. */

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
