import { describe, it, expect } from "vitest";
import { leggiFileLega, leggiLegaSalvata, testoFileLega } from "../../src/utils/legaFile";
import type { EsitoLettura } from "../../src/utils/legaFile";
import { DEFAULT_RULES } from "../../src/constants/rules";
import { isUuid, uid } from "../../src/utils/uid";
import type { Lega, SquadraTappa, Tappa } from "../../src/types";

/* ── Fixture ── */

/** Squadra con tutti i campi, anche quelli facoltativi */
const squadra = (id: string): SquadraTappa => ({
  id, nome: `Squadra ${id}`, rank: 120,
  giocatori: [{ id: `${id}-p1`, nome: "Mario" }, { id: `${id}-p2`, nome: "Luca" }],
  regId: `reg-${id}`, logo: "/logos/team.svg", website: "https://example.it", instagram: "https://instagram.com/team",
});

/** Tappa con tutti i campi, anche quelli facoltativi: serve a vedere che l'import non ne perde nessuno */
const tappaCompleta = (id: string, nome = "Tappa di Roma"): Tappa => ({
  id, nome, luogo: "Roma", data: "2026-06-14", nGironi: 2,
  regole: { target: 21, durata: 10, ot: 2, shot: 12 },
  squadre: ["a", "b", "c", "d"].map(squadra),
  gironi: [["a", "b"], ["c", "d"]],
  partite: [
    {
      id: "m1", g: 0, a: "a", b: "b", sa: 21, sb: 15, done: true,
      // la scheda di "a-p2" è nel formato vecchio: solo i punti, come numero
      pa: { "a-p1": { pt: 12, rb: 3, as: 2, ru: 1, st: 0, pe: 2, fa: 1 }, "a-p2": 9 },
      pb: { "b-p1": { pt: 15 } },
      eventi: [{ id: "e1", tipo: "Fallo", teamId: "a", pid: "a-p1", min: "7", nota: "antisportivo" }],
    },
    { id: "m2", g: 1, a: "c", b: "d", sa: 0, sb: 0, done: false },
  ],
  video: [{ id: "v1", titolo: "Finale", url: "https://youtu.be/abcdefghijk" }],
  conclusa: true,
  bracket: [
    { id: "b1", label: "Finale", squadraA: "a", squadraB: "c", pA: 21, pB: 18, done: true },
    { id: "b2", label: "Semifinale 2", squadraA: "c", squadraB: null, pA: 0, pB: 0, done: true, bye: true },
  ],
});

/** Tappa scritta a mano con il minimo indispensabile: il nome e due squadre (con id e nome) */
const tappaMinima = (nome = "Tappa minima") => ({
  nome, squadre: [{ id: "s1", nome: "Uno" }, { id: "s2", nome: "Due" }],
});

/* ── Aiuti ── */

const leggi = (dati: unknown, nomeFile = "lega.json") => leggiFileLega(JSON.stringify(dati), nomeFile);

/** La lega letta; se il file è stato rifiutato il test fallisce dicendo perché */
function lega(esito: EsitoLettura): Lega {
  if (!esito.ok) throw new Error(`file rifiutato: ${esito.errore}`);
  return esito.lega;
}

/** Il motivo del rifiuto; se il file è stato accettato il test fallisce */
function errore(esito: EsitoLettura): string {
  if (esito.ok) throw new Error("il file doveva essere rifiutato");
  return esito.errore;
}

/** Le tappe senza l'id, per confrontare tutto il resto */
const senzaId = (tappe: Tappa[]) => tappe.map((t) => ({ ...t, id: undefined }));

/* ── Test ── */

