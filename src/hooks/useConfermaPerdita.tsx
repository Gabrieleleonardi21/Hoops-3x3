/** Conferma prima delle azioni che fanno perdere qualcosa: i risultati di una tappa (nuovo sorteggio, cambi di struttura), ma
 *  anche le eliminazioni (tappa, tabellone, lega, voci dell'anagrafe) e la riapertura di una tappa pubblicata.
 *  `perdita` dice che cosa si perderebbe adesso, ed è il testo della finestra. Per chiedere sempre basta una `perdita` che non
 *  è mai null; per chiedere solo quando c'è qualcosa da perdere (nuovo sorteggio, rimuovi squadra) restituisce null quando non
 *  c'è niente. `chiedi(titolo, azione)` esegue subito l'azione se la perdita è null; altrimenti apre la finestra di conferma,
 *  che il componente mostra mettendo `finestra` nel suo JSX (è null finché nessuna richiesta è aperta), e l'azione parte solo
 *  con «Conferma»: «Annulla», Esc, lo sfondo e la X non fanno niente. Con un invio al server la conferma si chiede prima di
 *  useInvio.esegui, così «Annulla» non manda niente. */
import { useState } from "react";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";

interface Richiesta {
  titolo: string;
  testo: string;
  azione: () => void;
}

export function useConfermaPerdita(perdita: () => string | null) {
  const [richiesta, setRichiesta] = useState<Richiesta | null>(null);

  const chiedi = (titolo: string, azione: () => void) => {
    const testo = perdita();
    if (!testo) { azione(); return; }
    setRichiesta({ titolo, testo, azione });
  };

  const conferma = () => {
    richiesta?.azione();
    setRichiesta(null);
  };

  const finestra = richiesta && (
    <ConfirmDialog title={richiesta.titolo} onConfirm={conferma} onCancel={() => setRichiesta(null)}>
      {richiesta.testo}
    </ConfirmDialog>
  );

  return { chiedi, finestra };
}
