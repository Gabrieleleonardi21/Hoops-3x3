import { describe, it, expect } from "vitest";
import { safeUrl } from "../../src/utils/safeUrl";

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
  ])("%s", (_nome, url) => {
    expect(safeUrl(url)).toBe("#");
  });
});