describe("leggiFileLega: file validi", () => {
  it("un file esportato dall'app si legge con nome e tappe uguali, campi facoltativi compresi", () => {
    const tappe = [tappaCompleta("a", "Prima tappa"), tappaCompleta("b", "Seconda tappa")];
    const letta = lega(leggi({ nome: "Roma Streetball", tappe }));
    expect(letta.nome).toBe("Roma Streetball");
    expect(senzaId(letta.tappe)).toEqual(senzaId(tappe));
  });

  it("una lega senza tappe è valida", () => {
    expect(lega(leggi({ nome: "Vuota", tappe: [] }))).toEqual({ nome: "Vuota", tappe: [] });
  });

  it("i campi mancanti prendono i valori predefiniti", () => {
    const letta = lega(leggi({ nome: "L", tappe: [tappaMinima()] }));
    expect(senzaId(letta.tappe)).toEqual([{
      id: undefined, nome: "Tappa minima", luogo: "", data: "", nGironi: 1, regole: DEFAULT_RULES,
      squadre: [
        { id: "s1", nome: "Uno", giocatori: [], rank: "" },
        { id: "s2", nome: "Due", giocatori: [], rank: "" },
      ],
      gironi: null, partite: [], video: [],
    }]);
  });

  it("delle regole incomplete mancano solo le voci assenti, e ogni tappa ha il suo oggetto", () => {
    const [a, b] = lega(leggi({ nome: "L", tappe: [{ ...tappaMinima(), regole: { target: 11, shot: 24 } }, tappaMinima("Altra")] })).tappe;
    expect(a.regole).toEqual({ target: 11, durata: 10, ot: 2, shot: 24 });
    // le regole predefinite non si condividono: modificarne una tappa le cambierebbe a tutte
    expect(b.regole).toEqual(DEFAULT_RULES);
    expect(b.regole).not.toBe(DEFAULT_RULES);
  });

  it("il vecchio formato dei punti (un numero al posto delle statistiche del giocatore) è accettato così com'è", () => {
    const [t] = lega(leggi({ nome: "L", tappe: [tappaCompleta("x")] })).tappe;
    expect(t.partite[0].pa).toEqual({ "a-p1": { pt: 12, rb: 3, as: 2, ru: 1, st: 0, pe: 2, fa: 1 }, "a-p2": 9 });
  });

  it("gironi e fase finale nulli, come li manda il server per una tappa non sorteggiata, sono accettati", () => {
    const dalServer = {
      ...tappaMinima(), id: uid(), luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES },
      gironi: null, partite: [], video: [], conclusa: false, bracket: null,
    };
    const [t] = lega(leggi({ nome: "L", tappe: [dalServer] })).tappe;
    expect(t.gironi).toBeNull();
    expect(t.bracket).toBeUndefined();
    expect(t.conclusa).toBe(false);
  });

  it("gli spazi ai lati di nome, luogo e data vengono tolti: il server conta i caratteri prima di toglierli", () => {
    const tappa = { ...tappaMinima("  Napoli Open  "), luogo: "  Piazza Plebiscito ", data: " 2026-06-14 " };
    const letta = lega(leggi({ nome: "  Roma  ", tappe: [tappa] }));
    expect(letta.nome).toBe("Roma");
    expect(letta.tappe[0]).toMatchObject({ nome: "Napoli Open", luogo: "Piazza Plebiscito", data: "2026-06-14" });
  });

  it("i campi che l'app non conosce non entrano nella lega, né nel browser né sul server", () => {
    const tappa = { ...tappaMinima(), segreto: "x", squadre: [{ id: "s1", nome: "Uno", altro: true }, { id: "s2", nome: "Due" }] };
    const letta = lega(leggi({ nome: "L", extra: 1, tappe: [tappa] }));
    expect(letta).not.toHaveProperty("extra");
    expect(letta.tappe[0]).not.toHaveProperty("segreto");
    expect(letta.tappe[0].squadre[0]).not.toHaveProperty("altro");
  });

  it("una chiave come __proto__ nelle schede non arriva ai dati e non inquina gli oggetti", () => {
    const testo = `{"nome":"L","tappe":[{"nome":"T","squadre":[{"id":"a","nome":"A"},{"id":"b","nome":"B"}],`
      + `"partite":[{"id":"m","g":0,"a":"a","b":"b","sa":1,"sb":0,"done":true,"pa":{"__proto__":{"pt":99},"p1":5}}]}]}`;
    const scheda = lega(leggiFileLega(testo, "x.json")).tappe[0].partite[0].pa!;
    expect(Object.keys(scheda)).toEqual(["p1"]);
    expect(Object.getPrototypeOf(scheda)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).pt).toBeUndefined();
  });
});

