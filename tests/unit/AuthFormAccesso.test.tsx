// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthForm } from "../../src/components/auth/AuthForm";
import { ApiError } from "../../src/services/api";
import * as authService from "../../src/services/authService";
import { legheApi } from "../../src/services/legheApi";
import { useAppStore } from "../../src/stores/useAppStore";
import type { User } from "../../src/types";

// Si sostituiscono solo la rete (accesso e leghe): form, hook useAuth, validazione e store sono quelli veri
vi.mock("../../src/services/authService", () => ({
  register: vi.fn(), login: vi.fn(), me: vi.fn(), logout: vi.fn(),
}));
vi.mock("../../src/services/legheApi", () => ({
  legheApi: {
    list: vi.fn(), create: vi.fn(), get: vi.fn(), rename: vi.fn(), remove: vi.fn(),
    addTappa: vi.fn(), putTappa: vi.fn(), removeTappa: vi.fn(),
  },
}));

const register = vi.mocked(authService.register);
const login = vi.mocked(authService.login);
const utente: User = { id: "u1", name: "Anna", email: "anna@example.it", ruolo: "USER", guest: false };

/** Dove il form ricorda che su questo browser c'è già un account (AuthForm): chi ce l'ha parte da «Accedi» */
const INDIZIO_ACCOUNT = "hoop3x3_has_account";

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear(); // senza l'indizio di un account già usato, il form parte dalla registrazione
  vi.mocked(legheApi.list).mockResolvedValue([]); // dopo l'accesso lo store carica le leghe: nessuna
});

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
  localStorage.clear();
});

/** Mostra lo stato della navigazione di adesso (JSON): «null» quando il form lo ha tolto dalla cronologia */
function StatoNavigazione() {
  return <output>{JSON.stringify(useLocation().state)}</output>;
}

/** Mostra il form su «/», con la pagina delle leghe su «/lega» per vedere dove porta. `stato` è quello della navigazione */
function monta(stato?: unknown) {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/", state: stato }]}>
      <Routes>
        <Route path="/" element={<AuthForm />} />
        <Route path="/lega" element={<p>Elenco delle leghe</p>} />
      </Routes>
      <StatoNavigazione />
    </MemoryRouter>,
  );
}

/** Come si arriva al form di chi ha già un account su questo browser */
function montaPerChiHaUnAccount() {
  localStorage.setItem(INDIZIO_ACCOUNT, "1");
  monta();
}

const scrivi = (etichetta: string, testo: string) =>
  fireEvent.change(screen.getByLabelText(etichetta), { target: { value: testo } });

/** Compila e invia la registrazione */
function registra(nome: string, mail: string, password: string) {
  scrivi("Nome utente", nome);
  scrivi("Mail", mail);
  scrivi("Password", password);
  fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
}

/** «Accedi» è anche la scheda del form: si preme il pulsante che lo invia */
const inviaAccesso = () =>
  fireEvent.click(screen.getAllByRole("button", { name: "Accedi" }).find((b) => b.getAttribute("type") === "submit")!);

/** Compila e invia l'accesso */
function accedi(mail: string, password: string) {
  scrivi("Mail", mail);
  scrivi("Password", password);
  inviaAccesso();
}

/** La scheda «Registrati» o «Accedi» (le sole con aria-pressed): in «Accedi» c'è anche il pulsante che invia il modulo */
const scheda = (nome: string) => screen.getAllByRole("button", { name: nome }).find((b) => b.hasAttribute("aria-pressed"))!;

