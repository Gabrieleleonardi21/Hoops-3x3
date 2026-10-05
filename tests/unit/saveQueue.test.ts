import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createSaveQueue } from "../../src/stores/saveQueue";
import { DEFAULT_RULES } from "../../src/constants/rules";
import type { Tappa } from "../../src/types";

const tappa = (id: string, nome: string): Tappa => ({
  id, nome, luogo: "", data: "", nGironi: 1, regole: { ...DEFAULT_RULES }, squadre: [], gironi: null, partite: [], video: [],
});

/** Promessa controllabile a mano: il test decide quando il "server" risponde */
function differita() {
  let ok!: () => void;
  let ko!: (e: unknown) => void;
  const p = new Promise<void>((res, rej) => { ok = res; ko = rej; });
  return { p, ok, ko };
}

class ErroreRete extends Error {}
class Rifiuto extends Error {}

describe("saveQueue (salvataggi delle tappe verso il server)", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  const nuova = (salva: (t: Tappa) => Promise<unknown>, onErrore = vi.fn()) =>
    createSaveQueue({ salva, riprovabile: (e) => e instanceof ErroreRete, onErrore, ritardo: 400, attese: [2000, 5000] });

  it("più modifiche ravvicinate producono un solo salvataggio, con l'ultima versione", async () => {
    const salva = vi.fn<(t: Tappa) => Promise<unknown>>(async () => undefined);
    const q = nuova(salva);
    q.accoda(tappa("t1", "A"));
    q.accoda(tappa("t1", "AB"));
    q.accoda(tappa("t1", "ABC"));
    await vi.advanceTimersByTimeAsync(400);
    expect(salva).toHaveBeenCalledTimes(1);
    expect(salva.mock.calls[0][0].nome).toBe("ABC");
  });

  it("non manda mai due richieste insieme per la stessa tappa: la seconda parte quando la prima è finita", async () => {
    const prima = differita();
    const salva = vi.fn<(t: Tappa) => Promise<unknown>>().mockReturnValueOnce(prima.p).mockResolvedValue(undefined);
    const q = nuova(salva);
    q.accoda(tappa("t1", "v1"));
    await vi.advanceTimersByTimeAsync(400);       // parte il salvataggio di v1 (lento)
    q.accoda(tappa("t1", "v2"));
    await vi.advanceTimersByTimeAsync(400);       // il debounce di v2 scade mentre v1 è ancora in volo
    expect(salva).toHaveBeenCalledTimes(1);
    prima.ok();
    await vi.advanceTimersByTimeAsync(0);
    expect(salva).toHaveBeenCalledTimes(2);
    expect(salva.mock.calls.map((c) => c[0].nome)).toEqual(["v1", "v2"]);
  });

  it("rete assente: avvisa una volta e riprova da sola dopo la pausa", async () => {
    const onErrore = vi.fn();
    const salva = vi.fn<(t: Tappa) => Promise<unknown>>()
      .mockRejectedValueOnce(new ErroreRete()).mockResolvedValue(undefined);
    const q = nuova(salva, onErrore);
    q.accoda(tappa("t1", "v1"));
    await vi.advanceTimersByTimeAsync(400);
    expect(onErrore).toHaveBeenCalledTimes(1);
    expect(onErrore.mock.calls[0][1]).toBe(false); // non definitivo
    expect(q.inAttesa().map((t) => t.nome)).toEqual(["v1"]);
    await vi.advanceTimersByTimeAsync(2000);
    expect(salva).toHaveBeenCalledTimes(2);
    expect(q.inAttesa()).toEqual([]);
  });

  it("se i dati vengono rifiutati dal server non riprova e segnala l'errore come definitivo", async () => {
    const onErrore = vi.fn();
    const salva = vi.fn(async () => { throw new Rifiuto(); });
    const q = nuova(salva, onErrore);
    q.accoda(tappa("t1", "v1"));
    await vi.advanceTimersByTimeAsync(400);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(salva).toHaveBeenCalledTimes(1);
    expect(onErrore).toHaveBeenCalledWith(expect.any(Rifiuto), true);
  });

  it("finiti i tentativi si ferma, e riparte alla modifica successiva", async () => {
    const salva = vi.fn<(t: Tappa) => Promise<unknown>>().mockRejectedValue(new ErroreRete());
    const q = nuova(salva);
    q.accoda(tappa("t1", "v1"));
    await vi.advanceTimersByTimeAsync(400 + 2000 + 5000);
    expect(salva).toHaveBeenCalledTimes(3);       // primo invio + 2 tentativi
    await vi.advanceTimersByTimeAsync(60_000);
    expect(salva).toHaveBeenCalledTimes(3);       // fermo: nessun ciclo infinito
    salva.mockResolvedValue(undefined);
    q.accoda(tappa("t1", "v2"));
    await vi.advanceTimersByTimeAsync(400);
    expect(salva).toHaveBeenLastCalledWith(expect.objectContaining({ nome: "v2" }));
    expect(q.inAttesa()).toEqual([]);
  });

  it("svuota() salva subito senza aspettare il debounce e dice se è rimasto qualcosa", async () => {
    const salva = vi.fn(async () => undefined);
    const q = nuova(salva);
    q.accoda(tappa("t1", "v1"));
    q.accoda(tappa("t2", "w1"));
    await expect(q.svuota()).resolves.toBe(true);
    expect(salva).toHaveBeenCalledTimes(2);
  });

  it("svuota() aspetta anche la versione arrivata durante una richiesta in volo", async () => {
    const prima = differita();
    const salva = vi.fn<(t: Tappa) => Promise<unknown>>().mockReturnValueOnce(prima.p).mockResolvedValue(undefined);
    const q = nuova(salva);
    q.accoda(tappa("t1", "v1"));
    await vi.advanceTimersByTimeAsync(400);
    q.accoda(tappa("t1", "v2"));
    const fine = q.svuota();
    prima.ok();
    await expect(fine).resolves.toBe(true);
    expect(salva.mock.calls.map((c) => c[0].nome)).toEqual(["v1", "v2"]);
  });

  it("annulla() ferma i salvataggi di una tappa eliminata", async () => {
    const salva = vi.fn(async () => undefined);
    const q = nuova(salva);
    q.accoda(tappa("t1", "v1"));
    q.annulla("t1");
    await vi.advanceTimersByTimeAsync(5000);
    expect(salva).not.toHaveBeenCalled();
  });

  it("onInSospeso segue il numero di tappe con modifiche non confermate", async () => {
    const stati: number[] = [];
    const q = createSaveQueue({ salva: async () => undefined, riprovabile: () => false, onErrore: vi.fn(), onInSospeso: (n) => stati.push(n) });
    q.accoda(tappa("t1", "v1"));
    await vi.advanceTimersByTimeAsync(400);
    expect(stati[0]).toBe(1);
    expect(stati.at(-1)).toBe(0);
  });
});
