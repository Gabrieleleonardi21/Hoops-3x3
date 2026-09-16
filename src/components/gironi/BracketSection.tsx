/** Fase a eliminazione diretta: mostra i match del bracket, permette di registrare i risultati
 *  e avanza automaticamente i vincitori ai round successivi. */
import { useState } from "react";
import { Bracket } from "./Bracket";
import { Button } from "../ui/Button";
import { Section } from "../ui/Section";
import type { BracketMatch, Tappa } from "../../types";
import { useAppStore } from "../../stores/useAppStore";
import { buildBracket, nextBracketSlot } from "../../utils/buildBracket";
import { standings } from "../../utils/standings";

/** Divide il bracket in round in base alla struttura ad albero:
 *  il primo round ha N match, il secondo N/2, il terzo N/4, ecc. */
function splitRounds(matches: BracketMatch[]): BracketMatch[][] {
  const rounds: BracketMatch[][] = [];
  let left = matches.length;
  let idx  = 0;
  // Calcola la dimensione del primo round (più grande potenza di 2 che divide left+1)
  let firstSize = 1;
  while (firstSize * 2 <= left) firstSize *= 2;
  // Se non è una potenza di 2 perfetta, prende la metà superiore
  let size = left - (left >> 1); // ceil(left/2)... in realtà più semplice:
  // Divide semplicemente dimezzando ogni volta
  size = Math.ceil(left / 2);
  // Ricostruisce: il primo round è la metà superiore (le prime coppie)
  // Approccio diretto: ricostruisce i round dal totale
  let roundSize = 1;
  while (roundSize < left) roundSize *= 2;
  // roundSize è la dimensione totale dell'albero; il primo round è roundSize/2
  // Ma i match reali possono essere meno (bye)
  // Approccio semplificato: usa le etichette per raggruppare
  const byLabel: Record<string, BracketMatch[]> = {};
  for (const m of matches) {
    const key = m.label.replace(/\s\d+$/, ""); // rimuove il numero finale (es. "Semifinale 1" → "Semifinale")
    if (!byLabel[key]) byLabel[key] = [];
    byLabel[key].push(m);
  }
  // Ordine dei round: QF → SF → Finale
  const order = ["Quarto di finale", "Semifinale", "Finale"];
  for (const key of order) {
    if (byLabel[key]) rounds.push(byLabel[key]);
  }
  // Aggiunge eventuali chiavi non standard
  for (const key of Object.keys(byLabel)) {
    if (!order.includes(key)) rounds.push(byLabel[key]);
  }
  return rounds.length > 0 ? rounds : [matches];
}

interface Props {
  tappa: Tappa;
  readOnly?: boolean;
}

export function BracketSection({ tappa, readOnly = false }: Props) {
  const updateTappa        = useAppStore((s) => s.updateTappa);
  const updateBracketMatch = useAppStore((s) => s.updateBracketMatch);
  const nameOf = (id: string | null) =>
    id ? (tappa.squadre.find((s) => s.id === id)?.nome ?? id) : "TBD";

  // Stato locale per inserimento punteggi
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const allGironiDone = tappa.gironi !== null &&
    tappa.partite.every((m) => m.done);

  /** Genera il bracket dalla classifica dei gironi */
  const generaBracket = () => {
    if (!tappa.gironi) return;
    const bracket = buildBracket(tappa.gironi, tappa.partite, tappa.squadre);
    updateTappa(tappa.id, { bracket });
  };

  /** Registra il risultato di un match del bracket e avanza il vincitore al round successivo. */
  const registraRisultato = (match: BracketMatch) => {
    const sc = scores[match.id] ?? { a: "", b: "" };
    const pA = parseInt(sc.a, 10);
    const pB = parseInt(sc.b, 10);
    if (isNaN(pA) || isNaN(pB) || pA === pB) return;

    const vincitoreId = pA > pB ? match.squadraA : match.squadraB;
    updateBracketMatch(tappa.id, match.id, { pA, pB, done: true });

    // Avanza il vincitore allo slot TBD del round successivo (logica condivisa col Coach AI)
    const next = nextBracketSlot(tappa.bracket ?? [], match.id, vincitoreId);
    if (next) updateBracketMatch(tappa.id, next.id, next.patch);

    setScores((prev) => ({ ...prev, [match.id]: { a: "", b: "" } }));
  };

  // Prompt prima dei gironi
  if (!allGironiDone && !tappa.bracket?.length) {
    return null; // non mostrare nulla finché i gironi non sono completati
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