describe("AuthForm: registrazione", () => {
  it("senza un account già usato su questo browser parte dalla registrazione", () => {
    monta();
    expect(scheda("Registrati").getAttribute("aria-pressed")).toBe("true");
    expect(scheda("Accedi").getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByLabelText("Nome utente")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Crea account" })).toBeTruthy();
  });

  it("con tutti i campi vuoti i messaggi compaiono insieme, e niente parte verso il server", async () => {
    monta();
    fireEvent.click(screen.getByRole("button", { name: "Crea account" }));
    expect(await screen.findByText("Inserisci il nome utente")).toBeTruthy();
    expect(screen.getByText("Mail non valida")).toBeTruthy();
    expect(screen.getByText("Password di almeno 8 caratteri")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("una mail senza dominio è rifiutata prima dell'invio, con il motivo", async () => {
    monta();
    registra("Anna", "anna@", "password-lunga");
    expect(await screen.findByText("Mail non valida")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("una password di 7 caratteri è rifiutata", async () => {
    monta();
    registra("Anna", "anna@example.it", "1234567");
    expect(await screen.findByText("Password di almeno 8 caratteri")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("con 8 caratteri la password basta: la registrazione parte, e porta alle leghe", async () => {
    register.mockResolvedValue(utente);
    monta();
    registra("Anna", "anna@example.it", "12345678");
    expect(await screen.findByText("Elenco delle leghe")).toBeTruthy();
    expect(register).toHaveBeenCalledWith("Anna", "anna@example.it", "12345678");
  });

  it("registrata, l'utente entra e il browser ricorda l'account: la prossima volta si parte da «Accedi»", async () => {
    register.mockResolvedValue(utente);
    monta();
    registra("Anna", "anna@example.it", "password-lunga");
    await screen.findByText("Elenco delle leghe");
    expect(useAppStore.getState().user).toEqual(utente);
    expect(localStorage.getItem(INDIZIO_ACCOUNT)).toBe("1");
  });

  it("se il server rifiuta mostra il suo messaggio, resta sul form e non ricorda nessun account", async () => {
    register.mockRejectedValue(new ApiError(409, "Email già registrata"));
    monta();
    registra("Anna", "anna@example.it", "password-lunga");
    expect((await screen.findByRole("alert")).textContent).toBe("Email già registrata");
    expect(screen.queryByText("Elenco delle leghe")).toBeNull();
    expect(useAppStore.getState().user).toBeNull();
    expect(localStorage.getItem(INDIZIO_ACCOUNT)).toBeNull();
  });

  it("un errore che non viene dal server (rete caduta nel browser) dà un messaggio generico, non il testo tecnico", async () => {
    register.mockRejectedValue(new TypeError("Failed to fetch"));
    monta();
    registra("Anna", "anna@example.it", "password-lunga");
    expect((await screen.findByRole("alert")).textContent).toBe("errore imprevisto"); // il generico di testoErrore, lo stesso di tutta l'app
  });
});

describe("AuthForm: accesso", () => {
  it("con un account già usato su questo browser parte da «Accedi»: solo mail e password", () => {
    montaPerChiHaUnAccount();
    expect(scheda("Accedi").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Mail")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.queryByLabelText("Nome utente")).toBeNull();
  });

  it("senza mail valida e senza password dice che cosa manca, e niente parte verso il server", async () => {
    montaPerChiHaUnAccount();
    accedi("anna", "");
    expect(await screen.findByText("Mail non valida")).toBeTruthy();
    expect(screen.getByText("Inserisci la password")).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it("la regola degli 8 caratteri è solo della registrazione: chi accede può avere una password più corta", async () => {
    login.mockResolvedValue(utente);
    montaPerChiHaUnAccount();
    accedi("anna@example.it", "x");
    await waitFor(() => expect(login).toHaveBeenCalledWith("anna@example.it", "x"));
    await screen.findByText("Elenco delle leghe");
  });

  it("accesso riuscito: l'utente entra, il browser ricorda l'account e si va alle leghe", async () => {
    login.mockResolvedValue(utente);
    montaPerChiHaUnAccount();
    accedi("anna@example.it", "password-lunga");
    expect(await screen.findByText("Elenco delle leghe")).toBeTruthy();
    expect(useAppStore.getState().user).toEqual(utente);
    expect(localStorage.getItem(INDIZIO_ACCOUNT)).toBe("1");
  });

  it("credenziali sbagliate: compare il messaggio del server e nessuno risulta entrato", async () => {
    login.mockRejectedValue(new ApiError(401, "Mail o password errate"));
    montaPerChiHaUnAccount();
    accedi("anna@example.it", "sbagliata");
    expect((await screen.findByRole("alert")).textContent).toBe("Mail o password errate");
    expect(screen.queryByText("Elenco delle leghe")).toBeNull();
    expect(useAppStore.getState().user).toBeNull();
  });

  it("passando da una scheda all'altra l'errore del server sparisce", async () => {
    login.mockRejectedValue(new ApiError(401, "Mail o password errate"));
    montaPerChiHaUnAccount();
    accedi("anna@example.it", "sbagliata");
    await screen.findByRole("alert");
    fireEvent.click(scheda("Registrati"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Nome utente")).toBeTruthy();
  });

  it("un nuovo tentativo toglie l'errore del primo mentre il server risponde", async () => {
    login.mockRejectedValueOnce(new ApiError(401, "Mail o password errate"));
    montaPerChiHaUnAccount();
    accedi("anna@example.it", "sbagliata");
    await screen.findByRole("alert");
    // Il server non ha ancora risposto al secondo tentativo: il messaggio del primo non c'è più
    let rispondi!: (u: User) => void;
    login.mockReturnValue(new Promise<User>((ok) => { rispondi = ok; }));
    accedi("anna@example.it", "giusta-adesso");
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    rispondi(utente);
    await screen.findByText("Elenco delle leghe");
  });
});

describe("AuthForm: ospite e avvisi", () => {
  it("«Continua come Ospite» entra senza account e porta alle leghe", async () => {
    monta();
    fireEvent.click(screen.getByRole("button", { name: "Continua come Ospite" }));
    expect(await screen.findByText("Elenco delle leghe")).toBeTruthy();
    expect(useAppStore.getState().user).toEqual({ name: "Ospite", guest: true });
    expect(register).not.toHaveBeenCalled();
    expect(login).not.toHaveBeenCalled();
  });

  it("il messaggio arrivato con la navigazione (sessione scaduta) compare sopra il form e resta anche dopo che lo stato è stato tolto dalla cronologia", async () => {
    const messaggio = "La sessione è scaduta: accedi di nuovo.";
    monta({ messaggio });
    expect((await screen.findByRole("alert")).textContent).toBe(messaggio);
    // Il form toglie lo stato dalla cronologia (ricaricando la pagina il messaggio non ricompare): si aspetta che l'abbia fatto
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("null"));
    // ...e il messaggio c'è ancora: il form se n'è tenuto una copia finché si sta sul form
    expect(screen.getByRole("alert").textContent).toBe(messaggio);
  });

  it("uno stato della navigazione senza messaggio testuale non mostra nessun avviso", () => {
    monta({ messaggio: 42 });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
