import { INK, ORANGE, PAPER, RED, RULE } from "../../constants/colors";
import type { RegGiocatore, RegSquadra, User } from "../../types";
import { useScrollLock } from "../../hooks/useScrollLock";

/** Modale con tutte le informazioni di una squadra dell'anagrafe */
export function SquadraAnagrafeModal({
  s,
  giocatori,
  user,
  onClose,
  onRemove,
}: {
  s: RegSquadra;
  giocatori: RegGiocatore[];
  user: User;
  onClose: () => void;
  onRemove: () => void;
}) {
  useScrollLock();

  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };
  const canDelete = !user.guest && s.autore === user.name;

  const handleRemove = () => {
    onRemove();
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(23,32,58,0.55)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={`Scheda squadra ${s.nome}`}
        style={{ background: "var(--card)", border: `2px solid ${INK}`, width: "min(500px, 100%)", maxHeight: "88vh", overflowY: "auto", padding: 24 }}
      >
        {/* Pulsante chiudi */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 4 }}>
          <button onClick={onClose} className="linkbtn" style={{ color: INK, fontSize: 22 }} aria-label="Chiudi">×</button>
        </div>

        {/* Logo centrato — cliccabile se la squadra ha un sito web */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          {s.logo ? (
            s.website ? (
              <a href={s.website} target="_blank" rel="noopener noreferrer" title={`Vai al sito di ${s.nome}`}>
                <img
                  src={s.logo}
                  alt={`Logo ${s.nome}`}
                  style={{ width: 130, height: 130, objectFit: "contain", cursor: "pointer" }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              </a>
            ) : (
              <img
                src={s.logo}
                alt={`Logo ${s.nome}`}
                style={{ width: 130, height: 130, objectFit: "contain" }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )
          ) : (
            <div style={{ width: 100, height: 100, background: INK, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "var(--card)", fontSize: 28, fontFamily: "var(--disp)" }}>3×3</span>
            </div>
          )}
        </div>

        {/* Nome */}
        <div className="disp" style={{ fontSize: 26, textTransform: "uppercase", textAlign: "center", borderBottom: `3px solid ${INK}`, paddingBottom: 10, marginBottom: 14 }}>
          {s.nome}
        </div>

        {/* Info principali */}
        <div className="ui" style={{ fontSize: 13.5, lineHeight: 1.9, marginBottom: 14 }}>
          {Number(s.rank) > 0 && (
            <div style={{ fontWeight: 700, color: ORANGE }}>Ranking circuito: {s.rank} pt</div>
          )}
          {s.citta && (
            <div>
              Città: <strong>{s.citta}</strong>
              {s.anno ? ` · Fondata nel ${s.anno}` : ""}
            </div>
          )}
          {!s.citta && s.anno && <div>Fondata nel <strong>{s.anno}</strong></div>}
          {s.referente && <div>Referente / capitano: <strong>{s.referente}</strong></div>}
          {s.website && (
            <div>
              Sito web:{" "}
              <a href={s.website} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE, fontWeight: 700 }}>
                {s.website.replace(/^https?:\/\//, "")}
              </a>
            </div>
          )}
        </div>

        {/* Roster */}
        {(s.roster || []).length > 0 && (
          <div style={{ background: PAPER, border: `1px solid ${RULE}`, padding: 14, marginBottom: 14 }}>
            <div className="ui" style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              Roster ({s.roster.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {s.roster.map((id) => (
                <div key={id} className="ui" style={{ fontSize: 14, fontWeight: 700, borderBottom: `1px dotted ${RULE}`, paddingBottom: 4 }}>
                  {gName(id)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Note */}
        {s.note && (
          <p style={{ fontSize: 13.5, fontStyle: "italic", margin: "0 0 14px" }}>{s.note}</p>
        )}

        {/* Footer: autore + elimina */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${RULE}`, paddingTop: 10, marginTop: 4 }}>
          <span className="ui" style={{ fontSize: 10.5, opacity: 0.5 }}>Registrata da {s.autore}</span>
          {canDelete && (
            <button onClick={handleRemove} className="linkbtn" style={{ color: RED, fontWeight: 700, fontSize: 13 }}>
              Elimina squadra
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
