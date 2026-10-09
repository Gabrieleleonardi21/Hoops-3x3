import { describe, it, expect, beforeEach } from "vitest";
import { ApiError, token } from "../../src/services/api";
import { campettiApi } from "../../src/services/campettiApi";
import type { Campetto, CampettoInput } from "../../src/types/campetto";
import { azzeraRete, chiamata, fetchFinto, jwtFinto, rispondi, rispondiConErrore, rispondiSenzaCorpo } from "./reteFinta";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

/** Le richieste vere che il client manda al backend: URL, metodo e corpo di ogni funzione. La rete è finta, `api` è quella vera */
const [ruffini, giardini] = CAMPETTI_DEMO;
/** Centro di Roma e raggio con cui la pagina si apre (contratto della fase 5) */
const ROMA = { lat: 41.9028, lng: 12.4964, raggioKm: 20 };
/** I campi compilabili di un campetto: quello che POST e PUT mandano. Senza `versione`: la creazione non ce l'ha */
const input: CampettoInput = {
  nome: ruffini.nome, indirizzo: ruffini.indirizzo, citta: ruffini.citta, lat: ruffini.lat, lng: ruffini.lng,
  superficie: ruffini.superficie, canestri: ruffini.canestri, illuminato: true, coperto: false, gratuito: true, retine: true,
  linee: true, fontanella: true, stato: "buono", note: "",
};
const NON_VALIDA = "Risposta del server non valida. Riprova più tardi.";

beforeEach(() => {
  azzeraRete();
});

