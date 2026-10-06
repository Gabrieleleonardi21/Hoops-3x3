// @vitest-environment jsdom
/** Modal e finestre una sopra l'altra: il focus (iniziale, trattenuto dentro, ripristinato alla chiusura) e l'Esc, che chiude solo
 *  la finestra in primo piano. jsdom non sposta il focus con Tab da solo: i test premono Tab sull'elemento che ha il focus e
 *  guardano due cose, se l'evento è stato fermato (la finestra porta il focus dove vuole lei) o lasciato passare (il browser fa
 *  il suo corso). */
import { StrictMode, useState, type ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { Modal } from "../../src/components/ui/Modal";
import { ConfirmDialog } from "../../src/components/ui/ConfirmDialog";

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

const nulla = () => {};

/** Preme Tab (o Shift+Tab) sull'elemento che ha il focus. true = l'evento è passato al browser, false = la finestra l'ha fermato */
const tab = (indietro = false) => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Tab", shiftKey: indietro });
/** Preme Esc sull'elemento che ha il focus: l'evento sale fino alla finestra del browser, come con una tastiera vera */
const esc = () => fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

/** Un pulsante «Apri» e, dopo il clic, una finestra con questo contenuto, che si chiude con Esc, X o sfondo */
function ConApertura({ children, onClose = nulla }: { children?: ReactNode; onClose?: () => void }) {
  const [aperta, setAperta] = useState(false);
  const chiudi = () => { onClose(); setAperta(false); };
  return (
    <>
      <button onClick={() => setAperta(true)}>Apri</button>
      {aperta && <Modal label="Scheda" onClose={chiudi}>{children}</Modal>}
    </>
  );
}

/** Mostra `ConApertura` e la apre come farebbe chi usa la tastiera: il pulsante ha il focus e lo si preme. Restituisce il pulsante */
function apri(contenuto?: ReactNode) {
  render(<ConApertura>{contenuto}</ConApertura>);
  const pulsante = screen.getByRole("button", { name: "Apri" });
  pulsante.focus();
  fireEvent.click(pulsante);
  return pulsante;
}

describe("Modal: il focus all'apertura", () => {
  it("entra nella finestra, sul primo elemento del contenuto e non sul pulsante che l'ha aperta", () => {
    apri(<><input aria-label="Nome" /><button>Salva</button></>);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Nome" }));
  });

  it("un elemento segnato con data-focus-iniziale ha la precedenza sul primo del contenuto", () => {
    apri(<><button>Uno</button><button data-focus-iniziale>Due</button></>);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Due" }));
  });

  it("senza elementi nel contenuto il focus va alla finestra stessa, che si annuncia con il suo nome", () => {
    apri(<p>Solo testo</p>);
    expect(document.activeElement).toBe(screen.getByRole("dialog", { name: "Scheda" }));
  });
});

describe("Modal: Tab resta dentro la finestra", () => {
  // L'ordine degli elementi raggiungibili è quello del DOM: la X dell'intestazione, poi il contenuto

  it("Tab sull'ultimo elemento torna al primo, Shift+Tab sul primo va all'ultimo, in mezzo il browser fa il suo corso", () => {
    apri(<><input aria-label="Nome" /><button>Salva</button></>);
    const chiudi = screen.getByRole("button", { name: "Chiudi" });
    const nome = screen.getByRole("textbox", { name: "Nome" });
    const salva = screen.getByRole("button", { name: "Salva" });

    nome.focus();
    expect(tab()).toBe(true); // in mezzo non si interviene
    expect(tab(true)).toBe(true);
    expect(document.activeElement).toBe(nome);

    salva.focus();
    expect(tab()).toBe(false); // sull'ultimo l'evento è fermato…
    expect(document.activeElement).toBe(chiudi); // …e il focus fa il giro

    expect(tab(true)).toBe(false); // Shift+Tab sul primo
    expect(document.activeElement).toBe(salva);
  });

  it("con Tab tenuto premuto il focus continua a girare: le ripetizioni del tasto non si fermano", () => {
    apri(<button>Salva</button>);
    screen.getByRole("button", { name: "Salva" }).focus();
    expect(fireEvent.keyDown(document.activeElement!, { key: "Tab", repeat: true })).toBe(false); // sull'ultimo, anche in ripetizione
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Chiudi" }));
  });

  it("un elemento disattivato non si raggiunge con Tab: non conta come ultimo", () => {
    apri(<><button>Salva</button><button disabled>Elimina</button></>);
    screen.getByRole("button", { name: "Salva" }).focus();
    expect(tab()).toBe(false); // Salva è l'ultimo raggiungibile
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Chiudi" }));
  });

  it("con il focus fuori dalla finestra (la pagina sotto) Tab lo riporta dentro", () => {
    const pulsante = apri(<button>Salva</button>);
    pulsante.focus(); // il focus è sul pulsante della pagina, non nella finestra
    expect(tab()).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Chiudi" }));
    pulsante.focus();
    expect(tab(true)).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Salva" }));
  });

  it("con solo la X, e con il focus sulla finestra stessa, Tab e Shift+Tab non escono", () => {
    apri(<p>Solo testo</p>);
    const dialogo = screen.getByRole("dialog", { name: "Scheda" });
    const chiudi = screen.getByRole("button", { name: "Chiudi" });
    expect(document.activeElement).toBe(dialogo);
    expect(tab()).toBe(true); // dalla finestra Tab va alla X, e ci pensa il browser
    chiudi.focus();
    expect(tab()).toBe(false); // la X è anche l'ultima
    expect(document.activeElement).toBe(chiudi);
    dialogo.focus();
    expect(tab(true)).toBe(false); // dalla finestra stessa Shift+Tab andrebbe a ciò che la precede, fuori: va invece all'ultimo elemento
    expect(document.activeElement).toBe(chiudi);
  });
});

describe("Modal: il focus alla chiusura", () => {
  it("torna al pulsante che aveva aperto la finestra, con Esc, con la X e con lo sfondo", () => {
    const pulsante = apri(<input aria-label="Nome" />);
    // Chi usa la finestra ha il focus dentro: chiudendola il focus non resta nel vuoto
    screen.getByRole("textbox", { name: "Nome" }).focus();
    esc();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(pulsante);

    pulsante.focus();
    fireEvent.click(pulsante);
    const chiudi = screen.getByRole("button", { name: "Chiudi" });
    chiudi.focus();
    fireEvent.click(chiudi);
    expect(document.activeElement).toBe(pulsante);

    pulsante.focus();
    fireEvent.click(pulsante);
    screen.getByRole("textbox", { name: "Nome" }).focus();
    fireEvent.click(screen.getByRole("dialog").parentElement!); // lo sfondo è l'elemento sopra la finestra
    expect(document.activeElement).toBe(pulsante);
  });

  it("se il pulsante che l'aveva aperta non c'è più non succede niente: il focus non va a un elemento staccato", () => {
    function PulsanteCheSparisce() {
      const [stato, setStato] = useState<"chiusa" | "aperta" | "senzaPulsante">("chiusa");
      return (
        <>
          {stato !== "senzaPulsante" && <button onClick={() => setStato("aperta")}>Apri</button>}
          {stato !== "chiusa" && (
            <Modal label="Scheda" onClose={() => setStato("chiusa")}>
              <button onClick={() => setStato("senzaPulsante")}>Togli il pulsante</button>
            </Modal>
          )}
        </>
      );
    }
    render(<PulsanteCheSparisce />);
    const pulsante = screen.getByRole("button", { name: "Apri" });
    pulsante.focus();
    fireEvent.click(pulsante);
    fireEvent.click(screen.getByRole("button", { name: "Togli il pulsante" })); // «Apri» sparisce, la finestra resta
    expect(pulsante.isConnected).toBe(false);
    esc();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("in StrictMode (come in main.tsx) Esc chiude una volta sola e il focus torna a chi aveva aperto", () => {
    const onClose = vi.fn();
    render(<StrictMode><ConApertura onClose={onClose}><input aria-label="Nome" /></ConApertura></StrictMode>);
    const pulsante = screen.getByRole("button", { name: "Apri" });
    pulsante.focus();
    fireEvent.click(pulsante);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Nome" }));
    esc();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(pulsante);
  });
});

/** Due finestre separate: A si apre per prima, B dopo, quindi B è in primo piano */
function Due({ a, b, chiudiA, chiudiB }: { a: boolean; b: boolean; chiudiA: () => void; chiudiB: () => void }) {
  return (
    <>
      {a && <Modal label="A" onClose={chiudiA}>finestra A</Modal>}
      {b && <Modal label="B" onClose={chiudiB}>finestra B</Modal>}
    </>
  );
}

describe("Modal: Esc chiude solo la finestra in primo piano", () => {
  it("con due finestre Esc chiude la più recente; la più vecchia aspetta un altro Esc", () => {
    const chiudiA = vi.fn();
    const chiudiB = vi.fn();
    const { rerender } = render(<Due a b={false} chiudiA={chiudiA} chiudiB={chiudiB} />);
    rerender(<Due a b chiudiA={chiudiA} chiudiB={chiudiB} />);
    esc();
    expect(chiudiB).toHaveBeenCalledTimes(1);
    expect(chiudiA).not.toHaveBeenCalled();

    rerender(<Due a b={false} chiudiA={chiudiA} chiudiB={chiudiB} />); // B si è chiusa
    esc();
    expect(chiudiA).toHaveBeenCalledTimes(1);
    expect(chiudiB).toHaveBeenCalledTimes(1);
  });

  it("chiusa la finestra più vecchia per prima, Esc vale ancora per quella più recente", () => {
    const chiudiA = vi.fn();
    const chiudiB = vi.fn();
    const { rerender } = render(<Due a b={false} chiudiA={chiudiA} chiudiB={chiudiB} />);
    rerender(<Due a b chiudiA={chiudiA} chiudiB={chiudiB} />);
    rerender(<Due a={false} b chiudiA={chiudiA} chiudiB={chiudiB} />);
    esc();
    expect(chiudiB).toHaveBeenCalledTimes(1);
    expect(chiudiA).not.toHaveBeenCalled();
  });

  it("un onClose nuovo a ogni ridisegno non riaggancia l'Esc, e vale sempre l'ultimo", () => {
    const aggiunte = vi.spyOn(window, "addEventListener");
    const rimosse = vi.spyOn(window, "removeEventListener");
    const tastiera = (spia: { mock: { calls: unknown[][] } }) => spia.mock.calls.filter(([tipo]) => tipo === "keydown").length;
    const vecchio = vi.fn();
    const nuovo = vi.fn();
    const { rerender, unmount } = render(<Modal label="Scheda" onClose={() => vecchio()}>contenuto</Modal>);
    for (let i = 0; i < 5; i++) rerender(<Modal label="Scheda" onClose={() => nuovo()}>contenuto {i}</Modal>);
    expect(tastiera(aggiunte)).toBe(1);
    expect(tastiera(rimosse)).toBe(0);
    esc();
    expect(nuovo).toHaveBeenCalledTimes(1);
    expect(vecchio).not.toHaveBeenCalled();
    unmount();
    expect(tastiera(rimosse)).toBe(1); // chiusa l'ultima finestra, l'Esc si stacca
  });
});

/** La scheda di una voce con dentro la conferma di eliminazione (un'altra Modal), come GiocatoreModal */
function SchedaConConferma({ onClose }: { onClose: () => void }) {
  const [conferma, setConferma] = useState(false);
  return (
    <Modal label="Scheda giocatore" onClose={onClose}>
      <button onClick={() => setConferma(true)}>Elimina</button>
      <button>Modifica</button>
      {conferma && <ConfirmDialog title="Eliminare il giocatore?" onConfirm={nulla} onCancel={() => setConferma(false)}>Verrà eliminato.</ConfirmDialog>}
    </Modal>
  );
}

/** La pagina dell'anagrafe: due card, ognuna con la sua X (qui «Elimina Luigi» è la X di un'altra card), e la scheda di Mario */
function Pagina({ onChiudiScheda = nulla }: { onChiudiScheda?: () => void }) {
  const [scheda, setScheda] = useState(false);
  return (
    <>
      <button>Elimina Luigi</button>
      <button onClick={() => setScheda(true)}>Mario Rossi</button>
      {scheda && <SchedaConConferma onClose={() => { onChiudiScheda(); setScheda(false); }} />}
    </>
  );
}

describe("Modal: la conferma sopra una scheda", () => {
  /** Apre la scheda di Mario dalla tastiera e poi la conferma di «Elimina». Restituisce i pulsanti della pagina e della scheda */
  function apriSchedaEConferma(onChiudiScheda?: () => void) {
    render(<Pagina onChiudiScheda={onChiudiScheda} />);
    const mario = screen.getByRole("button", { name: "Mario Rossi" });
    mario.focus();
    fireEvent.click(mario);
    const elimina = screen.getByRole("button", { name: "Elimina" });
    expect(document.activeElement).toBe(elimina); // il primo elemento della scheda
    fireEvent.click(elimina);
    const conferma = screen.getByRole("dialog", { name: "Eliminare il giocatore?" });
    return { mario, elimina, conferma, luigi: screen.getByRole("button", { name: "Elimina Luigi" }) };
  }

  it("il focus passa alla conferma, sul pulsante più sicuro: «Annulla»", () => {
    const { conferma } = apriSchedaEConferma();
    expect(document.activeElement).toBe(within(conferma).getByRole("button", { name: "Annulla" }));
  });

  it("Tab resta nella conferma: non arriva alla scheda sotto né alla X di un'altra card", () => {
    const { conferma, luigi } = apriSchedaEConferma();
    const chiudi = within(conferma).getByRole("button", { name: "Chiudi" });
    const sceglie = within(conferma).getByRole("button", { name: "Conferma" });

    sceglie.focus();
    expect(tab()).toBe(false);
    expect(document.activeElement).toBe(chiudi); // il giro è dentro la conferma
    expect(tab(true)).toBe(false);
    expect(document.activeElement).toBe(sceglie);

    luigi.focus(); // se il focus fosse sulla pagina sotto, Tab lo riporta nella conferma e non apre un'altra conferma
    expect(tab()).toBe(false);
    expect(conferma.contains(document.activeElement)).toBe(true);
  });

  it("Esc chiude solo la conferma e il focus torna a «Elimina»; un secondo Esc chiude la scheda e il focus torna alla pagina", () => {
    const onChiudiScheda = vi.fn();
    const { mario, elimina } = apriSchedaEConferma(onChiudiScheda);
    esc();
    expect(screen.queryByRole("dialog", { name: "Eliminare il giocatore?" })).toBeNull();
    expect(screen.getByRole("dialog", { name: "Scheda giocatore" })).toBeTruthy();
    expect(onChiudiScheda).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(elimina);

    esc();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onChiudiScheda).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(mario);
  });

  it("con Esc tenuto premuto chiude solo la conferma: le ripetizioni automatiche del tasto non chiudono anche la scheda", () => {
    const onChiudiScheda = vi.fn();
    apriSchedaEConferma(onChiudiScheda);
    esc(); // la pressione: chiude la conferma
    expect(screen.queryByRole("dialog", { name: "Eliminare il giocatore?" })).toBeNull();
    for (let i = 0; i < 5; i++) fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape", repeat: true }); // il tasto tenuto
    expect(onChiudiScheda).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Scheda giocatore" })).toBeTruthy();
    esc(); // un'altra pressione: adesso tocca alla scheda
    expect(onChiudiScheda).toHaveBeenCalledTimes(1);
  });

  it("se scheda e conferma si smontano insieme (tasto «Indietro») la pila si svuota: un Esc dopo non chiama niente delle finestre di prima", () => {
    const onChiudiScheda = vi.fn();
    const { unmount } = render(<Pagina onChiudiScheda={onChiudiScheda} />);
    const mario = screen.getByRole("button", { name: "Mario Rossi" });
    mario.focus();
    fireEvent.click(mario);
    fireEvent.click(screen.getByRole("button", { name: "Elimina" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    unmount();
    esc();
    expect(onChiudiScheda).not.toHaveBeenCalled();
  });
});
