import { describe, expect, it } from "vitest";
import { dettagliSquadraAnagrafe, separaDettaglio, trovaPerNome, type Dettagli } from "../../src/utils/ricercaPerNome";
import type { RegSquadra } from "../../src/types";

/** Una tappa ridotta ai campi che servono alla ricerca: nome, data (gg/mm/aaaa o vuota) e luogo */
interface Tappa { nome: string; data: string; luogo: string }
const tappa = (nome: string, data: string, luogo: string): Tappa => ({ nome, data, luogo });
const nomeDi = (t: Tappa) => t.nome;

/** Come le tappe reali: data e luogo sono i descrittori, e la frase li elenca tra parentesi */
const dettagliTappa: Dettagli<Tappa> = {
  descrittori: (t) => [t.data, t.luogo].filter(Boolean),
  descrivi: (t) => `"${t.nome}" (${t.data || "senza data"}, ${t.luogo || "senza luogo"})`,
};

const DUE_ROMA_OPEN = [tappa("Roma Open", "12/05/2026", "Torino"), tappa("Roma Open", "26/06/2026", "Milano")];

describe("ricercaPerNome: la regola unica con cui il Coach trova tappe e squadre", () => {
  it("un nome esatto unico trova l'elemento, maiuscole e accenti a parte", () => {
    const elementi = [tappa("Roma Open", "", ""), tappa("Milano Città", "", "")];
    expect(trovaPerNome(elementi, "  roma OPEN ", nomeDi, "tappe")).toBe(elementi[0]);
    expect(trovaPerNome([tappa("Città", "", "")], "citta", nomeDi, "tappe")?.nome).toBe("Città");
  });

  it("due esatti senza dettagli: errore con i due nomi e la frase che chiede di rinominarne una", () => {
    const elementi = [tappa("Roma", "", ""), tappa("Roma", "", "")];
    expect(() => trovaPerNome(elementi, "Roma", nomeDi, "tappe")).toThrow(
      'Più tappe si chiamano "Roma": "Roma"; "Roma". Rinomina una delle due dalla pagina della tappa.',
    );
  });

  it("due esatti con dettagli: errore con la data e il luogo di ciascuna, e l'esempio con la data", () => {
    expect(() => trovaPerNome(DUE_ROMA_OPEN, "Roma Open", nomeDi, "tappe", dettagliTappa)).toThrow(
      'Più tappe si chiamano "Roma Open": "Roma Open" (12/05/2026, Torino); "Roma Open" (26/06/2026, Milano). '
      + 'Scrivi il nome con un dettaglio tra parentesi, per esempio "Roma Open (12/05/2026)".',
    );
  });

  it("«Roma Open (26/06/2026)» sceglie la seconda", () => {
    expect(trovaPerNome(DUE_ROMA_OPEN, "Roma Open (26/06/2026)", nomeDi, "tappe", dettagliTappa)).toBe(DUE_ROMA_OPEN[1]);
  });

  it("il dettaglio vale anche per il luogo, senza maiuscole", () => {
    expect(trovaPerNome(DUE_ROMA_OPEN, "Roma Open (milano)", nomeDi, "tappe", dettagliTappa)).toBe(DUE_ROMA_OPEN[1]);
  });

  it("un dettaglio che non corrisponde a nessuna: errore con tutte le opzioni", () => {
    expect(() => trovaPerNome(DUE_ROMA_OPEN, "Roma Open (oggi)", nomeDi, "tappe", dettagliTappa)).toThrow(
      'Nessuna "Roma Open" corrisponde a "(oggi)": le opzioni sono "Roma Open" (12/05/2026, Torino); "Roma Open" (26/06/2026, Milano).',
    );
  });

  it("un dettaglio che corrisponde a due omonime: errore con le due, senza sceglierne una", () => {
    expect(() => trovaPerNome(DUE_ROMA_OPEN, "Roma Open (2026)", nomeDi, "tappe", dettagliTappa)).toThrow(
      'Più "Roma Open" corrispondono a "(2026)": "Roma Open" (12/05/2026, Torino); "Roma Open" (26/06/2026, Milano). '
      + "Scrivi un dettaglio più preciso.",
    );
  });

  it("«Roma (B)» con una «Roma» del girone B e una di Bari: il descrittore uguale sceglie il girone B, senza errore", () => {
    // «b» sta anche in «Bari» (come parte): senza la prima passata sul descrittore uguale le due corrispondono e il comando si ferma
    const squadre = [
      { nome: "Roma", descrittori: ["girone A", "A", "Bari"] },
      { nome: "Roma", descrittori: ["girone B", "B", "Torino"] },
    ];
    const dettagliSquadre: Dettagli<(typeof squadre)[number]> = {
      descrittori: (s) => s.descrittori,
      descrivi: (s) => `"${s.nome}" (${s.descrittori[0]})`,
    };
    expect(trovaPerNome(squadre, "Roma (B)", (s) => s.nome, "squadre", dettagliSquadre)).toBe(squadre[1]);
  });

  it("un elemento chiamato davvero «Roma (Torino)» si trova per intero, prima di ogni lettura del dettaglio", () => {
    const elementi = [tappa("Roma", "", "Torino"), tappa("Roma (Torino)", "", "")];
    expect(trovaPerNome(elementi, "Roma (Torino)", nomeDi, "tappe", dettagliTappa)).toBe(elementi[1]);
  });

  it("una corrispondenza parziale sola basta", () => {
    const elementi = [tappa("Roma Open", "", ""), tappa("Milano", "", "")];
    expect(trovaPerNome(elementi, "Roma", nomeDi, "tappe")).toBe(elementi[0]);
  });

  it("più corrispondenze parziali restano un errore che chiede il nome completo", () => {
    const elementi = [tappa("Roma Open", "", ""), tappa("Roma Open 2", "", "")];
    expect(() => trovaPerNome(elementi, "Roma", nomeDi, "tappe")).toThrow(
      'Più tappe corrispondono a "Roma": "Roma Open", "Roma Open 2". Indica il nome completo.',
    );
  });

  it("nessuna corrispondenza, nemmeno parziale, dà null", () => {
    expect(trovaPerNome([tappa("Roma Open", "", "")], "Milano", nomeDi, "tappe")).toBeNull();
  });

  it("un dettaglio senza nessuna base corrispondente torna alla ricerca parziale con il nome intero", () => {
    expect(trovaPerNome([tappa("Roma Open", "", "")], "Milano (2026)", nomeDi, "tappe", dettagliTappa)).toBeNull();
  });

  it("i nomi nell'errore passano da pulisci: un «<» diventa «‹»", () => {
    const elementi = [tappa("Roma <i>", "", ""), tappa("Roma <i>", "", "")];
    expect(() => trovaPerNome(elementi, "Roma <i>", nomeDi, "tappe")).toThrow('Più tappe si chiamano "Roma ‹i›"');
  });
});

