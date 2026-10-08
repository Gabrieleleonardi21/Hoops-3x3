import { describe, it, expect, beforeEach } from "vitest";
import { ApiError, token } from "../../src/services/api";
import {
  anagrafeApi, toGiocatoreInput, toSquadraInput, type GiocatoreInput, type SquadraInput,
} from "../../src/services/anagrafeApi";
import { azzeraRete, chiamata, jwtFinto, rispondi, rispondiConErrore, rispondiSenzaCorpo } from "./reteFinta";
import type { RegGiocatore, RegSquadra } from "../../src/types";

/** Le richieste vere che il client manda al backend: URL, metodo e corpo di ogni funzione. La rete è finta, `api` è quella vera */
const giocatoreInput: GiocatoreInput = {
  nome: "Anna", cognome: "Rossi", soprannome: "Ani", nascita: "2000-05-01", citta: "Roma", nazionalita: "IT", altezza: "175",
  peso: "65", ruolo: "Guardia", numero: "7", squadra: "Alfa", esperienza: "5", note: "",
};
const squadraInput: SquadraInput = {
  nome: "Alfa", citta: "Roma", anno: "2020", rank: "40", referente: "Anna", roster: ["g1", "g2"], logo: "/logos/alfa.svg",
  website: "https://alfa.example.it", instagram: "", note: "",
};
/** I record come li restituisce il server: i campi compilabili più quelli che assegna lui */
const giocatore: RegGiocatore = { ...giocatoreInput, id: "g1", autore: "Anna", autoreId: "u1", ts: 5 };
const squadra: RegSquadra = { ...squadraInput, id: "s1", autore: "Anna", autoreId: "u1", ts: 9 };

beforeEach(() => {
  azzeraRete();
});

describe("anagrafeApi: URL, metodo e corpo di ogni chiamata", () => {
  const casi: [string, () => Promise<unknown>, string, string, unknown][] = [
    ["listGiocatori", () => anagrafeApi.listGiocatori(), "GET", "/api/anagrafe/giocatori", undefined],
    ["createGiocatore", () => anagrafeApi.createGiocatore(giocatoreInput), "POST", "/api/anagrafe/giocatori", giocatoreInput],
    ["updateGiocatore", () => anagrafeApi.updateGiocatore("g1", giocatoreInput), "PUT", "/api/anagrafe/giocatori/g1", giocatoreInput],
    ["removeGiocatore", () => anagrafeApi.removeGiocatore("g1"), "DELETE", "/api/anagrafe/giocatori/g1", undefined],
    ["listSquadre", () => anagrafeApi.listSquadre(), "GET", "/api/anagrafe/squadre", undefined],
    ["createSquadra", () => anagrafeApi.createSquadra(squadraInput), "POST", "/api/anagrafe/squadre", squadraInput],
    ["updateSquadra", () => anagrafeApi.updateSquadra("s1", squadraInput), "PUT", "/api/anagrafe/squadre/s1", squadraInput],
    ["removeSquadra", () => anagrafeApi.removeSquadra("s1"), "DELETE", "/api/anagrafe/squadre/s1", undefined],
  ];

  it.each(casi)("%s", async (_nome, chiama, metodo, url, corpo) => {
    await chiama();
    expect(chiamata()).toMatchObject({ url, metodo, corpo });
  });

  it("le chiamate di lettura restituiscono ciò che risponde il server", async () => {
    rispondi([giocatore]);
    await expect(anagrafeApi.listGiocatori()).resolves.toEqual([giocatore]);
    rispondi([squadra]);
    await expect(anagrafeApi.listSquadre()).resolves.toEqual([squadra]);
  });

  it("create e update restituiscono il record com'è dopo il salvataggio sul server", async () => {
    rispondi(squadra);
    await expect(anagrafeApi.createSquadra(squadraInput)).resolves.toEqual(squadra);
    rispondi(giocatore);
    await expect(anagrafeApi.updateGiocatore("g1", giocatoreInput)).resolves.toEqual(giocatore);
  });

  it("la cancellazione, che il server chiude con 204 senza corpo, non è un errore", async () => {
    rispondiSenzaCorpo();
    await expect(anagrafeApi.removeSquadra("s1")).resolves.toBeUndefined();
    await expect(anagrafeApi.removeGiocatore("g1")).resolves.toBeUndefined();
  });
});

describe("anagrafeApi: chi è entrato e chi no", () => {
  it("la lettura è pubblica: senza account parte senza Bearer", async () => {
    await anagrafeApi.listSquadre();
    expect(chiamata().intestazioni.Authorization).toBeUndefined();
  });

  it("con un account il Bearer c'è (il server manda i dati personali solo a chi ha un token)", async () => {
    token.set(jwtFinto());
    await anagrafeApi.listSquadre();
    expect(chiamata().intestazioni.Authorization).toBe(`Bearer ${token.get()}`);
  });

  it("una scrittura rifiutata (non sei l'autore) arriva a chi chiama con lo status e il messaggio del server", async () => {
    token.set(jwtFinto());
    rispondiConErrore(403, "Solo l'autore può modificare");
    const rifiuto = await anagrafeApi.updateSquadra("s1", squadraInput).catch((e: unknown) => e);
    expect(rifiuto).toBeInstanceOf(ApiError);
    expect(rifiuto).toMatchObject({ status: 403, message: "Solo l'autore può modificare" });
  });
});

describe("anagrafeApi: da un record completo ai campi da rimandare in modifica", () => {
  it("toSquadraInput toglie id, autore, autoreId e ts e tiene tutto il resto", () => {
    expect(toSquadraInput(squadra)).toEqual(squadraInput);
  });

  it("toGiocatoreInput toglie id, autore, autoreId e ts e tiene tutto il resto", () => {
    expect(toGiocatoreInput(giocatore)).toEqual(giocatoreInput);
  });

  it("non cambia il record ricevuto", () => {
    const prima = { ...squadra };
    toSquadraInput(squadra);
    expect(squadra).toEqual(prima);
  });
});
