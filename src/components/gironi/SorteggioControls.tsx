/** Controlli del sorteggio: casuale (Fisher-Yates) o per ranking (teste di serie a serpentina).
 *  Avvisa che un nuovo sorteggio azzera i punteggi già registrati. */
import { useState } from "react";
import { RED } from "../../constants/colors";

interface Props {
  hasGironi: boolean;
  onSorteggia: (mode: "casuale" | "ranking") => string | null;
}

export function SorteggioControls({ hasGironi, onSorteggia }: Props) {
  const [error, setError] = useState<string | null>(null);
  const run = (mode: "casuale" | "ranking") => setError(onSorteggia(mode));
  return (
    <>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <button onClick={() => run("casuale")} className="redbtn">🎲 Sorteggio casuale</button>
        <button onClick={() => run("ranking")} className="blackbtn">📊 Sorteggio per ranking</button>
        {hasGironi && (
          <span className="ui" style={{ fontSize: 12.5, fontWeight: 700, color: RED }}>
            Un nuovo sorteggio azzera i punteggi già registrati.
          </span>
        )}
      </div>
      <p className="ui" style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.75, margin: "0 0 14px" }}>
        Il sorteggio per ranking usa i punti ranking del circuito inseriti nelle card delle squadre:
        le teste di serie vengono distribuite a serpentina per bilanciare i gironi.
      </p>
      {error && <p className="ui" style={{ color: RED, fontWeight: 700, fontSize: 13, marginTop: -8 }}>{error}</p>}
    </>
  );
}
