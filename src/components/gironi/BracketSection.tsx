/** Fase a eliminazione diretta: mostra i match del bracket, permette di registrare i risultati
 *  e avanza automaticamente i vincitori ai round successivi. */
import { useState } from "react";
import { Bracket } from "./Bracket";
import { Button } from "../ui/Button";
import { Section } from "../ui/Section";
import type { BracketMatch, Tappa } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { generaFasiDirette, registraRisultatoBracket } from "../../domain/tappaOps";
import { splitRounds } from "../../utils/buildBracket";

interface Props {
  tappa: Tappa;
  readOnly?: boolean;
}

export function BracketSection({ tappa, readOnly = false }: Props) {
  const updateTappa  = useAppStore((s) => s.updateTappa);
  const replaceTappa = useAppStore((s) => s.replaceTappa);
  const nameOf = (id: string | null) =>
    id ? (tappa.squadre.find((s) => s.id === id)?.nome ?? id) : "TBD";

  // Stato locale per inserimento punteggi
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const allGironiDone = tappa.gironi !== null &&
    tappa.partite.every((m) => m.done);

  /** Genera il bracket dalla classifica dei gironi (regole in tappaOps) */
  const generaBracket = () => {
    const esito = generaFasiDirette(tappa);
    if (esito.ok) replaceTappa(esito.tappa);
  };

  /** Registra il risultato di un match del bracket: validazione e avanzamento del vincitore
   *  sono in tappaOps (stessa logica del Coach AI). */
  const registraRisultato = (match: BracketMatch) => {
    const sc = scores[match.id] ?? { a: "", b: "" };
    const esito = registraRisultatoBracket(tappa, match.id, parseInt(sc.a, 10), parseInt(sc.b, 10));
    if (!esito.ok) return; // punteggio non valido: come prima, non succede nulla
    replaceTappa(esito.tappa);
    setScores((prev) => ({ ...prev, [match.id]: { a: "", b: "" } }));
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
  const logoOf = (id: string | null) => (id ? tappa.squadre.find((s) => s.id === id)?.logo : undefined);

  /** Input punteggio + salva per un match ancora da giocare (markup; la logica è registraRisultato) */
  const renderControls = (m: BracketMatch) => {
    const sc = scores[m.id] ?? { a: "", b: "" };
    const setSc = (side: "a" | "b", v: string) =>
      setScores((p) => ({ ...p, [m.id]: { ...(p[m.id] ?? { a: "", b: "" }), [side]: v } }));
    return (
      <div className="flex items-center gap-1.5">
        <input type="number" min={0} inputMode="numeric" className="scorein w-12" value={sc.a}
          onChange={(e) => setSc("a", e.target.value)} aria-label={`Punti ${nameOf(m.squadraA)}`} />
        <span className="font-display text-chalk-dim">–</span>
        <input type="number" min={0} inputMode="numeric" className="scorein w-12" value={sc.b}
          onChange={(e) => setSc("b", e.target.value)} aria-label={`Punti ${nameOf(m.squadraB)}`} />
        <Button size="sm" className="ml-auto" onClick={() => registraRisultato(m)}>Salva</Button>
      </div>
    );
  };

  return (
    <Section title="Fase finale" kicker="Eliminazione diretta"
      actions={!readOnly && (
        <Button variant="link" className="text-chalk-muted" onClick={() => updateTappa(tappa.id, { bracket: undefined })}>
          Elimina bracket e ricomincia
        </Button>
      )}>
      <Bracket rounds={rounds} nameOf={nameOf} logoOf={logoOf} renderControls={readOnly ? undefined : renderControls} />
    </Section>
  );
}
