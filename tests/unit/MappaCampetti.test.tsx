// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MappaCampetti } from "../../src/components/campetti/MappaCampetti";
import { coordinateDa, inquadra, proietta } from "../../src/utils/geo";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

/** Il lato del sistema di coordinate dell'immagine (640 px, quello che il server fissa): i pin si posizionano in percentuale di questo */
const LATO = 640;
/** Dove sta chi guarda: nel centro di Torino, non su un campetto. Non deve finire nell'URL dell'immagine (D7) */
const UTENTE = { lat: 45.0703, lng: 7.6869 };
const [ruffini, giardini] = CAMPETTI_DEMO;
/** Palermo: fuori dall'inquadratura di tutti i campetti di esempio, Torino e Roma */
const PALERMO = { lat: 38.1157, lng: 13.3615 };

/** La mappa con l'immagine: il browser la chiede sempre a /api/mappa-campetti, e il server decide se c'è (la chiave sta lì) */
function conImmagine(props: Partial<Parameters<typeof MappaCampetti>[0]> = {}) {
  return render(<MappaCampetti campetti={CAMPETTI_DEMO} selezionato={ruffini.id} onSeleziona={() => {}} {...props} />);
}

/** La mappa schematica: l'immagine non c'è (il server risponde 503, o la rete cade), e quando non carica torna la griglia */
function schematica(props: Partial<Parameters<typeof MappaCampetti>[0]> = {}) {
  const risultato = conImmagine(props);
  fireEvent.error(immagine()!);
  return risultato;
}

const immagine = () => screen.queryByRole("img", { name: /mappa/i }) as HTMLImageElement | null;
/** La griglia schematica è l'unico svg in 100×100 unità (le icone dei pin sono in 24×24) */
const griglia = () => document.querySelector("svg[viewBox='0 0 100 100']");
/** Il livello che riceve i clic sulla mappa (contiene immagine o griglia e i pin): è `presentation` perché raccoglie gli eventi dei figli */
const livelloClic = () => document.querySelector("[role='presentation']") as HTMLElement;

afterEach(() => {
  cleanup();
});

describe("MappaCampetti: l'immagine viene dal server (/api/mappa-campetti), inquadrata sui soli campetti", () => {
  it("l'img punta a /api/mappa-campetti con lat, lng e zoom di `inquadra`; nessuna chiave, nessuna dimensione, nessun markers", () => {
    conImmagine();
    const img = immagine();
    expect(img).not.toBeNull();
    const url = new URL(img!.src);
    expect(url.pathname).toBe("/api/mappa-campetti");
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    expect(url.searchParams.get("lat")).toBe(String(centro.lat));
    expect(url.searchParams.get("lng")).toBe(String(centro.lng));
    expect(url.searchParams.get("zoom")).toBe(String(zoom));
    for (const assente of ["key", "size", "scale", "markers", "center"]) expect(url.searchParams.has(assente), assente).toBe(false);
    expect(griglia()).toBeNull();
  });

  it("la posizione dell'utente non entra nell'URL: centro e zoom dipendono solo dai campetti (D7)", () => {
    conImmagine({ posizioneUtente: UTENTE });
    const src = immagine()!.src;
    expect(src).not.toContain(String(UTENTE.lat));
    expect(src).not.toContain(String(UTENTE.lng));
    const { centro } = inquadra(CAMPETTI_DEMO, LATO);
    expect(new URL(src).searchParams.get("lat")).toBe(String(centro.lat));
  });

  it("se l'immagine non carica (503 del server, rete) al suo posto torna la griglia, con gli stessi pin", () => {
    conImmagine();
    fireEvent.error(immagine()!);
    expect(immagine()).toBeNull();
    expect(griglia()).not.toBeNull();
    expect(screen.getByRole("button", { name: ruffini.nome })).toBeTruthy();
  });
});

describe("MappaCampetti: i pin sono pulsanti posizionati da `proietta`, in percentuale del lato 640", () => {
  it.each([["con l'immagine", conImmagine], ["schematica", schematica]])("%s", (_nome, monta) => {
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
    schematica({ onSeleziona, onClicMappa });
    expect(screen.getByRole("button", { name: ruffini.nome }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: giardini.nome }).getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: giardini.nome }));
    expect(onSeleziona).toHaveBeenCalledWith(giardini.id);
    expect(onClicMappa).not.toHaveBeenCalled();
  });

  it("senza campetti non ci sono pin e la mappa resta (Roma, dove la pagina si apre)", () => {
    schematica({ campetti: [], selezionato: null });
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(griglia()).not.toBeNull();
  });
});

describe("MappaCampetti: il pin dell'utente lo disegna l'app", () => {
  it("con la posizione c'è un segno non interattivo con il testo «La tua posizione», dove dice `proietta`", () => {
    conImmagine({ posizioneUtente: UTENTE });
    const testo = screen.getByText("La tua posizione");
    const segno = testo.closest("[style]") as HTMLElement;
    expect(testo.closest("button")).toBeNull();
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    const { x, y } = proietta(UTENTE.lat, UTENTE.lng, centro, zoom, LATO);
    expect(segno.style.left).toBe(`${(x / LATO) * 100}%`);
    expect(segno.style.top).toBe(`${(y / LATO) * 100}%`);
  });

  it("senza posizione, o con l'utente fuori dall'inquadratura (che segue solo i campetti), il segno non c'è", () => {
    schematica();
    expect(screen.queryByText("La tua posizione")).toBeNull();
    cleanup();
    schematica({ posizioneUtente: PALERMO }); // lontano da tutti i campetti di esempio (Torino e Roma): l'inquadratura non lo segue
    expect(screen.queryByText("La tua posizione")).toBeNull();
  });
});

describe("MappaCampetti: il pin provvisorio del form (T5.5)", () => {
  it("con `pinProvvisorio` c'è un segno non cliccabile «Posizione scelta» dove dice `proietta`; fuori dall'inquadratura non c'è", () => {
    schematica({ pinProvvisorio: UTENTE });
    const testo = screen.getByText("Posizione scelta");
    expect(testo.closest("button")).toBeNull();
    const { centro, zoom } = inquadra(CAMPETTI_DEMO, LATO);
    const { x, y } = proietta(UTENTE.lat, UTENTE.lng, centro, zoom, LATO);
    const segno = testo.closest("[style]") as HTMLElement;
    expect(segno.style.left).toBe(`${(x / LATO) * 100}%`);
    expect(segno.style.top).toBe(`${(y / LATO) * 100}%`);
    cleanup();
    schematica({ pinProvvisorio: PALERMO }); // lontano da tutti i campetti di esempio: l'inquadratura non lo segue
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

  it.each([["con l'immagine", conImmagine], ["schematica", schematica]])("%s", (_nome, monta) => {
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
    schematica();
    expect(() => simulaClic(100, 100)).not.toThrow();
  });
});
