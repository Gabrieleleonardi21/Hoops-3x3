/** Card cliccabile di un giocatore registrato nell'anagrafe: apre la modale di dettaglio.
 *  Solo l'autore può eliminarlo; il × stoppa il click sulla card. */
import { INK, ORANGE } from "../../constants/colors";
import { eta } from "../../utils/eta";
import type { RegGiocatore, User } from "../../types";

export function GiocatoreCard({ g, user, onRemove, onOpen }: {
  g: RegGiocatore; user: User; onRemove: () => void; onOpen: () => void;
}) {
  const age = eta(g.nascita);
  return (
    /* div + role="button" per evitare <button> annidati (il × interno è già un button) */
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
      style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 12, cursor: "pointer", textAlign: "left", width: "100%" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 2px ${ORANGE}`; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <div className="disp" style={{ fontSize: 15, textTransform: "uppercase" }}>
          {g.nome} {g.cognome}{g.numero ? <span style={{ color: ORANGE }}> #{g.numero}</span> : null}
        </div>
        {/* Il × stoppa il click sulla card per non aprire la modale */}
        {!user.guest && g.autore === user.name && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="linkbtn" style={{ color: INK, opacity: 0.5 }}>×</button>
        )}
      </div>
      {g.soprannome && <div className="ui" style={{ fontSize: 11.5, fontWeight: 700, color: ORANGE }}>"{g.soprannome}"</div>}
      <div className="ui" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
        <strong>{g.ruolo}</strong>{g.squadra ? <> · {g.squadra}</> : null}<br />
        {g.nascita && <>{`Nato il ${g.nascita}`}{age !== null ? ` (${age} anni)` : ""}{g.citta ? ` a ${g.citta}` : ""}<br /></>}
        {!g.nascita && g.citta && <>{g.citta}<br /></>}
        {g.nazionalita && <>{g.nazionalita}<br /></>}
        {(g.altezza || g.peso) && <>{g.altezza ? `${g.altezza} cm` : ""}{g.altezza && g.peso ? " · " : ""}{g.peso ? `${g.peso} kg` : ""}<br /></>}
        {g.esperienza && <>{g.esperienza} anni di esperienza<br /></>}
      </div>
      {g.note && <p style={{ fontSize: 13, fontStyle: "italic", margin: "6px 0 0" }}>{g.note}</p>}
      <div className="ui" style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>Registrato da {g.autore}</div>
    </div>
  );
}
