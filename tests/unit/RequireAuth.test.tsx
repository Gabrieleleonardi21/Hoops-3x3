// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { RequireAuth } from "../../src/components/auth/RequireAuth";
import { useUtente } from "../../src/hooks/useUtente";
import { useAppStore } from "../../src/stores/useAppStore";

afterEach(() => {
  cleanup();
  useAppStore.setState({ user: null });
});

/** La home e una pagina riservata, come in App */
function apri(percorso: string) {
  render(
    <MemoryRouter initialEntries={[percorso]}>
      <Routes>
        <Route path="/" element={<p>Home con l'accesso</p>} />
        <Route element={<RequireAuth />}>
          <Route path="/leghe" element={<p>Le mie leghe</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth: le pagine riservate a chi è entrato", () => {
  it("senza utente si torna alla home, che mostra l'accesso", () => {
    apri("/leghe");
    expect(screen.getByText("Home con l'accesso")).toBeTruthy();
    expect(screen.queryByText("Le mie leghe")).toBeNull();
  });

  it("con un utente, anche ospite, la pagina si apre", () => {
    useAppStore.setState({ user: { name: "Ospite", guest: true } });
    apri("/leghe");
    expect(screen.getByText("Le mie leghe")).toBeTruthy();
  });
});

/** Una pagina riservata che legge il suo utente */
function PaginaRiservata() {
  const utente = useUtente();
  return <p>Ciao {utente.name}</p>;
}

describe("useUtente: l'utente delle pagine riservate", () => {
  it("all'uscita la pagina aperta non va in errore: si torna alla home", () => {
    useAppStore.setState({ user: { name: "Anna", guest: true } });
    render(
      <MemoryRouter initialEntries={["/leghe"]}>
        <Routes>
          <Route path="/" element={<p>Home con l'accesso</p>} />
          <Route element={<RequireAuth />}>
            <Route path="/leghe" element={<PaginaRiservata />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Ciao Anna")).toBeTruthy();
    act(() => { useAppStore.setState({ user: null }); });
    expect(screen.getByText("Home con l'accesso")).toBeTruthy();
  });

  it("una pagina fuori da RequireAuth, senza utente, è un errore di programmazione", () => {
    expect(() => render(<PaginaRiservata />)).toThrow(/RequireAuth/);
  });
});
