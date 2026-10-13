// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ConfermaEmailPage } from "../../src/pages/ConfermaEmailPage";
import { useAppStore, SESSION_KEY } from "../../src/stores/useAppStore";
import { ApiError } from "../../src/services/api";
import { profiloApi } from "../../src/services/profiloApi";
import * as authService from "../../src/services/authService";
import type { User } from "../../src/types";

vi.mock("../../src/services/profiloApi", () => ({ profiloApi: { confermaEmail: vi.fn() } }));
vi.mock("../../src/services/authService", () => ({ register: vi.fn(), login: vi.fn(), me: vi.fn(), logout: vi.fn() }));
const conferma = vi.mocked(profiloApi.confermaEmail);
const me = vi.mocked(authService.me);

const anna: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const SUCCESSO = "Email aggiornata: da ora accedi con il nuovo indirizzo.";
const LINK_NON_VALIDO = "Il link non è valido o è scaduto. Richiedine uno nuovo.";

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
  localStorage.clear();
});

/** Dove si è finiti: percorso e stato della navigazione (JSON) */
function Dove() {
  const { pathname, state } = useLocation();
  return <output>{`${pathname} ${JSON.stringify(state)}`}</output>;
}

function monta(ricerca: string, utente: User | null = null) {
  useAppStore.setState({ user: utente });
  render(
    <MemoryRouter initialEntries={[`/conferma-email${ricerca}`]}>
      <Routes>
        <Route path="/conferma-email" element={<ConfermaEmailPage />} />
        <Route path="*" element={<Dove />} />
      </Routes>
    </MemoryRouter>,
  );
}
const premiConferma = () => fireEvent.click(screen.getByRole("button", { name: "Conferma l'indirizzo" }));

describe("ConfermaEmailPage: senza token", () => {
  it.each(["", "?token=", "?altro=1"])("con «%s» dice che il link non è valido, senza pulsante né chiamate", (ricerca) => {
    monta(ricerca);
    expect(screen.getByText("Il link non è valido")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Conferma l'indirizzo" })).toBeNull();
    expect(conferma).not.toHaveBeenCalled();
  });

  it("chi non è entrato trova «Accedi», che porta al modulo sulla scheda «Accedi»", async () => {
    monta("");
    fireEvent.click(screen.getByRole("link", { name: "Accedi" }));
    expect((await screen.findByRole("status")).textContent).toBe('/ {"modo":"login"}');
  });

  it("chi è entrato trova «Vai al profilo»", async () => {
    monta("", anna);
    fireEvent.click(screen.getByRole("link", { name: "Vai al profilo" }));
    expect((await screen.findByRole("status")).textContent).toContain("/profilo");
  });
});

describe("ConfermaEmailPage: con il token", () => {
  it("aprire il link non manda niente: serve il clic su «Conferma l'indirizzo»", () => {
    monta("?token=abc");
    expect(screen.getByText("Stai per confermare il nuovo indirizzo email del tuo account HOOP 3X3.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conferma l'indirizzo" })).toBeTruthy();
    expect(conferma).not.toHaveBeenCalled();
    expect(me).not.toHaveBeenCalled();
  });

  it("al clic manda il token dall'indirizzo e mostra il messaggio del server; senza utente «Accedi» porta al modulo", async () => {
    conferma.mockResolvedValue(SUCCESSO);
    monta("?token=abc%20123");
    premiConferma();
    expect((await screen.findByRole("status")).textContent).toBe(SUCCESSO);
    expect(conferma).toHaveBeenCalledWith("abc 123");
    expect(me).not.toHaveBeenCalled(); // nessun utente registrato in questo browser: niente da aggiornare
    expect(screen.queryByRole("button", { name: "Conferma l'indirizzo" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Accedi" }));
    expect((await screen.findByRole("status")).textContent).toBe('/ {"modo":"login"}');
  });

  it("con un registrato nello store rilegge l'utente dal server: la sessione ha l'email nuova senza ricaricare", async () => {
    conferma.mockResolvedValue(SUCCESSO);
    me.mockResolvedValue({ esito: "valida", user: { ...anna, email: "nuova@example.it" } });
    monta("?token=abc", anna);
    premiConferma();
    await screen.findByText(SUCCESSO);
    await waitFor(() => expect(useAppStore.getState().user?.email).toBe("nuova@example.it"));
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null").email).toBe("nuova@example.it");
    expect(screen.getByRole("link", { name: "Vai al profilo" })).toBeTruthy();
  });

  it("se la sessione non si può rileggere (scaduta, rete) la conferma resta riuscita e l'utente com'era", async () => {
    conferma.mockResolvedValue(SUCCESSO);
    me.mockResolvedValue({ esito: "irraggiungibile" });
    monta("?token=abc", anna);
    premiConferma();
    expect((await screen.findByRole("status")).textContent).toBe(SUCCESSO);
    await waitFor(() => expect(me).toHaveBeenCalled());
    expect(useAppStore.getState().user).toEqual(anna);
  });

  it.each([[400, LINK_NON_VALIDO], [409, "Email nuova@example.it già registrata"]])(
    "%i: il messaggio del server compare com'è, con il collegamento per proseguire", async (status, messaggio) => {
      conferma.mockRejectedValue(new ApiError(status, messaggio));
      monta("?token=abc", anna);
      premiConferma();
      expect((await screen.findByRole("alert")).textContent).toBe(messaggio);
      expect(screen.getByRole("link", { name: "Vai al profilo" })).toBeTruthy();
      expect(me).not.toHaveBeenCalled();
    },
  );

  it("senza rete l'errore si vede e il pulsante resta, per riprovare", async () => {
    conferma.mockRejectedValue(new ApiError(0, "Server non raggiungibile: controlla la connessione e riprova."));
    monta("?token=abc");
    premiConferma();
    expect(await screen.findByText("Server non raggiungibile: controlla la connessione e riprova.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Conferma l'indirizzo" })).toBeTruthy();
  });
});
