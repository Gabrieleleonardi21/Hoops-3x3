import { describe, it, expect, beforeEach } from "vitest";
import { ApiError, token } from "../../src/services/api";
import { profiloApi } from "../../src/services/profiloApi";
import { RISPOSTA_PROFILO_NON_VALIDA } from "../../src/utils/testi";
import { azzeraRete, chiamata, fetchFinto, jwtFinto, rispondi, rispondiConErrore, rispondiSenzaCorpo } from "./reteFinta";

/** Le richieste vere che il client del profilo manda al backend: URL, metodo, Bearer e corpo. La rete è finta, `api` è quella vera */
const utenteServer = { id: "u1", name: "Anna Rossi", email: "anna@example.it", ruolo: "USER" };
const utenteClient = { id: "u1", name: "Anna Rossi", email: "anna@example.it", ruolo: "USER", guest: false };
let jwtAttuale = "";

beforeEach(() => {
  azzeraRete();
  jwtAttuale = jwtFinto();
  token.set(jwtAttuale);
});

describe("profiloApi.cambiaNome", () => {
  it("PATCH /api/auth/me con il nome e il Bearer; restituisce l'utente di sessione", async () => {
    rispondi(utenteServer);
    expect(await profiloApi.cambiaNome("Anna Rossi")).toEqual(utenteClient);
    expect(chiamata()).toMatchObject({ url: "/api/auth/me", metodo: "PATCH", corpo: { name: "Anna Rossi" } });
    expect(chiamata().intestazioni.Authorization).toBe(`Bearer ${jwtAttuale}`);
  });

  it("una risposta fuori forma è un ApiError con il testo del profilo", async () => {
    rispondi({ id: "u1" });
    await expect(profiloApi.cambiaNome("Anna")).rejects.toMatchObject({ status: 200, message: RISPOSTA_PROFILO_NON_VALIDA });
  });

  it("un ruolo sconosciuto non è una risposta valida", async () => {
    rispondi({ ...utenteServer, ruolo: "SUPER" });
    await expect(profiloApi.cambiaNome("Anna")).rejects.toBeInstanceOf(ApiError);
  });

  it.each([[400, "Nome non valido"], [429, "Troppe richieste"]])("%i: ApiError con il messaggio del server", async (status, messaggio) => {
    rispondiConErrore(status, messaggio);
    await expect(profiloApi.cambiaNome("Anna")).rejects.toMatchObject({ status, message: messaggio });
  });
});

describe("profiloApi.cambiaPassword", () => {
  it("POST /api/auth/me/password con le due password; il nuovo token sostituisce quello in localStorage", async () => {
    const nuovo = jwtFinto() + "x";
    rispondi({ token: nuovo, user: utenteServer });
    expect(await profiloApi.cambiaPassword("vecchia-pass", "nuova-pass-1")).toEqual(utenteClient);
    expect(chiamata()).toMatchObject({
      url: "/api/auth/me/password", metodo: "POST", corpo: { passwordAttuale: "vecchia-pass", nuovaPassword: "nuova-pass-1" },
    });
    expect(chiamata().intestazioni.Authorization).toBe(`Bearer ${jwtAttuale}`);
    expect(localStorage.getItem("hoop3x3_token")).toBe(nuovo);
  });

  it("se l'utente è uscito mentre la richiesta era in volo non salva il JWT nuovo e chiude la sessione appena aperta", async () => {
    const nuovo = jwtFinto() + "x";
    // «Esci» durante l'attesa: il token sparisce prima che la risposta arrivi
    fetchFinto.mockImplementationOnce(async () => {
      token.clear();
      return new Response(JSON.stringify({ token: nuovo, user: utenteServer }), { status: 200 });
    });
    rispondi({});
    expect(await profiloApi.cambiaPassword("vecchia-pass", "nuova-pass-1")).toEqual(utenteClient);
    expect(localStorage.getItem("hoop3x3_token")).toBeNull();
    // La sessione che il server ha riaperto per questo browser si chiude subito, anche a pagina che si chiude (keepalive)
    expect(chiamata(1)).toMatchObject({ url: "/api/auth/logout", metodo: "POST", keepalive: true });
  });

  it("una risposta fuori forma (token vuoto) non tocca il token salvato", async () => {
    rispondi({ token: "", user: utenteServer });
    await expect(profiloApi.cambiaPassword("a", "nuova-pass-1")).rejects.toMatchObject({ message: RISPOSTA_PROFILO_NON_VALIDA });
    expect(localStorage.getItem("hoop3x3_token")).toBe(jwtAttuale);
  });

  it("400 (password attuale sbagliata): ApiError con il messaggio, token com'era", async () => {
    rispondiConErrore(400, "La password attuale non è corretta");
    await expect(profiloApi.cambiaPassword("x", "nuova-pass-1")).rejects.toMatchObject({
      status: 400, message: "La password attuale non è corretta",
    });
    expect(localStorage.getItem("hoop3x3_token")).toBe(jwtAttuale);
  });
});

