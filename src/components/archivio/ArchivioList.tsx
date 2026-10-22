/** Lista delle tappe concluse e pubblicate nell'archivio del circuito (dal backend), raggruppate per lega. */
import { useId } from "react";
import { ErroreCaricamento } from "../ui/ErroreCaricamento";
import { Loading } from "../ui/Loading";
import { Section } from "../ui/Section";
import { Button } from "../ui/Button";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { raggruppaPerLega } from "../../utils/archivio";
import { puoModificare } from "../../utils/permessi";
import { conteggio, ELENCO_NON_AGGIORNATO, LEGA_SENZA_NOME, perditaRitiroArchivio, TITOLO_RITIRO_ARCHIVIO } from "../../utils/testi";
import type { PubTappaMeta, User } from "../../types";

/** `pubs` null = non ancora caricato: il caricamento, oppure l'errore con «Riprova» se `errore` c'è (mai «archivio vuoto»).
 *  Le tappe sono raggruppate per lega, nell'ordine del server (le più recenti prima): qui non si riordina.
 *  «Ritira» c'è solo dove `puoModificare` lo permette (l'autore, l'ADMIN); è un pulsante accanto alla riga, non dentro: il pulsante
 *  che apre la tappa resta da solo (un pulsante dentro un pulsante non è HTML valido). Chiede conferma, poi chiama `onRitira`. */
export function ArchivioList({ pubs, errore, onRiprova, onOpen, user, erroreRitiro, onRitira }: {
  pubs: PubTappaMeta[] | null; errore: string | null; onRiprova: () => void; onOpen: (voce: PubTappaMeta) => void;
  user: User | null; erroreRitiro: string | null; onRitira: (voce: PubTappaMeta) => void;
}) {
  // Prefisso degli id dei titoli di gruppo (aria-labelledby): un id per gruppo, unico nella pagina
  const base = useId();
  // Nessuna perdita fissa: ogni «Ritira» passa la sua (con l'autore, se non è l'utente)
  const { chiedi, finestra } = useConfermaPerdita(() => null);

  if (pubs === null && errore) {
    return <ErroreCaricamento cosa="Non è stato possibile caricare l'archivio del circuito." motivo={errore} onRiprova={onRiprova} />;
  }
  if (pubs === null) return <Loading>Sto aprendo l'archivio del circuito…</Loading>;

  /** Una riga: il pulsante che apre la tappa, e «Ritira» accanto se l'utente può */
  const riga = (voce: PubTappaMeta) => {
    const puoRitirare = puoModificare(user, voce.autoreId ?? null);
    return (
      <div key={voce.tappaId} className="tapparow group">
        <button className="flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-2.5 bg-transparent p-0 text-left" onClick={() => onOpen(voce)}>
          <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
            <strong className="font-display text-lg text-chalk transition-colors group-hover:text-court">{voce.nome}</strong>
            <span className="text-xs text-chalk-muted">{[voce.lega, voce.luogo, voce.data].filter(Boolean).join(" · ")}</span>
          </span>
          <span className="text-xs font-semibold text-chalk-muted">{conteggio(voce.nSquadre, "squadra", "squadre")} · di {voce.autore || "?"}</span>
        </button>
        {puoRitirare && (
          <Button variant="ghost" size="sm" aria-label={`Ritira ${voce.nome} dall'archivio`}
            onClick={() => chiedi(TITOLO_RITIRO_ARCHIVIO, () => onRitira(voce), () => perditaRitiroArchivio(voce.autore, voce.autoreId !== user?.id))}>
            Ritira
          </Button>
        )}
      </div>
    );
  };

  return (
    <>
      <h1 className="font-display text-4xl mb-4">Archivio <span className="text-court">circuito</span></h1>
      <Section title="Tappe concluse" kicker="Visibili a tutti gli utenti">
        {erroreRitiro && <p role="alert" className="m-0 mb-3 text-[13px] font-semibold text-loss">{erroreRitiro}</p>}
        {/* Un aggiornamento fallito con l'elenco già visibile (per esempio la ricarica dopo «Ritira»): l'errore si vede lo stesso */}
        {errore && <p role="alert" className="m-0 mb-3 text-[13px] font-semibold text-loss">{ELENCO_NON_AGGIORNATO(errore)}</p>}
        {!pubs.length ? (
          <p className="text-[15px] text-chalk-muted">L'archivio è vuoto: nessuna tappa è ancora stata conclusa e pubblicata.</p>
        ) : (
          raggruppaPerLega(pubs).map((gruppo, i) => {
            const idTitolo = `${base}-${i}`;
            return (
              <section key={gruppo.chiave} aria-labelledby={idTitolo} className="mb-5">
                <h3 id={idTitolo} className="font-display text-lg text-chalk mb-1">{gruppo.lega || LEGA_SENZA_NOME}</h3>
                <div className="rounded border border-asphalt-700 bg-asphalt-900 px-3">
                  {gruppo.voci.map(riga)}
                </div>
              </section>
            );
          })
        )}
      </Section>
      {finestra}
    </>
  );
}