describe("leggiFileLega: nome della lega", () => {
  it.each([[undefined], [null], [""], ["   "]])("se nel file non c'è un nome (%j) si usa quello del file, senza .json", (nome) => {
    expect(lega(leggi({ nome, tappe: [] }, "Circuito Roma 2025.JSON")).nome).toBe("Circuito Roma 2025");
  });

  it("il nome preso dal file non supera i 120 caratteri", () => {
    expect(lega(leggi({ tappe: [] }, `${"N".repeat(130)}.json`)).nome).toHaveLength(120);
  });
});

describe("leggiFileLega: struttura sbagliata, rifiutata dicendo che cosa non va", () => {
  it("un testo che non è JSON", () => {
    expect(errore(leggiFileLega("{ non json", "x.json"))).toBe("il file non è un JSON valido");
  });

  it.each([["un elenco", "[]"], ["un numero", "42"], ["null", "null"], ["un testo", "\"ciao\""]])(
    "%s al posto dell'oggetto con nome e tappe",
    (_cosa, testo) => {
      expect(errore(leggiFileLega(testo, "x.json"))).toBe("il file deve contenere un oggetto con i campi «nome» e «tappe»");
    },
  );

  it("un file senza tappe dice che manca il campo «tappe»", () => {
    expect(errore(leggi({ nome: "Lega" }))).toBe("manca il campo «tappe»");
  });

  it("tappe che non è un elenco", () => {
    expect(errore(leggi({ nome: "Lega", tappe: { a: 1 } }))).toBe("tappe: deve essere un elenco");
  });

  it("una tappa senza squadre è rifiutata e il messaggio dice quale", () => {
    const rotta = { ...tappaCompleta(uid()), squadre: undefined };
    expect(errore(leggi({ nome: "L", tappe: [tappaCompleta(uid()), rotta] }))).toBe("tappe[1]: manca il campo «squadre»");
  });

  it("squadre che non è un elenco", () => {
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), squadre: null }] }))).toBe("tappe[0].squadre: deve essere un elenco");
  });

  it("una tappa senza nome, o con il nome vuoto, è rifiutata", () => {
    expect(errore(leggi({ nome: "L", tappe: [{ squadre: tappaMinima().squadre }] }))).toBe("tappe[0]: manca il campo «nome»");
    expect(errore(leggi({ nome: "L", tappe: [tappaMinima("   ")] }))).toBe("tappe[0].nome: non può essere vuoto");
  });

  it("un campo del tipo sbagliato dice dove sta e che tipo serve", () => {
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), nGironi: "due" }] }))).toBe("tappe[0].nGironi: deve essere un numero");
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), luogo: 5 }] }))).toBe("tappe[0].luogo: deve essere un testo");
  });

  it("un campo mancante dentro una squadra o una partita dice dove", () => {
    const squadre = [{ id: "s1", nome: "Uno" }, { nome: "Due" }];
    expect(errore(leggi({ nome: "L", tappe: [{ nome: "T", squadre }] }))).toBe("tappe[0].squadre[1]: manca il campo «id»");
    const partita = { id: "m", g: 0, b: "s2", sa: 0, sb: 0, done: false };
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), partite: [partita] }] }))).toBe("tappe[0].partite[0]: manca il campo «a»");
  });

  it("una scheda con un valore che non è né un numero né delle statistiche", () => {
    const partita = { id: "m", g: 0, a: "s1", b: "s2", sa: 1, sb: 0, done: true, pa: { p1: "dodici" } };
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), partite: [partita] }] }))).toBe("tappe[0].partite[0].pa.p1: formato non valido");
  });
});

