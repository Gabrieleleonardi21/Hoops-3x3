/** Timer di gara per il 3x3: countdown 10 min, shot clock 12 s, punteggio live.
 *  Modale a tutto schermo, usato dal tavolo durante la partita. */
import { useState, useEffect, useRef } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

const GAME_SECS  = 600; // 10 minuti
const SHOT_SECS  = 12;  // shot clock FIBA 3x3

function fmt(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function MatchTimer({ teamA, teamB, onClose }: {
  teamA?: string;
  teamB?: string;
  onClose: () => void;
}) {
  const [timeLeft,  setTimeLeft]  = useState(GAME_SECS);
  const [shotClock, setShotClock] = useState(SHOT_SECS);
  const [running,   setRunning]   = useState(false);
  const [scoreA,    setScoreA]    = useState(0);
  const [scoreB,    setScoreB]    = useState(0);
  const [overtime,  setOvertime]  = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Gestione tick principale
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setRunning(false);
          setOvertime(true);
          return 0;
        }
        return t - 1;
      });
      setShotClock((s) => {
        if (s <= 1) return SHOT_SECS; // auto-reset shot clock
        return s - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const resetAll = () => {
    setRunning(false);
    setTimeLeft(GAME_SECS);
    setShotClock(SHOT_SECS);
    setScoreA(0);
    setScoreB(0);
    setOvertime(false);
  };

  const resetShot = () => setShotClock(SHOT_SECS);
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
            <Button onClick={() => setRunning((r) => !r)} className={`h-12 px-8 text-xl ${running ? "bg-loss text-chalk hover:bg-loss" : ""}`}>
              {running ? "STOP" : "START"}
            </Button>
          )}
          <Button variant="link" className="text-chalk-muted" onClick={resetAll}>Reset tutto</Button>
        </div>
      </div>
    </div>
  );
}
