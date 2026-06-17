/** Timer di gara per il 3x3: countdown 10 min, shot clock 12 s, punteggio live.
 *  Modale a tutto schermo, usato dal tavolo durante la partita. */
import { useState, useEffect, useRef } from "react";
import { INK, ORANGE, PAPER, RED, RULE } from "../../constants/colors";

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

  return (
    <div style={{
      position: "fixed", inset: 0, background: INK, color: PAPER,
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", zIndex: 1000, padding: 20,
    }}>
      {/* Chiudi */}
      <button onClick={onClose} className="linkbtn"
        style={{ position: "absolute", top: 16, right: 20, color: PAPER, fontSize: 22, opacity: 0.7 }}>
        ✕
      </button>

      {/* Squadre */}
      <div style={{ display: "flex", gap: 32, fontSize: "clamp(13px, 3vw, 16px)", fontFamily: "'Archivo', sans-serif", fontWeight: 700, opacity: 0.7, marginBottom: 8 }}>
        <span>{teamA ?? "Squadra A"}</span>
        <span>vs</span>
        <span>{teamB ?? "Squadra B"}</span>
      </div>

      {/* Punteggio */}
      <div style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 18 }}>
        <div style={{ textAlign: "center" }}>
          <div className="disp" style={{ fontSize: "clamp(64px, 14vw, 96px)", lineHeight: 1, color: scoreA > scoreB ? ORANGE : PAPER }}>
            {scoreA}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
            <button onClick={() => addPoint("A", 1)} className="redbtn" style={{ padding: "10px 16px", fontSize: 18 }}>+1</button>
            <button onClick={() => addPoint("A", 2)} className="redbtn" style={{ padding: "10px 16px", fontSize: 18 }}>+2</button>
            <button onClick={() => setScoreA((s) => Math.max(0, s - 1))} className="linkbtn" style={{ color: PAPER, opacity: 0.5, fontSize: 13 }}>−</button>
          </div>
        </div>

        <div className="disp" style={{ fontSize: "clamp(28px, 6vw, 40px)", opacity: 0.4 }}>—</div>

        <div style={{ textAlign: "center" }}>
          <div className="disp" style={{ fontSize: "clamp(64px, 14vw, 96px)", lineHeight: 1, color: scoreB > scoreA ? ORANGE : PAPER }}>
            {scoreB}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
            <button onClick={() => addPoint("B", 1)} className="redbtn" style={{ padding: "10px 16px", fontSize: 18 }}>+1</button>
            <button onClick={() => addPoint("B", 2)} className="redbtn" style={{ padding: "10px 16px", fontSize: 18 }}>+2</button>
            <button onClick={() => setScoreB((s) => Math.max(0, s - 1))} className="linkbtn" style={{ color: PAPER, opacity: 0.5, fontSize: 13 }}>−</button>
          </div>
        </div>
      </div>

      {/* Countdown + Shot clock */}
      <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 16, width: "100%", maxWidth: 480, textAlign: "center" }}>
        <div className="disp" style={{ fontSize: "clamp(48px, 10vw, 72px)", color: timeDanger ? RED : PAPER, lineHeight: 1 }}>
          {overtime ? "OT" : fmt(timeLeft)}
        </div>
        <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 13, opacity: 0.6, marginBottom: 10 }}>
          {overtime ? `Supplementare: vince chi segna per primo ${2} pt` : "Tempo rimanente"}
        </div>

        {/* Shot clock */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 18 }}>
          <div className="disp" style={{
            fontSize: 40, minWidth: 60, textAlign: "center",
            color: shotDanger ? RED : ORANGE,
          }}>
            {shotClock}
          </div>
          <div>
            <div style={{ fontFamily: "'Archivo', sans-serif", fontSize: 11, fontWeight: 700, opacity: 0.6 }}>SHOT CLOCK</div>
            <button onClick={resetShot} className="linkbtn" style={{ color: PAPER, opacity: 0.7, fontSize: 13 }}>Reset 12s</button>
          </div>
        </div>

        {/* Controlli */}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {gameOver ? (
            <span className="disp" style={{ fontSize: 18, color: ORANGE }}>
              {scoreA >= 21 ? (teamA ?? "A") : scoreB >= 21 ? (teamB ?? "B") : "Fine tempo"} — Partita conclusa
            </span>
          ) : (
            <button onClick={() => setRunning((r) => !r)} className="blackbtn"
              style={{ background: running ? RED : ORANGE, color: PAPER, fontSize: 20, padding: "12px 32px" }}>
              {running ? "STOP" : "START"}
            </button>
          )}
          <button onClick={resetAll} className="linkbtn" style={{ color: PAPER, opacity: 0.6, fontSize: 13 }}>
            Reset tutto
          </button>
        </div>
      </div>
    </div>
  );
}
