/** Sezione "Concludi tappa": pubblica i risultati nell'archivio condiviso del circuito.
 *  Mostra eventuali errori di validazione (partite mancanti, roster incompleti…). */
import { useState } from "react";
import { INK, RED } from "../../constants/colors";

export function TappaConclusion({ onConcludi }: { onConcludi: () => Promise<string | null> }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section style={{ borderTop: `4px solid ${INK}`, paddingTop: 14 }}>
      <button onClick={async () => setMsg(await onConcludi())} className="redbtn">🏁 Concludi e pubblica la tappa</button>
      <p style={{ fontSize: 13, fontStyle: "italic", margin: "8px 0 0" }}>
        Quando tutte le partite sono registrate, la tappa viene pubblicata nell'Archivio circuito: ogni utente
        potrà consultarne squadre, statistiche, eventi e video. I dati pubblicati sono visibili a tutti.
      </p>
      {msg && <p className="ui t-red" style={{ fontWeight: 700, fontSize: 13, marginTop: 6 }}>{msg}</p>}
    </section>
  );
}
