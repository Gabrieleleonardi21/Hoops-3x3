import { describe, it, expect, beforeEach } from "vitest";
import { ApiError, token } from "../../src/services/api";
import { legheApi } from "../../src/services/legheApi";
import { azzeraRete, chiamata, fetchFinto, jwtFinto, rispondi, rispondiConErrore, rispondiSenzaCorpo } from "./reteFinta";
import { tappaDiProva } from "./tappeDiProva";

/** Le richieste vere che il client manda al backend: URL, metodo e corpo di ogni funzione. La rete è finta, `api` è quella vera */
const tappa = tappaDiProva("t1", { Alfa: ["Anna"], Beta: ["Dora"] }, [{ a: "Alfa", b: "Beta" }]);

beforeEach(() => {
  azzeraRete();
  token.set(jwtFinto());
});

describe("legheApi: le leghe", () => {
  it("list: GET /api/leghe senza corpo, con il Bearer; restituisce l'elenco del server", async () => {
    const elenco = [{ id: "l1", nome: "Estate", ts: 1, nTappe: 2 }];
    rispondi(elenco);
    await expect(legheApi.list()).resolves.toEqual(elenco);
    const c = chiamata();
    expect(c).toMatchObject({ url: "/api/leghe", metodo: "GET", corpo: undefined });
    expect(c.intestazioni.Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("create: POST /api/leghe con il solo nome (niente tappe se non è un import)", async () => {
    await legheApi.create("Estate");
    expect(chiamata()).toMatchObject({ url: "/api/leghe", metodo: "POST", corpo: { nome: "Estate" } });
  });

  it("create da file: POST /api/leghe con nome e tappe importate", async () => {
    await legheApi.create("Importata", [tappa]);
    expect(chiamata()).toMatchObject({ url: "/api/leghe", metodo: "POST", corpo: { nome: "Importata", tappe: [tappa] } });
  });

  it("get: GET /api/leghe/{id}; restituisce la lega con le sue tappe", async () => {
    const lega = { id: "l1", nome: "Estate", tappe: [tappa] };
    rispondi(lega);
    await expect(legheApi.get("l1")).resolves.toEqual(lega);
    expect(chiamata()).toMatchObject({ url: "/api/leghe/l1", metodo: "GET", corpo: undefined });
  });

  it("rename: PATCH /api/leghe/{id} con il nuovo nome", async () => {
    await legheApi.rename("l1", "Autunno");
    expect(chiamata()).toMatchObject({ url: "/api/leghe/l1", metodo: "PATCH", corpo: { nome: "Autunno" } });
  });

  it("remove: DELETE /api/leghe/{id} senza corpo; il 204 senza corpo non è un errore", async () => {
    rispondiSenzaCorpo();
    await expect(legheApi.remove("l1")).resolves.toBeUndefined();
    expect(chiamata()).toMatchObject({ url: "/api/leghe/l1", metodo: "DELETE", corpo: undefined });
  });
});

describe("legheApi: le tappe", () => {
  it("addTappa: POST /api/leghe/{legaId}/tappe con la tappa intera", async () => {
    await legheApi.addTappa("l1", tappa);
    expect(chiamata()).toMatchObject({ url: "/api/leghe/l1/tappe", metodo: "POST", corpo: tappa });
  });

  it("putTappa: PUT /api/tappe/{id della tappa} con la tappa intera (sostituzione completa)", async () => {
    await legheApi.putTappa(tappa);
    expect(chiamata()).toMatchObject({ url: "/api/tappe/t1", metodo: "PUT", corpo: tappa });
  });

  it("putTappa rimanda al server la versione su cui si basa (il server risponde 409 se nel frattempo è cambiata)", async () => {
    await legheApi.putTappa({ ...tappa, versione: 3 });
    expect(chiamata().corpo).toMatchObject({ id: "t1", versione: 3 });
  });

  it("removeTappa: DELETE /api/tappe/{id} senza corpo", async () => {
    rispondiSenzaCorpo();
    await expect(legheApi.removeTappa("t1")).resolves.toBeUndefined();
    expect(chiamata()).toMatchObject({ url: "/api/tappe/t1", metodo: "DELETE", corpo: undefined });
  });

  it("senza keepalive le richieste hanno il tempo massimo normale; in chiusura pagina (keepalive) non ne hanno", async () => {
    await legheApi.addTappa("l1", tappa);
    await legheApi.putTappa(tappa);
    await legheApi.removeTappa("t1");
    await legheApi.addTappa("l1", tappa, true);
    await legheApi.putTappa(tappa, true);
    await legheApi.removeTappa("t1", true);
    const [senza, con] = [[0, 1, 2], [3, 4, 5]].map((indici) => indici.map((n) => chiamata(n)));
    senza.forEach((c) => {
      expect(c.keepalive).toBe(false);
      expect(c.init.signal).toBeDefined();
    });
    con.forEach((c) => {
      expect(c.keepalive).toBe(true);
      expect(c.init.signal).toBeUndefined();
    });
  });
});

describe("legheApi: errori del server", () => {
  it("lo status e il messaggio del server arrivano a chi chiama (un 409 di versione, un 404)", async () => {
    rispondiConErrore(409, "La tappa è stata modificata da un altro dispositivo");
    const conflitto = await legheApi.putTappa(tappa).catch((e: unknown) => e);
    expect(conflitto).toBeInstanceOf(ApiError);
    expect(conflitto).toMatchObject({ status: 409, message: "La tappa è stata modificata da un altro dispositivo" });
    rispondiConErrore(404, "Lega non trovata");
    await expect(legheApi.get("l9")).rejects.toMatchObject({ status: 404, message: "Lega non trovata" });
    expect(fetchFinto).toHaveBeenCalledTimes(2);
  });
});
