/** Fase a eliminazione diretta: mostra i match del bracket, permette di registrare i risultati
 *  e avanza automaticamente i vincitori ai round successivi. */
import { useState } from "react";
import { INK, ORANGE, RED, RULE } from "../../constants/colors";
import type { BracketMatch, SquadraTappa, Tappa } from "../../types";
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
      <section style={{ borderTop: `4px solid ${INK}`, marginBottom: 26 }}>
        <h3 className="disp up" style={{ fontSize: 18, margin: "12px 0 6px" }}>
          Fase finale
        </h3>
        <p className="ui" style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.75, margin: "0 0 12px" }}>
          Tutti i gironi sono conclusi. Genera il bracket per la fase a eliminazione diretta.
        </p>
        {!readOnly && (
          <button onClick={generaBracket} className="blackbtn">
            Genera bracket eliminazione diretta
          </button>
        )}
      </section>
    );
  }

  const rounds = splitRounds(tappa.bracket);

  return (
    <section style={{ borderTop: `4px solid ${INK}`, marginBottom: 26 }}>
      <h3 className="h-sec">
        Fase finale — Eliminazione diretta
      </h3>

      {rounds.map((round, ri) => (
        <div key={ri} style={{ marginBottom: 18 }}>
          <div className="ui up" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", opacity: 0.6, margin: "0 0 8px" }}>
            {round[0]?.label.replace(/\s\d+$/, "") ?? `Round ${ri + 1}`}
          </div>
          {round.map((m) => {
            const sc = scores[m.id] ?? { a: "", b: "" };
            const isFinale = m.label === "Finale";
            return (
              <div key={m.id} className="row wrap gap-12" style={{
                border: `1.5px solid ${INK}`,
                background: "var(--card)",
                padding: "10px 14px",
                marginBottom: 8,
              }}>
                <span className="ui" style={{ fontSize: 10.5, fontWeight: 700, opacity: 0.5, minWidth: 80 }}>
                  {m.label}
                </span>

                {/* Squadra A */}
                <span className="disp tar up" style={{
                  flex: "1 1 120px", fontSize: 14,
                  color: m.done && m.pA > m.pB ? INK : m.done ? RED : INK,
                  fontWeight: m.done && m.pA > m.pB ? 900 : 400,
                }}>
                  {nameOf(m.squadraA)}
                </span>

                {/* Punteggio / input */}
                {m.done ? (
                  <span className="disp tac" style={{ fontSize: 20, minWidth: 70 }}>
                    <span style={{ color: m.pA > m.pB ? INK : RED }}>{m.pA}</span>
                    {" — "}
                    <span style={{ color: m.pB > m.pA ? INK : RED }}>{m.pB}</span>
                  </span>
                ) : !readOnly && m.squadraA && m.squadraB ? (
                  <div className="row gap-4">
                    <input type="number" min={0} className="scorein"
                      value={sc.a}
                      onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...p[m.id] ?? { a: "", b: "" }, a: e.target.value } }))}
                      style={{ width: 52 }} />
                    <span className="disp" style={{ fontSize: 16, opacity: 0.5 }}>—</span>
                    <input type="number" min={0} className="scorein"
                      value={sc.b}
                      onChange={(e) => setScores((p) => ({ ...p, [m.id]: { ...p[m.id] ?? { a: "", b: "" }, b: e.target.value } }))}
                      style={{ width: 52 }} />
                    <button onClick={() => registraRisultato(m)} className="blackbtn" style={{ padding: "8px 12px", fontSize: 12 }}>
                      Salva
                    </button>
                  </div>
                ) : (
                  <span className="disp tac" style={{ fontSize: 18, minWidth: 70, opacity: 0.35 }}>
                    ? — ?
                  </span>
                )}

                {/* Squadra B */}
                <span className="disp up" style={{
                  flex: "1 1 120px", fontSize: 14,
                  color: m.done && m.pB > m.pA ? INK : m.done ? RED : INK,
                  fontWeight: m.done && m.pB > m.pA ? 900 : 400,
                }}>
                  {nameOf(m.squadraB)}
                </span>

                {/* Badge vincitore finale */}
                {m.done && isFinale && (
                  <span className="disp" style={{ fontSize: 11, background: ORANGE, color: "white", padding: "3px 8px" }}>
                    CAMPIONE — {nameOf(m.pA > m.pB ? m.squadraA : m.squadraB)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {!readOnly && (
        <button onClick={() => updateTappa(tappa.id, { bracket: undefined })}
          className="linkbtn" style={{ opacity: 0.5, fontSize: 12, marginTop: 4 }}>
          Elimina bracket e ricomincia
        </button>
      )}
    </section>
  );
}
