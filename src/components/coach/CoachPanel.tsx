/** Pannello chat del Coach AI: input utente, lista messaggi, bottone "Cancella chat".
 *  La cronologia viene persistita in sessionStorage (si azzera alla chiusura della scheda). */
import { useState } from "react";
import { RED, ORANGE } from "../../constants/colors";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
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
      <div className="flex items-center justify-between border-b border-asphalt-700 px-3.5 py-2.5">
        <span className="flex items-center gap-2 font-display text-base text-chalk"><Icon name="ball" size={16} className="text-court" /> Coach AI · 3x3</span>
        <div className="flex items-center gap-2">
          {msgs.length > 0 && (
            <button onClick={clearChat} className="text-xs text-chalk-muted hover:text-chalk" aria-label="Cancella chat">Cancella</button>
          )}
          <button onClick={onClose} className="text-chalk-muted hover:text-chalk" aria-label="Chiudi"><Icon name="close" size={18} /></button>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
        {msgs.length === 0 && (
          <p className="m-0 text-sm text-chalk-muted">
            Chiedimi delle regole 3x3, come organizzare la tua tappa o come funziona il circuito FIBA 3x3.
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className="flex flex-col">
            <div className={m.role === "user" ? "bubble-u" : "bubble-a"}>{m.content}</div>
            {/* Badge delle azioni eseguite, solo sui messaggi assistant che hanno usato tool */}
            {m.role === "assistant" && m.tools && m.tools.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {riepilogoTool(m.tools).map((t, j) => (
                  <span key={j} className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-asphalt-950"
                    title="Azione eseguita dal Coach AI" style={{ background: t.color }}>
                    <Icon name="check" size={10} /> {t.label}{t.count > 1 && ` ×${t.count}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {loading && <div className="bubble-a pulse">Il coach sta pensando…</div>}
      </div>
      <div className="flex gap-2 border-t border-asphalt-700 p-2.5">
        <input className="statin flex-1" value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Scrivi al coach…" aria-label="Messaggio per il coach" />
        <Button onClick={submit} disabled={loading}>Invia</Button>
      </div>
    </div>
  );
}
