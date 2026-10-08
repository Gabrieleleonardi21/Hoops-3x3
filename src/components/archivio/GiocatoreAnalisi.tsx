/** Modale di analisi individuale: mostra medie statistiche, punti di forza, aree di
 *  miglioramento con esercizi specifici per il 3x3 e (opzionalmente) i consigli del Coach AI. */
import { useState } from "react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { analyzePlayer3x3 } from "../../utils/analyzePlayer3x3";
import { askCoach, AiError } from "../../services/aiService";
import { useAppStore } from "../../stores/useAppStore";
import type { Tappa } from "../../types";
import { fmtMedia } from "../../utils/formato";
import { pulisci } from "../../utils/buildCoachContext";


export function GiocatoreAnalisi({ tappa, pid, onClose }: { tappa: Tappa; pid: string; onClose: () => void }) {
  const a = analyzePlayer3x3(tappa, pid);
  const user = useAppStore((s) => s.user);
  const aiAvailable = !!user && !user.guest; // il proxy Coach AI richiede un account
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const chiediAlCoach = async () => {
    if (!a || aiLoading) return;
    setAiLoading(true);
    try {
      const preamble =
        "Sei un allenatore esperto di basket 3x3 (regole FIBA: canestri da 1 e 2 punti, gara a 21 o 10 minuti, possesso di 12 secondi). Rispondi in italiano, tono diretto e incoraggiante, massimo 130 parole, senza markdown e senza elenchi puntati.";
      // Nome e squadra li hanno scritti gli utenti: nel prompt passano da pulisci, come ogni altro nome che arriva al modello
      const domanda = `Analizza questo giocatore di un torneo 3x3 e dagli consigli pratici di allenamento. ${pulisci(a.nome)} (${pulisci(a.squadra)}), ${a.partite} partite giocate. Medie a partita: ${fmtMedia(a.medie.pt)} punti, ${fmtMedia(a.medie.rb)} rimbalzi, ${fmtMedia(a.medie.as)} assist, ${fmtMedia(a.medie.ru)} recuperi, ${fmtMedia(a.medie.st)} stoppate, ${fmtMedia(a.medie.pe)} palle perse, ${fmtMedia(a.medie.fa)} falli. Aree deboli individuate: ${a.migliorare.map((m) => m.area).join(", ") || "nessuna"}. Dai 2-3 consigli specifici e un esercizio in più non banale.`;
      const reply = await askCoach(preamble, [{ role: "user", content: domanda }]);
      setAiText(reply);
    } catch (e) {
      if (e instanceof AiError && e.code === "UNAVAILABLE") setAiText("Coach AI non è configurato sul server.");
      else setAiText("Il coach non risponde in questo momento, riprova tra poco.");
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <Modal label={`Analisi di ${a?.nome || "giocatore"}`} title={a?.nome || "?"} width={560} onClose={onClose}
      subtitle={a ? `${a.squadra} · ${a.partite} ${a.partite === 1 ? "partita" : "partite"}` : undefined}>
      {!a || a.partite === 0 ? (
        <p className="text-[14px] text-chalk-muted">
          Nessuna statistica registrata per questo giocatore nella tappa: senza tabellini non posso indicare su cosa lavorare.
        </p>
      ) : (
        <>
          <div className="mb-4 overflow-x-auto">
            <table className="statstable">
              <caption className="sr-only">Medie a partita di {a.nome} nella tappa</caption>
              <thead>
                <tr><th scope="col">PT</th><th scope="col">RIMB</th><th scope="col">AST</th><th scope="col">RUB</th><th scope="col">STO</th><th scope="col">PER</th><th scope="col">FALLI</th></tr>
              </thead>
              <tbody>
                <tr>
                  {([a.medie.pt, a.medie.rb, a.medie.as, a.medie.ru, a.medie.st, a.medie.pe, a.medie.fa]).map((v, i) => (
                    <td key={i} className="font-display text-lg text-chalk">{fmtMedia(v)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[11px] text-chalk-dim">Medie a partita nella tappa.</p>
          </div>

          {a.forti.length > 0 && (
            <p className="mb-3 text-[13px] font-semibold text-chalk">
              Punti di forza: <span className="text-win">{a.forti.join(", ")}</span> — sopra la media della tappa.
            </p>
          )}

          <h4 className="font-display text-lg mb-2">Su cosa lavorare</h4>
          {a.migliorare.map((m) => (
            <div key={m.area} className="mb-2.5 rounded border border-asphalt-700 bg-asphalt-950/60 p-3">
              <div className="text-[13.5px]">
                <span className="font-semibold text-court">{m.area}</span>
                <span className="text-chalk-muted"> — {m.motivo}</span>
              </div>
              <div className="kicker mt-2 mb-1">Esercizi consigliati</div>
              <ol className="m-0 list-none p-0">
                {m.esercizi.map((e, i) => (
                  <li key={i} className="mb-1 flex gap-2 text-[13.5px] leading-snug text-chalk">
                    <span className="font-display text-sm text-court">{i + 1}.</span> {e}
                  </li>
                ))}
              </ol>
            </div>
          ))}

          <div className="mt-1 border-t border-asphalt-700 pt-3">
            {/* La risposta del Coach; senza, il pulsante per chiederla (solo con un account) o l'invito a registrarsi */}
            {aiText && (
              <p className="m-0 text-sm leading-relaxed">
                <span className="kicker text-court">Coach AI · </span>{aiText}
              </p>
            )}
            {!aiText && aiAvailable && (
              <Button variant="outline" size="sm" onClick={chiediAlCoach} disabled={aiLoading}>
                {aiLoading ? <span className="pulse">Il coach sta guardando le sue partite…</span> : <><Icon name="ball" size={14} /> Consigli personalizzati del Coach AI</>}
              </Button>
            )}
            {!aiText && !aiAvailable && (
              <p className="m-0 text-[11px] text-chalk-muted">
                Con un account registrato qui compaiono anche i consigli personalizzati del Coach AI.
              </p>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
