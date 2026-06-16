import { INK, ORANGE, PAPER, RULE } from "../../constants/colors";
import type { SquadraTappa } from "../../types";
import { useScrollLock } from "../../hooks/useScrollLock";

/** Modale con le info ingrandite di una squadra: logo, roster cliccabile per analisi */
export function SquadraModal({
  squadra,
  onClose,
  onSelectPlayer,
  hasStats,
}: {
  squadra: SquadraTappa;
  onClose: () => void;
  onSelectPlayer: (pid: string) => void;
  hasStats: boolean;
}) {
  useScrollLock();
  const giocatori = (squadra.giocatori || []).filter((p) => p.nome.trim());

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(23,32,58,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Scheda squadra ${squadra.nome}`}
        style={{ background: "var(--card)", border: `2px solid ${INK}`, width: "min(480px, 100%)", maxHeight: "85vh", overflowY: "auto", padding: 24 }}
      >
        {/* Header: pulsante chiudi */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button onClick={onClose} className="linkbtn" style={{ color: INK, fontSize: 22 }} aria-label="Chiudi">×</button>
        </div>

        {/* Logo centrato — cliccabile se la squadra ha un sito web */}
        {squadra.logo && (
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
            {squadra.website ? (
              <a href={squadra.website} target="_blank" rel="noopener noreferrer" title={`Vai al sito di ${squadra.nome}`}>
                <img
                  src={squadra.logo}
                  alt={`Logo ${squadra.nome}`}
                  style={{ width: 120, height: 120, objectFit: "contain", cursor: "pointer" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </a>
            ) : (
              <img
                src={squadra.logo}
                alt={`Logo ${squadra.nome}`}
                style={{ width: 120, height: 120, objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>
        )}

        {/* Nome squadra */}
        <div className="disp" style={{ fontSize: 26, textTransform: "uppercase", textAlign: "center", borderBottom: `3px solid ${INK}`, paddingBottom: 10, marginBottom: 14 }}>
          {squadra.nome}
        </div>

        {/* Ranking */}
        {Number(squadra.rank) > 0 && (
          <div className="ui" style={{ fontSize: 13, fontWeight: 700, color: ORANGE, textAlign: "center", marginBottom: 14 }}>
            Ranking circuito: {squadra.rank} pt
          </div>
        )}

        {/* Link Instagram se disponibile */}
        {squadra.instagram && (
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <a href={squadra.instagram} target="_blank" rel="noopener noreferrer"
               className="ui" style={{ fontSize: 13, fontWeight: 700, color: INK, textDecoration: "none" }}>
              Instagram ↗
            </a>
          </div>
        )}

        {/* Roster */}
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, padding: 14 }}>
          <div className="ui" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
            Roster
          </div>
          {giocatori.length === 0 ? (
            <span className="ui" style={{ fontSize: 13, opacity: 0.6 }}>Nessun giocatore registrato.</span>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {giocatori.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onClose(); onSelectPlayer(p.id); }}
                  className="ui"
                  title={hasStats ? `Analisi di ${p.nome}` : "Nessuna statistica per questa tappa"}
                  disabled={!hasStats}
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${INK}`,
                    padding: "8px 14px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: hasStats ? "pointer" : "default",
                    color: INK,
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    opacity: hasStats ? 1 : 0.55,
                  }}
                >
                  {p.nome}
                  {hasStats && <span style={{ color: ORANGE, fontSize: 12 }}>▸ analisi</span>}
                </button>
              ))}
            </div>
          )}
          {hasStats && (
            <p className="ui" style={{ fontSize: 11, opacity: 0.6, margin: "10px 0 0" }}>
              Clicca un giocatore per vedere le sue statistiche e gli esercizi consigliati.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
