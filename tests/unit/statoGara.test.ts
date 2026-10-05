/** statoGara: come sta la partita di 3x3 in un dato momento, secondo le regole della tappa.
 *  È una funzione pura: riceve punteggio, tempo rimasto e (se è stato avviato) il punto da cui è partito il supplementare. */
import { describe, it, expect, vi, afterEach } from "vitest";
import { statoGara, supplementareValido, type Lato, type Punti } from "../../src/utils/statoGara";
import { DEFAULT_RULES } from "../../src/constants/rules";

const REGOLE = DEFAULT_RULES; // 21 punti, 10 minuti, supplementare a 2 punti
const METAPARTITA = 300; // secondi rimasti sul cronometro di gara
const SCADUTO = 0;

const punti = (a: number, b: number): Punti => ({ a, b });

describe("statoGara: la partita è in corso", () => {
  it("all'inizio, a metà e a un secondo dalla fine, senza nessuno al punteggio di vittoria", () => {
    expect(statoGara({ punti: punti(0, 0), rimasto: 600 }, REGOLE)).toEqual({ fase: "inCorso" });
    expect(statoGara({ punti: punti(12, 9), rimasto: METAPARTITA }, REGOLE)).toEqual({ fase: "inCorso" });
    expect(statoGara({ punti: punti(12, 9), rimasto: 1 }, REGOLE)).toEqual({ fase: "inCorso" });
  });

  it("a 20 punti non è finita: si gioca fino a 21", () => {
    expect(statoGara({ punti: punti(20, 19), rimasto: METAPARTITA }, REGOLE)).toEqual({ fase: "inCorso" });
  });

  it("una parità col tempo che resta non decide niente", () => {
    expect(statoGara({ punti: punti(15, 15), rimasto: METAPARTITA }, REGOLE)).toEqual({ fase: "inCorso" });
  });
});

describe("statoGara: la partita finisce al punteggio di vittoria", () => {
  it.each<[string, Punti, Lato]>([
    ["A", punti(21, 14), "a"],
    ["B", punti(9, 21), "b"],
  ])("la squadra %s arriva a 21 con il tempo che resta: vince subito", (_squadra, p, vincitore) => {
    expect(statoGara({ punti: p, rimasto: 400 }, REGOLE)).toEqual({ fase: "vintaAlPunteggio", vincitore });
  });

  it("con un canestro da 2 il punteggio si può superare (22 a 20) e la partita finisce lo stesso", () => {
    expect(statoGara({ punti: punti(22, 20), rimasto: 400 }, REGOLE)).toEqual({ fase: "vintaAlPunteggio", vincitore: "a" });
  });
});

describe("statoGara: a tempo scaduto vince chi è avanti", () => {
  it.each<[string, Punti, Lato]>([
    ["A", punti(15, 12), "a"],
    ["B", punti(9, 12), "b"],
  ])("la squadra %s è avanti allo scadere: vince a tempo", (_squadra, p, vincitore) => {
    expect(statoGara({ punti: p, rimasto: SCADUTO }, REGOLE)).toEqual({ fase: "vintaATempo", vincitore });
  });
});

describe("statoGara: in parità a tempo scaduto serve il supplementare, che va avviato", () => {
  it.each<[string, Punti]>([
    ["15 pari", punti(15, 15)],
    ["0 a 0", punti(0, 0)],
  ])("%s: serve il supplementare e non è ancora partito, senza vincitore", (_nome, p) => {
    expect(statoGara({ punti: p, rimasto: SCADUTO }, REGOLE)).toEqual({ fase: "supplementareDaAvviare" });
  });

  it("finché non è avviato, un canestro registrato in ritardo o una correzione che rompe la parità dà la vittoria a tempo", () => {
    const allo = (a: number, b: number) => statoGara({ punti: punti(a, b), rimasto: SCADUTO }, REGOLE);
    expect(allo(15, 15)).toEqual({ fase: "supplementareDaAvviare" });
    expect(allo(16, 15)).toEqual({ fase: "vintaATempo", vincitore: "a" }); // un canestro in ritardo
    expect(allo(15, 16)).toEqual({ fase: "vintaATempo", vincitore: "b" });
    expect(allo(15, 15)).toEqual({ fase: "supplementareDaAvviare" }); // la correzione torna indietro: ancora da avviare
  });

  it("senza il punto di partenza (assente o null) il supplementare non è avviato", () => {
    expect(statoGara({ punti: punti(8, 8), rimasto: SCADUTO, inizioSupplementare: null }, REGOLE)).toEqual({ fase: "supplementareDaAvviare" });
    expect(statoGara({ punti: punti(8, 8), rimasto: SCADUTO, inizioSupplementare: undefined }, REGOLE)).toEqual({ fase: "supplementareDaAvviare" });
  });
});

