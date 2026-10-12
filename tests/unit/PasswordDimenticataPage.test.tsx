// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PasswordDimenticataPage } from "../../src/pages/PasswordDimenticataPage";
import { ApiError } from "../../src/services/api";
import { recuperoApi } from "../../src/services/recuperoApi";

// Si sostituisce solo la rete: pagina, validazione e hook sono quelli veri
vi.mock("../../src/services/recuperoApi", () => ({ recuperoApi: { richiediLink: vi.fn(), reimposta: vi.fn() } }));
const richiediLink = vi.mocked(recuperoApi.richiediLink);

const MESSAGGIO = "Se l'email è registrata, riceverai un link per reimpostare la password.";

beforeEach(() => {
  vi.resetAllMocks();
});
afterEach(cleanup);

function monta() {
  render(
    <MemoryRouter initialEntries={["/password-dimenticata"]}>
      <Routes>
        <Route path="/password-dimenticata" element={<PasswordDimenticataPage />} />
        <Route path="/" element={<p>Schermata di accesso</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const invia = (mail: string) => {
  fireEvent.change(screen.getByLabelText("Mail"), { target: { value: mail } });
  fireEvent.click(screen.getByRole("button", { name: "Invia il link" }));
};

describe("PasswordDimenticataPage", () => {
  it("mostra il campo mail e il pulsante «Invia il link»", () => {
    monta();
    expect(screen.getByLabelText("Mail")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invia il link" })).toBeTruthy();
  });

  it("una mail non valida è rifiutata prima dell'invio, con il motivo", async () => {
    monta();
    invia("anna@");
    expect(await screen.findByText("Mail non valida")).toBeTruthy();
    expect(richiediLink).not.toHaveBeenCalled();
  });

  it("invia la mail e mostra il messaggio del server, con il ritorno all'accesso", async () => {
    richiediLink.mockResolvedValue(MESSAGGIO);
    monta();
    invia("anna@example.it");
    expect(await screen.findByText(MESSAGGIO)).toBeTruthy();
    expect(richiediLink).toHaveBeenCalledWith("anna@example.it");
    expect(screen.queryByRole("button", { name: "Invia il link" })).toBeNull();
    fireEvent.click(screen.getByRole("link", { name: /Torna all'accesso/ }));
    expect(await screen.findByText("Schermata di accesso")).toBeTruthy();
  });

  it("il messaggio è lo stesso per qualunque mail: la pagina non distingue le mail registrate", async () => {
    richiediLink.mockResolvedValue(MESSAGGIO);
    monta();
    invia("esiste@example.it");
    const primo = (await screen.findByText(MESSAGGIO)).textContent;
    cleanup();
    monta();
    invia("non-esiste@example.it");
    expect((await screen.findByText(MESSAGGIO)).textContent).toBe(primo);
  });

  it("mentre aspetta il server il pulsante è disattivato e dice «Invio in corso…»", async () => {
    let finisci: (m: string) => void = () => {};
    richiediLink.mockReturnValue(new Promise<string>((resolve) => { finisci = resolve; }));
    monta();
    invia("anna@example.it");
    const pulsante = await screen.findByRole("button", { name: "Invio in corso…" });
    expect((pulsante as HTMLButtonElement).disabled).toBe(true);
    finisci(MESSAGGIO);
    expect(await screen.findByText(MESSAGGIO)).toBeTruthy();
  });

  it("senza rete l'errore si vede e «Riprova» ripete l'invio con la stessa mail", async () => {
    richiediLink.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile: controlla la connessione e riprova."));
    richiediLink.mockResolvedValueOnce(MESSAGGIO);
    monta();
    invia("anna@example.it");
    expect(await screen.findByText("Server non raggiungibile: controlla la connessione e riprova.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByText(MESSAGGIO)).toBeTruthy();
    expect(richiediLink).toHaveBeenCalledTimes(2);
    expect(richiediLink).toHaveBeenLastCalledWith("anna@example.it");
  });

  it("un rifiuto del server (400) mostra il suo messaggio, senza «Riprova», e il form resta", async () => {
    richiediLink.mockRejectedValue(new ApiError(400, "Mail non valida"));
    monta();
    invia("anna@example.it");
    await waitFor(() => expect(screen.getAllByText("Mail non valida").length).toBeGreaterThan(0));
    expect(screen.queryByRole("button", { name: "Riprova" })).toBeNull();
    expect(screen.getByRole("button", { name: "Invia il link" })).toBeTruthy();
  });
});
