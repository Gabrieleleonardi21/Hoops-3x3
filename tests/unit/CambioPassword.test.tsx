// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CambioPassword } from "../../src/components/profilo/CambioPassword";
import { useAppStore } from "../../src/stores/useAppStore";
import { ApiError } from "../../src/services/api";
import { profiloApi } from "../../src/services/profiloApi";
import type { User } from "../../src/types";

vi.mock("../../src/services/profiloApi", () => ({ profiloApi: { cambiaPassword: vi.fn() } }));
const cambiaPassword = vi.mocked(profiloApi.cambiaPassword);

const anna: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  useAppStore.setState({ user: anna });
  render(<CambioPassword />);
});
afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
  localStorage.clear();
});

const campo = (etichetta: string) => screen.getByLabelText(etichetta) as HTMLInputElement;
function invia(attuale: string, nuova: string, ripetuta: string) {
  fireEvent.change(campo("Password attuale"), { target: { value: attuale } });
  fireEvent.change(campo("Nuova password"), { target: { value: nuova } });
  fireEvent.change(campo("Ripeti la password"), { target: { value: ripetuta } });
  fireEvent.click(screen.getByRole("button", { name: "Cambia la password" }));
}

describe("CambioPassword", () => {
  it("i campi hanno gli autocomplete giusti per il gestore delle password", () => {
    expect(campo("Password attuale").autocomplete).toBe("current-password");
    expect(campo("Nuova password").autocomplete).toBe("new-password");
    expect(campo("Ripeti la password").autocomplete).toBe("new-password");
  });

  it("due password diverse sono rifiutate prima dell'invio", async () => {
    invia("vecchia-pass", "nuova-pass-1", "altra-pass-1");
    expect(await screen.findByText("Le due password non coincidono")).toBeTruthy();
    expect(cambiaPassword).not.toHaveBeenCalled();
  });

  it("la password attuale vuota è rifiutata", async () => {
    invia("", "nuova-pass-1", "nuova-pass-1");
    expect(await screen.findByText("Inserisci la password attuale")).toBeTruthy();
    expect(cambiaPassword).not.toHaveBeenCalled();
  });

  it("la nuova password segue le regole della registrazione", async () => {
    invia("vecchia-pass", "corta", "corta");
    expect(await screen.findByText("Password di almeno 8 caratteri")).toBeTruthy();
    expect(cambiaPassword).not.toHaveBeenCalled();
  });

  it("successo: manda le due password, aggiorna l'utente, svuota i campi e dice che gli altri dispositivi sono scollegati", async () => {
    cambiaPassword.mockResolvedValue({ ...anna });
    invia("vecchia-pass", "nuova-pass-1", "nuova-pass-1");
    expect((await screen.findByRole("status")).textContent).toBe("Password aggiornata. Gli altri dispositivi sono stati scollegati.");
    expect(cambiaPassword).toHaveBeenCalledWith("vecchia-pass", "nuova-pass-1");
    expect(campo("Password attuale").value).toBe("");
    expect(campo("Nuova password").value).toBe("");
    expect(campo("Ripeti la password").value).toBe("");
    expect(useAppStore.getState().user).toEqual(anna);
  });

  it("400 «La password attuale non è corretta»: alert e campi ancora pieni", async () => {
    cambiaPassword.mockRejectedValue(new ApiError(400, "La password attuale non è corretta"));
    invia("sbagliata", "nuova-pass-1", "nuova-pass-1");
    expect((await screen.findByRole("alert")).textContent).toBe("La password attuale non è corretta");
    expect(campo("Password attuale").value).toBe("sbagliata");
    expect(campo("Nuova password").value).toBe("nuova-pass-1");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
