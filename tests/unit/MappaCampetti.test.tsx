// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import L from "leaflet";
import { MappaCampetti } from "../../src/components/campetti/MappaCampetti";
import { CAMPETTI_DEMO } from "../fixtures/campetti";

/* La mappa è Leaflet con le tessere di OpenStreetMap (niente più immagine di Google né chiave nel browser). In jsdom una mappa non ha
 * dimensioni: si imposta una misura finta del contenitore, e si provano i comportamenti (pin, clic, trascinamento, vista) senza disegno. */

/** Dove sta chi guarda: nel centro di Torino, non su un campetto */
const UTENTE = { lat: 45.0703, lng: 7.6869 };
const [ruffini, giardini] = CAMPETTI_DEMO;
/** Il centro di Roma, dove la mappa si apre senza campetti */
const ROMA = { lat: 41.9028, lng: 12.4964 };

beforeEach(() => {
  // Leaflet legge la misura del contenitore: senza, la mappa ha dimensione zero e non si inquadra niente
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 640 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 640 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Il contenitore della mappa (Leaflet lo marca con `leaflet-container`) */
const contenitore = () => document.querySelector(".leaflet-container") as HTMLElement;
/** Il pin di un campetto, come pulsante con il suo nome */
const pin = (nome: string) => screen.getByRole("button", { name: nome });

describe("MappaCampetti: la mappa Leaflet con le tessere di OpenStreetMap", () => {
  it("mostra le tessere di OpenStreetMap e l'attribuzione © OpenStreetMap contributors, con il link alla licenza", () => {
    render(<MappaCampetti campetti={CAMPETTI_DEMO} selezionato={null} onSeleziona={() => {}} />);
    const attribuzione = document.querySelector(".leaflet-control-attribution");
    expect(attribuzione?.textContent).toContain("© OpenStreetMap contributors");
    expect(attribuzione?.querySelector("a[href='https://www.openstreetmap.org/copyright']")).not.toBeNull();
    const tessere = [...document.querySelectorAll<HTMLImageElement>("img.leaflet-tile")];
    expect(tessere.length).toBeGreaterThan(0);
    for (const t of tessere) expect(t.src).toMatch(/^https:\/\/[abc]\.tile\.openstreetmap\.org\/\d+\/\d+\/\d+\.png$/);
  });

  it("nella pagina non c'è nulla di Google né una chiave: la mappa non chiede niente a Google", () => {
    render(<MappaCampetti campetti={CAMPETTI_DEMO} selezionato={null} onSeleziona={() => {}} />);
    expect(document.body.innerHTML).not.toMatch(/googleapis|AIza|MAPS_API_KEY/);
  });

  it("senza campetti la mappa si apre su Roma, a zoom 12, e non ha pin", () => {
    const vista = vi.spyOn(L.Map.prototype, "setView");
    render(<MappaCampetti campetti={[]} selezionato={null} onSeleziona={() => {}} />);
    expect(vista).toHaveBeenCalledWith([ROMA.lat, ROMA.lng], 12);
    // I pulsanti di zoom di Leaflet sono anch'essi pulsanti: i pin si riconoscono da aria-pressed
    expect(document.querySelectorAll("button[aria-pressed]")).toHaveLength(0);
  });
});

describe("MappaCampetti: i pin dei campetti sono pulsanti, selezionabili da tastiera", () => {
  it("ogni campetto è un pulsante con il suo nome, e il selezionato ha aria-pressed", () => {
    render(<MappaCampetti campetti={[ruffini, giardini]} selezionato={ruffini.id} onSeleziona={() => {}} />);
    expect(pin(ruffini.nome).tagName).toBe("BUTTON");
    expect(pin(ruffini.nome).getAttribute("aria-pressed")).toBe("true");
    expect(pin(giardini.nome).getAttribute("aria-pressed")).toBe("false");
  });

  it("un pin è nell'ordine di Tab (non fuori con tabIndex negativo): Invio e Spazio attivano il pulsante vero", () => {
    render(<MappaCampetti campetti={[ruffini]} selezionato={null} onSeleziona={() => {}} />);
    expect(pin(ruffini.nome).tabIndex).toBeGreaterThanOrEqual(0);
  });

  it("un clic su un pin chiama onSeleziona con l'id, e non onClicMappa", () => {
    const onSeleziona = vi.fn();
    const onClicMappa = vi.fn();
    render(<MappaCampetti campetti={[ruffini, giardini]} selezionato={ruffini.id} onSeleziona={onSeleziona} onClicMappa={onClicMappa} />);
    fireEvent.click(pin(giardini.nome));
    expect(onSeleziona).toHaveBeenCalledWith(giardini.id);
    expect(onClicMappa).not.toHaveBeenCalled();
  });
});

describe("MappaCampetti: un clic sulla mappa dà le coordinate del punto", () => {
  it("un clic sullo sfondo chiama onClicMappa con lat e lng finiti dentro l'area dei campetti", () => {
    const onClicMappa = vi.fn();
    render(<MappaCampetti campetti={[ruffini, giardini]} selezionato={null} onSeleziona={() => {}} onClicMappa={onClicMappa} />);
    fireEvent.click(contenitore(), { clientX: 320, clientY: 320 });
    expect(onClicMappa).toHaveBeenCalledTimes(1);
    const { lat, lng } = onClicMappa.mock.calls[0][0];
    expect(Number.isFinite(lat) && Number.isFinite(lng)).toBe(true);
    expect(lat).toBeGreaterThan(45.0);
    expect(lat).toBeLessThan(45.1);
    expect(lng).toBeGreaterThan(7.6);
    expect(lng).toBeLessThan(7.7);
  });

  it("senza onClicMappa il clic non fa niente", () => {
    render(<MappaCampetti campetti={[ruffini]} selezionato={null} onSeleziona={() => {}} />);
    expect(() => fireEvent.click(contenitore(), { clientX: 100, clientY: 100 })).not.toThrow();
  });
});

describe("MappaCampetti: il pin provvisorio si trascina e dà la nuova posizione", () => {
  /** Un trascinamento con il mouse (Leaflet ascolta mousedown sul pin, mousemove e mouseup sul documento) */
  function trascina(elemento: Element, da: { x: number; y: number }, a: { x: number; y: number }) {
    // Leaflet ignora i pulsanti diversi dal sinistro: which 1 è il sinistro, come in un browser
    fireEvent.mouseDown(elemento, { clientX: da.x, clientY: da.y, button: 0, which: 1 });
    // Il movimento parte dall'elemento sotto il puntatore e risale al documento (come in un browser: Leaflet legge l'elemento bersaglio)
    fireEvent.mouseMove(elemento, { clientX: a.x, clientY: a.y });
    fireEvent.mouseUp(elemento, { clientX: a.x, clientY: a.y });
  }

  it("trascinare il pin provvisorio chiama onClicMappa con la nuova posizione", () => {
    const onClicMappa = vi.fn();
    render(<MappaCampetti campetti={[ruffini, giardini]} selezionato={null} onSeleziona={() => {}}
      onClicMappa={onClicMappa} pinProvvisorio={UTENTE} />);
    const provvisorio = document.querySelector(".leaflet-marker-draggable") as HTMLElement;
    expect(provvisorio).not.toBeNull();
    trascina(provvisorio, { x: 300, y: 300 }, { x: 360, y: 340 });
    expect(onClicMappa).toHaveBeenCalled();
    const ultimo = onClicMappa.mock.calls.at(-1)![0];
    expect(ultimo.lat).not.toBeCloseTo(UTENTE.lat, 6);
    expect(ultimo.lng).not.toBeCloseTo(UTENTE.lng, 6);
  });

  it("il pin provvisorio è lo stesso elemento quando la posizione cambia: si sposta, non si ricrea (un trascinamento non si perde)", () => {
    const { rerender } = render(<MappaCampetti campetti={[ruffini]} selezionato={null} onSeleziona={() => {}} pinProvvisorio={UTENTE} />);
    const prima = document.querySelector(".leaflet-marker-draggable");
    rerender(<MappaCampetti campetti={[ruffini]} selezionato={null} onSeleziona={() => {}} pinProvvisorio={giardini} />);
    expect(document.querySelector(".leaflet-marker-draggable")).toBe(prima);
    expect(document.querySelectorAll(".leaflet-marker-draggable")).toHaveLength(1);
  });

  it("il pin provvisorio non è un pulsante, e ha il testo «Posizione scelta» per chi legge lo schermo", () => {
    render(<MappaCampetti campetti={[ruffini]} selezionato={null} onSeleziona={() => {}} pinProvvisorio={UTENTE} />);
    const testo = screen.getByText("Posizione scelta");
    expect(testo.closest("button")).toBeNull();
  });
});

describe("MappaCampetti: la posizione dell'utente e la vista", () => {
  it("con la posizione c'è un segno non cliccabile con il testo «La tua posizione»", () => {
    render(<MappaCampetti campetti={[ruffini, giardini]} selezionato={null} onSeleziona={() => {}} posizioneUtente={UTENTE} />);
    expect(screen.getByText("La tua posizione").closest("button")).toBeNull();
  });

  it("la vista si adatta ai campetti quando cambia l'elenco, non a ogni render: la mappa non torna indietro mentre la si sposta", () => {
    const adatta = vi.spyOn(L.Map.prototype, "fitBounds");
    const { rerender } = render(<MappaCampetti campetti={[ruffini, giardini]} selezionato={null} onSeleziona={() => {}} />);
    expect(adatta).toHaveBeenCalledTimes(1);
    // Stesso elenco, altro array (il form ricrea la lista a ogni render): nessun adattamento
    rerender(<MappaCampetti campetti={[ruffini, giardini]} selezionato={null} onSeleziona={() => {}} />);
    expect(adatta).toHaveBeenCalledTimes(1);
    // Un elenco diverso (per esempio un filtro): la vista si rifà sui nuovi campetti
    rerender(<MappaCampetti campetti={[ruffini]} selezionato={null} onSeleziona={() => {}} />);
    expect(adatta).toHaveBeenCalledTimes(2);
  });
});
