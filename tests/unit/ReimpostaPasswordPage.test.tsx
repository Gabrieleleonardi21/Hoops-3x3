// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ReimpostaPasswordPage } from "../../src/pages/ReimpostaPasswordPage";
import { ApiError } from "../../src/services/api";
import { recuperoApi } from "../../src/services/recuperoApi";

vi.mock("../../src/services/recuperoApi", () => ({ recuperoApi: { richiediLink: vi.fn(), reimposta: vi.fn() } }));
const reimposta = vi.mocked(recuperoApi.reimposta);

const LINK_NON_VALIDO = "Il link non è valido o è scaduto. Richiedine uno nuovo.";
const SUCCESSO = "Password aggiornata. Accedi con la nuova password.";

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

/** Dove si è finiti: percorso e stato della navigazione (JSON) */
function Dove() {
  const { pathname, state } = useLocation();
  return <output>{`${pathname} ${JSON.stringify(state)}`}</output>;
}

function monta(ricerca: string) {
  render(
    <MemoryRouter initialEntries={[`/reimposta-password${ricerca}`]}>
      <Routes>
        <Route path="/reimposta-password" element={<ReimpostaPasswordPage />} />
        <Route path="*" element={<Dove />} />
      </Routes>
    </MemoryRouter>,
  );
}

const scrivi = (etichetta: string, testo: string) =>
  fireEvent.change(screen.getByLabelText(etichetta), { target: { value: testo } });
function invia(nuova: string, ripetuta: string) {
  scrivi("Nuova password", nuova);
  scrivi("Ripeti la password", ripetuta);
  fireEvent.click(screen.getByRole("button", { name: "Imposta la password" }));
}

describe("ReimpostaPasswordPage: senza token", () => {
  it.each(["", "?token=", "?altro=1"])("con «%s» dice subito che il link non è valido, senza campi", (ricerca) => {
    monta(ricerca);
    expect(screen.getByText("Il link non è valido")).toBeTruthy();
    expect(screen.queryByLabelText("Nuova password")).toBeNull();
    expect(reimposta).not.toHaveBeenCalled();
  });

  it("il pulsante per richiedere un nuovo link porta alla richiesta", async () => {
    monta("");
    fireEvent.click(screen.getByRole("link", { name: "Richiedi un nuovo link" }));
    expect((await screen.findByRole("status")).textContent).toContain("/password-dimenticata");
  });
});

describe("ReimpostaPasswordPage: con il token", () => {
  it("mostra i due campi e legge il token dall'indirizzo", async () => {
    reimposta.mockResolvedValue(SUCCESSO);
    monta("?token=abc%20123");
    invia("nuova-password", "nuova-password");
    await screen.findByText(SUCCESSO);
    expect(reimposta).toHaveBeenCalledWith("abc 123", "nuova-password");
  });

  it("le due password diverse sono rifiutate prima dell'invio", async () => {
    monta("?token=abc");
    invia("nuova-password", "altra-password");
    expect(await screen.findByText("Le due password non coincidono")).toBeTruthy();
    expect(reimposta).not.toHaveBeenCalled();
  });

  it("la password corta o oltre i 72 byte è rifiutata con le regole della registrazione", async () => {
    monta("?token=abc");
    invia("1234567", "1234567");
    expect(await screen.findByText("Password di almeno 8 caratteri")).toBeTruthy();
    cleanup();
    monta("?token=abc");
    invia("a".repeat(73), "a".repeat(73));
    expect(await screen.findByText("Password di al massimo 72 byte")).toBeTruthy();
    expect(reimposta).not.toHaveBeenCalled();
  });

  it("successo: mostra il messaggio del server e «Accedi» porta alla schermata di accesso, sulla scheda «Accedi»", async () => {
    reimposta.mockResolvedValue(SUCCESSO);
    monta("?token=abc");
    invia("nuova-password", "nuova-password");
    expect(await screen.findByText(SUCCESSO)).toBeTruthy();
    expect(screen.queryByLabelText("Nuova password")).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: "Accedi" }));
    expect((await screen.findByRole("status")).textContent).toBe('/ {"modo":"login"}');
  });

  it("token respinto (400): messaggio del server e link per richiederne uno nuovo", async () => {
    reimposta.mockRejectedValue(new ApiError(400, LINK_NON_VALIDO));
    monta("?token=scaduto");
    invia("nuova-password", "nuova-password");
    expect(await screen.findByText(LINK_NON_VALIDO)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Richiedi un nuovo link" })).toBeTruthy();
  });

  it("senza rete l'errore si vede e il form resta, per riprovare", async () => {
    reimposta.mockRejectedValue(new ApiError(0, "Server non raggiungibile: controlla la connessione e riprova."));
    monta("?token=abc");
    invia("nuova-password", "nuova-password");
    expect(await screen.findByText("Server non raggiungibile: controlla la connessione e riprova.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Imposta la password" })).toBeTruthy();
  });
});
