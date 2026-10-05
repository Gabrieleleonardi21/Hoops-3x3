/** Conferma prima delle azioni che cancellano i risultati di una tappa (nuovo sorteggio, cambi di struttura).
 *  `perdita` dice che cosa si perderebbe adesso (null = niente). `chiedi(titolo, azione)` esegue subito l'azione se non
 *  c'è niente da perdere; altrimenti apre la finestra di conferma, che il componente mostra mettendo `finestra` nel
 *  suo JSX, e l'azione parte solo con «Conferma». */
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
