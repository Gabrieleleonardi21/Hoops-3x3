/** Card cliccabile per una squadra dell'anagrafe: apre la modale di dettaglio.
 *  Il × per eliminare stoppa la propagazione del click così non apre la modale. */
import { INK } from "../../constants/colors";
import type { RegGiocatore, RegSquadra, User } from "../../types";

export function SquadraAnagrafeCard({ s, giocatori, user, onRemove, onOpen }: {
  s: RegSquadra; giocatori: RegGiocatore[]; user: User; onRemove: () => void; onOpen: () => void;
}) {
  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };
  return (
    /* div invece di button: permette il <button> del × interno senza violare HTML */
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
      className="tal fullw hovercard"
      style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 12, cursor: "pointer", display: "block" }}
    >
      <div className="row between gap-8 items-start">
        <div className="row gap-10">
          {s.logo && (
            <img src={s.logo} alt={`Logo ${s.nome}`}
              style={{ width: 44, height: 44, objectFit: "contain", flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="disp up" style={{ fontSize: 15 }}>{s.nome}</div>
        </div>
        {/* Il × stoppa il click sulla card per non aprire la modale */}
        {!user.guest && s.autore === user.name && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="linkbtn t-ink" style={{ opacity: 0.5 }}>×</button>
        )}
      </div>
      {Number(s.rank) > 0 && <div className="ui t-orange" style={{ fontSize: 11.5, fontWeight: 700 }}>Ranking circuito: {s.rank}</div>}
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
