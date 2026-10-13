// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { EliminaAccount } from "../../src/components/profilo/EliminaAccount";
import { useAppStore } from "../../src/stores/useAppStore";
import { ApiError } from "../../src/services/api";
import { profiloApi } from "../../src/services/profiloApi";
import type { LegaMeta, User } from "../../src/types";

vi.mock("../../src/services/profiloApi", () => ({ profiloApi: { eliminaAccount: vi.fn() } }));
const elimina = vi.mocked(profiloApi.eliminaAccount);

const anna: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const lega = (id: string): LegaMeta => ({ id, nome: `Lega ${id}`, ts: 1, nTappe: 0 });
const TRE_LEGHE =
  "Le tue 3 leghe, con le loro tappe e le pubblicazioni in archivio, saranno eliminate per sempre, comprese le modifiche non ancora salvate. "
  + "I campetti e le schede dell'anagrafe che hai inserito restano, senza autore. Non si può annullare.";

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

function monta(utente: User, leghe: LegaMeta[] | null = []) {
  useAppStore.setState({ user: utente, leghe });
  render(
    <MemoryRouter initialEntries={["/profilo"]}>
      <Routes>
        <Route path="/profilo" element={<EliminaAccount />} />
        <Route path="*" element={<Dove />} />
      </Routes>
    </MemoryRouter>,
  );
}
const scrivi = (password: string) => fireEvent.change(screen.getByLabelText("Password attuale"), { target: { value: password } });
const pulsante = () => screen.getByRole("button", { name: "Elimina il mio account" }) as HTMLButtonElement;

describe("EliminaAccount: che cosa sparisce e che cosa resta", () => {
  it("con tre leghe lo dice sopra il campo, con i campetti e l'anagrafe che restano", () => {
    monta(anna, [lega("l1"), lega("l2"), lega("l3")]);
    expect(screen.getByText(TRE_LEGHE)).toBeTruthy();
  });

  it("senza leghe dice «Non hai leghe da eliminare»", () => {
    monta(anna, []);
    expect(screen.getByText(/^Non hai leghe da eliminare\./)).toBeTruthy();
  });

  it("se le leghe non si sono potute leggere non afferma che non ce ne sono", () => {
    monta(anna, null);
    expect(screen.queryByText(/Non hai leghe/)).toBeNull();
    expect(screen.getByText(/^Le tue leghe, con le loro tappe/)).toBeTruthy();
  });
});

describe("EliminaAccount: la conferma", () => {
  it("il pulsante è disattivato finché la password è vuota", () => {
    monta(anna);
    expect(pulsante().disabled).toBe(true);
    scrivi("la-mia-pass");
    expect(pulsante().disabled).toBe(false);
  });

  it("«Annulla» chiude la finestra senza chiamare il server", async () => {
    monta(anna, [lega("l1"), lega("l2"), lega("l3")]);
    scrivi("la-mia-pass");
    fireEvent.click(pulsante());
    const finestra = await screen.findByRole("alertdialog", { name: "Eliminare l'account?" });
    expect(within(finestra).getByText(TRE_LEGHE)).toBeTruthy();
    fireEvent.click(within(finestra).getByRole("button", { name: "Annulla" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(elimina).not.toHaveBeenCalled();
    expect(useAppStore.getState().user).toEqual(anna);
  });

  it("«Conferma» manda la password, svuota la sessione e porta alla home con «Account eliminato.»", async () => {
    elimina.mockResolvedValue(undefined);
    monta(anna);
    scrivi("la-mia-pass");
    fireEvent.click(pulsante());
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    expect((await screen.findByRole("status")).textContent).toBe('/ {"messaggio":"Account eliminato."}');
    expect(elimina).toHaveBeenCalledWith("la-mia-pass");
    expect(useAppStore.getState().user).toBeNull();
  });

  it("server a 400: il messaggio compare e l'utente resta dentro", async () => {
    elimina.mockRejectedValue(new ApiError(400, "La password attuale non è corretta"));
    monta(anna);
    scrivi("sbagliata");
    fireEvent.click(pulsante());
    fireEvent.click(await screen.findByRole("button", { name: "Conferma" }));
    expect((await screen.findByRole("alert", {}, { timeout: 2000 })).textContent).toBe("La password attuale non è corretta");
    expect(useAppStore.getState().user).toEqual(anna);
    expect(screen.queryByRole("status")).toBeNull(); // nessuna uscita
    expect(pulsante()).toBeTruthy();
  });
});

describe("EliminaAccount: l'ADMIN", () => {
  it("non si elimina dall'app: il motivo al posto del form", () => {
    monta({ ...anna, ruolo: "ADMIN" });
    expect(screen.getByText("L'account ADMIN si gestisce dalla configurazione del server.")).toBeTruthy();
    expect(screen.queryByLabelText("Password attuale")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
