// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { useImportaFoto } from "../../src/hooks/useImportaFoto";
import { foglioApi } from "../../src/services/foglioApi";
import { ApiError } from "../../src/services/api";
import { FOTO_NON_APRIBILE, FOTO_NON_RIDUCIBILE, LETTURA_FALLITA, LETTURA_IN_CORSO } from "../../src/utils/testi";
import type { BozzaFoglio } from "../../src/types";

/* La lettura delle foto: riduzione nel browser (createImageBitmap e canvas, finti perché jsdom non li ha) e invio al server una
 * foto alla volta. La rete del foglio è finta. */

vi.mock("../../src/services/foglioApi", () => ({ foglioApi: { leggi: vi.fn() } }));
const leggi = vi.mocked(foglioApi.leggi);

const bozza = (nome: string): BozzaFoglio => ({
  nome, luogo: null, data: null, squadre: [], gironi: null, partite: [], dubbi: [],
});
const foto = (nome: string) => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], nome, { type: "image/jpeg" });
const PICCOLA = "data:image/jpeg;base64,AAAA";
const ENORME = `data:image/jpeg;base64,${"A".repeat(1_500_001)}`;

/** Le misure del canvas e la qualità chieste a ogni toDataURL */
let disegni: { larghezza: number; altezza: number; qualita: unknown }[];
let creaBitmap: ReturnType<typeof vi.fn>;

/** Il canvas finto risponde i data URL in ordine (l'ultimo si ripete) */
function canvasRisponde(...dataUrl: string[]) {
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockImplementation(function (this: HTMLCanvasElement, _tipo, qualita) {
    disegni.push({ larghezza: this.width, altezza: this.height, qualita });
    return dataUrl[Math.min(disegni.length - 1, dataUrl.length - 1)];
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  disegni = [];
  creaBitmap = vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() }));
  vi.stubGlobal("createImageBitmap", creaBitmap);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    { drawImage: vi.fn() } as unknown as ReturnType<HTMLCanvasElement["getContext"]>,
  );
  canvasRisponde(PICCOLA);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useImportaFoto: riduzione e lettura in sequenza", () => {
  it("riduce ogni foto a 1600 px (JPEG 0,8, orientamento EXIF) e la manda al server, nell'ordine", async () => {
    leggi.mockResolvedValueOnce(bozza("Prima")).mockResolvedValueOnce(bozza("Seconda"));
    const { result } = renderHook(() => useImportaFoto());
    let bozze: BozzaFoglio[] = [];
    await act(async () => { bozze = await result.current.leggiFoto([foto("a.jpg"), foto("b.jpg")]); });
    expect(bozze.map((b) => b.nome)).toEqual(["Prima", "Seconda"]);
    expect(creaBitmap).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect(disegni[0]).toEqual({ larghezza: 1600, altezza: 1200, qualita: 0.8 });
    expect(leggi).toHaveBeenNthCalledWith(1, PICCOLA);
    expect(leggi).toHaveBeenCalledTimes(2);
    expect(result.current.stato).toBeNull();
  });

  it("se il primo passo supera il limite del server riprova a 1200 px e qualità 0,7", async () => {
    canvasRisponde(ENORME, PICCOLA);
    leggi.mockResolvedValue(bozza("Prima"));
    const { result } = renderHook(() => useImportaFoto());
    await act(async () => { await result.current.leggiFoto([foto("a.jpg")]); });
    expect(disegni).toEqual([
      { larghezza: 1600, altezza: 1200, qualita: 0.8 }, { larghezza: 1200, altezza: 900, qualita: 0.7 },
    ]);
    expect(leggi).toHaveBeenCalledWith(PICCOLA);
  });

  it("una foto troppo grande anche ridotta non parte, e il messaggio la nomina", async () => {
    canvasRisponde(ENORME);
    const { result } = renderHook(() => useImportaFoto());
    await act(async () => {
      await expect(result.current.leggiFoto([foto("enorme.jpg")])).rejects.toThrow(FOTO_NON_RIDUCIBILE("enorme.jpg"));
    });
    expect(leggi).not.toHaveBeenCalled();
  });

  it("una foto che il browser non decodifica: messaggio con il nome, niente al server", async () => {
    creaBitmap.mockRejectedValue(new DOMException("The source image could not be decoded.", "InvalidStateError"));
    const { result } = renderHook(() => useImportaFoto());
    await act(async () => {
      await expect(result.current.leggiFoto([foto("rotta.jpg")])).rejects.toThrow(FOTO_NON_APRIBILE("rotta.jpg"));
    });
    expect(leggi).not.toHaveBeenCalled();
  });

  it("tre foto e la seconda non si legge (502): errore con il nome e il motivo, la terza non parte", async () => {
    leggi.mockResolvedValueOnce(bozza("Prima")).mockRejectedValueOnce(new ApiError(502, "Lettore dei fogli non raggiungibile"));
    const { result } = renderHook(() => useImportaFoto());
    await act(async () => {
      await expect(result.current.leggiFoto([foto("a.jpg"), foto("b.jpg"), foto("c.jpg")]))
        .rejects.toThrow(LETTURA_FALLITA("b.jpg", "Lettore dei fogli non raggiungibile"));
    });
    expect(leggi).toHaveBeenCalledTimes(2);
    expect(result.current.stato).toBeNull();
  });

  it("durante la lettura `stato` dice a che foglio si è", async () => {
    let risolvi: (b: BozzaFoglio) => void = () => {};
    leggi.mockImplementation(() => new Promise((r) => { risolvi = r; }));
    const { result } = renderHook(() => useImportaFoto());
    let lettura: Promise<BozzaFoglio[]> = Promise.resolve([]);
    act(() => { lettura = result.current.leggiFoto([foto("a.jpg"), foto("b.jpg")]); });
    await waitFor(() => expect(result.current.stato).toBe(LETTURA_IN_CORSO(1, 2)));
    await act(async () => { risolvi(bozza("Prima")); });
    await waitFor(() => expect(result.current.stato).toBe(LETTURA_IN_CORSO(2, 2)));
    await act(async () => {
      risolvi(bozza("Seconda"));
      await lettura;
    });
    expect(result.current.stato).toBeNull();
  });
});