describe("leggiFileLega: limiti del server, con un messaggio al posto del 400", () => {
  const tappe = (quante: number) => Array.from({ length: quante }, (_, i) => tappaMinima(`Tappa ${i + 1}`));

  it("al massimo 100 tappe: 100 si leggono, 101 no", () => {
    expect(lega(leggi({ nome: "L", tappe: tappe(100) })).tappe).toHaveLength(100);
    expect(errore(leggi({ nome: "L", tappe: tappe(101) }))).toBe("tappe: un file può avere al massimo 100 tappe");
  });

  it("il nome della tappa arriva a 120 caratteri", () => {
    expect(lega(leggi({ nome: "L", tappe: [tappaMinima("N".repeat(120))] })).tappe).toHaveLength(1);
    expect(errore(leggi({ nome: "L", tappe: [tappaMinima("N".repeat(121))] })))
      .toBe("tappe[0]: Il nome della tappa può avere al massimo 120 caratteri.");
  });

  it("il luogo arriva a 160 caratteri", () => {
    expect(lega(leggi({ nome: "L", tappe: [{ ...tappaMinima(), luogo: "L".repeat(160) }] })).tappe).toHaveLength(1);
    expect(errore(leggi({ nome: "L", tappe: [tappaMinima(), { ...tappaMinima(), luogo: "L".repeat(161) }] })))
      .toBe("tappe[1]: Il luogo può avere al massimo 160 caratteri.");
  });

  it("la data è vuota oppure aaaa-mm-gg", () => {
    expect(lega(leggi({ nome: "L", tappe: [{ ...tappaMinima(), data: "" }, { ...tappaMinima(), data: "2026-06-14" }] })).tappe).toHaveLength(2);
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), data: "14/06/2026" }] })))
      .toBe("tappe[0]: La data deve essere vuota oppure nel formato aaaa-mm-gg (per esempio 2026-06-14).");
  });

  it("il nome della lega arriva a 120 caratteri, contati senza gli spazi ai lati", () => {
    expect(lega(leggi({ nome: ` ${"N".repeat(120)} `, tappe: [] })).nome).toHaveLength(120);
    expect(errore(leggi({ nome: "N".repeat(121), tappe: [] }))).toBe("nome: il nome della lega può avere al massimo 120 caratteri");
  });

  it("le regole sono numeri interi da 1 in su (RegoleDTO)", () => {
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), regole: { target: 0 } }] })))
      .toBe("tappe[0].regole.target: deve essere un numero intero da 1 in su");
    expect(errore(leggi({ nome: "L", tappe: [{ ...tappaMinima(), regole: { shot: 12.5 } }] })))
      .toBe("tappe[0].regole.shot: deve essere un numero intero da 1 in su");
  });
});

describe("leggiFileLega: un ripristino non applica i limiti di creazione", () => {
  it("una tappa esportata con la vecchia logica, con più gironi di metà delle squadre, torna com'era", () => {
    // 4 squadre: oggi l'interfaccia ammette al massimo 2 gironi, ma le versioni precedenti lasciavano scrivere qualsiasi numero
    const vecchia = { ...tappaCompleta(uid(), "Tappa vecchia"), nGironi: 3 };
    const letta = lega(leggi({ nome: "L", tappe: [vecchia] }));
    expect(letta.tappe[0].nGironi).toBe(3);
    expect(senzaId(letta.tappe)).toEqual(senzaId([vecchia]));
  });

  it.each([
    ["una sola squadra", { squadre: [{ id: "s1", nome: "Uno" }] }],
    ["nessuna squadra", { squadre: [] }],
    ["più di 64 squadre", { squadre: Array.from({ length: 70 }, (_, i) => ({ id: `s${i}`, nome: `Squadra ${i}` })) }],
  ])("%s non blocca l'import: sono limiti di creazione, non del server", (_caso, cambia) => {
    const letta = lega(leggi({ nome: "L", tappe: [{ ...tappaMinima(), ...cambia }] }));
    expect(letta.tappe).toHaveLength(1);
    expect(letta.tappe[0]).toMatchObject(cambia);
  });

  it("restano i limiti dei campi del server: nome, luogo e data", () => {
    // Stessa tappa vecchia di sopra, con il nome troppo lungo
    const vecchia = { ...tappaCompleta(uid(), "N".repeat(121)), nGironi: 3 };
    expect(errore(leggi({ nome: "L", tappe: [vecchia] }))).toBe("tappe[0]: Il nome della tappa può avere al massimo 120 caratteri.");
  });
});

