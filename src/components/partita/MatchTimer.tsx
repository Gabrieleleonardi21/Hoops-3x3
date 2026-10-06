/** Timer di gara per il 3x3: cronometro, shot clock e punteggio live, con le regole della tappa (punteggio di vittoria, durata,
 *  possesso, supplementare). Finestra (Modal) usata dal tavolo durante la partita: Esc, X e blocco dello scroll come le altre.
 *  A tempo scaduto in parità il supplementare non parte da solo: nel 3x3 c'è una pausa, in cui si può ancora registrare un canestro
 *  del tempo regolamentare, e il supplementare parte quando l'operatore preme «Avvia supplementare».
 *  Il timer non salva niente nella tappa: chiuderlo con la partita cominciata chiede conferma, perché si perdono punteggio e tempo. */
import { useState, useEffect } from "react";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { statoGara, supplementareValido, type Lato, type Punti } from "../../utils/statoGara";
import type { Regole } from "../../types";

/** Un conto alla rovescia, in millisecondi. In marcia tiene l'istante in cui finisce (`fine`), in pausa il tempo che gli resta
 *  (`resto`): quanto manca si calcola sempre dall'orologio e mai contando gli scatti del timer, che con la scheda in secondo
 *  piano o il telefono bloccato rallentano o non arrivano. */
type Cronometro = { fine: number } | { resto: number };

/** Il cronometro di gara e quello del possesso, letti all'istante `ora` (quello dell'ultimo scatto o dell'ultima azione) */
interface Tempo { gara: Cronometro; possesso: Cronometro; ora: number }

/** Ms che mancano alla fine di `c` all'istante `ora`. Scaduto, il cronometro di gara resta a 0; il possesso, che ha un `periodo`,
 *  ricomincia da capo nell'istante in cui è scaduto: così, anche dopo scatti mancati, mostra il punto giusto del suo ciclo */
function mancano(c: Cronometro, ora: number, periodo?: number): number {
  if (!("fine" in c)) return c.resto;
  if (ora < c.fine) return c.fine - ora;
  if (periodo === undefined) return 0;
  return periodo - ((ora - c.fine) % periodo);
}

/** `c` in marcia da `ora` (se lo è già, com'è) */
function avviato(c: Cronometro, ora: number): Cronometro {
  if ("fine" in c) return c;
  return { fine: ora + c.resto };
}

/** Tutti e due i cronometri a durata intera e fermi */
const daCapo = (durata: number, periodo: number): Tempo => ({ gara: { resto: durata }, possesso: { resto: periodo }, ora: 0 });

/** Parte il possesso, e il cronometro di gara se gli resta tempo: nel supplementare il cronometro di gara non c'è */
function avviati(t: Tempo, ora: number): Tempo {
  let gara = t.gara;
  if (mancano(gara, ora) > 0) gara = avviato(gara, ora);
  return { gara, possesso: avviato(t.possesso, ora), ora };
}

/** Si ferma tutto nell'istante `quando`, tenendo il tempo che resta a ciascuno */
function fermati(t: Tempo, quando: number, periodo: number): Tempo {
  return { gara: { resto: mancano(t.gara, quando) }, possesso: { resto: mancano(t.possesso, quando, periodo) }, ora: quando };
}

/** Lo scatto del timer, e il primo passo di ogni azione dell'operatore (`agisci`): legge l'orologio e, se il tempo di gara è finito,
 *  ferma tutto nell'istante della fine (non in quello, un po' dopo, dello scatto: con la scheda in secondo piano può essere molto dopo) */
function scattato(t: Tempo, ora: number, periodo: number): Tempo {
  if ("fine" in t.gara && ora >= t.gara.fine) return fermati(t, t.gara.fine, periodo);
  return { ...t, ora };
}

/** Il possesso ricomincia da un periodo intero; continua a correre se correva */
function possessoRiportato(t: Tempo, ora: number, periodo: number): Tempo {
  let possesso: Cronometro = { resto: periodo };
  if ("fine" in t.possesso) possesso = { fine: ora + periodo };
  return { ...t, possesso, ora };
}

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const LATI: Lato[] = ["a", "b"];
const ALTRO: Record<Lato, Lato> = { a: "b", b: "a" };
/** B sta a destra del trattino, che ha `order-2` */
const ORDINE: Record<Lato, string> = { a: "", b: "order-3" };

/** Il punteggio di chi è avanti è arancione */
function colorePunti(inVantaggio: boolean): string {
  if (inVantaggio) return "text-court";
  return "text-chalk";
}

