// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AuthForm } from "../../src/components/auth/AuthForm";
import * as authService from "../../src/services/authService";

vi.mock("../../src/services/authService", () => ({
  register: vi.fn(), login: vi.fn(), me: vi.fn(), logout: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear(); // senza l'indizio di un account già usato, il form parte dalla registrazione
});
afterEach(cleanup);

function monta(stato?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/", state: stato }]}>
      <Routes>
        <Route path="/" element={<AuthForm />} />
        <Route path="/password-dimenticata" element={<p>Richiesta del link</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** La scheda «Registrati» o «Accedi» (le sole con aria-pressed) */
const scheda = (nome: string) => screen.getAllByRole("button", { name: nome }).find((b) => b.hasAttribute("aria-pressed"))!;

describe("AuthForm: recupero della password", () => {
  it("nella scheda «Accedi» c'è «Password dimenticata?», e apre la richiesta del link", async () => {
    monta();
    fireEvent.click(scheda("Accedi"));
    fireEvent.click(screen.getByRole("link", { name: "Password dimenticata?" }));
    expect(await screen.findByText("Richiesta del link")).toBeTruthy();
  });

  it("nella registrazione il link non c'è: chi si registra non ha una password da recuperare", () => {
    monta();
    expect(screen.queryByRole("link", { name: "Password dimenticata?" })).toBeNull();
  });

  it("arrivando dal link «Accedi» della nuova password (stato modo «login») il modulo parte dalla scheda «Accedi»", () => {
    monta({ modo: "login" });
    expect(scheda("Accedi").getAttribute("aria-pressed")).toBe("true");
  });

  it("senza quello stato, e senza un account già usato, il modulo parte dalla registrazione", () => {
    monta({ modo: "altro" });
    expect(scheda("Registrati").getAttribute("aria-pressed")).toBe("true");
  });

  it("la registrazione rifiuta una password oltre i 72 byte, come la nuova password", async () => {
    monta();
    fireEvent.change(screen.getByLabelText("Nome utente"), { target: { value: "Anna" } });
    fireEvent.change(screen.getByLabelText("Mail"), { target: { value: "anna@example.it" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "a".repeat(73) } });
    fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
    expect(await screen.findByText("Password di al massimo 72 byte")).toBeTruthy();
    expect(authService.register).not.toHaveBeenCalled();
  });
});
