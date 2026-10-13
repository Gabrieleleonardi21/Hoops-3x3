import { describe, it, expect } from "vitest";
import { emailSchema, nomeUtenteSchema, passwordSchema } from "../../src/utils/credenziali";

/** Il messaggio del primo errore, o null se il valore è valido */
const errore = (schema: typeof emailSchema | typeof passwordSchema | typeof nomeUtenteSchema, valore: string): string | null => {
  const esito = schema.safeParse(valore);
  if (esito.success) return null;
  return esito.error.issues[0].message;
};

describe("emailSchema", () => {
  it("accetta una mail valida", () => {
    expect(errore(emailSchema, "anna@example.it")).toBeNull();
  });
  it.each(["", "anna", "anna@"])("rifiuta «%s» con «Mail non valida»", (mail) => {
    expect(errore(emailSchema, mail)).toBe("Mail non valida");
  });
});

describe("passwordSchema: da 8 caratteri a 72 byte UTF-8", () => {
  it("rifiuta 7 caratteri", () => {
    expect(errore(passwordSchema, "1234567")).toBe("Password di almeno 8 caratteri");
  });
  it("accetta 8 caratteri e 72 byte", () => {
    expect(errore(passwordSchema, "12345678")).toBeNull();
    expect(errore(passwordSchema, "a".repeat(72))).toBeNull();
  });
  it("rifiuta 73 byte", () => {
    expect(errore(passwordSchema, "a".repeat(73))).toBe("Password di al massimo 72 byte");
  });
  it("conta i byte, non i caratteri: 37 «è» sono 74 byte", () => {
    expect(errore(passwordSchema, "è".repeat(36))).toBeNull(); // 72 byte
    expect(errore(passwordSchema, "è".repeat(37))).toBe("Password di al massimo 72 byte");
  });
});

describe("nomeUtenteSchema: da 2 a 80 caratteri (come il server)", () => {
  it("il campo vuoto ha il suo messaggio", () => {
    expect(errore(nomeUtenteSchema, "")).toBe("Inserisci il nome utente");
  });
  it("rifiuta 1 carattere", () => {
    expect(errore(nomeUtenteSchema, "a")).toBe("Nome utente di almeno 2 caratteri");
  });
  it("accetta 2 e 80 caratteri", () => {
    expect(errore(nomeUtenteSchema, "ab")).toBeNull();
    expect(errore(nomeUtenteSchema, "a".repeat(80))).toBeNull();
  });
  it("rifiuta 81 caratteri", () => {
    expect(errore(nomeUtenteSchema, "a".repeat(81))).toBe("Nome utente di al massimo 80 caratteri");
  });
});
