// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MappaCampetti } from "../../src/components/campetti/MappaCampetti";
import { coordinateDa, inquadra, proietta } from "../../src/utils/geo";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

/** Il lato del sistema di coordinate dell'immagine (`size=640x640` della Maps Static API): i pin si posizionano in percentuale di questo */
const LATO = 640;
/** Dove sta chi guarda: nel centro di Torino, non su un campetto. Non deve finire nell'URL dell'immagine (D7) */
const UTENTE = { lat: 45.0703, lng: 7.6869 };
const [ruffini, giardini] = CAMPETTI_DEMO;

/** La mappa con la chiave finta: l'immagine di Google al posto della griglia */
function conChiave(props: Partial<Parameters<typeof MappaCampetti>[0]> = {}) {
  vi.stubEnv("MAPS_API_KEY", "chiave-finta");
  return render(<MappaCampetti campetti={CAMPETTI_DEMO} selezionato={ruffini.id} onSeleziona={() => {}} {...props} />);
}

/** La mappa senza chiave: la griglia schematica */
function senzaChiave(props: Partial<Parameters<typeof MappaCampetti>[0]> = {}) {
  vi.stubEnv("MAPS_API_KEY", "");
  return render(<MappaCampetti campetti={CAMPETTI_DEMO} selezionato={ruffini.id} onSeleziona={() => {}} {...props} />);
}

const immagine = () => screen.queryByRole("img", { name: /mappa/i }) as HTMLImageElement | null;
/** La griglia schematica è l'unico svg in 100×100 unità (le icone dei pin sono in 24×24) */
const griglia = () => document.querySelector("svg[viewBox='0 0 100 100']");
/** Il livello che riceve i clic sulla mappa (contiene immagine o griglia e i pin): è `presentation` perché raccoglie gli eventi dei figli */
const livelloClic = () => document.querySelector("[role='presentation']") as HTMLElement;

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe("MappaCampetti con la chiave: l'immagine della Maps Static API, inquadrata sui soli campetti", () => {
  it("l'img punta a maps.googleapis.com con center e zoom di `inquadra`, size 640x640, scale 2 e la chiave; nessun markers", () => {
    conChiave();
    const img = immagine();
    expect(img).not.toBeNull();
    const url = new URL(img!.src);
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/staticmap");
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    expect(url.searchParams.get("center")).toBe(`${centro.lat},${centro.lng}`);
    expect(url.searchParams.get("zoom")).toBe(String(zoom));
    expect(url.searchParams.get("size")).toBe("640x640");
    expect(url.searchParams.get("scale")).toBe("2");
    expect(url.searchParams.get("key")).toBe("chiave-finta");
    expect(url.searchParams.has("markers")).toBe(false);
    expect(griglia()).toBeNull();
  });

  it("la posizione dell'utente non entra nell'URL: centro e zoom dipendono solo dai campetti (D7)", () => {
    conChiave({ posizioneUtente: UTENTE });
    const src = immagine()!.src;
    expect(src).not.toContain(String(UTENTE.lat));
    expect(src).not.toContain(String(UTENTE.lng));
    const { centro } = inquadra(CAMPETTI_DEMO, LATO);
    expect(new URL(src).searchParams.get("center")).toBe(`${centro.lat},${centro.lng}`);
  });

  it("l'immagine manda il Referer: la restrizione per referrer di Google lo richiede, quindi niente no-referrer", () => {
    conChiave();
    expect(immagine()!.referrerPolicy).not.toBe("no-referrer");
  });

  it("se l'immagine non carica (rete, quota, restrizioni) al suo posto torna la griglia, con gli stessi pin", () => {
    conChiave();
    fireEvent.error(immagine()!);
    expect(immagine()).toBeNull();
    expect(griglia()).not.toBeNull();
    expect(screen.getByRole("button", { name: ruffini.nome })).toBeTruthy();
  });
});