describe("campettiApi.list: la lettura pubblica, con i parametri nella query string", () => {
  const casi: [string, Parameters<typeof campettiApi.list>[0], string][] = [
    ["intorno a un punto, entro un raggio", ROMA, "/api/campetti?lat=41.9028&lng=12.4964&raggioKm=20"],
    ["per testo su tutta la base", { q: "Torino" }, "/api/campetti?q=Torino"],
    ["per testo, ordinati per distanza da un punto", { q: "Torino", lat: 45.0703, lng: 7.6869 }, "/api/campetti?q=Torino&lat=45.0703&lng=7.6869"],
    ["per testo con una coordinata sola: la posizione non si manda a metà", { q: "Torino", lat: 45.0703 }, "/api/campetti?q=Torino"],
    ["il testo è codificato: spazi e caratteri speciali non rompono l'URL", { q: "Parco Dora & co" }, "/api/campetti?q=Parco+Dora+%26+co"],
    ["gli spazi ai lati del testo non partono", { q: "  Dora " }, "/api/campetti?q=Dora"],
  ];

  it.each(casi)("%s", async (_nome, parametri, url) => {
    rispondi([]);
    await campettiApi.list(parametri);
    expect(chiamata()).toMatchObject({ url, metodo: "GET", corpo: undefined });
  });

  it("un testo vuoto o di soli spazi non parte: il server risponderebbe 400, e la pagina con la casella vuota cerca per raggio", async () => {
    for (const q of ["", "   "]) {
      await expect(campettiApi.list({ q, lat: 45.0703, lng: 7.6869 })).rejects.toThrow("testo di ricerca vuoto");
    }
    expect(fetchFinto).not.toHaveBeenCalled();
  });

  it("senza account parte senza Bearer, con un account lo porta", async () => {
    rispondi([]);
    await campettiApi.list(ROMA);
    expect(chiamata(0).intestazioni.Authorization).toBeUndefined();
    token.set(jwtFinto());
    await campettiApi.list(ROMA);
    expect(chiamata(1).intestazioni.Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("restituisce i campetti com'è il server, nello stesso ordine: li ordina lui (per distanza o per città e nome)", async () => {
    rispondi([giardini, ruffini]);
    const elenco = await campettiApi.list(ROMA);
    expect(elenco).toEqual([giardini, ruffini]);
  });

  it("nessun campetto nel raggio è un elenco vuoto, non un errore", async () => {
    rispondi([]);
    await expect(campettiApi.list(ROMA)).resolves.toEqual([]);
  });

  it("un campetto il cui autore non esiste più (autoreId null, autore vuoto) è valido: resta visibile", async () => {
    const orfano: Campetto = { ...ruffini, autore: "", autoreId: null };
    rispondi([orfano]);
    await expect(campettiApi.list(ROMA)).resolves.toEqual([orfano]);
  });

  it("un campo in più (aggiunto domani dal server) non rompe l'elenco, ma non arriva a chi chiama", async () => {
    rispondi([{ ...ruffini, fonte: "pick-roll", annidato: { dentro: true } }]);
    const [letto] = await campettiApi.list(ROMA);
    expect(letto).toStrictEqual(ruffini);
  });

  describe("una risposta che non ha la forma del contratto è un errore, mai un elenco da disegnare", () => {
    const casi: [string, unknown][] = [
      ["un oggetto al posto dell'array", { campetti: [ruffini] }],
      ["null al posto dell'array", null],
      ["un campetto che non è un oggetto", [null]],
      ["un campetto senza id", [{ ...ruffini, id: undefined }]],
      ["un campetto con il nome vuoto", [{ ...ruffini, nome: "" }]],
      ["lat scritta come stringa", [{ ...ruffini, lat: "45.05" }]],
      ["lat fuori intervallo", [{ ...ruffini, lat: 91 }]],
      ["lng fuori intervallo", [{ ...ruffini, lng: -181 }]],
      ["un tipo sconosciuto", [{ ...ruffini, tipo: "spiaggia" }]],
      ["una superficie sconosciuta", [{ ...ruffini, superficie: "Erba" }]],
      ["uno stato sconosciuto", [{ ...ruffini, stato: "ottimo" }]],
      ["canestri non intero", [{ ...ruffini, canestri: 2.5 }]],
      ["illuminato non booleano", [{ ...ruffini, illuminato: "sì" }]],
      ["note null (il server manda sempre una stringa)", [{ ...ruffini, note: null }]],
      ["autoreId mancante", [{ ...ruffini, autoreId: undefined }]],
      ["versione mancante", [{ ...ruffini, versione: undefined }]],
      ["ts mancante", [{ ...ruffini, ts: undefined }]],
      ["un campetto fuori forma in mezzo a quelli buoni: l'elenco intero è respinto", [ruffini, { ...giardini, stato: 3 }]],
    ];

    it.each(casi)("%s", async (_nome, corpo) => {
      rispondi(corpo);
      const esito = await campettiApi.list(ROMA).then(() => null, (e: unknown) => e);
      expect(esito).toBeInstanceOf(ApiError);
      expect((esito as ApiError).message).toBe(NON_VALIDA);
    });
  });

  it("un 400 del server (parametri non validi) arriva come ApiError con lo status e il messaggio", async () => {
    rispondiConErrore(400, "raggioKm deve essere tra 0 e 500");
    await expect(campettiApi.list({ ...ROMA, raggioKm: 900 })).rejects.toMatchObject({ status: 400, message: "raggioKm deve essere tra 0 e 500" });
  });
});

describe("campettiApi.create: POST /api/campetti con i campi compilabili", () => {
  it("manda il corpo com'è, senza versione quando manca, con il Bearer, e restituisce il campetto creato dal server", async () => {
    token.set(jwtFinto());
    rispondi(ruffini);
    await expect(campettiApi.create(input)).resolves.toEqual(ruffini);
    const c = chiamata();
    expect(c).toMatchObject({ url: "/api/campetti", metodo: "POST", corpo: input });
    expect(Object.keys(c.corpo as object)).not.toContain("versione");
    expect(c.intestazioni.Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("senza account il server risponde 401: arriva come ApiError con lo status", async () => {
    rispondiConErrore(401, "Accesso richiesto");
    const esito = await campettiApi.create(input).catch((e: unknown) => e);
    expect(esito).toBeInstanceOf(ApiError);
    expect(esito).toMatchObject({ status: 401, message: "Accesso richiesto" });
  });

  it("una risposta che non è un campetto è un errore", async () => {
    token.set(jwtFinto());
    rispondi({ ...ruffini, lat: "no" });
    await expect(campettiApi.create(input)).rejects.toMatchObject({ message: NON_VALIDA });
  });
});

describe("campettiApi.update: PUT /api/campetti/{id} con la versione su cui si basano le modifiche", () => {
  it("manda il corpo con la versione quando c'è, e restituisce il campetto aggiornato", async () => {
    token.set(jwtFinto());
    const aggiornato = { ...ruffini, nome: "Parco Ruffini — Campo 3", versione: 1 };
    rispondi(aggiornato);
    await expect(campettiApi.update(ruffini.id, { ...input, nome: "Parco Ruffini — Campo 3", versione: 0 })).resolves.toEqual(aggiornato);
    expect(chiamata()).toMatchObject({ url: `/api/campetti/${ruffini.id}`, metodo: "PUT", corpo: { ...input, nome: "Parco Ruffini — Campo 3", versione: 0 } });
  });

  it("403 (non sei l'autore né ADMIN) e 404 (il campetto non c'è più) arrivano come ApiError con lo status", async () => {
    token.set(jwtFinto());
    rispondiConErrore(403, "Solo l'autore può modificare");
    await expect(campettiApi.update(ruffini.id, input)).rejects.toMatchObject({ status: 403, message: "Solo l'autore può modificare" });
    rispondiConErrore(404, "Campetto non trovato");
    await expect(campettiApi.update(ruffini.id, input)).rejects.toMatchObject({ status: 404, message: "Campetto non trovato" });
  });

  it("409 (un altro dispositivo ha salvato nel frattempo) arriva con lo status e il messaggio del server, come nell'anagrafe", async () => {
    token.set(jwtFinto());
    const messaggio = "I dati sono stati modificati o eliminati da un'altra richiesta: ricarica";
    rispondiConErrore(409, messaggio);
    const esito = await campettiApi.update(ruffini.id, { ...input, versione: 0 }).catch((e: unknown) => e);
    expect(esito).toBeInstanceOf(ApiError);
    expect(esito).toMatchObject({ status: 409, message: messaggio });
  });

  it("una risposta che non è un campetto è un errore", async () => {
    token.set(jwtFinto());
    rispondi([ruffini]);
    await expect(campettiApi.update(ruffini.id, input)).rejects.toMatchObject({ message: NON_VALIDA });
  });
});

describe("campettiApi.remove: DELETE /api/campetti/{id}", () => {
  it("senza corpo, con il Bearer; il 204 senza corpo non è un errore", async () => {
    token.set(jwtFinto());
    rispondiSenzaCorpo();
    await expect(campettiApi.remove(ruffini.id)).resolves.toBeUndefined();
    const c = chiamata();
    expect(c).toMatchObject({ url: `/api/campetti/${ruffini.id}`, metodo: "DELETE", corpo: undefined });
    expect(c.intestazioni.Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("404 (già eliminato) arriva come ApiError con lo status", async () => {
    token.set(jwtFinto());
    rispondiConErrore(404, "Campetto non trovato");
    await expect(campettiApi.remove(ruffini.id)).rejects.toMatchObject({ status: 404, message: "Campetto non trovato" });
  });
});
