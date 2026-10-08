// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SquadraAnagrafeForm } from "../../src/components/anagrafe/SquadraAnagrafeForm";
import { MAX_ROSTER_ANAGRAFE } from "../../src/constants/rules";
import type { RegGiocatore } from "../../src/types";

afterEach(cleanup);

const giocatore = (n: number): RegGiocatore => ({
  id: `g${n}`, nome: `Nome${n}`, cognome: "Rossi", soprannome: "", nascita: "", citta: "", nazionalita: "", altezza: "", peso: "",
  ruolo: "", numero: "", squadra: "", esperienza: "", note: "", autore: "Anna", autoreId: "u1", ts: 1,
});

/** Sceglie il giocatore `id` nella tendina e preme «Aggiungi» */
function aggiungi(id: string) {
  fireEvent.change(screen.getByLabelText("Scegli un giocatore"), { target: { value: id } });
  fireEvent.click(screen.getByRole("button", { name: "Aggiungi" }));
}

describe("SquadraAnagrafeForm: il limite del roster che il form dichiara è quello che applica", () => {
  it(`accetta ${MAX_ROSTER_ANAGRAFE} giocatori, poi «Aggiungi» e la tendina si disattivano e il salvataggio manda solo quelli`, async () => {
    const onSave = vi.fn(async () => {});
    const giocatori = Array.from({ length: MAX_ROSTER_ANAGRAFE + 1 }, (_, i) => giocatore(i + 1));
    render(<SquadraAnagrafeForm giocatori={giocatori} onSave={onSave} />);
    expect(screen.getByText(`Roster (dai giocatori registrati, 0/${MAX_ROSTER_ANAGRAFE})`)).toBeTruthy();
    for (let i = 1; i <= MAX_ROSTER_ANAGRAFE; i++) aggiungi(`g${i}`);
    expect(screen.getByText(`Roster (dai giocatori registrati, ${MAX_ROSTER_ANAGRAFE}/${MAX_ROSTER_ANAGRAFE})`)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Aggiungi" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Scegli un giocatore") as HTMLSelectElement).disabled).toBe(true);
    // Un clic in più non aggiunge nessuno
    aggiungi(`g${MAX_ROSTER_ANAGRAFE + 1}`);
    expect(screen.getAllByRole("button", { name: /^Rimuovi / })).toHaveLength(MAX_ROSTER_ANAGRAFE);

    fireEvent.change(screen.getByLabelText("Nome squadra *"), { target: { value: "Ballers" } });
    fireEvent.click(screen.getByRole("button", { name: "Salva nell'anagrafe" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0].roster).toEqual(giocatori.slice(0, MAX_ROSTER_ANAGRAFE).map((g) => g.id));
  });

  it("togliendo un giocatore dal roster pieno si può aggiungerne un altro", () => {
    const giocatori = Array.from({ length: MAX_ROSTER_ANAGRAFE + 1 }, (_, i) => giocatore(i + 1));
    render(<SquadraAnagrafeForm giocatori={giocatori} onSave={vi.fn(async () => {})} />);
    for (let i = 1; i <= MAX_ROSTER_ANAGRAFE; i++) aggiungi(`g${i}`);
    fireEvent.click(screen.getByRole("button", { name: "Rimuovi Nome1 Rossi" }));
    expect((screen.getByRole("button", { name: "Aggiungi" }) as HTMLButtonElement).disabled).toBe(false);
    aggiungi(`g${MAX_ROSTER_ANAGRAFE + 1}`);
    expect(screen.getByRole("button", { name: `Rimuovi Nome${MAX_ROSTER_ANAGRAFE + 1} Rossi` })).toBeTruthy();
  });
});
