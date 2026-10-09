// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { CampettiPage } from "../../src/pages/CampettiPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { useCampettiStore } from "../../src/stores/useCampettiStore";
import { campettiApi } from "../../src/services/campettiApi";
import { ApiError } from "../../src/services/api";
import { distanzaKm, fmtDistanza } from "../../src/utils/geo";
import type { Campetto } from "../../src/types/campetto";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

// Si sostituisce solo la rete: store e pagina sono quelli veri
vi.mock("../../src/services/campettiApi", async (importOriginal) => {
  const reale = await importOriginal<typeof import("../../src/services/campettiApi")>();
  return { ...reale, campettiApi: { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() } };
});
const api = vi.mocked(campettiApi);

/** Il centro di Roma con cui la pagina si apre (contratto) e il centro di Torino, dove sta l'utente dei test */
const ROMA = { lat: 41.9028, lng: 12.4964, raggioKm: 20 };
const UTENTE = { lat: 45.0703, lng: 7.6869 };
const [ruffini, giardini, dora, piazzaArmi, vanchiglia, colletta] = CAMPETTI_DEMO;

/** Il browser finto: concede la posizione dell'utente, oppure la nega (PERMISSION_DENIED = 1) */
function geolocalizzazione(esito: "concessa" | "negata") {
  const getCurrentPosition = vi.fn((ok: PositionCallback, ko: PositionErrorCallback) => {
    if (esito === "concessa") ok({ coords: { latitude: UTENTE.lat, longitude: UTENTE.lng } } as GeolocationPosition);
    else ko({ code: 1 } as GeolocationPositionError);
  });
  Object.defineProperty(navigator, "geolocation", { value: { getCurrentPosition }, configurable: true });
  return getCurrentPosition;
}

/** La card di un campetto (un article con il nome) e i nomi delle card nell'ordine in cui compaiono */
const card = (c: Campetto) => screen.getByRole("article", { name: c.nome });
const ordineCard = () => screen.getAllByRole("article").map((a) => a.getAttribute("aria-label"));

/** Apre la pagina e aspetta la prima card */
async function apri() {
  render(<CampettiPage />);
  await screen.findByRole("article", { name: ruffini.nome });
}

/** Una promessa che si risolve quando lo decide il test: il server finto che risponde in ritardo */
function differita<T>() {
  let risolvi: (valore: T) => void = () => {};
  const promessa = new Promise<T>((ok) => { risolvi = ok; });
  return { promessa, risolvi };
}

/** L'immagine della Maps Static API, se è nella pagina */
const immagineDiGoogle = () => document.querySelector("img[src*='maps.googleapis.com']");

beforeEach(() => {
  vi.resetAllMocks();
  // Senza chiave: la chiave vera, se è nella shell di chi lancia i test, non deve finire nell'URL dell'immagine (né nei log)
  vi.stubEnv("MAPS_API_KEY", "");
  api.list.mockResolvedValue(CAMPETTI_DEMO);
  useCampettiStore.setState({ campetti: null, ricerca: null, errore: null, inCorso: false, epoca: 0, svuotata: 0 });
  // La pagina sta dentro RequireAuth: c'è sempre un utente. Anna, registrata (i permessi sono in campettiGestione.test)
  useAppStore.setState({ user: { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false }, tappe: [] });
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  vi.unstubAllEnvs();
  useAppStore.getState().reset();
  Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
});

