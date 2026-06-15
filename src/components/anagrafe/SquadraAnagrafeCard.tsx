import { INK, ORANGE } from "../../constants/colors";
import type { RegGiocatore, RegSquadra, User } from "../../types";

export function SquadraAnagrafeCard({ s, giocatori, user, onRemove }: {
  s: RegSquadra; giocatori: RegGiocatore[]; user: User; onRemove: () => void;
}) {
  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };
  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {s.logo && (
            <img src={s.logo} alt={`Logo ${s.nome}`}
              style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="disp" style={{ fontSize: 15, textTransform: "uppercase" }}>{s.nome}</div>
        </div>
        {!user.guest && s.autore === user.name && (
          <button onClick={onRemove} className="linkbtn" style={{ color: INK, opacity: 0.5 }}>×</button>
        )}
      </div>
      {Number(s.rank) > 0 && <div className="ui" style={{ fontSize: 11.5, fontWeight: 700, color: ORANGE }}>Ranking circuito: {s.rank}</div>}
      <div className="ui" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
        {s.citta && <>{s.citta}{s.anno ? ` · dal ${s.anno}` : ""}<br /></>}
        {!s.citta && s.anno && <>Fondata nel {s.anno}<br /></>}
        {s.referente && <>Referente: {s.referente}<br /></>}
        {(s.roster || []).length > 0 && <>Roster: {(s.roster || []).map(gName).join(", ")}<br /></>}
      </div>
      {s.note && <p style={{ fontSize: 13, fontStyle: "italic", margin: "6px 0 0" }}>{s.note}</p>}
      <div className="ui" style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>Registrata da {s.autore}</div>
    </div>
  );
}
