// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePosizione } from "../../src/hooks/usePosizione";

/** Il centro di Torino, come lo dà il browser (coords) e come lo vuole l'app (lat/lng) */
const COORDS = { latitude: 45.0703, longitude: 7.6869 };
const ATTESA = { lat: 45.0703, lng: 7.6869 };

/** Il browser finto: `getCurrentPosition` risponde come decide il test. undefined = browser senza Geolocation API */
function browserCon(getCurrentPosition: ((ok: PositionCallback, ko: PositionErrorCallback) => void) | undefined) {
  let geolocation: unknown = undefined;
  if (getCurrentPosition) geolocation = { getCurrentPosition: vi.fn(getCurrentPosition) };
  Object.defineProperty(navigator, "geolocation", { value: geolocation, configurable: true });
  return geolocation as { getCurrentPosition: ReturnType<typeof vi.fn> } | undefined;
}

const concede = (ok: PositionCallback) => ok({ coords: COORDS } as GeolocationPosition);
const rifiuta = (code: number) => (_ok: PositionCallback, ko: PositionErrorCallback) => ko({ code } as GeolocationPositionError);

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, "geolocation", { value: undefined, configurable: true });
});

describe("usePosizione: la posizione dell'utente solo su richiesta (D7)", () => {
  it("al montaggio non chiede niente al browser: stato «mai chiesta», nessuna posizione", () => {
    const geo = browserCon(concede);
    const { result } = renderHook(() => usePosizione());
    expect(result.current.stato).toBe("mai chiesta");
    expect(result.current.posizione).toBeNull();
    expect(geo!.getCurrentPosition).not.toHaveBeenCalled();
  });

  it("chiedi() passa a «in corso» finché il browser non risponde", () => {
    browserCon(() => {}); // il browser non risponde ancora
    const { result } = renderHook(() => usePosizione());
    act(() => result.current.chiedi());
    expect(result.current.stato).toBe("in corso");
    expect(result.current.posizione).toBeNull();
  });

  it("permesso concesso: stato «concessa» e la posizione in lat/lng", () => {
    const geo = browserCon(concede);
    const { result } = renderHook(() => usePosizione());
    act(() => result.current.chiedi());
    expect(result.current.stato).toBe("concessa");
    expect(result.current.posizione).toEqual(ATTESA);
    expect(geo!.getCurrentPosition).toHaveBeenCalledTimes(1);
  });

  it("permesso negato (PERMISSION_DENIED = 1): stato «negata», nessuna posizione", () => {
    browserCon(rifiuta(1));
    const { result } = renderHook(() => usePosizione());
    act(() => result.current.chiedi());
    expect(result.current.stato).toBe("negata");
    expect(result.current.posizione).toBeNull();
  });

  it.each([["posizione non determinabile (2)", 2], ["tempo scaduto (3)", 3]])("%s: stato «non disponibile»", (_nome, code) => {
    browserCon(rifiuta(code));
    const { result } = renderHook(() => usePosizione());
    act(() => result.current.chiedi());
    expect(result.current.stato).toBe("non disponibile");
    expect(result.current.posizione).toBeNull();
  });

  it("browser senza Geolocation API: chiedi() dà subito «non disponibile», senza errori", () => {
    browserCon(undefined);
    const { result } = renderHook(() => usePosizione());
    act(() => result.current.chiedi());
    expect(result.current.stato).toBe("non disponibile");
  });

  it("si può richiedere dopo un rifiuto: la seconda volta il browser può concederla", () => {
    let esito: (ok: PositionCallback, ko: PositionErrorCallback) => void = rifiuta(1);
    browserCon((ok, ko) => esito(ok, ko));
    const { result } = renderHook(() => usePosizione());
    act(() => result.current.chiedi());
    expect(result.current.stato).toBe("negata");
    esito = concede;
    act(() => result.current.chiedi());
    expect(result.current.stato).toBe("concessa");
    expect(result.current.posizione).toEqual(ATTESA);
  });

  it("una risposta arrivata dopo lo smontaggio non tocca niente (nessun avviso di React)", () => {
    let rispondi: PositionCallback = () => {};
    browserCon((ok) => { rispondi = ok; });
    const avvisi = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => usePosizione());
    act(() => result.current.chiedi());
    unmount();
    act(() => rispondi({ coords: COORDS } as GeolocationPosition));
    expect(avvisi).not.toHaveBeenCalled();
    avvisi.mockRestore();
  });
});
