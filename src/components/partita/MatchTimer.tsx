/** Timer di gara per il 3x3: countdown 10 min, shot clock 12 s, punteggio live.
 *  Modale a tutto schermo, usato dal tavolo durante la partita. */
import { useState, useEffect } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

const GAME_MS = 600_000; // 10 minuti
const SHOT_MS = 12_000;  // shot clock FIBA 3x3

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

/** Parte tutto da `ora` */
const avviati = (t: Tempo, ora: number): Tempo => ({ gara: avviato(t.gara, ora), possesso: avviato(t.possesso, ora), ora });

/** Si ferma tutto nell'istante `quando`, tenendo il tempo che resta a ciascuno */
function fermati(t: Tempo, quando: number, periodo: number): Tempo {
  return { gara: { resto: mancano(t.gara, quando) }, possesso: { resto: mancano(t.possesso, quando, periodo) }, ora: quando };
}

/** Lo scatto del timer: legge l'orologio e, se il tempo di gara è finito, ferma tutto nell'istante della fine
 *  (non in quello, un po' dopo, dello scatto: con la scheda in secondo piano può essere molto dopo) */
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

export function MatchTimer({ teamA, teamB, onClose }: {
  teamA?: string;
  teamB?: string;
  onClose: () => void;
}) {
  const [tempo,  setTempo]  = useState(() => daCapo(GAME_MS, SHOT_MS));
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);

  const inMarcia = "fine" in tempo.gara || "fine" in tempo.possesso;
  // Secondi interi: un secondo conta finché non è passato per intero (il possesso mostra 12, 11, … 1 e poi ricomincia da 12)
  const timeLeft  = Math.ceil(mancano(tempo.gara, tempo.ora) / 1000);
  const shotClock = Math.ceil(mancano(tempo.possesso, tempo.ora, SHOT_MS) / 1000);
  const overtime  = timeLeft === 0;

  // Mentre un cronometro corre, uno scatto ogni 100 ms ridisegna lo schermo. Lo scatto non conta il tempo: legge l'orologio
  useEffect(() => {
    if (!inMarcia) return;
    const id = setInterval(() => {
      const adesso = Date.now();
      setTempo((t) => scattato(t, adesso, SHOT_MS));
    }, 100);
    return () => clearInterval(id);
  }, [inMarcia]);

  const avviaOFerma = () => {
    const adesso = Date.now();
    if (inMarcia) setTempo(fermati(tempo, adesso, SHOT_MS));
    else setTempo(avviati(tempo, adesso));
  };

  const resetAll = () => {
    setTempo(daCapo(GAME_MS, SHOT_MS));
    setScoreA(0);
    setScoreB(0);
  };

  const resetShot = () => setTempo(possessoRiportato(tempo, Date.now(), SHOT_MS));
  const addPoint  = (team: "A" | "B", pts: number) => {
    if (team === "A") setScoreA((s) => s + pts);
    else              setScoreB((s) => s + pts);
  };

  // Segnale di fine: tempo scaduto o qualcuno a 21
  const gameOver = timeLeft === 0 || scoreA >= 21 || scoreB >= 21;
  const shotDanger = shotClock <= 4;
  const timeDanger = timeLeft <= 60;

  const scoreBtn = "h-11 min-w-11 px-4 font-display text-xl";

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-asphalt-950 p-5 text-chalk" role="dialog" aria-label="Timer di gara">
      {/* Chiudi */}
      <button onClick={onClose} className="absolute right-5 top-4 text-chalk-muted hover:text-chalk" aria-label="Chiudi timer">
        <Icon name="close" size={24} />
      </button>

      {/* Squadre */}
      <div className="mb-2 flex gap-8 font-display text-base text-chalk-muted sm:text-lg">
        <span>{teamA ?? "Squadra A"}</span>
        <span className="text-chalk-dim">vs</span>
        <span>{teamB ?? "Squadra B"}</span>
      </div>

      {/* Punteggio */}
      <div className="mb-5 flex items-center gap-6">
        {([["A", scoreA, setScoreA], ["B", scoreB, setScoreB]] as const).map(([side, score, setScore], i) => (
          <div key={side} className={`text-center ${i === 1 ? "order-3" : ""}`}>
            <div className={`font-display leading-none text-[clamp(64px,14vw,112px)] ${score > (side === "A" ? scoreB : scoreA) ? "text-court" : "text-chalk"}`}>
              {score}
            </div>
            <div className="mt-2 flex justify-center gap-1.5">
              <Button className={scoreBtn} onClick={() => addPoint(side, 1)}>+1</Button>
              <Button className={scoreBtn} onClick={() => addPoint(side, 2)}>+2</Button>
              <Button variant="ghost" className={scoreBtn} onClick={() => setScore((s) => Math.max(0, s - 1))} aria-label={`Togli un punto a ${side === "A" ? teamA ?? "A" : teamB ?? "B"}`}>
                <Icon name="minus" size={16} />
              </Button>
            </div>
          </div>
        ))}
        <div className="order-2 font-display text-4xl text-chalk-dim">–</div>
      </div>

      {/* Countdown + Shot clock */}
      <div className="w-full max-w-md border-t border-asphalt-700 pt-4 text-center">
        <div className={`font-display leading-none text-[clamp(48px,10vw,80px)] ${timeDanger ? "text-loss" : "text-chalk"}`}>
          {overtime ? "OT" : fmt(timeLeft)}
        </div>
        <div className="mb-3 text-xs text-chalk-muted">
          {overtime ? "Supplementare: vince chi segna per primo 2 pt" : "Tempo rimanente"}
        </div>

        {/* Shot clock */}
        <div className="mb-5 flex items-center justify-center gap-3">
          <div className={`min-w-16 rounded border px-2 font-display text-5xl ${shotDanger ? "border-loss text-loss" : "border-court/50 text-court"}`}>
            {shotClock}
          </div>
          <div className="text-left">
            <div className="kicker">Shot clock</div>
            <Button variant="link" onClick={resetShot}>Reset 12s</Button>
          </div>
        </div>

        {/* Controlli */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          {gameOver ? (
            <span className="font-display text-xl text-court">
              {scoreA >= 21 ? (teamA ?? "A") : scoreB >= 21 ? (teamB ?? "B") : "Fine tempo"} — Partita conclusa
            </span>
          ) : (
            <Button onClick={avviaOFerma} className={`h-12 px-8 text-xl ${inMarcia ? "bg-loss text-chalk hover:bg-loss" : ""}`}>
              {inMarcia ? "STOP" : "START"}
            </Button>
          )}
          <Button variant="link" className="text-chalk-muted" onClick={resetAll}>Reset tutto</Button>
        </div>
      </div>
    </div>
  );
}
