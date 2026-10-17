import { describe, it, expect } from "vitest";
import { tipoFile } from "../../src/utils/tipoFile";

/* Il tipo di un file scelto per «Importa file» si decide dai primi byte, non dal nome né dal `type` (che il browser ricava
 * dall'estensione): un PDF rinominato .jpg non deve partire verso il server, una foto salvata con il nome sbagliato sì. */

/** Un File con questi byte all'inizio, seguiti da un po' di riempitivo */
const file = (byte: number[], nome = "foto.jpg", type = "image/jpeg") =>
  new File([new Uint8Array([...byte, ...new Array(32).fill(0)])], nome, { type });

const testo = (contenuto: string, nome = "lega.json") => new File([contenuto], nome, { type: "application/json" });

describe("tipoFile: il formato dai primi byte", () => {
  it("riconosce JPEG, PNG e WebP dalla firma", async () => {
    expect(await tipoFile(file([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(await tipoFile(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    // WebP: «RIFF», 4 byte di lunghezza, «WEBP»
    expect(await tipoFile(file([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe("webp");
  });

  it("riconosce un JSON che comincia con «{», anche dopo il BOM e gli spazi", async () => {
    expect(await tipoFile(testo('{"nome":"Estate","tappe":[]}'))).toBe("json");
    expect(await tipoFile(testo('﻿{"nome":"Estate"}'))).toBe("json");
    expect(await tipoFile(testo('  \r\n\t{"nome":"Estate"}'))).toBe("json");
  });

  it("un PDF, un testo, un HTML e un file vuoto non sono niente di ammesso", async () => {
    expect(await tipoFile(file([0x25, 0x50, 0x44, 0x46], "foglio.jpg"))).toBeNull(); // %PDF rinominato .jpg
    expect(await tipoFile(testo("ciao a tutti", "note.json"))).toBeNull();
    expect(await tipoFile(testo("<html><script>alert(1)</script></html>", "lega.json"))).toBeNull();
    expect(await tipoFile(testo("", "vuoto.json"))).toBeNull();
    // RIFF ma non WebP (un WAV)
    expect(await tipoFile(file([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
  });

  it("nome e type del file non contano: un .jpg che contiene un PNG è un PNG", async () => {
    expect(await tipoFile(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], "foto.jpg", "image/jpeg"))).toBe("png");
    expect(await tipoFile(file([0xff, 0xd8, 0xff, 0xdb], "lega.json", "application/json"))).toBe("jpeg");
  });
});
