/** Modale di analisi individuale: mostra medie statistiche, punti di forza, aree di
 *  miglioramento con esercizi specifici per il 3x3 e (opzionalmente) i consigli del Coach AI. */
import { useState } from "react";
import { INK, PAPER, RULE } from "../../constants/colors";
import { analyzePlayer3x3 } from "../../utils/analyzePlayer3x3";
import { askCoach, aiAvailable } from "../../services/aiService";
import type { Tappa } from "../../types";

const f = (v: number) => v.toFixed(1).replace(".", ",");

export function GiocatoreAnalisi({ tappa, pid, onClose }: { tappa: Tappa; pid: string; onClose: () => void }) {
  const a = analyzePlayer3x3(tappa, pid);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const chiediAlCoach = async () => {
    if (!a || aiLoading) return;
    setAiLoading(true);
    try {
      const preamble =
        "Sei un allenatore esperto di basket 3x3 (regole FIBA: canestri da 1 e 2 punti, gara a 21 o 10 minuti, possesso di 12 secondi). Rispondi in italiano, tono diretto e incoraggiante, massimo 130 parole, senza markdown e senza elenchi puntati.";
      const domanda = `Analizza questo giocatore di un torneo 3x3 e dagli consigli pratici di allenamento. ${a.nome} (${a.squadra}), ${a.partite} partite giocate. Medie a partita: ${f(a.medie.pt)} punti, ${f(a.medie.rb)} rimbalzi, ${f(a.medie.as)} assist, ${f(a.medie.ru)} recuperi, ${f(a.medie.st)} stoppate, ${f(a.medie.pe)} palle perse, ${f(a.medie.fa)} falli. Aree deboli individuate: ${a.migliorare.map((m) => m.area).join(", ") || "nessuna"}. Dai 2-3 consigli specifici e un esercizio in più non banale.`;
      const reply = await askCoach(preamble, [{ role: "user", content: domanda }]);
      setAiText(reply);
    } catch {
      setAiText("Il coach non risponde in questo momento, riprova tra poco.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div onClick={onClose}
      className="modal-overlay">
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Analisi di ${a?.nome || "giocatore"}`}
        className="modal-card" style={{ width: "min(560px, 100%)", maxHeight: "85vh", padding: 18 }}>

        <div className="row between items-base" style={{ borderBottom: `3px solid ${INK}`, paddingBottom: 8, marginBottom: 12 }}>
          <div>
            <div className="disp up" style={{ fontSize: 20 }}>{a?.nome || "?"}</div>
            <div className="ui t-orange" style={{ fontSize: 12, fontWeight: 700 }}>
              {a?.squadra}{a ? ` · ${a.partite} ${a.partite === 1 ? "partita" : "partite"}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="linkbtn t-ink" style={{ fontSize: 20 }} aria-label="Chiudi">×</button>
        </div>

        {!a || a.partite === 0 ? (
          <p style={{ fontStyle: "italic", fontSize: 14.5 }}>
            Nessuna statistica registrata per questo giocatore nella tappa: senza tabellini non posso indicare su cosa lavorare.
          </p>
        ) : (
          <>
            <div style={{ overflowX: "auto", marginBottom: 14 }}>
              <table className="statstable">
                <thead>
                  <tr><th>PT</th><th>RIMB</th><th>AST</th><th>RUB</th><th>STO</th><th>PER</th><th>FALLI</th></tr>
                </thead>
                <tbody>
                  <tr>
                    {([a.medie.pt, a.medie.rb, a.medie.as, a.medie.ru, a.medie.st, a.medie.pe, a.medie.fa]).map((v, i) => (
                      <td key={i} style={{ fontWeight: 700, padding: "5px 6px" }}>{f(v)}</td>
                    ))}
                  </tr>
                </tbody>
              </table>
              <p className="ui" style={{ fontSize: 10.5, opacity: 0.6, margin: "4px 0 0" }}>Medie a partita nella tappa.</p>
            </div>

            {a.forti.length > 0 && (
              <p className="ui" style={{ fontSize: 13, fontWeight: 700, margin: "0 0 12px" }}>
                Punti di forza: <span className="t-orange">{a.forti.join(", ")}</span> — sopra la media della tappa.
              </p>
            )}

            <h4 className="disp up" style={{ fontSize: 15, margin: "0 0 8px" }}>Su cosa lavorare</h4>
            {a.migliorare.map((m) => (
              <div key={m.area} style={{ background: PAPER, border: `1px solid ${RULE}`, padding: 12, marginBottom: 10 }}>
                <div className="ui" style={{ fontWeight: 700, fontSize: 13.5 }}>
                  <span className="t-red">▸ {m.area}</span>
                  <span style={{ fontWeight: 600, opacity: 0.85 }}> — {m.motivo}</span>
                </div>
                <div className="kicker" style={{ margin: "8px 0 4px" }}>
                  Esercizi consigliati
                </div>
                {m.esercizi.map((e, i) => (
                  <p key={i} style={{ fontSize: 13.5, margin: "0 0 5px", lineHeight: 1.45 }}>
                    <span className="disp t-orange" style={{ fontSize: 12 }}>{i + 1}.</span> {e}
                  </p>
                ))}
              </div>
            ))}

            <div style={{ borderTop: `1px solid ${RULE}`, paddingTop: 10, marginTop: 4 }}>
              {aiText ? (
                <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
                  <span className="ui up t-orange" style={{ fontWeight: 700, fontSize: 11, letterSpacing: "0.08em" }}>Coach AI · </span>
                  {aiText}
                </p>
              ) : aiAvailable ? (
                <button onClick={chiediAlCoach} disabled={aiLoading} className="blackbtn" style={{ padding: "9px 14px", fontSize: 12.5 }}>
                  {aiLoading ? <span className="pulse">Il coach sta guardando le sue partite…</span> : "🏀 Consigli personalizzati del Coach AI"}
                </button>
              ) : (
                <p className="ui" style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, margin: 0 }}>
                  Con la chiave API configurata qui compaiono anche i consigli personalizzati del Coach AI.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
