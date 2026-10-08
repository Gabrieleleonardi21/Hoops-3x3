/** Fase a eliminazione diretta: mostra i match del bracket, permette di registrare i risultati
 *  e avanza automaticamente i vincitori ai round successivi. */
import { useState } from "react";
import { Bracket } from "./Bracket";
import { Button } from "../ui/Button";
import { Section } from "../ui/Section";
import type { BracketMatch, Tappa } from "../../types";
import { useAppStore, tappaCorrente } from "../../stores/useAppStore";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import { annullaRisultatoBracket, generaFasiDirette, perditaTabellone, registraRisultatoBracket } from "../../domain/tappaOps";
import { splitRounds } from "../../utils/buildBracket";
import { logoSquadra, nomeSquadra } from "../../utils/tappaInfo";

interface Props {
  tappa: Tappa;
  readOnly?: boolean;
}

export function BracketSection({ tappa, readOnly = false }: Props) {
  const updateTappa  = useAppStore((s) => s.updateTappa);
  const replaceTappa = useAppStore((s) => s.replaceTappa);
  // Un posto ancora senza squadra (il vincitore del turno prima non c'è ancora) si chiama TBD
  const nameOf = (id: string | null) => {
    if (!id) return "TBD";
    return nomeSquadra(tappa.squadre, id);
  };

  // Stato locale per inserimento punteggi
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  // Perché l'ultimo «Salva» è stato rifiutato, e per quale match: il messaggio compare sotto i suoi punteggi
  const [errore, setErrore] = useState<{ matchId: string; testo: string } | null>(null);
  // «Elimina bracket e ricomincia» chiede sempre conferma. Il testo conta i risultati sulla tappa di adesso (come le operazioni
  // qui sotto): quella della prop può essere vecchia
  const { chiedi, finestra } = useConfermaPerdita(() => perditaTabellone(tappaCorrente(tappa.id) ?? tappa));

  const allGironiDone = tappa.gironi !== null &&
    tappa.partite.every((m) => m.done);

  // Le due operazioni partono dalla tappa di adesso e non dalla prop `tappa`, che può essere vecchia (per esempio
  // se nel frattempo il Coach ha registrato un altro match): salvarne un derivato cancellerebbe quelle modifiche.

  /** Genera il bracket dalla classifica dei gironi (regole in tappaOps) */
  const generaBracket = () => {
    const corrente = tappaCorrente(tappa.id);
    if (!corrente) return;
    const esito = generaFasiDirette(corrente);
    if (esito.ok) replaceTappa(esito.tappa);
  };

  /** Registra il risultato di un match del bracket: validazione e avanzamento del vincitore
   *  sono in tappaOps (stessa logica del Coach AI). */
  const registraRisultato = (match: BracketMatch) => {
    const corrente = tappaCorrente(tappa.id);
    if (!corrente) return;
    const sc = scores[match.id] ?? { a: "", b: "" };
    const esito = registraRisultatoBracket(corrente, match.id, parseInt(sc.a, 10), parseInt(sc.b, 10));
    // Punteggio non valido: non si salva niente e si dice perché (lo stesso messaggio che riceve il Coach)
    if (!esito.ok) { setErrore({ matchId: match.id, testo: esito.errore }); return; }
    replaceTappa(esito.tappa);
    setScores((prev) => ({ ...prev, [match.id]: { a: "", b: "" } }));
    setErrore(null);
  };

  /** «Correggi» di un match giocato: il risultato si annulla (tappaOps lo rifiuta se il vincitore ha già giocato il turno
   *  dopo) e i punteggi tornano nei campi come bozza, da correggere e salvare di nuovo */
  const correggi = (match: BracketMatch) => {
    const corrente = tappaCorrente(tappa.id);
    if (!corrente) return;
    const esito = annullaRisultatoBracket(corrente, match.id);
    if (!esito.ok) { setErrore({ matchId: match.id, testo: esito.errore }); return; }
    replaceTappa(esito.tappa);
    setScores((prev) => ({ ...prev, [match.id]: { a: String(match.pA), b: String(match.pB) } }));
    setErrore(null);
  };

  // Prompt prima dei gironi
  if (!allGironiDone && !tappa.bracket?.length) {
    return null; // non mostrare nulla finché i gironi non sono completati
  }

  // Un solo girone: nessun incrocio possibile (generaFasiDirette lo rifiuta), quindi si spiega
  // perché manca il pulsante invece di mostrarne uno che non fa nulla
  if (!tappa.bracket?.length && tappa.gironi?.length === 1) {
    return (
      <Section title="Fase finale" kicker="Eliminazione diretta">
        <p className="text-[13px] text-chalk-muted">
          Il girone è concluso. Con un solo girone non c'è la fase a eliminazione diretta (servono almeno 2 gironi):
          vale la classifica del girone.
        </p>
      </Section>
    );
  }

  // Bottone per generare il bracket
  if (!tappa.bracket?.length) {
    return (
      <Section title="Fase finale" kicker="Eliminazione diretta">
        <p className="mb-3 text-[13px] text-chalk-muted">
          Tutti i gironi sono conclusi. Genera il bracket per la fase a eliminazione diretta.
        </p>
        {!readOnly && <Button onClick={generaBracket}>Genera bracket eliminazione diretta</Button>}
      </Section>
    );
  }

  const rounds = splitRounds(tappa.bracket);
  const logoOf = (id: string | null) => logoSquadra(tappa.squadre, id);

  /** Messaggio del rifiuto dell'ultimo «Salva» o «Correggi», sotto il match a cui si riferisce */
  const erroreDi = (m: BracketMatch) => {
    if (errore?.matchId !== m.id) return null;
    return <p className="mt-1.5 text-xs font-semibold text-loss" role="alert">{errore.testo}</p>;
  };

  /** Input punteggio + salva per un match ancora da giocare, «Correggi» per uno giocato (markup; la logica è in
   *  registraRisultato e correggi) */
  const renderControls = (m: BracketMatch) => {
    if (m.done) {
      return (
        <>
          <Button variant="link" className="text-chalk-muted" onClick={() => correggi(m)}>Correggi</Button>
          {erroreDi(m)}
        </>
      );
    }
    const sc = scores[m.id] ?? { a: "", b: "" };
    // Correggendo il punteggio il messaggio del rifiuto precedente non vale più
    const setSc = (side: "a" | "b", v: string) => {
      setScores((p) => ({ ...p, [m.id]: { ...(p[m.id] ?? { a: "", b: "" }), [side]: v } }));
      setErrore(null);
    };
    return (
      <>
        <div className="flex items-center gap-1.5">
          <input type="number" min={0} inputMode="numeric" className="scorein w-12" value={sc.a}
            onChange={(e) => setSc("a", e.target.value)} aria-label={`Punti ${nameOf(m.squadraA)}`} />
          <span className="font-display text-chalk-dim">–</span>
          <input type="number" min={0} inputMode="numeric" className="scorein w-12" value={sc.b}
            onChange={(e) => setSc("b", e.target.value)} aria-label={`Punti ${nameOf(m.squadraB)}`} />
          <Button size="sm" className="ml-auto" onClick={() => registraRisultato(m)}>Salva</Button>
        </div>
        {erroreDi(m)}
      </>
    );
  };

  return (
    <Section title="Fase finale" kicker="Eliminazione diretta"
      actions={!readOnly && (
        <Button variant="link" className="text-chalk-muted"
          onClick={() => chiedi("Eliminare il tabellone?", () => updateTappa(tappa.id, { bracket: undefined }))}>
          Elimina bracket e ricomincia
        </Button>
      )}>
      <Bracket rounds={rounds} nameOf={nameOf} logoOf={logoOf} renderControls={readOnly ? undefined : renderControls} />
      {finestra}
    </Section>
  );
}
