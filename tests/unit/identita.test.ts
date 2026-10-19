import { describe, it, expect } from "vitest";
import {
  normalizza, identitaSquadra, nomeCompleto, stessoNomeGiocatore, perId, risolviGiocatore, squadraDelGiocatore,
} from "../../src/utils/identita";
import { normalizza as normalizzaDaStat } from "../../src/utils/statGiocatori";
import type { RegGiocatore, RegSquadra } from "../../src/types";

/* ── Fixture: un giocatore e una squadra dell'anagrafe, con i soli campi che contano ── */

const giocatore = (id: string, nome: string, cognome: string, squadra = ""): RegGiocatore => ({
  id, nome, cognome, soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "", ruolo: "", numero: "",
  squadra, esperienza: "", note: "", autore: "", autoreId: null, ts: 1,
});

const squadraReg = (id: string, nome: string, roster: string[], logo = ""): RegSquadra => ({
  id, nome, citta: "", anno: "", rank: "", referente: "", roster, logo, website: "", instagram: "", note: "",
  autore: "", autoreId: null, ts: 1,
});

describe("normalizza", () => {
  it("toglie gli spazi ai lati, riduce quelli interni e ignora maiuscole e accenti", () => {
    expect(normalizza("  Nicolò   Rossi ")).toBe("nicolo rossi");
  });

  it("l'apostrofo tipografico è uguale a quello semplice", () => {
    expect(normalizza("D’Angelo")).toBe(normalizza("D'Angelo"));
  });

  it("«De Rossi» e «DeRossi» restano diversi", () => {
    expect(normalizza("De Rossi")).not.toBe(normalizza("DeRossi"));
  });

  it("statGiocatori la ri-esporta: è la stessa funzione, così i chiamanti di oggi non cambiano", () => {
    expect(normalizzaDaStat).toBe(normalizza);
  });
});

describe("identitaSquadra", () => {
  it("con regId conta la voce dell'anagrafe, anche se il nome è diverso", () => {
    expect(identitaSquadra({ regId: "r1", nome: "Roma" })).toBe("reg:r1");
    expect(identitaSquadra({ regId: "r1", nome: "Roma Kings" })).toBe("reg:r1");
  });

  it("senza regId conta il nome normalizzato (maiuscole e spazi ai lati a parte)", () => {
    expect(identitaSquadra({ nome: " Roma " })).toBe("nome:roma");
    expect(identitaSquadra({ regId: undefined, nome: "Nicolò" })).toBe("nome:nicolo");
  });
});

describe("nomeCompleto e stessoNomeGiocatore", () => {
  it("il nome completo è «nome cognome», senza spazi in più se manca il cognome", () => {
    expect(nomeCompleto(giocatore("g1", "Mario", "Rossi"))).toBe("Mario Rossi");
    expect(nomeCompleto(giocatore("g1", "Mario", ""))).toBe("Mario");
  });

  it("riconosce il nome nei due ordini, con maiuscole e spazi diversi", () => {
    const g = giocatore("g1", "Mario", "Rossi");
    expect(stessoNomeGiocatore("Mario Rossi", g)).toBe(true);
    expect(stessoNomeGiocatore("rossi mario", g)).toBe(true);
    expect(stessoNomeGiocatore("mario  rossi", g)).toBe(true);
  });

  it("un cognome diverso non è lo stesso giocatore", () => {
    expect(stessoNomeGiocatore("Mario Rossini", giocatore("g1", "Mario", "Rossi"))).toBe(false);
  });
});

describe("perId", () => {
  it("indicizza gli elementi per id", () => {
    const a = { id: "a", valore: 1 };
    expect(perId([a, { id: "b", valore: 2 }]).get("a")).toBe(a);
  });
});

describe("risolviGiocatore", () => {
  const mario = giocatore("g1", "Mario", "Rossi");
  const luca = giocatore("g2", "Luca", "Bianchi");
  const giocatoriPerId = perId([mario, luca]);

  it("senza squadra collegata non risolve niente", () => {
    expect(risolviGiocatore("Mario Rossi", undefined, giocatoriPerId)).toBeNull();
  });

  it("il solo giocatore del roster con quel nome è lui, in qualunque ordine", () => {
    const sq = squadraReg("sq1", "Roma", ["g1", "g2"]);
    expect(risolviGiocatore("Mario Rossi", sq, giocatoriPerId)).toBe(mario);
    expect(risolviGiocatore("Rossi Mario", sq, giocatoriPerId)).toBe(mario);
  });

  it("un nome che non c'è nel roster non si risolve", () => {
    expect(risolviGiocatore("Paolo Verdi", squadraReg("sq1", "Roma", ["g1", "g2"]), giocatoriPerId)).toBeNull();
  });

  it("due omonimi nel roster non si risolvono: nessuno dei due è quello giusto", () => {
    const omonimo = giocatore("g3", "Mario", "Rossi");
    const mappa = perId([mario, omonimo]);
    expect(risolviGiocatore("Mario Rossi", squadraReg("sq1", "Roma", ["g1", "g3"]), mappa)).toBeNull();
  });

  it("un id del roster che non è nella mappa viene ignorato, non fa ambiguità", () => {
    const sq = squadraReg("sq1", "Roma", ["gcancellato", "g1"]);
    expect(risolviGiocatore("Mario Rossi", sq, giocatoriPerId)).toBe(mario);
  });
});

describe("squadraDelGiocatore", () => {
  const roma1 = squadraReg("sq1", "Roma", ["g1"], "/logo-1.svg");
  const roma2 = squadraReg("sq2", "Roma", ["g2"], "/logo-2.svg");

  it("la squadra è quella il cui roster contiene il giocatore, anche tra due omonime", () => {
    expect(squadraDelGiocatore(giocatore("g2", "Mario", "Rossi", "Roma"), [roma1, roma2])).toBe(roma2);
  });

  it("senza roster, se il nome della squadra del giocatore è unico, è quella", () => {
    const solo = squadraReg("sq3", "Torino", []);
    expect(squadraDelGiocatore(giocatore("g9", "Mario", "Rossi", " torino "), [solo])).toBe(solo);
  });

  it("due squadre omonime senza il giocatore nel roster: non si sa quale, quindi undefined", () => {
    expect(squadraDelGiocatore(giocatore("g9", "Mario", "Rossi", "Roma"), [roma1, roma2])).toBeUndefined();
  });

  it("un giocatore senza squadra scritta non ha squadra", () => {
    expect(squadraDelGiocatore(giocatore("g9", "Mario", "Rossi", ""), [roma1])).toBeUndefined();
  });
});