export function MatchTimer({ regole, teamA, teamB, onClose }: {
  regole: Regole;
  teamA?: string;
  teamB?: string;
  onClose: () => void;
}) {
  // Un possesso a 0 non avrebbe un ciclo (le regole dell'ospite, salvate da versioni vecchie, possono esserlo): almeno 1 secondo
  const possesso = Math.max(1, regole.shot);
  const durataMs = regole.durata * 60_000;
  const possessoMs = possesso * 1000;

  const [tempo, setTempo] = useState(() => daCapo(durataMs, possessoMs));
  const [punti, setPunti] = useState<Punti>({ a: 0, b: 0 });
  // Il punteggio da cui è stato avviato il supplementare (con il suo pulsante), per contare da lì i suoi punti (null: non è avviato)
  const [inizioSupplementare, setInizioSupplementare] = useState<Punti | null>(null);

  const nomi: Record<Lato, string> = { a: teamA ?? "Squadra A", b: teamB ?? "Squadra B" };
  const inMarcia = "fine" in tempo.gara || "fine" in tempo.possesso;
  const restoGara = mancano(tempo.gara, tempo.ora);
  // Secondi interi: un secondo conta finché non è passato per intero (il possesso mostra 12, 11, … 1 e poi ricomincia da 12)
  const timeLeft  = Math.ceil(restoGara / 1000);
  const shotClock = Math.ceil(mancano(tempo.possesso, tempo.ora, possessoMs) / 1000);
  const stato = statoGara({ punti, rimasto: restoGara / 1000, inizioSupplementare }, regole);
  const inSupplementare = stato.fase === "supplementare" || stato.fase === "vintaAlSupplementare";

  // Mentre un cronometro corre, uno scatto ogni 100 ms ridisegna lo schermo. Lo scatto non conta il tempo: legge l'orologio
  useEffect(() => {
    if (!inMarcia) return;
    const id = setInterval(() => {
      const adesso = Date.now();
      setTempo((t) => scattato(t, adesso, possessoMs));
    }, 100);
    return () => clearInterval(id);
  }, [inMarcia, possessoMs]);

  /** Un'azione dell'operatore sul tempo. Prima legge l'orologio con `scattato`: un tempo di gara scaduto che lo scatto non ha ancora
   *  visto (fino a 100 ms, di più dopo un'assenza lunga con la scheda in secondo piano) si registra adesso, con i cronometri fermi
   *  nell'istante della scadenza, e l'azione parte da lì. Senza questo toccherebbe cronometri ancora in marcia oltre la fine, e lo
   *  scatto dopo li fermerebbe all'istante della scadenza, anteriore all'azione, disfacendola (un reset del possesso darebbe 13) */
  const agisci = (azione: (t: Tempo, adesso: number, periodo: number) => Tempo) => {
    const adesso = Date.now();
    setTempo((t) => azione(scattato(t, adesso, possessoMs), adesso, possessoMs));
  };

  const avviaOFerma = () => {
    // Si fa ciò che l'operatore vedeva sul pulsante: se premeva STOP si ferma tutto, anche se intanto il tempo è scaduto
    if (inMarcia) agisci(fermati);
    else agisci(avviati);
  };

  const resetAll = () => {
    setTempo(daCapo(durataMs, possessoMs));
    setPunti({ a: 0, b: 0 });
    setInizioSupplementare(null);
  };

  const resetShot = () => agisci(possessoRiportato);

  /** Avvia il supplementare dal punteggio di adesso: i suoi punti si contano da qui. Prima del pulsante un canestro registrato in
   *  ritardo o una correzione contano ancora sul tempo regolamentare. Il supplementare comincia con un possesso nuovo e non con quello
   *  rimasto dal tempo regolamentare (congelato allo scadere): i cronometri sono già fermi, quindi il possesso riparte da un periodo
   *  intero e resta fermo fino a START */
  const avviaSupplementare = () => {
    setInizioSupplementare(punti);
    agisci(possessoRiportato);
  };

  /** Aggiunge `delta` punti alla squadra `lato` (con un valore negativo li toglie, per correggere) */
  const segna = (lato: Lato, delta: number) => {
    const nuovi = { ...punti, [lato]: Math.max(0, punti[lato] + delta) };
    // Sotto il punteggio da cui è partito, il supplementare non c'è più: la parità che lo giustificava è stata corretta via, e per
    // ripartire serve di nuovo il pulsante. Tornare al punteggio di partenza (togliere un punto del supplementare) non lo annulla
    let inizio = inizioSupplementare;
    if (inizio && !supplementareValido(nuovi, inizio)) inizio = null;
    setPunti(nuovi);
    setInizioSupplementare(inizio);
    // Se questo canestro decide la partita i cronometri si fermano subito
    const dopo = statoGara({ punti: nuovi, rimasto: restoGara / 1000, inizioSupplementare: inizio }, regole);
    if ("vincitore" in dopo) agisci(fermati);
  };

  let coloreTempo = "text-chalk";
  if (timeLeft <= 60) coloreTempo = "text-loss";
  let coloreShot = "border-court/50 text-court";
  if (shotClock <= 4) coloreShot = "border-loss text-loss";

  let orologio = fmt(timeLeft);
  let didascalia = "Tempo rimanente";
  if (stato.fase === "supplementareDaAvviare") didascalia = "Pareggio: serve il supplementare";
  if (inSupplementare) {
    orologio = "OT"; // nel supplementare il cronometro di gara non c'è
    didascalia = `Supplementare: vince chi segna per primo ${regole.ot} pt`;
  }
  // Vinto il supplementare l'istruzione per giocarlo non serve più: si dice come è finita
  if (stato.fase === "vintaAlSupplementare") didascalia = "Vinta al supplementare";

  // Chiudere il timer (Esc, sfondo, X) fa perdere punteggio e tempo, che il timer non salva nella tappa: se la partita è cominciata,
  // cioè il cronometro è partito o il punteggio non è 0 a 0, lo si dice e si chiede conferma; altrimenti si chiude subito
  const cominciata = inMarcia || restoGara < durataMs || punti.a !== 0 || punti.b !== 0;
  const { chiedi, finestra } = useConfermaPerdita(() => {
    if (!cominciata) return null;
    return `Chiudendo il timer si perdono il punteggio (${punti.a} a ${punti.b}) e il tempo di gara (${orologio}): il timer non li salva nella tappa.`;
  });
  // Con la conferma aperta Esc è della conferma e il timer resta: Modal manda l'Esc solo alla finestra in primo piano
  const chiudi = () => chiedi("Chiudere il timer?", onClose);

  // START/STOP; a tempo scaduto in parità «Avvia supplementare»; a partita decisa il vincitore (togliendo un punto per errore si riapre)
  let etichetta = "START";
  let stileComando = "";
  if (inMarcia) {
    etichetta = "STOP";
    stileComando = "bg-loss text-chalk hover:bg-loss";
  }
  // data-focus-iniziale: all'apertura il focus va su START (vedi Modal), non sul primo pulsante «+1»: un Invio darebbe un punto a una squadra
  let comando = <Button onClick={avviaOFerma} data-focus-iniziale className={`h-12 px-8 text-xl ${stileComando}`}>{etichetta}</Button>;
  if (stato.fase === "supplementareDaAvviare") {
    comando = <Button onClick={avviaSupplementare} className="h-12 px-8 text-xl">Avvia supplementare</Button>;
  }
  if ("vincitore" in stato) {
    comando = <span className="font-display text-xl text-court">{nomi[stato.vincitore]} — Partita conclusa</span>;
  }

  const scoreBtn = "h-11 min-w-11 px-4 font-display text-xl";

  return (
    <Modal label="Timer di gara" title="Timer di gara" width={560} onClose={chiudi}>
      <div className="flex flex-col items-center">
        {/* Squadre */}
        <div className="mb-2 flex gap-8 font-display text-base text-chalk-muted sm:text-lg">
          <span>{nomi.a}</span>
          <span className="text-chalk-dim">vs</span>
          <span>{nomi.b}</span>
        </div>

        {/* Punteggio. La finestra è più stretta dello schermo intero di prima: sotto i 480 px i due blocchi vanno uno sopra
            l'altro, senza trattino, invece di uscire dai lati e restare tagliati */}
        <div className="mb-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
          {LATI.map((lato) => (
            <div key={lato} className={`text-center ${ORDINE[lato]}`}>
              <div className={`font-display leading-none text-[clamp(64px,14vw,112px)] ${colorePunti(punti[lato] > punti[ALTRO[lato]])}`}>
                {punti[lato]}
              </div>
              <div className="mt-2 flex justify-center gap-1.5">
                <Button className={scoreBtn} onClick={() => segna(lato, 1)}>+1</Button>
                <Button className={scoreBtn} onClick={() => segna(lato, 2)}>+2</Button>
                <Button variant="ghost" className={scoreBtn} onClick={() => segna(lato, -1)} aria-label={`Togli un punto a ${nomi[lato]}`}>
                  <Icon name="minus" size={16} />
                </Button>
              </div>
            </div>
          ))}
          <div className="order-2 hidden font-display text-4xl text-chalk-dim min-[480px]:block">–</div>
        </div>

        {/* Countdown + Shot clock */}
        <div className="w-full max-w-md border-t border-asphalt-700 pt-4 text-center">
          <div className={`font-display leading-none text-[clamp(48px,10vw,80px)] ${coloreTempo}`}>
            {orologio}
          </div>
          <div className="mb-3 text-xs text-chalk-muted">{didascalia}</div>

          {/* Shot clock */}
          <div className="mb-5 flex items-center justify-center gap-3">
            <div className={`min-w-16 rounded border px-2 font-display text-5xl ${coloreShot}`}>
              {shotClock}
            </div>
            <div className="text-left">
              <div className="kicker">Shot clock</div>
              <Button variant="link" onClick={resetShot}>Reset {possesso}s</Button>
            </div>
          </div>

          {/* Controlli */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {comando}
            <Button variant="link" className="text-chalk-muted" onClick={resetAll}>Reset tutto</Button>
          </div>
        </div>
      </div>
      {finestra}
    </Modal>
  );
}
