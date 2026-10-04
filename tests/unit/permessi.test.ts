import { describe, it, expect } from "vitest";
import { puoModificare } from "../../src/utils/permessi";
import type { User } from "../../src/types";

// Una voce dell'anagrafe scritta da Anna (id "u1"); gli altri utenti sono quelli che potrebbero volerla modificare
const AUTORE_ID = "u1";
const autore: User = { id: AUTORE_ID, name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
// Stesso nome visualizzato, altra persona: il nome non è unico, l'id sì
const omonimo: User = { id: "u2", name: "Anna", email: "anna.bis@example.it", ruolo: "USER", guest: false };
const admin: User = { id: "u9", name: "Responsabile", email: "admin@example.it", ruolo: "ADMIN", guest: false };
const ospite: User = { name: "Anna", guest: true };

describe("puoModificare (come sul server: autore o ADMIN)", () => {
  it("l'autore può modificare la sua voce", () => {
    expect(puoModificare(autore, AUTORE_ID)).toBe(true);
  });

  it("un omonimo che non è l'autore non può: conta l'id, non il nome", () => {
    expect(puoModificare(omonimo, AUTORE_ID)).toBe(false);
  });

  it("l'ADMIN può modificare anche le voci altrui", () => {
    expect(puoModificare(admin, AUTORE_ID)).toBe(true);
  });

  it("l'ospite non può, nemmeno se si chiama come l'autore", () => {
    expect(puoModificare(ospite, AUTORE_ID)).toBe(false);
  });

  it("senza utente non può nessuno", () => {
    expect(puoModificare(null, AUTORE_ID)).toBe(false);
  });

  it("l'ospite non può mai, neppure se la sessione salvata nel browser dice ADMIN o ha l'id dell'autore", () => {
    expect(puoModificare({ ...ospite, ruolo: "ADMIN" }, AUTORE_ID)).toBe(false);
    expect(puoModificare({ ...ospite, id: AUTORE_ID }, AUTORE_ID)).toBe(false);
  });

  it("un registrato senza id (sessione salvata prima degli id) non è l'autore di nessuna voce", () => {
    expect(puoModificare({ name: "Anna", guest: false }, AUTORE_ID)).toBe(false);
  });
});
