// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthForm } from "../../src/components/auth/AuthForm";
import { ApiError } from "../../src/services/api";
import * as authService from "../../src/services/authService";
import { useAppStore } from "../../src/stores/useAppStore";

// Si sostituisce solo il servizio di autenticazione: form, hook useAuth e validazione sono quelli veri
vi.mock("../../src/services/authService", () => ({
  register: vi.fn(), login: vi.fn(), me: vi.fn(), logout: vi.fn(),
}));

const register = vi.mocked(authService.register);

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear(); // senza l'indizio di un account già usato, il form parte dalla registrazione
  // Il server rifiuta sempre: i dati che passano la validazione si fermano lì, senza caricare le leghe
  register.mockRejectedValue(new ApiError(409, "Email già registrata"));
  render(<MemoryRouter><AuthForm /></MemoryRouter>);
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
  localStorage.clear();
});

const scrivi = (etichetta: string, testo: string) =>
  fireEvent.change(screen.getByLabelText(etichetta), { target: { value: testo } });

/** Compila la registrazione con questo nome utente (mail e password valide) e la invia */
function registra(nome: string) {
  scrivi("Nome utente", nome);
  scrivi("Mail", "anna@example.it");
  scrivi("Password", "password-lunga");
  fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
}

describe("AuthForm: nome utente come sul server (RegisterRequestDTO: da 2 a 80 caratteri)", () => {
  it("un solo carattere è rifiutato prima dell'invio, con il motivo", async () => {
    registra("A");
    expect(await screen.findByText("Nome utente di almeno 2 caratteri")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("con 2 caratteri la registrazione parte", async () => {
    registra("Al");
    await waitFor(() => expect(register).toHaveBeenCalledWith("Al", "anna@example.it", "password-lunga"));
    // La risposta del server (finta) arriva al form: il percorso è finito, nessun aggiornamento resta in sospeso
    expect(await screen.findByText("Email già registrata")).toBeTruthy();
  });

  it("vuoto dice ancora «Inserisci il nome utente»", async () => {
    registra("");
    expect(await screen.findByText("Inserisci il nome utente")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("il campo non accetta più di 80 caratteri", () => {
    expect((screen.getByLabelText("Nome utente") as HTMLInputElement).maxLength).toBe(80);
  });
});
