// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthForm } from "../../src/components/auth/AuthForm";
import { useAppStore } from "../../src/stores/useAppStore";

// Il form, useAuth, authService e api sono quelli veri: si finge solo il server (fetch) e il browser senza più spazio

/** Il server risponde che registrazione e accesso sono riusciti, con il JWT da salvare */
const fetchFinto = vi.fn(async () => new Response(
  JSON.stringify({ token: "jwt-nuovo", user: { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER" } }),
  { status: 200, headers: { "Content-Type": "application/json" } },
));

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("fetch", fetchFinto);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  useAppStore.getState().reset();
  localStorage.clear();
});

/** Da qui il browser rifiuta ogni scrittura */
const spazioFinito = () => vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
  throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
});

const scrivi = (etichetta: string, testo: string) =>
  fireEvent.change(screen.getByLabelText(etichetta), { target: { value: testo } });

describe("AuthForm con lo spazio del browser finito (FS-9)", () => {
  it("registrazione: il motivo vero compare nel form, e nessuno risulta entrato", async () => {
    render(<MemoryRouter><AuthForm /></MemoryRouter>);
    spazioFinito();
    scrivi("Nome utente", "Anna");
    scrivi("Mail", "anna@example.it");
    scrivi("Password", "password-lunga");
    fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/spazio esaurito/i);
    expect(screen.queryByText(/Errore imprevisto/)).toBeNull();
    expect(useAppStore.getState().user).toBeNull();
  });

  it("accesso: il motivo vero compare nel form", async () => {
    localStorage.setItem("hoop3x3_has_account", "1"); // chi ha già un account parte da «Accedi»
    render(<MemoryRouter><AuthForm /></MemoryRouter>);
    spazioFinito();
    scrivi("Mail", "anna@example.it");
    scrivi("Password", "password-lunga");
    // «Accedi» è anche la scheda del form: si preme il pulsante che lo invia
    fireEvent.click(screen.getAllByRole("button", { name: "Accedi" }).find((b) => b.getAttribute("type") === "submit")!);
    expect((await screen.findByRole("alert")).textContent).toMatch(/spazio esaurito/i);
    expect(screen.queryByText(/Errore imprevisto/)).toBeNull();
    expect(useAppStore.getState().user).toBeNull();
  });
});