describe("CampettiPage: all'apertura i campetti intorno a Roma, dall'API", () => {
  it("chiede al server i campetti intorno a Roma (raggio 20 km), li mostra e dice quanti sono e dove", async () => {
    render(<CampettiPage />);
    expect(screen.getByText(/Sto cercando i campetti/).getAttribute("role")).toBe("status");
    await screen.findByRole("article", { name: ruffini.nome });
    expect(api.list).toHaveBeenCalledWith(ROMA);
    expect(screen.getAllByRole("article")).toHaveLength(6);
    expect(screen.getByText(/6 campetti · intorno a Roma/)).toBeTruthy();
  });

  it("non chiede la posizione al browser all'apertura (D7) e non c'è più l'avviso «Dati di esempio»", async () => {
    const getCurrentPosition = geolocalizzazione("concessa");
    await apri();
    expect(getCurrentPosition).not.toHaveBeenCalled();
    expect(screen.queryByRole("note")).toBeNull();
    expect(screen.queryByText(/Dati di esempio/)).toBeNull();
  });

  it("nessun campetto nella zona: lo dice, senza errore", async () => {
    api.list.mockResolvedValue([]);
    render(<CampettiPage />);
    expect(await screen.findByText("Nessun campetto trovato.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("server in errore: il motivo con «Riprova», che richiama il server e mostra l'elenco", async () => {
    api.list.mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    render(<CampettiPage />);
    const avviso = await screen.findByRole("alert");
    expect(avviso.textContent).toContain("Non è stato possibile caricare i campetti.");
    expect(avviso.textContent).toContain("Servizio non disponibile");
    expect(screen.queryByText("Nessun campetto trovato.")).toBeNull();
    fireEvent.click(within(avviso).getByRole("button", { name: "Riprova" }));
    await screen.findByRole("article", { name: ruffini.nome });
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("«Aggiungi un campetto» è attivo per chi ha un account e non dice più «In arrivo» (T5.5)", async () => {
    await apri();
    const aggiungi = screen.getByRole("button", { name: /Aggiungi un campetto/ });
    expect(aggiungi).toHaveProperty("disabled", false);
    expect(aggiungi.getAttribute("title")).toBeNull();
  });

  it("con la chiave, l'immagine di Google (a pagamento) non si monta finché l'elenco non è arrivato, né se la ricerca fallisce", async () => {
    vi.stubEnv("MAPS_API_KEY", "chiave-finta");
    const lenta = differita<Campetto[]>();
    api.list.mockReturnValueOnce(lenta.promessa);
    render(<CampettiPage />);
    expect(screen.getByText(/Sto cercando i campetti/)).toBeTruthy();
    expect(immagineDiGoogle()).toBeNull();
    lenta.risolvi(CAMPETTI_DEMO);
    await screen.findByRole("article", { name: ruffini.nome });
    expect(immagineDiGoogle()).not.toBeNull();
    cleanup();
    api.list.mockRejectedValueOnce(new ApiError(503, "Servizio non disponibile"));
    useCampettiStore.setState({ campetti: null, ricerca: null, errore: null, inCorso: false, epoca: 0, svuotata: 0 });
    render(<CampettiPage />);
    await screen.findByRole("alert");
    expect(immagineDiGoogle()).toBeNull();
  });

  it("in fondo l'attribuzione dei dati: Pick-Roll con il link all'app e OpenStreetMap per le coordinate di esempio (D5)", async () => {
    await apri();
    const fonte = screen.getByText(/Campetti: dati di/);
    expect(within(fonte).getByRole("link", { name: "Pick-Roll" }).getAttribute("href")).toBe("https://pick-roll.com");
    expect(fonte.textContent).toContain("© OpenStreetMap contributors");
  });
});

describe("CampettoCard: i dati di un campetto, solo come testo", () => {
  it("nome, indirizzo e città, le caratteristiche scritte (non solo icone o colori) e lo stato del campo", async () => {
    await apri();
    const c = card(ruffini);
    expect(c.textContent).toContain("Corso Trapani 32, Torino");
    for (const testo of ["Asfalto", "2 canestri", "Illuminato", "Gratuito", "Retine", "Linee", "Fontanella", "Stato: buono"]) {
      expect(within(c).getByText(testo)).toBeTruthy();
    }
    expect(within(c).queryByText("Coperto")).toBeNull();
    // Colletta: senza retine né linee, da sistemare; Vanchiglia: a pagamento; Dora: coperto
    expect(within(card(colletta)).queryByText("Retine")).toBeNull();
    expect(within(card(colletta)).queryByText("Linee")).toBeNull();
    expect(within(card(colletta)).getByText("Stato: da sistemare")).toBeTruthy();
    expect(within(card(vanchiglia)).getByText("A pagamento")).toBeTruthy();
    expect(within(card(dora)).getByText("Coperto")).toBeTruthy();
  });

  it("«Indicazioni» e «Apri in Google Maps» puntano a Google Maps con lat e lng, senza chiave, in una nuova scheda", async () => {
    await apri();
    const c = card(ruffini);
    const indicazioni = within(c).getByRole("link", { name: "Indicazioni" });
    const apriMappa = within(c).getByRole("link", { name: "Apri in Google Maps" });
    expect(indicazioni.getAttribute("href")).toBe(`https://www.google.com/maps/dir/?api=1&destination=${ruffini.lat},${ruffini.lng}`);
    expect(apriMappa.getAttribute("href")).toBe(`https://www.google.com/maps/search/?api=1&query=${ruffini.lat},${ruffini.lng}`);
    for (const link of [indicazioni, apriMappa]) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
      expect(link.getAttribute("href")).not.toContain("key=");
    }
  });

  it("un nome o una nota che somigliano a HTML restano testo: nessun elemento entra nella pagina (XSS)", async () => {
    const cattivo: Campetto = { ...ruffini, nome: "<img src=x onerror=alert(1)>", note: "<script>alert(1)</script>" };
    api.list.mockResolvedValue([cattivo]);
    render(<CampettiPage />);
    const c = await screen.findByRole("article", { name: cattivo.nome });
    expect(within(c).getByText(cattivo.note)).toBeTruthy();
    expect(document.querySelector("img[src='x']")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });

  it("senza la posizione la card non ha la distanza e l'ordine è per città e nome", async () => {
    await apri();
    expect(screen.queryByText(/\d (km|m)$/)).toBeNull();
    expect(ordineCard()).toEqual([vanchiglia.nome, giardini.nome, colletta.nome, dora.nome, ruffini.nome, piazzaArmi.nome]);
  });

  it("un clic sulla card la seleziona (aria-pressed) e il pin sulla mappa la segue", async () => {
    await apri();
    fireEvent.click(within(card(dora)).getByRole("button"));
    expect(within(card(dora)).getByRole("button").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: dora.nome }).getAttribute("aria-pressed")).toBe("true"); // il pin
    expect(within(card(ruffini)).getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });
});

describe("CampettiPage: la posizione dell'utente (D7, D9)", () => {
  it("«Usa la mia posizione» concessa: i campetti intorno all'utente (stesso raggio), con le distanze, in ordine di distanza", async () => {
    geolocalizzazione("concessa");
    await apri();
    fireEvent.click(screen.getByRole("button", { name: "Usa la mia posizione" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ ...UTENTE, raggioKm: 20 }));
    await screen.findByText(/6 campetti · intorno a te/);
    expect(screen.getByRole("status").textContent).toContain("Posizione trovata");
    const perDistanza = [...CAMPETTI_DEMO].sort((a, b) => distanzaKm(UTENTE, a) - distanzaKm(UTENTE, b));
    expect(ordineCard()).toEqual(perDistanza.map((c) => c.nome));
    for (const c of CAMPETTI_DEMO) expect(within(card(c)).getByText(fmtDistanza(distanzaKm(UTENTE, c)))).toBeTruthy();
    expect(screen.getByText("La tua posizione")).toBeTruthy(); // il pin dell'utente sulla mappa
  });

  it("mentre arriva l'elenco intorno all'utente, etichetta, distanze e ordine restano quelli dell'elenco di Roma ancora mostrato", async () => {
    geolocalizzazione("concessa");
    await apri();
    const lenta = differita<Campetto[]>();
    api.list.mockReturnValueOnce(lenta.promessa);
    fireEvent.click(screen.getByRole("button", { name: "Usa la mia posizione" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ ...UTENTE, raggioKm: 20 }));
    expect(screen.getByRole("status").textContent).toContain("Posizione trovata");
    // L'elenco è ancora quello di Roma: l'etichetta non dice «intorno a te», niente distanze, ordine per città e nome
    expect(screen.getByText(/6 campetti · intorno a Roma/)).toBeTruthy();
    expect(screen.queryByText(/\d (km|m)$/)).toBeNull();
    expect(ordineCard()[0]).toBe(vanchiglia.nome);
    lenta.risolvi(CAMPETTI_DEMO);
    await screen.findByText(/6 campetti · intorno a te/);
    expect(ordineCard()[0]).toBe(giardini.nome);
    expect(within(card(giardini)).getByText(fmtDistanza(distanzaKm(UTENTE, giardini)))).toBeTruthy();
  });

  it("posizione negata: il messaggio lo dice, niente distanze, ordine per città e nome, e il server non riceve nessuna posizione", async () => {
    geolocalizzazione("negata");
    await apri();
    fireEvent.click(screen.getByRole("button", { name: "Usa la mia posizione" }));
    expect(screen.getByRole("status").textContent).toContain("Posizione negata");
    expect(screen.queryByText(/\d (km|m)$/)).toBeNull();
    expect(ordineCard()[0]).toBe(vanchiglia.nome);
    expect(api.list).toHaveBeenCalledTimes(1);
    expect(api.list).toHaveBeenCalledWith(ROMA);
  });
});

describe("CampettiPage: la casella di ricerca interroga il server su tutta l'Italia, con attesa", () => {
  const casella = () => screen.getByLabelText("Cerca città o campo");

  it("il testo parte dopo 300 ms dall'ultimo tasto, una volta sola, come `q`; la casella vuota torna alla ricerca per raggio", async () => {
    await apri();
    api.list.mockResolvedValue([dora]);
    for (const parziale of ["D", "Do", "Dor", "Dora"]) fireEvent.change(casella(), { target: { value: parziale } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ q: "Dora" }));
    expect(api.list).toHaveBeenCalledTimes(2); // Roma all'apertura, poi solo «Dora»: niente D, Do, Dor
    await screen.findByText(/1 campetto · in tutta Italia/);
    expect(screen.getAllByRole("article")).toHaveLength(1);
    api.list.mockResolvedValue(CAMPETTI_DEMO);
    fireEvent.change(casella(), { target: { value: "  " } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(ROMA));
    await screen.findByText(/6 campetti · intorno a Roma/);
  });

  it("con la posizione concessa il testo porta anche lat e lng: il server ordina per distanza", async () => {
    geolocalizzazione("concessa");
    await apri();
    fireEvent.click(screen.getByRole("button", { name: "Usa la mia posizione" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ ...UTENTE, raggioKm: 20 }));
    fireEvent.change(casella(), { target: { value: "Parco" } });
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ q: "Parco", lat: UTENTE.lat, lng: UTENTE.lng }));
  });

  it("nessun risultato per il testo: lo dice", async () => {
    await apri();
    api.list.mockResolvedValue([]);
    fireEvent.change(casella(), { target: { value: "Zzz" } });
    expect(await screen.findByText("Nessun campetto trovato.")).toBeTruthy();
  });
});

