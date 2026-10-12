import { describe, it, expect, beforeEach } from "vitest";
import { luoghiApi } from "../../src/services/luoghiApi";
import { azzeraRete, chiamata, rispondi, rispondiConErrore } from "./reteFinta";

/* Il geocoding dei luoghi (`GET /api/luoghi?q=`): quando la ricerca dei campetti non trova niente, la pagina chiede dove si trova il
 * luogo cercato, e sposta la mappa lì. La rete è finta; `api` e la lettura con zod sono quelli veri. */

beforeEach(() => {
  azzeraRete();
});

describe("luoghiApi.cerca: il luogo cercato, con il testo codificato nella query string", () => {
  it("manda GET /api/luoghi?q= con il testo codificato e legge nome, lat e lng", async () => {
    rispondi({ nome: "Firenze", lat: 43.7696, lng: 11.2558 });
    const luogo = await luoghiApi.cerca("Firenze");
    expect(chiamata()).toMatchObject({ url: "/api/luoghi?q=Firenze", metodo: "GET" });
    expect(luogo).toEqual({ nome: "Firenze", lat: 43.7696, lng: 11.2558 });
  });

  it("il testo con spazi e caratteri speciali è codificato (la query non si spezza)", async () => {
    rispondi({ nome: "Reggio Calabria", lat: 38.1, lng: 15.6 });
    await luoghiApi.cerca("Reggio  Calabria & co");
    expect(chiamata().url).toBe("/api/luoghi?q=Reggio+Calabria+%26+co");
  });

  it("il 404 del server (luogo non trovato) arriva come ApiError con il suo messaggio", async () => {
    rispondiConErrore(404, "Luogo non trovato");
    await expect(luoghiApi.cerca("xyzzy")).rejects.toMatchObject({ status: 404, message: "Luogo non trovato" });
  });

  it("il 502 (Nominatim non risponde) arriva come ApiError con status 502", async () => {
    rispondiConErrore(502, "Servizio dei luoghi non raggiungibile");
    await expect(luoghiApi.cerca("Firenze")).rejects.toMatchObject({ status: 502 });
  });

  it("una risposta fuori forma (senza lat o lng numerici) è un errore, non un luogo con coordinate sbagliate", async () => {
    rispondi({ nome: "Firenze", lat: "43,7", lng: 11.2558 });
    const esito = await luoghiApi.cerca("Firenze").catch((e: unknown) => e);
    expect(esito).toBeInstanceOf(Error);
    expect((esito as Error).message).toBe("Risposta del server non valida. Riprova più tardi.");
  });
});
