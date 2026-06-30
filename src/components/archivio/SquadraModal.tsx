import { INK, PAPER, RULE } from "../../constants/colors";
import type { SquadraTappa } from "../../types";
import { useScrollLock } from "../../hooks/useScrollLock";
import { safeUrl } from "../../utils/safeUrl";

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
      className="modal-overlay"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Scheda squadra ${squadra.nome}`}
        className="modal-card"
        style={{ width: "min(480px, 100%)", maxHeight: "85vh", padding: 24 }}
      >
        {/* Header: pulsante chiudi */}
        <div className="flex jc-end" style={{ marginBottom: 4 }}>
          <button onClick={onClose} className="linkbtn t-ink" style={{ fontSize: 22 }} aria-label="Chiudi">×</button>
        </div>

        {/* Logo centrato — cliccabile se la squadra ha un sito web */}
        {squadra.logo && (
          <div className="flex jc-center" style={{ marginBottom: 16 }}>
            {squadra.website ? (
              <a href={safeUrl(squadra.website)} target="_blank" rel="noopener noreferrer" title={`Vai al sito di ${squadra.nome}`}>
                <img
                  src={safeUrl(squadra.logo)}
                  alt={`Logo ${squadra.nome}`}
                  style={{ width: 120, height: 120, objectFit: "contain", cursor: "pointer" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </a>
            ) : (
              <img
                src={safeUrl(squadra.logo)}
                alt={`Logo ${squadra.nome}`}
                style={{ width: 120, height: 120, objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
          </div>
        )}

        {/* Nome squadra */}
        <div className="disp up tac" style={{ fontSize: 26, borderBottom: `3px solid ${INK}`, paddingBottom: 10, marginBottom: 14 }}>
          {squadra.nome}
        </div>

        {/* Ranking */}
        {Number(squadra.rank) > 0 && (
          <div className="ui t-orange tac" style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>
            Ranking circuito: {squadra.rank} pt
          </div>
        )}

        {/* Link Instagram se disponibile */}
        {squadra.instagram && (
          <div className="tac" style={{ marginBottom: 14 }}>
            <a href={safeUrl(squadra.instagram)} target="_blank" rel="noopener noreferrer"
               className="ui t-ink" style={{ fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              Instagram ↗
            </a>
          </div>
        )}

        {/* Roster */}
        <div style={{ background: PAPER, border: `1px solid ${RULE}`, padding: 14 }}>
          <div className="kicker" style={{ fontSize: 11, marginBottom: 10 }}>
            Roster
          </div>
          {giocatori.length === 0 ? (
            <span className="ui" style={{ fontSize: 13, opacity: 0.6 }}>Nessun giocatore registrato.</span>
          ) : (
            <div className="col gap-6">
              {giocatori.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { onClose(); onSelectPlayer(p.id); }}
                  className="ui row between tal t-ink"
                  title={hasStats ? `Analisi di ${p.nome}` : "Nessuna statistica per questa tappa"}
                  disabled={!hasStats}
                  style={{
                    background: "transparent",
                    border: `1.5px solid ${INK}`,
                    padding: "8px 14px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: hasStats ? "pointer" : "default",
                    opacity: hasStats ? 1 : 0.55,
                  }}
                >
                  {p.nome}
                  {hasStats && <span className="t-orange" style={{ fontSize: 12 }}>▸ analisi</span>}
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