describe("MappaCampetti: i pin sono pulsanti posizionati da `proietta`, in percentuale del lato 640", () => {
  it.each([["con la chiave", conChiave], ["senza chiave", senzaChiave]])("%s", (_nome, monta) => {
    monta();
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    for (const c of CAMPETTI_DEMO) {
      const pin = screen.getByRole("button", { name: c.nome });
      const { x, y } = proietta(c.lat, c.lng, centro, zoom, LATO);
      expect(pin.style.left).toBe(`${(x / LATO) * 100}%`);
      expect(pin.style.top).toBe(`${(y / LATO) * 100}%`);
    }
  });

  it("il pin del campetto selezionato ha aria-pressed; un clic su un pin chiama onSeleziona con l'id, non onClicMappa", () => {
    const onSeleziona = vi.fn();
    const onClicMappa = vi.fn();
    senzaChiave({ onSeleziona, onClicMappa });
    expect(screen.getByRole("button", { name: ruffini.nome }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: giardini.nome }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: giardini.nome }));
    expect(onSeleziona).toHaveBeenCalledWith(giardini.id);
    expect(onClicMappa).not.toHaveBeenCalled();
  });

  it("senza campetti non ci sono pin e la mappa resta (Roma, dove la pagina si apre)", () => {
    senzaChiave({ campetti: [], selezionato: null });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(griglia()).not.toBeNull();
  });
});

describe("MappaCampetti: il pin dell'utente lo disegna l'app", () => {
  it("con la posizione c'è un segno non interattivo con il testo «La tua posizione», dove dice `proietta`", () => {
    conChiave({ posizioneUtente: UTENTE });
    const testo = screen.getByText("La tua posizione");
    const segno = testo.closest("[style]") as HTMLElement;
    expect(testo.closest("button")).toBeNull();
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    const { x, y } = proietta(UTENTE.lat, UTENTE.lng, centro, zoom, LATO);
    expect(segno.style.left).toBe(`${(x / LATO) * 100}%`);
    expect(segno.style.top).toBe(`${(y / LATO) * 100}%`);
  });

  it("senza posizione, o con l'utente fuori dall'inquadratura (che segue solo i campetti), il segno non c'è", () => {
    senzaChiave();
    expect(screen.queryByText("La tua posizione")).toBeNull();
    cleanup();
    senzaChiave({ posizioneUtente: { lat: 41.9028, lng: 12.4964 } }); // Roma, con i campetti di Torino
    expect(screen.queryByText("La tua posizione")).toBeNull();
  });
});

describe("MappaCampetti: il pin provvisorio del form (T5.5)", () => {
  it("con `pinProvvisorio` c'è un segno non cliccabile «Posizione scelta» dove dice `proietta`; fuori dall'inquadratura non c'è", () => {
    senzaChiave({ pinProvvisorio: UTENTE });
    const testo = screen.getByText("Posizione scelta");
    expect(testo.closest("button")).toBeNull();
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    const { x, y } = proietta(UTENTE.lat, UTENTE.lng, centro, zoom, LATO);
    const segno = testo.closest("[style]") as HTMLElement;
    expect(segno.style.left).toBe(`${(x / LATO) * 100}%`);
    expect(segno.style.top).toBe(`${(y / LATO) * 100}%`);
    cleanup();
    senzaChiave({ pinProvvisorio: { lat: 41.9028, lng: 12.4964 } }); // Roma, con i campetti di Torino: l'inquadratura non lo segue
    expect(screen.queryByText("Posizione scelta")).toBeNull();
  });
});

describe("MappaCampetti: un clic sulla mappa (non su un pin) dà le coordinate del punto, con `coordinateDa`", () => {
  /** La mappa è disegnata a 320×320 px nella pagina (metà del sistema 640): il clic si riporta nel sistema 640 con il rettangolo */
  function simulaClic(clientX: number, clientY: number) {
    const livello = livelloClic();
    livello.getBoundingClientRect = () => ({ left: 10, top: 20, width: 320, height: 320, right: 330, bottom: 340, x: 10, y: 20, toJSON: () => ({}) });
    fireEvent.click(livello, { clientX, clientY });
  }

  it.each([["con la chiave", conChiave], ["senza chiave", senzaChiave]])("%s", (_nome, monta) => {
    const onClicMappa = vi.fn();
    monta({ onClicMappa });
    simulaClic(10 + 160, 20 + 80); // al centro in orizzontale, a un quarto in verticale
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    expect(onClicMappa).toHaveBeenCalledTimes(1);
    const atteso = coordinateDa(320, 160, centro, zoom, LATO);
    const [dato] = onClicMappa.mock.calls[0];
    expect(dato.lat).toBeCloseTo(atteso.lat, 9);
    expect(dato.lng).toBeCloseTo(atteso.lng, 9);
  });

  it("senza onClicMappa il clic non fa niente", () => {
    senzaChiave();
    expect(() => simulaClic(100, 100)).not.toThrow();
  });
});
