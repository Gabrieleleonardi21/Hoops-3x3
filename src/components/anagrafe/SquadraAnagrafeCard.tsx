/** Card di una squadra dell'anagrafe: il nome è un pulsante che apre la modale di dettaglio
 *  (niente controlli annidati), il × elimina, dopo una conferma (solo autore o ADMIN). */
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { puoModificare } from "../../utils/permessi";
import { safeUrl } from "../../utils/safeUrl";
import { perditaSquadraAnagrafe } from "../../utils/testi";
import { Icon } from "../ui/Icon";
import type { RegGiocatore, RegSquadra, User } from "../../types";

/** `disabled`: un'altra eliminazione è in corso, quindi la X aspetta (un secondo invio verrebbe scartato senza dire niente) */
export function SquadraAnagrafeCard({ s, giocatori, user, onRemove, onOpen, disabled = false }: {
  s: RegSquadra; giocatori: RegGiocatore[]; user: User; onRemove: () => void; onOpen: () => void; disabled?: boolean;
}) {
  const { chiedi, finestra } = useConfermaPerdita(() => perditaSquadraAnagrafe(s));
  const gName = (id: string) => {
    const g = giocatori.find((x) => x.id === id);
    return g ? `${g.nome} ${g.cognome}` : "?";
  };
  return (
    <article className="hovercard block w-full rounded border border-asphalt-700 bg-asphalt-900 p-3 text-left">
      <div className="flex items-start justify-between gap-2">
        <button onClick={onOpen} className="flex min-w-0 items-center gap-2.5 text-left" title="Apri la scheda">
          {s.logo && (
            <img src={safeUrl(s.logo)} alt={`Logo ${s.nome}`} className="h-11 w-11 shrink-0 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className="min-w-0 truncate font-display text-lg text-chalk transition-colors hover:text-court">{s.nome}</span>
        </button>
        {puoModificare(user, s.autoreId) && (
          <button onClick={() => chiedi("Eliminare la squadra?", onRemove)} disabled={disabled} className="area-tocco shrink-0 text-chalk-dim hover:text-loss" aria-label={`Elimina ${s.nome}`}>
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {Number(s.rank) > 0 && <div className="text-xs font-semibold text-court">Ranking circuito: {s.rank}</div>}
      <div className="mt-1.5 text-xs leading-relaxed text-chalk-muted">
        {s.citta && <span className="block">{s.citta}{s.anno ? ` · dal ${s.anno}` : ""}</span>}
        {!s.citta && s.anno && <span className="block">Fondata nel {s.anno}</span>}
        {s.referente && <span className="block">Referente: {s.referente}</span>}
        {(s.roster || []).length > 0 && <span className="block">Roster: {(s.roster || []).map(gName).join(", ")}</span>}
      </div>
      {s.note && <p className="mt-1.5 text-[13px] text-chalk-muted">{s.note}</p>}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10.5px] text-chalk-dim">Registrata da {s.autore}</span>
        <button onClick={onOpen} className="area-tocco inline-flex items-center gap-1 text-xs font-semibold text-court hover:underline">Scheda <Icon name="chevron" size={12} /></button>
      </div>
      {finestra}
    </article>
  );
}
