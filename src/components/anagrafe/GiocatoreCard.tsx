/** Card di un giocatore registrato nell'anagrafe. Il nome è un pulsante che apre la modale
 *  di dettaglio (niente controlli annidati: card = <article>), "Profilo" porta alla pagina con
 *  le statistiche; solo l'autore o un ADMIN può eliminarlo, dopo una conferma. */
import { Link } from "react-router-dom";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { eta } from "../../utils/eta";
import { puoModificare } from "../../utils/permessi";
import { safeUrl } from "../../utils/safeUrl";
import { perditaGiocatore } from "../../utils/testi";
import { Icon } from "../ui/Icon";
import type { RegGiocatore, RegSquadra, User } from "../../types";

/** `disabled`: un'altra eliminazione è in corso, quindi la X aspetta (un secondo invio verrebbe scartato senza dire niente) */
export function GiocatoreCard({ g, user, squadre, onRemove, onOpen, disabled = false }: {
  g: RegGiocatore; user: User; squadre?: RegSquadra[]; onRemove: () => void; onOpen: () => void; disabled?: boolean;
}) {
  const { chiedi, finestra } = useConfermaPerdita(() => perditaGiocatore(g, squadre));
  // Cerca il logo della squadra abbinando il nome del giocatore con la lista squadre
  const squadraLogo = squadre?.find((s) => s.nome === g.squadra)?.logo ?? null;
  const age = eta(g.nascita);
  const dettagli = [
    g.nascita ? `Nato il ${g.nascita}${age !== null ? ` (${age} anni)` : ""}${g.citta ? ` a ${g.citta}` : ""}` : g.citta,
    g.nazionalita,
    [g.altezza ? `${g.altezza} cm` : "", g.peso ? `${g.peso} kg` : ""].filter(Boolean).join(" · "),
    g.esperienza ? `${g.esperienza} anni di esperienza` : "",
  ].filter(Boolean);

  return (
    <article className="hovercard flex w-full flex-col rounded border border-asphalt-700 bg-asphalt-900 p-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="flex min-w-0 items-center gap-2 text-left hover:text-court" title="Apri la scheda">
          {squadraLogo && (
            <img src={safeUrl(squadraLogo)} alt="" aria-hidden className="h-6 w-6 shrink-0 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className="min-w-0 truncate font-display text-lg text-chalk transition-colors">
            {g.nome} {g.cognome}{g.numero ? <span className="text-court"> #{g.numero}</span> : null}
          </span>
        </button>
        {puoModificare(user, g.autoreId) && (
          <button onClick={() => chiedi("Eliminare il giocatore?", onRemove)} disabled={disabled} className="area-tocco shrink-0 text-chalk-dim hover:text-loss" aria-label={`Elimina ${g.nome} ${g.cognome}`}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {g.soprannome && <div className="text-xs font-semibold text-court">"{g.soprannome}"</div>}
      <div className="mt-1.5 text-xs leading-relaxed text-chalk-muted">
        <strong className="text-chalk">{g.ruolo}</strong>{g.squadra ? ` · ${g.squadra}` : ""}
        {dettagli.map((d) => <span key={d} className="block">{d}</span>)}
      </div>
      {g.note && <p className="mt-1.5 text-[13px] text-chalk-muted">{g.note}</p>}
      <div className="mt-auto flex items-center justify-between pt-2">
        <span className="text-[10.5px] text-chalk-dim">Registrato da {g.autore}</span>
        <Link to={`/giocatore/${g.id}`} className="area-tocco inline-flex items-center gap-1 text-xs font-semibold text-court hover:underline">
          Profilo <Icon name="chevron" size={12} />
        </Link>
      </div>
      {finestra}
    </article>
  );
}