describe("leggiFileLega: il numero di gironi è un intero da 1 a 32, come in TappaDTO", () => {
  it.each([[2.5], [0], [33]])("%s è rifiutato e il messaggio dice quale tappa e che cosa non va", (nGironi) => {
    // Il numero sbagliato sta nella seconda tappa: il messaggio la nomina
    const tappe = [tappaMinima(), { ...tappaMinima("Seconda"), nGironi }];
    expect(errore(leggi({ nome: "L", tappe }))).toBe("tappe[1].nGironi: deve essere un numero intero da 1 a 32");
  });

  it("da 1 a 32 gironi sono accettati qualunque sia il numero di squadre: contano solo i limiti del server", () => {
    // 3 gironi con 4 squadre (più di metà delle squadre) e 32 con 2 squadre: la creazione li rifiuterebbe, il server no
    const tappe = [
      { ...tappaCompleta(uid(), "Tre gironi"), nGironi: 3 },
      { ...tappaMinima("Un girone"), nGironi: 1 },
      { ...tappaMinima("Trentadue gironi"), nGironi: 32 },
    ];
    expect(lega(leggi({ nome: "L", tappe })).tappe.map((t) => t.nGironi)).toEqual([3, 1, 32]);
  });
});

describe("leggiFileLega: id delle tappe", () => {
  it("export seguito da import della stessa lega: gli id delle tappe sono nuovi", () => {
    const originali = [tappaCompleta(uid(), "Prima"), tappaCompleta(uid(), "Seconda")];
    const importata = lega(leggiFileLega(testoFileLega("Roma", originali), "Roma.json"));
    const idNuovi = importata.tappe.map((t) => t.id);
    expect(idNuovi.every(isUuid)).toBe(true);
    expect(new Set(idNuovi).size).toBe(2);
    expect(idNuovi.filter((id) => originali.some((t) => t.id === id))).toEqual([]);
    // tutto il resto è com'era
    expect(senzaId(importata.tappe)).toEqual(senzaId(originali));
  });

  it("lo stesso file letto due volte dà ogni volta id diversi: si può ripristinare più di una volta", () => {
    const testo = testoFileLega("Roma", [tappaCompleta(uid())]);
    const prima = lega(leggiFileLega(testo, "Roma.json")).tappe[0].id;
    const seconda = lega(leggiFileLega(testo, "Roma.json")).tappe[0].id;
    expect(prima).not.toBe(seconda);
  });

  it("id ripetuti dentro lo stesso file non restano ripetuti", () => {
    const ripetuto = uid();
    const ids = lega(leggi({ nome: "L", tappe: [tappaCompleta(ripetuto, "A"), tappaCompleta(ripetuto, "B")] })).tappe.map((t) => t.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("le tappe senza id, o con un id di una versione vecchia, vanno bene: l'id lo dà l'import", () => {
    const letta = lega(leggi({ nome: "L", tappe: [tappaMinima("Senza id"), { ...tappaMinima("Id corto"), id: "a1b2c3d4" }] }));
    expect(letta.tappe.every((t) => isUuid(t.id))).toBe(true);
  });
});

describe("testoFileLega", () => {
  it("scrive un JSON rientrato con il nome e le tappe", () => {
    const tappe = [tappaCompleta("a")];
    const testo = testoFileLega("Roma", tappe);
    expect(JSON.parse(testo)).toEqual({ nome: "Roma", tappe });
    expect(testo).toContain("\n  \"nome\": \"Roma\"");
  });
});

describe("leggiLegaSalvata: la lega dell'ospite nel browser, controllata all'avvio", () => {
  const dati = (nome: string | undefined, tappe: unknown) => ({ nome, tappe });

  it("una lega valida si legge com'è, con gli id che le sue tappe già avevano e nessun avviso", () => {
    const tappe = [tappaCompleta("a", "Prima"), tappaCompleta("b", "Seconda")];
    const letta = leggiLegaSalvata(dati("Roma", tappe));
    expect(letta).toEqual({ lega: { nome: "Roma", tappe }, avviso: null });
  });

  it("una tappa senza squadre è scartata, le altre restano usabili e l'avviso dice quale e perché", () => {
    const rotta = { ...tappaCompleta("b", "Tappa rotta"), squadre: undefined };
    const letta = leggiLegaSalvata(dati("Estate", [tappaCompleta("a", "Buona"), rotta]))!;
    expect(letta.lega.tappe.map((t) => t.id)).toEqual(["a"]);
    expect(letta.avviso).toBe("La lega «Estate» ha una tappa non valida, che non è stata caricata: «Tappa rotta» (manca il campo «squadre»).");
  });

  it("una tappa senza nome si indica con il suo numero, e più tappe scartate stanno nello stesso avviso", () => {
    const senzaNome = { squadre: tappaMinima().squadre };
    const senzaSquadre = { ...tappaMinima("Seconda"), squadre: null };
    const letta = leggiLegaSalvata(dati("Estate", [tappaCompleta("a"), senzaNome, senzaSquadre]))!;
    expect(letta.lega.tappe).toHaveLength(1);
    expect(letta.avviso).toBe(
      "La lega «Estate» ha 2 tappe non valide, che non sono state caricate: "
      + "n. 2 (manca il campo «nome»); «Seconda» (squadre: deve essere un elenco).",
    );
  });

  it("un elemento che non è nemmeno un oggetto è una tappa scartata", () => {
    const letta = leggiLegaSalvata(dati("Estate", [null, 7, tappaCompleta("a")]))!;
    expect(letta.lega.tappe.map((t) => t.id)).toEqual(["a"]);
    expect(letta.avviso).toContain("n. 1 (non è una tappa)");
    expect(letta.avviso).toContain("n. 2 (non è una tappa)");
  });

  it("un problema dentro una squadra dice dov'è", () => {
    const squadre = [{ id: "s1", nome: "Uno" }, { nome: "Due" }];
    const letta = leggiLegaSalvata(dati("Estate", [{ nome: "T", squadre }]))!;
    expect(letta.avviso).toContain("«T» (squadre[1]: manca il campo «id»)");
  });

  it("dati che non sono una lega non si leggono: non un oggetto, oppure senza l'elenco delle tappe", () => {
    for (const non of [null, "testo", 42, [], { nome: "Estate" }, { nome: "Estate", tappe: { a: 1 } }]) {
      expect(leggiLegaSalvata(non), JSON.stringify(non)).toBeNull();
    }
  });

  it("una tappa salvata da una versione vecchia, a cui mancano dei campi, prende i valori predefiniti", () => {
    const letta = leggiLegaSalvata(dati("Estate", [{ id: "vecchia", nome: "Tappa vecchia", squadre: tappaMinima().squadre }]))!;
    expect(letta.avviso).toBeNull();
    expect(letta.lega.tappe[0]).toMatchObject({
      id: "vecchia", nGironi: 1, regole: DEFAULT_RULES, gironi: null, partite: [], video: [],
    });
  });

  it("i limiti del server non scartano una tappa del browser: un ospite non ha un server", () => {
    const lunga = { id: "x", ...tappaMinima("N".repeat(130)), data: "14/06/2026" };
    const letta = leggiLegaSalvata(dati("Estate", [lunga]))!;
    expect(letta.avviso).toBeNull();
    expect(letta.lega.tappe[0]).toMatchObject({ id: "x", data: "14/06/2026" });
  });

  it("senza nome la lega si legge lo stesso (nome vuoto), e l'avviso la chiama «senza nome»", () => {
    const letta = leggiLegaSalvata(dati(undefined, [{ nome: "T" }]))!;
    expect(letta.lega.nome).toBe("");
    expect(letta.avviso).toContain("La lega «senza nome»");
  });
});
