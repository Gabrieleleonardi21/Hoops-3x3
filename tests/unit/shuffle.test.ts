import { describe, it, expect, vi, afterEach } from "vitest";
import { shuffle } from "../../src/utils/shuffle";

afterEach(() => {
  vi.restoreAllMocks(); // Math.random torna quello vero per i test dopo
});

/** Math.random risponde con questi numeri, uno a ogni chiamata (finiti, tornerebbe quello vero: ogni test ne pesca esattamente tanti) */
function randomFinto(...valori: number[]) {
  const random = vi.spyOn(Math, "random");
  valori.forEach((v) => random.mockReturnValueOnce(v));
  return random;
}

describe("shuffle", () => {
  it("restituisce gli stessi elementi, senza mutare l'originale", () => {
    const arr = [1, 2, 3, 4, 5];
    const copia = [...arr];
    const out = shuffle(arr);
    expect(arr).toEqual(copia);
    expect([...out].sort()).toEqual([...arr].sort());
    expect(out).toHaveLength(arr.length);
  });

  it("gestisce array vuoti e con un elemento", () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle([42])).toEqual([42]);
  });

  it("con i numeri casuali decisi l'ordine è sempre lo stesso, e preciso (Fisher-Yates dalla fine)", () => {
    // Per i = 4, 3, 2, 1 si pesca j = floor(random * (i + 1)) e si scambia la posizione i con la j:
    //   0,5 → j 2: [1,2,5,4,3]   0 → j 0: [4,2,5,1,3]   0,9 → j 2 (resta)   0,2 → j 0: [2,4,5,1,3]
    const random = randomFinto(0.5, 0, 0.9, 0.2);
    expect(shuffle([1, 2, 3, 4, 5])).toEqual([2, 4, 5, 1, 3]);
    expect(random).toHaveBeenCalledTimes(4); // una volta per ogni posizione, esclusa la prima
  });

  it("con random sempre 0 ogni elemento va in fondo a turno: l'array ruota di una posizione, e l'originale non cambia", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const originale = ["a", "b", "c", "d"];
    expect(shuffle(originale)).toEqual(["b", "c", "d", "a"]);
    expect(originale).toEqual(["a", "b", "c", "d"]);
  });

  it("con random vicino a 1 si sceglie sempre la posizione stessa: l'ordine non cambia", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    expect(shuffle(["a", "b", "c", "d"])).toEqual(["a", "b", "c", "d"]);
  });

  it("array vuoto e con un solo elemento non pescano nessun numero casuale", () => {
    const random = vi.spyOn(Math, "random");
    shuffle([]);
    shuffle([42]);
    expect(random).not.toHaveBeenCalled();
  });
});
