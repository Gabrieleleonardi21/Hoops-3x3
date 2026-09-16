/** Sezione "Concludi tappa": pubblica i risultati nell'archivio condiviso del circuito.
 *  Mostra eventuali errori di validazione (partite mancanti, roster incompleti…). */
import { useState } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

export function TappaConclusion({ onConcludi }: { onConcludi: () => Promise<string | null> }) {
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="border-t border-asphalt-700 pt-4">
      <Button onClick={async () => setMsg(await onConcludi())}><Icon name="flag" size={16} /> Concludi e pubblica la tappa</Button>
      <p className="mt-2 text-[13px] text-chalk-muted">
        Quando tutte le partite sono registrate, la tappa viene pubblicata nell'Archivio circuito: ogni utente
        potrà consultarne squadre, statistiche, eventi e video. I dati pubblicati sono visibili a tutti.
      </p>
      {msg && <p className="mt-1.5 text-[13px] font-semibold text-loss" role="alert">{msg}</p>}
    </section>
  );
}