describe("profiloApi.richiediCambioEmail", () => {
  it("POST /api/auth/me/email con la nuova email e la password; restituisce il messaggio del server", async () => {
    rispondi({ message: "Ti abbiamo inviato un link al nuovo indirizzo." });
    expect(await profiloApi.richiediCambioEmail("nuova@example.it", "la-mia-pass")).toBe("Ti abbiamo inviato un link al nuovo indirizzo.");
    expect(chiamata()).toMatchObject({
      url: "/api/auth/me/email", metodo: "POST", corpo: { nuovaEmail: "nuova@example.it", password: "la-mia-pass" },
    });
    expect(chiamata().intestazioni.Authorization).toBe(`Bearer ${jwtAttuale}`);
  });

  it.each([[400, "È già l'email del tuo account"], [403, "L'account ADMIN si gestisce dalla configurazione del server"],
    [409, "Email già registrata"], [429, "Hai già richiesto 3 link in 15 minuti"]])("%i: ApiError con il messaggio del server", async (status, messaggio) => {
    rispondiConErrore(status, messaggio);
    await expect(profiloApi.richiediCambioEmail("n@example.it", "p")).rejects.toMatchObject({ status, message: messaggio });
  });

  it("senza message è un ApiError", async () => {
    rispondi({});
    await expect(profiloApi.richiediCambioEmail("n@example.it", "p")).rejects.toMatchObject({ message: RISPOSTA_PROFILO_NON_VALIDA });
  });
});

describe("profiloApi.confermaEmail", () => {
  it("POST /api/auth/email/conferma con il token, senza Bearer (rotta pubblica)", async () => {
    rispondi({ message: "Email aggiornata." });
    expect(await profiloApi.confermaEmail("tok-123")).toBe("Email aggiornata.");
    expect(chiamata()).toMatchObject({ url: "/api/auth/email/conferma", metodo: "POST", corpo: { token: "tok-123" } });
    expect(chiamata().intestazioni.Authorization).toBeUndefined();
  });

  it("link non valido: 400 con il messaggio del server", async () => {
    rispondiConErrore(400, "Il link non è valido o è scaduto. Richiedine uno nuovo.");
    await expect(profiloApi.confermaEmail("vecchio")).rejects.toMatchObject({ status: 400 });
  });

  it("senza rete è un ApiError con status 0", async () => {
    fetchFinto.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(profiloApi.confermaEmail("tok")).rejects.toMatchObject({ status: 0 });
  });
});

describe("profiloApi.eliminaAccount", () => {
  it("POST /api/auth/me/elimina con la password; 204 → undefined", async () => {
    rispondiSenzaCorpo();
    expect(await profiloApi.eliminaAccount("la-mia-pass")).toBeUndefined();
    expect(chiamata()).toMatchObject({ url: "/api/auth/me/elimina", metodo: "POST", corpo: { password: "la-mia-pass" } });
    expect(chiamata().intestazioni.Authorization).toBe(`Bearer ${jwtAttuale}`);
  });

  it.each([[400, "La password attuale non è corretta"], [403, "L'account ADMIN si gestisce dalla configurazione del server"]])(
    "%i: ApiError con il messaggio del server", async (status, messaggio) => {
      rispondiConErrore(status, messaggio);
      await expect(profiloApi.eliminaAccount("x")).rejects.toMatchObject({ status, message: messaggio });
    },
  );
});
