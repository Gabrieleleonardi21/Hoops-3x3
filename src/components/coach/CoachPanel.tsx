/** Pannello chat del Coach AI: input utente, lista messaggi, bottone "Cancella chat".
 *  La cronologia viene persistita in sessionStorage (si azzera alla chiusura della scheda). */
import { useState } from "react";
import { INK, PAPER, RULE } from "../../constants/colors";
import { useCoachAI } from "../../hooks/useCoachAI";

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
          <div key={i} className={m.role === "user" ? "bubble-u" : "bubble-a"}>{m.content}</div>
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