describe("CampettiPage: i filtri si applicano ai risultati, nel browser", () => {
  /** Il nome esatto (la regex ancorata): «Retine» non deve prendere il pulsante della card, che nel nome ha anche indirizzo e città */
  const filtro = (nome: string) => screen.getByRole("button", { name: new RegExp(`^${nome}$`) });

  it("Retine e Fontanella tolgono i campetti che non le hanno; il filtro acceso ha aria-pressed", async () => {
    await apri();
    fireEvent.click(filtro("Retine"));
    expect(filtro("Retine").getAttribute("aria-pressed")).toBe("true");
    expect(ordineCard()).not.toContain(piazzaArmi.nome);
    expect(ordineCard()).not.toContain(colletta.nome);
    fireEvent.click(filtro("Fontanella"));
    expect(ordineCard()).toEqual([dora.nome, ruffini.nome]);
    expect(api.list).toHaveBeenCalledTimes(1); // il server non si richiama: i filtri lavorano sui risultati
    fireEvent.click(filtro("Retine"));
    expect(ordineCard()).toEqual([colletta.nome, dora.nome, ruffini.nome, piazzaArmi.nome]);
  });

  it("i filtri di prima restano: Illuminato, Coperto, 4 canestri, Gratuito", async () => {
    await apri();
    fireEvent.click(filtro("Coperto"));
    expect(ordineCard()).toEqual([dora.nome]);
    fireEvent.click(filtro("Coperto"));
    fireEvent.click(filtro("Illuminato"));
    expect(ordineCard()).not.toContain(piazzaArmi.nome);
    fireEvent.click(filtro("4 canestri"));
    expect(ordineCard()).toEqual([dora.nome]);
    fireEvent.click(filtro("4 canestri"));
    fireEvent.click(filtro("Gratuito"));
    expect(ordineCard()).not.toContain(vanchiglia.nome);
  });

  it("lo stato del campo si sceglie da una tendina", async () => {
    await apri();
    fireEvent.change(screen.getByLabelText("Stato del campo"), { target: { value: "discreto" } });
    expect(ordineCard()).toEqual([vanchiglia.nome, piazzaArmi.nome]);
    fireEvent.change(screen.getByLabelText("Stato del campo"), { target: { value: "" } });
    expect(ordineCard()).toHaveLength(6);
  });

  it("filtri che non lasciano niente: «Nessun campetto con questi filtri.», e il conteggio segue i filtri", async () => {
    await apri();
    fireEvent.click(filtro("Coperto"));
    fireEvent.change(screen.getByLabelText("Stato del campo"), { target: { value: "da sistemare" } });
    expect(screen.getByText("Nessun campetto con questi filtri.")).toBeTruthy();
    expect(screen.getByText(/0 campetti · intorno a Roma/)).toBeTruthy();
  });
});
