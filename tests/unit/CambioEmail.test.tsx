// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CambioEmail } from "../../src/components/profilo/CambioEmail";
import { useAppStore } from "../../src/stores/useAppStore";
import { ApiError } from "../../src/services/api";
import { profiloApi } from "../../src/services/profiloApi";
import type { User } from "../../src/types";

vi.mock("../../src/services/profiloApi", () => ({ profiloApi: { richiediCambioEmail: vi.fn() } }));
const richiedi = vi.mocked(profiloApi.richiediCambioEmail);

const anna: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };
const MESSAGGIO = "Ti abbiamo inviato un link al nuovo indirizzo: aprilo entro 30 minuti per confermare il cambio.";

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(() => {
  cleanup();
  useAppStore.getState().reset();
});

function monta(utente: User) {
  useAppStore.setState({ user: utente });
  render(<CambioEmail />);
}
const campo = (etichetta: string) => screen.getByLabelText(etichetta) as HTMLInputElement;
function invia(nuova: string, password: string) {
  fireEvent.change(campo("Nuova email"), { target: { value: nuova } });
  fireEvent.change(campo("Password attuale"), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: "Invia il link di conferma" }));
}

describe("CambioEmail", () => {
  it("mostra l'email attuale come testo e i campi con gli autocomplete giusti", () => {
    monta(anna);
    expect(screen.getByText("anna@example.it")).toBeTruthy();
    expect(campo("Nuova email").autocomplete).toBe("email");
    expect(campo("Password attuale").autocomplete).toBe("current-password");
  });

  it("un'email non valida è rifiutata sotto il campo, senza chiamate", async () => {
    monta(anna);
    invia("non-una-mail", "la-mia-pass");
    expect(await screen.findByText("Mail non valida")).toBeTruthy();
    expect(richiedi).not.toHaveBeenCalled();
  });

  it("la password vuota è rifiutata", async () => {
    monta(anna);
    invia("nuova@example.it", "");
    expect(await screen.findByText("Inserisci la password attuale")).toBeTruthy();
    expect(richiedi).not.toHaveBeenCalled();
  });

  it("invio: manda email e password, mostra il messaggio del server e svuota i campi", async () => {
    richiedi.mockResolvedValue(MESSAGGIO);
    monta(anna);
    invia("nuova@example.it", "la-mia-pass");
    expect((await screen.findByRole("status")).textContent).toBe(MESSAGGIO);
    expect(richiedi).toHaveBeenCalledWith("nuova@example.it", "la-mia-pass");
    expect(campo("Nuova email").value).toBe("");
    expect(campo("Password attuale").value).toBe("");
    // L'email dell'account non cambia finché non si apre il link
    expect(useAppStore.getState().user?.email).toBe("anna@example.it");
  });

  it("409 (indirizzo già registrato): alert con il messaggio e campi ancora pieni", async () => {
    richiedi.mockRejectedValue(new ApiError(409, "Email nuova@example.it già registrata"));
    monta(anna);
    invia("nuova@example.it", "la-mia-pass");
    expect((await screen.findByRole("alert")).textContent).toBe("Email nuova@example.it già registrata");
    expect(campo("Nuova email").value).toBe("nuova@example.it");
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("l'ADMIN non cambia email dall'app: il motivo al posto del form", () => {
    monta({ ...anna, ruolo: "ADMIN" });
    expect(screen.getByText("L'account ADMIN si gestisce dalla configurazione del server.")).toBeTruthy();
    expect(screen.queryByLabelText("Nuova email")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
