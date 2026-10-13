// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProfiloPage } from "../../src/pages/ProfiloPage";
import { useAppStore } from "../../src/stores/useAppStore";
import { profiloApi } from "../../src/services/profiloApi";
import type { User } from "../../src/types";

vi.mock("../../src/services/profiloApi", () => ({
  profiloApi: { cambiaNome: vi.fn(), cambiaPassword: vi.fn(), richiediCambioEmail: vi.fn(), confermaEmail: vi.fn(), eliminaAccount: vi.fn() },
}));

const registrato: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const ospite: User = { name: "Ospite", guest: true };

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
});

function monta(utente: User) {
  useAppStore.setState({ user: utente });
  render(<MemoryRouter><ProfiloPage /></MemoryRouter>);
}

describe("ProfiloPage", () => {
  it("l'ospite legge che non ha un account da gestire: nessun campo, nessuna richiesta", () => {
    monta(ospite);
    expect(screen.getByText(/Sei entrato come Ospite: i tuoi dati restano in questo browser e non c'è un account da gestire/)).toBeTruthy();
    expect(screen.getByText(/Per averne uno, esci e scegli «Registrati»/)).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(Object.values(profiloApi).every((f) => vi.mocked(f).mock.calls.length === 0)).toBe(true);
  });

  it("il registrato vede il titolo, la sua email come testo e le schede Nome utente e Password", () => {
    monta(registrato);
    expect(screen.getByRole("heading", { name: "Il tuo account" })).toBeTruthy();
    // Sotto il titolo e nella scheda dell'email
    expect(screen.getAllByText("anna@example.it")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Nome utente" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Password" })).toBeTruthy();
  });

  it("le schede stanno nell'ordine Nome utente, Password, Email, Elimina account", () => {
    monta(registrato);
    const nomi = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(nomi).toEqual(["Nome utente", "Password", "Email", "Elimina account"]);
  });

  it("nome ed email scritti dall'utente si mostrano solo come testo, mai come HTML", () => {
    monta({ ...registrato, name: "<img src=x onerror=alert(1)>", email: "<b>x</b>@example.it" });
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector("b")).toBeNull();
    expect(screen.getAllByText("<b>x</b>@example.it")).toHaveLength(2);
  });
});
