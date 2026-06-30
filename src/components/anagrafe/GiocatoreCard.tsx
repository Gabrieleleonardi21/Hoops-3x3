/** Card cliccabile di un giocatore registrato nell'anagrafe: apre la modale di dettaglio.
 *  Solo l'autore può eliminarlo; il × stoppa il click sulla card. */
import { INK } from "../../constants/colors";
import { eta } from "../../utils/eta";
import { safeUrl } from "../../utils/safeUrl";
import type { RegGiocatore, RegSquadra, User } from "../../types";

export function GiocatoreCard({ g, user, squadre, onRemove, onOpen }: {
  g: RegGiocatore; user: User; squadre?: RegSquadra[]; onRemove: () => void; onOpen: () => void;
}) {
  // Cerca il logo della squadra abbinando il nome del giocatore con la lista squadre
  const squadraLogo = squadre?.find((s) => s.nome === g.squadra)?.logo ?? null;
  const age = eta(g.nascita);
  return (
    /* div + role="button" per evitare <button> annidati (il × interno è già un button) */
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(); }}
      className="tal fullw hovercard"
      style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 12, cursor: "pointer" }}
    >
      <div className="row between gap-8">
        <div className="row gap-7">
          {squadraLogo && (
            <img src={safeUrl(squadraLogo)} alt="" aria-hidden
              style={{ width: 22, height: 22, objectFit: "contain", flexShrink: 0 }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <div className="disp up" style={{ fontSize: 15 }}>
            {g.nome} {g.cognome}{g.numero ? <span className="t-orange"> #{g.numero}</span> : null}
          </div>
        </div>
        {/* Il × stoppa il click sulla card per non aprire la modale */}
        {!user.guest && g.autore === user.name && (
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="linkbtn t-ink" style={{ opacity: 0.5 }}>×</button>
        )}
      </div>
      {g.soprannome && <div className="ui t-orange" style={{ fontSize: 11.5, fontWeight: 700 }}>"{g.soprannome}"</div>}
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