describe("statoGara: nel supplementare vince chi segna per primo i punti previsti", () => {
  // Il supplementare è stato avviato sul 15 pari
  const INIZIO = punti(15, 15);
  const supplementare = (a: number, b: number) => statoGara({ punti: punti(a, b), rimasto: SCADUTO, inizioSupplementare: INIZIO }, REGOLE);

  it("avviato, e finché nessuno ha fatto 2 punti, continua", () => {
    expect(supplementare(15, 15)).toEqual({ fase: "supplementare" });
    expect(supplementare(16, 15)).toEqual({ fase: "supplementare" });
    expect(supplementare(16, 16)).toEqual({ fase: "supplementare" });
  });

  it("il primo a fare 2 punti vince, anche se l'altra squadra ne ha già fatto 1", () => {
    expect(supplementare(17, 15)).toEqual({ fase: "vintaAlSupplementare", vincitore: "a" });
    expect(supplementare(16, 17)).toEqual({ fase: "vintaAlSupplementare", vincitore: "b" });
  });

  it("i punti si contano da quando il supplementare è partito, non sul totale", () => {
    // Dal 10 pari: l'11 a 10 è un solo punto del supplementare. Contando sul totale (11 ≥ 2) la vittoria sarebbe già assegnata
    const dalDieci = (a: number, b: number) => statoGara({ punti: punti(a, b), rimasto: SCADUTO, inizioSupplementare: punti(10, 10) }, REGOLE);
    expect(dalDieci(11, 10)).toEqual({ fase: "supplementare" });
    expect(dalDieci(12, 10)).toEqual({ fase: "vintaAlSupplementare", vincitore: "a" });
  });

  it("il cronometro di gara non conta più: chi è avanti di un punto non vince a tempo", () => {
    expect(supplementare(16, 15)).toEqual({ fase: "supplementare" });
  });

  it("il punteggio di vittoria non vale più: arrivare a 21 con un solo punto del supplementare non basta", () => {
    const dalVenti = (a: number, b: number) => statoGara({ punti: punti(a, b), rimasto: SCADUTO, inizioSupplementare: punti(20, 20) }, REGOLE);
    expect(dalVenti(21, 20)).toEqual({ fase: "supplementare" });
    expect(dalVenti(22, 20)).toEqual({ fase: "vintaAlSupplementare", vincitore: "a" });
  });

  it("una parità non decide: dopo una correzione, 2 punti a testa non assegnano la vittoria", () => {
    expect(supplementare(17, 17)).toEqual({ fase: "supplementare" });
  });
});

describe("statoGara: sotto il punteggio di partenza il supplementare non vale più", () => {
  // Avviato sul 15 pari: se poi una squadra scende sotto 15, il pareggio che lo giustificava è stato corretto via
  const INIZIO = punti(15, 15);
  const dopoLaCorrezione = (a: number, b: number) => statoGara({ punti: punti(a, b), rimasto: SCADUTO, inizioSupplementare: INIZIO }, REGOLE);

  it("si giudica di nuovo il tempo regolamentare: vince a tempo chi è avanti, e niente punti negativi del supplementare", () => {
    expect(dopoLaCorrezione(15, 14)).toEqual({ fase: "vintaATempo", vincitore: "a" });
    expect(dopoLaCorrezione(14, 15)).toEqual({ fase: "vintaATempo", vincitore: "b" });
  });

  it("anche se l'altra squadra è sopra: conta il tempo regolamentare, non i punti del supplementare", () => {
    // A ha 1 punto del supplementare e B −1: giudicata sul supplementare nessuno avrebbe finito; sul tempo regolamentare vince A
    expect(dopoLaCorrezione(16, 14)).toEqual({ fase: "vintaATempo", vincitore: "a" });
  });

  it("se tornano pari, sotto, serve di nuovo avviare il supplementare", () => {
    expect(dopoLaCorrezione(14, 14)).toEqual({ fase: "supplementareDaAvviare" });
  });

  it("al punteggio di partenza esatto il supplementare vale ancora", () => {
    expect(dopoLaCorrezione(15, 15)).toEqual({ fase: "supplementare" });
  });

  it("supplementareValido: vale finché nessuna squadra scende sotto il punteggio di partenza", () => {
    expect(supplementareValido(punti(15, 15), INIZIO)).toBe(true);
    expect(supplementareValido(punti(17, 16), INIZIO)).toBe(true);
    expect(supplementareValido(punti(15, 14), INIZIO)).toBe(false);
    expect(supplementareValido(punti(14, 16), INIZIO)).toBe(false);
  });
});

