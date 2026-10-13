// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CambioNome } from "../../src/components/profilo/CambioNome";
import { Header } from "../../src/components/layout/Header";
import { useAppStore, SESSION_KEY } from "../../src/stores/useAppStore";
import { ApiError } from "../../src/services/api";
import { profiloApi } from "../../src/services/profiloApi";
import type { User } from "../../src/types";

vi.mock("../../src/services/profiloApi", () => ({ profiloApi: { cambiaNome: vi.fn() } }));
const cambiaNome = vi.mocked(profiloApi.cambiaNome);

const anna: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  useAppStore.setState({ user: anna });
  // L'intestazione sta accanto alla scheda: il nome nuovo deve comparirci subito
  render(<MemoryRouter><Header /><CambioNome /></MemoryRouter>);
});
afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
  localStorage.clear();
});

const campo = () => screen.getByRole("textbox", { name: "Nome utente" }) as HTMLInputElement;
const scrivi = (testo: string) => fireEvent.change(campo(), { target: { value: testo } });
const salva = () => fireEvent.click(screen.getByRole("button", { name: /^Salva il nome|^Salvataggio in corso/ }));

describe("CambioNome", () => {
  it("parte dal nome attuale e accetta al massimo 80 caratteri", () => {
    expect(campo().value).toBe("Anna");
    expect(campo().maxLength).toBe(80);
  });

  it.each([["", "Inserisci il nome utente"], ["a", "Nome utente di almeno 2 caratteri"], ["a".repeat(81), "Nome utente di al massimo 80 caratteri"]])(
    "il nome «%#» è rifiutato sotto il campo, senza chiamate", async (nome, messaggio) => {
      scrivi(nome);
      salva();
      expect(await screen.findByText(messaggio)).toBeTruthy();
      expect(cambiaNome).not.toHaveBeenCalled();
    },
  );

  it("un nome di 80 caratteri si salva", async () => {
    const lungo = "a".repeat(80);
    cambiaNome.mockResolvedValue({ ...anna, name: lungo });
    scrivi(lungo);
    salva();
    await screen.findByRole("status");
    expect(cambiaNome).toHaveBeenCalledWith(lungo);
  });

  it("nome valido: PATCH, store, sessione del browser e intestazione mostrano il nome nuovo, con lo status", async () => {
    cambiaNome.mockResolvedValue({ ...anna, name: "Anna Rossi" });
    scrivi("Anna Rossi");
    salva();
    expect((await screen.findByRole("status")).textContent).toBe("Nome aggiornato.");
    expect(cambiaNome).toHaveBeenCalledWith("Anna Rossi");
    expect(useAppStore.getState().user?.name).toBe("Anna Rossi");
    expect(JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null").name).toBe("Anna Rossi");
    expect(screen.getAllByText("Anna Rossi").length).toBeGreaterThan(0); // l'intestazione, oltre al campo
  });

  it("server a 400: il messaggio compare com'è sotto il form e il campo tiene il testo", async () => {
    cambiaNome.mockRejectedValue(new ApiError(400, "Nome utente non valido"));
    scrivi("Anna Rossi");
    salva();
    expect((await screen.findByRole("alert")).textContent).toBe("Nome utente non valido");
    expect(campo().value).toBe("Anna Rossi");
    expect(useAppStore.getState().user?.name).toBe("Anna");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("durante l'attesa il pulsante è disattivato e dice che sta salvando", async () => {
    let finisci: (u: User) => void = () => {};
    cambiaNome.mockReturnValue(new Promise<User>((ok) => { finisci = ok; }));
    scrivi("Anna Rossi");
    salva();
    const pulsante = await screen.findByRole("button", { name: "Salvataggio in corso…" });
    expect((pulsante as HTMLButtonElement).disabled).toBe(true);
    finisci({ ...anna, name: "Anna Rossi" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Salva il nome" })).toBeTruthy());
  });
});
