import type { SquadraTappa } from "../../types";
import { safeUrl } from "../../utils/safeUrl";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";

/** Modale con le info ingrandite di una squadra: logo, roster cliccabile per analisi */
export function SquadraModal({ squadra, onClose, onSelectPlayer, hasStats }: {
  squadra: SquadraTappa;
  onClose: () => void;
  onSelectPlayer: (pid: string) => void;
  hasStats: boolean;
}) {
  const giocatori = (squadra.giocatori || []).filter((p) => p.nome.trim());
  const logo = squadra.logo ? (
    <img src={safeUrl(squadra.logo)} alt={`Logo ${squadra.nome}`} className="h-28 w-28 object-contain"
      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
  ) : null;
  // Il blocco dei dati prende il focus solo se ha qualcosa da leggere (come nelle schede dell'anagrafe): senza giocatori, logo e
  // collegamenti sarebbe un blocco vuoto, e il focus va alla finestra stessa
  const haDati = giocatori.length > 0 || Boolean(squadra.logo || squadra.website || squadra.instagram);

  return (
    <Modal label={`Scheda squadra ${squadra.nome}`} title={squadra.nome}
      subtitle={Number(squadra.rank) > 0 ? `Ranking circuito: ${squadra.rank} pt` : undefined} onClose={onClose}>
      {/* Il focus iniziale è sul blocco dei dati, non sul primo collegamento (il logo, il sito: si aprono in un'altra scheda del browser, e
          un Invio dato di riflesso li aprirebbe), e il lettore di schermo legge i dati. tabIndex -1: si prende il focus per programma, senza
          entrare nell'ordine di Tab; l'anello del focus resta, con la tastiera è l'unico indicatore */}
      <div {...(haDati && { tabIndex: -1, "data-focus-iniziale": true })}>
        {/* Logo centrato — cliccabile se la squadra ha un sito web */}
        {logo && (
          <div className="mb-4 flex justify-center">
            {squadra.website ? <a href={safeUrl(squadra.website)} target="_blank" rel="noopener noreferrer" title={`Vai al sito di ${squadra.nome}`}>{logo}</a> : logo}
          </div>
        )}
        {(squadra.website || squadra.instagram) && (
          <div className="mb-4 flex justify-center gap-4 text-[13px] font-semibold">
            {squadra.website && <a href={safeUrl(squadra.website)} target="_blank" rel="noopener noreferrer" className="text-court hover:underline">Sito web ↗</a>}
            {squadra.instagram && <a href={safeUrl(squadra.instagram)} target="_blank" rel="noopener noreferrer" className="text-court hover:underline">Instagram ↗</a>}
          </div>
        )}

        {/* Roster */}
        <div className="rounded border border-asphalt-700 bg-asphalt-950/60 p-3.5">
          <div className="kicker mb-2.5">Roster</div>
          {giocatori.length === 0 ? (
            <span className="text-[13px] text-chalk-muted">Nessun giocatore registrato.</span>
          ) : (
            <div className="flex flex-col gap-1.5">
              {giocatori.map((p) => (
                <button key={p.id} onClick={() => { onClose(); onSelectPlayer(p.id); }} disabled={!hasStats}
                  title={hasStats ? `Analisi di ${p.nome}` : "Nessuna statistica per questa tappa"}
                  className="flex items-center justify-between rounded border border-asphalt-700 px-3.5 py-2 text-left text-sm font-semibold text-chalk transition-colors enabled:hover:border-court disabled:opacity-60">
                  {p.nome}
                  {hasStats && <span className="flex items-center gap-1 text-xs text-court">Analisi <Icon name="chevron" size={12} /></span>}
                </button>
              ))}
            </div>
          )}
          {hasStats && <p className="mt-2.5 mb-0 text-[11px] text-chalk-muted">Clicca un giocatore per vedere le sue statistiche e gli esercizi consigliati.</p>}
        </div>
      </div>
    </Modal>
  );
}