describe("statoGara: casi limite", () => {
  it("il punteggio raggiunto nello stesso istante in cui scade il tempo vale come vittoria al punteggio", () => {
    expect(statoGara({ punti: punti(21, 18), rimasto: SCADUTO }, REGOLE)).toEqual({ fase: "vintaAlPunteggio", vincitore: "a" });
  });

  it("una parità non decide mai, nemmeno oltre il punteggio di vittoria", () => {
    expect(statoGara({ punti: punti(21, 21), rimasto: METAPARTITA }, REGOLE)).toEqual({ fase: "inCorso" });
    expect(statoGara({ punti: punti(21, 21), rimasto: SCADUTO }, REGOLE)).toEqual({ fase: "supplementareDaAvviare" });
  });

  it("usa il punteggio di vittoria della tappa, non 21: gara a 11", () => {
    const aUndici = { ...REGOLE, target: 11 };
    expect(statoGara({ punti: punti(11, 4), rimasto: 400 }, aUndici)).toEqual({ fase: "vintaAlPunteggio", vincitore: "a" });
    expect(statoGara({ punti: punti(10, 4), rimasto: 400 }, aUndici)).toEqual({ fase: "inCorso" });
    // con le regole predefinite lo stesso punteggio non decide niente
    expect(statoGara({ punti: punti(11, 4), rimasto: 400 }, REGOLE)).toEqual({ fase: "inCorso" });
  });

  it("usa i punti del supplementare della tappa, non 2: supplementare a 3", () => {
    const aTre = { ...REGOLE, ot: 3 };
    const inizioOtto = punti(8, 8);
    expect(statoGara({ punti: punti(10, 8), rimasto: SCADUTO, inizioSupplementare: inizioOtto }, aTre)).toEqual({ fase: "supplementare" });
    expect(statoGara({ punti: punti(11, 8), rimasto: SCADUTO, inizioSupplementare: inizioOtto }, aTre)).toEqual({ fase: "vintaAlSupplementare", vincitore: "a" });
    // con le regole predefinite gli stessi 2 punti bastano
    expect(statoGara({ punti: punti(10, 8), rimasto: SCADUTO, inizioSupplementare: inizioOtto }, REGOLE)).toEqual({ fase: "vintaAlSupplementare", vincitore: "a" });
  });

  it("per ogni punteggio e tempo: il vincitore è sempre chi sta davanti, e la parità non vince mai", () => {
    for (let a = 0; a <= 25; a++) {
      for (let b = 0; b <= 25; b++) {
        for (const rimasto of [SCADUTO, 1, METAPARTITA]) {
          const stato = statoGara({ punti: punti(a, b), rimasto }, REGOLE);
          if ("vincitore" in stato) {
            const [suoi, altri] = { a: [a, b], b: [b, a] }[stato.vincitore];
            expect(suoi).toBeGreaterThan(altri);
            if (stato.fase === "vintaAlPunteggio") expect(suoi).toBeGreaterThanOrEqual(REGOLE.target);
            if (stato.fase === "vintaATempo") expect(rimasto).toBe(SCADUTO);
          } else if (a === b && rimasto === SCADUTO) {
            // Senza supplementare avviato, la parità a tempo scaduto chiede di avviarlo: non lo considera mai già in corso
            expect(stato.fase).toBe("supplementareDaAvviare");
          }
        }
      }
    }
  });
});

describe("statoGara è pura", () => {
  afterEach(() => vi.restoreAllMocks());

  it("non legge l'orologio, in nessuno dei sei esiti", () => {
    const orologio = vi.spyOn(Date, "now");
    statoGara({ punti: punti(5, 4), rimasto: METAPARTITA }, REGOLE);
    statoGara({ punti: punti(21, 4), rimasto: METAPARTITA }, REGOLE);
    statoGara({ punti: punti(9, 4), rimasto: SCADUTO }, REGOLE);
    statoGara({ punti: punti(9, 9), rimasto: SCADUTO }, REGOLE);
    statoGara({ punti: punti(9, 9), rimasto: SCADUTO, inizioSupplementare: punti(9, 9) }, REGOLE);
    statoGara({ punti: punti(11, 9), rimasto: SCADUTO, inizioSupplementare: punti(9, 9) }, REGOLE);
    expect(orologio).not.toHaveBeenCalled();
  });

  it("non modifica ciò che riceve e, con gli stessi dati, risponde sempre lo stesso", () => {
    // Congelati: scrivere su uno di questi oggetti farebbe fallire la chiamata
    const situazione = Object.freeze({ punti: Object.freeze(punti(16, 15)), rimasto: SCADUTO, inizioSupplementare: Object.freeze(punti(15, 15)) });
    const regole = Object.freeze({ ...REGOLE });
    expect(statoGara(situazione, regole)).toEqual(statoGara(situazione, regole));
  });
});
