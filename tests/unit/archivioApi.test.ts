import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError, token } from "../../src/services/api";
import { archivioApi } from "../../src/services/archivioApi";

/** localStorage e fetch non esistono nell'ambiente node: si sostituiscono con versioni in memoria */
const memoria = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => { memoria.set(k, v); },
  removeItem: (k: string) => { memoria.delete(k); },
});
const fetchFinto = vi.fn();
vi.stubGlobal("fetch", fetchFinto);

/** JWT finto che scade tra un'ora (firma non verificata dal client) */
const jwt = () => `intestazione.${btoa(JSON.stringify({ sub: "u1", exp: Math.floor(Date.now() / 1000) + 3600 }))}.firma`;
const risposta = { tappa: { id: "t1" }, lega: "Circuito", autore: "Anna", autoreId: "u1", ts: 1 };

beforeEach(() => {
  memoria.clear();
  fetchFinto.mockReset();
  fetchFinto.mockImplementation(async () => new Response(JSON.stringify(risposta), { status: 200 }));
});

describe("archivioApi.pubblica: il server costruisce la copia dalla tappa che ha salvato", () => {
  it("PUT /api/archivio/{tappaId} senza corpo e senza Content-Type, con il Bearer", async () => {
    token.set(jwt());
    await archivioApi.pubblica("ba1fd653-0eb0-4275-8f0f-115d350ba2e3");
    expect(fetchFinto).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFinto.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/archivio/ba1fd653-0eb0-4275-8f0f-115d350ba2e3");
    expect(init.method).toBe("PUT");
    expect(init.body).toBeUndefined();
    const intestazioni = init.headers as Record<string, string>;
    expect(intestazioni["Content-Type"]).toBeUndefined();
    expect(intestazioni.Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("restituisce la pubblicazione che il server risponde", async () => {
    token.set(jwt());
    await expect(archivioApi.pubblica("t1")).resolves.toEqual(risposta);
  });
});

/** Le intestazioni della n-esima chiamata a fetch */
const intestazioni = (n: number) => (fetchFinto.mock.calls[n][1] as RequestInit).headers as Record<string, string>;

describe("archivioApi.get: una tappa pubblicata", () => {
  it("GET /api/archivio/{tappaId} senza corpo; restituisce la pubblicazione com'è", async () => {
    await expect(archivioApi.get("t1")).resolves.toEqual(risposta);
    const [url, init] = fetchFinto.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/archivio/t1");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("la lettura è pubblica: senza account parte senza Bearer, con un account lo porta", async () => {
    await archivioApi.get("t1");
    expect(intestazioni(0).Authorization).toBeUndefined();
    token.set(jwt());
    await archivioApi.get("t1");
    expect(intestazioni(1).Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("il 404 (la tappa non è in archivio) arriva a chi chiama come ApiError con lo status: useStatoArchivio lo legge così", async () => {
    fetchFinto.mockImplementation(async () => new Response(JSON.stringify({ message: "Tappa non pubblicata" }), { status: 404 }));
    const esito = await archivioApi.get("t1").catch((e: unknown) => e);
    expect(esito).toBeInstanceOf(ApiError);
    expect(esito).toMatchObject({ status: 404, message: "Tappa non pubblicata" });
  });
});

describe("archivioApi.rimuovi: ritira la pubblicazione", () => {
  it("DELETE /api/archivio/{tappaId} senza corpo, con il Bearer; il 204 senza corpo non è un errore", async () => {
    token.set(jwt());
    fetchFinto.mockImplementation(async () => new Response(null, { status: 204 }));
    await expect(archivioApi.rimuovi("t1")).resolves.toBeUndefined();
    const [url, init] = fetchFinto.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/archivio/t1");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(intestazioni(0).Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("un rifiuto del server (non sei l'autore) arriva a chi chiama con lo status e il messaggio", async () => {
    token.set(jwt());
    fetchFinto.mockImplementation(async () => new Response(JSON.stringify({ message: "Solo l'autore può ritirarla" }), { status: 403 }));
    await expect(archivioApi.rimuovi("t1")).rejects.toMatchObject({ status: 403, message: "Solo l'autore può ritirarla" });
  });
});

/** Una voce dell'elenco com'è nella risposta di GET /api/archivio dal backend della T2.2 (otto campi, senza la tappa intera) */
const voce = (tappaId: string, ts: number) => ({
  tappaId, nome: `Tappa ${tappaId}`, luogo: "Roma", data: "2025-09-13", nSquadre: 8, lega: "Circuito", autore: "Admin", ts,
});
/** Una voce con la forma di prima della T2.2: la tappa intera dentro, senza gli otto campi sintetici */
const voceVecchia = { tappa: { id: "t1", nome: "Finale", squadre: [] }, lega: "Circuito", autore: "Anna", autoreId: "u1", ts: 1 };
/** Fa rispondere il server finto 200 con questo corpo */
const rispondi = (corpo: unknown) => fetchFinto.mockImplementation(async () => new Response(JSON.stringify(corpo), { status: 200 }));

describe("archivioApi.list: l'elenco sintetico", () => {
  it("GET /api/archivio senza corpo", async () => {
    rispondi([]);
    await archivioApi.list();
    const [url, init] = fetchFinto.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/archivio");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("restituisce le voci com'è il server, nello stesso ordine: il server le ordina, il client non le riordina", async () => {
    // Timestamp né crescenti né decrescenti: un riordino per data (in un senso o nell'altro) cambierebbe l'ordine
    const voci = [voce("a", 5), voce("b", 9), voce("c", 1)];
    rispondi(voci);
    const elenco = await archivioApi.list();
    expect(elenco).toEqual(voci);
    expect(elenco.map((v) => v.tappaId)).toEqual(["a", "b", "c"]);
  });

  it("un archivio vuoto è un elenco vuoto, non un errore", async () => {
    rispondi([]);
    await expect(archivioApi.list()).resolves.toEqual([]);
  });

  it("voce con una stringa vuota per luogo e data (la tappa non li ha) e nessuna squadra: è valida", async () => {
    const senzaDati = { ...voce("a", 1), luogo: "", data: "", nSquadre: 0 };
    rispondi([senzaDati]);
    await expect(archivioApi.list()).resolves.toEqual([senzaDati]);
  });

  // GUARDIA (passa già): fissa una regola che il codice ha da quando c'è lo schema, perché non si perda con una modifica futura
  it("un campo in più nella voce (aggiunto domani dal server) non rompe l'elenco, ma non arriva a chi chiama", async () => {
    rispondi([{ ...voce("a", 1), campoNuovo: "x", annidato: { dentro: true } }]);
    const [letta] = await archivioApi.list();
    expect(letta).toStrictEqual(voce("a", 1));
    expect(Object.keys(letta).sort()).toEqual(["autore", "data", "lega", "luogo", "nSquadre", "nome", "tappaId", "ts"]);
  });

  describe("una risposta che non ha la forma sintetica è un errore, mai un elenco da disegnare", () => {
    const casi: [string, unknown][] = [
      ["la forma di prima (tappa intera, senza tappaId, nome e nSquadre)", [voceVecchia]],
      ["una voce vecchia in mezzo a quelle nuove: l'elenco intero è respinto, niente righe a metà", [voce("a", 1), voceVecchia]],
      ["una voce senza tappaId", [{ ...voce("a", 1), tappaId: undefined }]],
      ["una voce con tappaId vuoto", [{ ...voce("a", 1), tappaId: "" }]],
      ["una voce senza nome", [{ ...voce("a", 1), nome: undefined }]],
      ["nSquadre scritto come stringa", [{ ...voce("a", 1), nSquadre: "8" }]],
      ["nSquadre negativo", [{ ...voce("a", 1), nSquadre: -1 }]],
      ["nSquadre non intero", [{ ...voce("a", 1), nSquadre: 2.5 }]],
      ["ts mancante", [{ ...voce("a", 1), ts: undefined }]],
      ["luogo null", [{ ...voce("a", 1), luogo: null }]],
      ["una voce che non è un oggetto", [null]],
      ["un oggetto al posto dell'array", { elenco: [voce("a", 1)] }],
      ["null al posto dell'array", null],
    ];

    it.each(casi)("%s", async (_nome, corpo) => {
      rispondi(corpo);
      const esito = await archivioApi.list().then(() => null, (e: unknown) => e);
      expect(esito).toBeInstanceOf(ApiError);
      // Il motivo arriva fino alla pagina, dove compare sotto «Non è stato possibile caricare l'archivio». È neutro: vale per
      // qualunque causa (un server da aggiornare o un suo difetto), senza parlare di forme né di aggiornamenti
      expect((esito as ApiError).message).toBe("Risposta del server non valida. Riprova più tardi.");
    });
  });
});
