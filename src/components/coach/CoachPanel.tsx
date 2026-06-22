/** Pannello chat del Coach AI: input utente, lista messaggi, bottone "Cancella chat".
 *  La cronologia viene persistita in sessionStorage (si azzera alla chiusura della scheda). */
import { useState } from "react";
import { INK, ORANGE, PAPER, RED, RULE } from "../../constants/colors";
import { useCoachAI } from "../../hooks/useCoachAI";

/** Etichette leggibili (al passato) per i tool eseguiti dal Coach AI. */
const TOOL_LABELS: Record<string, string> = {
  crea_lega:           "Lega creata",
  crea_tappa:          "Tappa creata",
  registra_squadra:    "Squadra registrata",
  registra_giocatore:  "Giocatore registrato",
  aggiorna_squadra:    "Squadra aggiornata",
  sorteggia_gironi:    "Gironi sorteggiati",
  genera_fasi_dirette: "Fasi dirette generate",
  registra_risultato:  "Risultato registrato",
  annulla_risultato:   "Risultato annullato",
  concludi_tappa:      "Tappa conclusa",
};

/** Colore del badge per natura dell'azione: le correzioni/undo risaltano in RED, il resto ORANGE. */
const TOOL_COLORS: Record<string, string> = {
  annulla_risultato: RED,
};

/** Raggruppa i tool eseguiti in etichette con conteggio e colore, nell'ordine di prima esecuzione. */
function riepilogoTool(tools: string[]): Array<{ label: string; count: number; color: string }> {
  const out: Array<{ label: string; count: number; color: string }> = [];
  for (const name of tools) {
    const label = TOOL_LABELS[name] ?? name;
    const trovato = out.find((x) => x.label === label);
    if (trovato) {
      trovato.count += 1;
    } else {
      out.push({ label, count: 1, color: TOOL_COLORS[name] ?? ORANGE });
    }
  }
  return out;
}

export function CoachPanel({ onClose }: { onClose: () => void }) {
  const { msgs, loading, send, clearChat } = useCoachAI();
  const [input, setInput] = useState("");

  const submit = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
  };

  return (
    <div className="chatpanel" role="dialog" aria-label="Coach AI">
      <div className="ui" style={{ background: INK, color: PAPER, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "'Archivo Black', sans-serif", textTransform: "uppercase", fontSize: 14 }}>Coach AI · 3x3</span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {msgs.length > 0 && (
            <button onClick={clearChat} style={{ background: "none", border: "none", color: PAPER, cursor: "pointer", fontSize: 12, opacity: 0.7 }} aria-label="Cancella chat">✕ Cancella</button>
          )}
          <button onClick={onClose} style={{ background: "none", border: "none", color: PAPER, cursor: "pointer", fontSize: 18, lineHeight: 1 }} aria-label="Chiudi">×</button>
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.length === 0 && (
          <p style={{ fontSize: 14, fontStyle: "italic", margin: 0, opacity: 0.8 }}>
            Chiedimi delle regole 3x3, come organizzare la tua tappa o come funziona il circuito FIBA 3x3.
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i}>
            <div className={m.role === "user" ? "bubble-u" : "bubble-a"}>{m.content}</div>
            {/* Badge delle azioni eseguite, solo sui messaggi assistant che hanno usato tool */}
            {m.role === "assistant" && m.tools && m.tools.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
                {riepilogoTool(m.tools).map((t, j) => (
                  <span key={j} className="ui" title="Azione eseguita dal Coach AI"
                    style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", background: t.color, color: PAPER, padding: "2px 7px" }}>
                    ✓ {t.label}{t.count > 1 && ` ×${t.count}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="bubble-a pulse">Il coach sta pensando…</div>}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${RULE}` }}>
        <input className="statin" style={{ flex: 1 }} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Scrivi al coach…" />
        <button onClick={submit} disabled={loading} className="redbtn" style={{ padding: "10px 16px" }}>Invia</button>
      </div>
    </div>
  );
}
