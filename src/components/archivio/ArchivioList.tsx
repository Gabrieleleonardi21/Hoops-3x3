/** Lista delle tappe concluse e pubblicate nell'archivio del circuito (dal backend). */
import { ErroreCaricamento } from "../ui/ErroreCaricamento";
import { Loading } from "../ui/Loading";
import { Section } from "../ui/Section";
import type { PubTappa } from "../../types";

/** `pubs` null = non ancora caricato: il caricamento, oppure l'errore con «Riprova» se `errore` c'è (mai «archivio vuoto») */
export function ArchivioList({ pubs, errore, onRiprova, onOpen }: {
  pubs: PubTappa[] | null; errore: string | null; onRiprova: () => void; onOpen: (p: PubTappa) => void;
}) {
  if (pubs === null && errore) {
    return <ErroreCaricamento cosa="Non è stato possibile caricare l'archivio del circuito." motivo={errore} onRiprova={onRiprova} />;
  }
  if (pubs === null) return <Loading>Sto aprendo l'archivio del circuito…</Loading>;
  return (
    <>
      <h1 className="font-display text-4xl mb-4">Archivio <span className="text-court">circuito</span></h1>
      <Section title="Tappe concluse" kicker="Visibili a tutti gli utenti">
        {!pubs.length ? (
          <p className="text-[15px] text-chalk-muted">L'archivio è vuoto: nessuna tappa è ancora stata conclusa e pubblicata.</p>
        ) : (
          <div className="rounded border border-asphalt-700 bg-asphalt-900 px-3">
            {pubs.map((pub, i) => (
              <button key={i} className="tapparow group" onClick={() => onOpen(pub)}>
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <strong className="font-display text-lg text-chalk transition-colors group-hover:text-court">{pub.tappa?.nome}</strong>
                  <span className="text-xs text-chalk-muted">{[pub.lega, pub.tappa?.luogo, pub.tappa?.data].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="text-xs font-semibold text-chalk-muted">{pub.tappa?.squadre?.length || 0} squadre · di {pub.autore || "?"}</span>
              </button>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
