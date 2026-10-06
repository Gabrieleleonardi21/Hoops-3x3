import { describe, it, expect, vi, afterEach } from "vitest";
import { uid, isUuid } from "../../src/utils/uid";

afterEach(() => vi.unstubAllGlobals());

/** Un `crypto` come quello di una pagina su http in rete locale (contesto non sicuro): c'è getRandomValues, manca randomUUID.
 *  Con `byte` ogni byte casuale è quello dato, così l'UUID atteso si conosce prima; senza, i byte sono quelli veri. */
function senzaRandomUUID(byte?: number) {
  const vero = globalThis.crypto;
  vi.stubGlobal("crypto", {
    getRandomValues: (a: Uint8Array) => {
      if (byte === undefined) return vero.getRandomValues(a);
      return a.fill(byte);
    },
  });
}

describe("uid (FS-9): funziona anche dove crypto.randomUUID non esiste", () => {
  it("dove randomUUID c'è, la usa", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-2222-4333-8444-555555555555" });
    expect(uid()).toBe("11111111-2222-4333-8444-555555555555");
  });

  it("senza randomUUID (http in rete locale) non va in errore e dà un UUID v4 valido", () => {
    senzaRandomUUID();
    const id = uid();
    expect(isUuid(id)).toBe(true);
    expect(id[14]).toBe("4"); // versione 4
    expect("89ab").toContain(id[19]); // variante RFC 4122
  });

  it("versione e variante sono fissate qualunque siano i byte casuali", () => {
    senzaRandomUUID(0x00);
    expect(uid()).toBe("00000000-0000-4000-8000-000000000000");
    senzaRandomUUID(0xff);
    expect(uid()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });

  it("senza randomUUID gli id restano diversi uno dall'altro", () => {
    senzaRandomUUID();
    const id = new Set(Array.from({ length: 500 }, () => uid()));
    expect(id.size).toBe(500);
  });
});
