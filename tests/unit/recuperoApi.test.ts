import { describe, it, expect, beforeEach } from "vitest";
import { ApiError } from "../../src/services/api";
import { recuperoApi } from "../../src/services/recuperoApi";
import { azzeraRete, chiamata, fetchFinto, rispondi, rispondiConErrore } from "./reteFinta";

/** Le richieste vere che il client manda al backend: URL, metodo e corpo. La rete è finta, `api` è quella vera */
beforeEach(() => {
  azzeraRete();
});

describe("recuperoApi.richiediLink", () => {
  it("manda l'email a POST /api/auth/password/dimenticata, senza token, e restituisce il messaggio del server", async () => {
    rispondi({ message: "Se l'email è registrata, riceverai un link." });
    const messaggio = await recuperoApi.richiediLink("anna@example.it");
    expect(messaggio).toBe("Se l'email è registrata, riceverai un link.");
    expect(chiamata()).toMatchObject({ url: "/api/auth/password/dimenticata", metodo: "POST", corpo: { email: "anna@example.it" } });
    expect(chiamata().intestazioni.Authorization).toBeUndefined();
  });

  it("un errore di validazione (400) arriva come ApiError con il messaggio del server", async () => {
    rispondiConErrore(400, "Mail non valida");
    await expect(recuperoApi.richiediLink("x")).rejects.toMatchObject({ status: 400, message: "Mail non valida" });
  });

  it("senza rete è un ApiError con status 0", async () => {
    fetchFinto.mockRejectedValue(new TypeError("Failed to fetch"));
    const e = await recuperoApi.richiediLink("anna@example.it").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 0 });
  });

  it("una risposta fuori forma (senza message) è un ApiError, mai un messaggio inventato", async () => {
    rispondi({ ok: true });
    await expect(recuperoApi.richiediLink("anna@example.it")).rejects.toBeInstanceOf(ApiError);
  });
});

describe("recuperoApi.reimposta", () => {
  it("manda token e nuova password a POST /api/auth/password/reimposta e restituisce il messaggio", async () => {
    rispondi({ message: "Password aggiornata. Accedi con la nuova password." });
    const messaggio = await recuperoApi.reimposta("tok-123", "nuova-password");
    expect(messaggio).toBe("Password aggiornata. Accedi con la nuova password.");
    expect(chiamata()).toMatchObject({
      url: "/api/auth/password/reimposta", metodo: "POST", corpo: { token: "tok-123", nuovaPassword: "nuova-password" },
    });
  });

  it("token non valido: 400 con il messaggio del server", async () => {
    rispondiConErrore(400, "Il link non è valido o è scaduto. Richiedine uno nuovo.");
    await expect(recuperoApi.reimposta("vecchio", "nuova-password")).rejects.toMatchObject({
      status: 400, message: "Il link non è valido o è scaduto. Richiedine uno nuovo.",
    });
  });

  it("senza rete è un ApiError con status 0", async () => {
    fetchFinto.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(recuperoApi.reimposta("tok", "nuova-password")).rejects.toMatchObject({ status: 0 });
  });

  it("una risposta fuori forma è un ApiError", async () => {
    rispondi([]);
    await expect(recuperoApi.reimposta("tok", "nuova-password")).rejects.toBeInstanceOf(ApiError);
  });
});