describe("dettagliSquadraAnagrafe: come si distinguono le squadre omonime dell'anagrafe (Coach e simulazione)", () => {
  // Una squadra dell'anagrafe con i soli campi che servono: città e autore
  const squadra = (citta: string, autore: string): RegSquadra => ({
    id: "r1", nome: "Roma", citta, anno: "", rank: "", referente: "", roster: [], logo: "", website: "", instagram: "",
    note: "", autore, autoreId: "u1", ts: 1,
  });

  it("i descrittori sono la città, «di» l'autore e l'autore, senza i vuoti", () => {
    expect(dettagliSquadraAnagrafe.descrittori(squadra("Torino", "Anna"))).toEqual(["Torino", "di Anna", "Anna"]);
    expect(dettagliSquadraAnagrafe.descrittori(squadra("", "Anna"))).toEqual(["di Anna", "Anna"]);
  });

  it("la descrizione è il nome tra virgolette, la città e l'autore", () => {
    expect(dettagliSquadraAnagrafe.descrivi(squadra("Torino", "Anna"))).toBe('"Roma" (Torino, di Anna)');
  });

  it("senza città la descrizione dice «città non indicata»", () => {
    expect(dettagliSquadraAnagrafe.descrivi(squadra("", "Anna"))).toBe('"Roma" (città non indicata, di Anna)');
  });
});

describe("separaDettaglio", () => {
  it("separa il nome dal dettaglio tra parentesi in fondo", () => {
    expect(separaDettaglio("Roma Open (26/06/2026)")).toEqual({ base: "Roma Open", dettaglio: "26/06/2026" });
    expect(separaDettaglio("Roma (girone B)")).toEqual({ base: "Roma", dettaglio: "girone B" });
  });

  it("senza parentesi, o con parentesi vuote, il nome resta intero", () => {
    expect(separaDettaglio("Roma")).toEqual({ base: "Roma", dettaglio: null });
    expect(separaDettaglio("Roma ( )")).toEqual({ base: "Roma ( )", dettaglio: null });
  });

  it("con più parentesi conta l'ultima", () => {
    expect(separaDettaglio("Roma (A) (B)")).toEqual({ base: "Roma (A)", dettaglio: "B" });
  });
});
