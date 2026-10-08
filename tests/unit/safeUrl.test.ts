import { describe, it, expect } from "vitest";
import { erroreUrl, erroreUrlSquadra, MAX_URL, safeUrl } from "../../src/utils/safeUrl";

describe("erroreUrl: il criterio del server per gli indirizzi scritti dagli utenti (B10), controllato prima dell'invio", () => {
  it.each(["", "   ", "https://esempio.it/logo.png", "http://esempio.it", "  HTTPS://ESEMPIO.IT/x  "])("«%s» va bene", (valore) => {
    expect(erroreUrl(valore)).toBeNull();
  });

  it.each([
    ["uno schema pericoloso", "javascript:alert(1)"],
    ["un percorso relativo (safeUrl lo accetta, il server no)", "/logos/squadra.svg"],
    ["un sito senza schema", "esempio.it/logo.png"],
    ["un URL malformato", "https://"],
    ["un «protocol-relative»", "//esempio.it"],
  ])("%s è rifiutato dicendo che serve http:// o https://", (_caso, valore) => {
    expect(erroreUrl(valore)).toBe("l'indirizzo deve cominciare con http:// o https:// (oppure lascia il campo vuoto).");
  });

  it(`oltre ${MAX_URL} caratteri è rifiutato per la lunghezza`, () => {
    expect(erroreUrl(`https://esempio.it/${"a".repeat(MAX_URL)}`)).toBe(`l'indirizzo può avere al massimo ${MAX_URL} caratteri.`);
    expect(erroreUrl(`https://e.it/${"a".repeat(MAX_URL - 13)}`)).toBeNull();
  });

  it("erroreUrlSquadra nomina il primo campo che non va, tra logo, sito e Instagram", () => {
    expect(erroreUrlSquadra({ logo: "", website: "", instagram: "" })).toBeNull();
    expect(erroreUrlSquadra({ logo: "https://e.it/l.png", website: "e.it", instagram: "x" })).toMatch(/^Sito web: l'indirizzo deve/);
    expect(erroreUrlSquadra({ logo: "", website: "", instagram: "instagram.com/squadra" })).toMatch(/^Instagram: /);
  });
});

// safeUrl è l'unica difesa del frontend sugli URL scritti dagli utenti (logo, sito, Instagram, video), che il server accetta come
// testo qualsiasi: ogni ramo che blocca va provato, perché un href javascript: in una pagina pubblica è un XSS

describe("safeUrl: lascia passare", () => {
  it.each([
    ["https://esempio.it/logo.png", "https://esempio.it/logo.png"],
    ["http://esempio.it", "http://esempio.it"],
    ["  https://esempio.it  ", "https://esempio.it"], // spazi intorno tolti
    ["HTTPS://ESEMPIO.IT", "HTTPS://ESEMPIO.IT"], // lo schema si confronta normalizzato, il testo resta com'è
    ["/archivio/tappa", "/archivio/tappa"],
    ["/", "/"],
  ])("%s → %s", (url, atteso) => {
    expect(safeUrl(url)).toBe(atteso);
  });
});

describe("safeUrl: blocca con «#»", () => {
  it.each([
    ["vuoto", ""],
    ["undefined", undefined],
    ["null", null],
    ["solo spazi", "   "],
    ["javascript:", "javascript:alert(1)"],
    ["JAVASCRIPT: maiuscolo", "JAVASCRIPT:alert(1)"],
    ["javascript: con spazi davanti", "   javascript:alert(1)"],
    ["java\\tscript: con una tabulazione dentro lo schema (il browser la toglie)", "java\tscript:alert(1)"],
    ["java\\nscript: con un a capo dentro lo schema", "java\nscript:alert(1)"],
    ["data:", "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
    ["vbscript:", "vbscript:MsgBox(1)"],
    ["file:", "file:///etc/passwd"],
    ["ftp:", "ftp://esempio.it"],
    ["senza schema", "esempio.it/logo.png"],
    ["malformato", "http://"],
    ["malformato con schema", "https://esem pio.it"],
    ["protocol-relative //host", "//evil.example/x"],
    ["protocol-relative con backslash /\\host", "/\\evil.example/x"],
    ["protocol-relative con spazi davanti", "  //evil.example"],
    ["protocol-relative con una tabulazione tra le barre (il browser la toglie)", "/\t/evil.example"],
    ["protocol-relative con un a capo tra le barre", "/\n/evil.example"],
  ])("%s", (_nome, url) => {
    expect(safeUrl(url)).toBe("#");
  });
});
