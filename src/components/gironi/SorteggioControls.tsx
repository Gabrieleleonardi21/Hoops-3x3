/** Controlli del sorteggio: casuale (Fisher-Yates) o per ranking (teste di serie a serpentina).
 *  Avvisa che un nuovo sorteggio azzera i punteggi già registrati e, se ce ne sono, chiede conferma. */
import { useState } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";

interface Props {
  hasGironi: boolean;
  onSorteggia: (mode: "casuale" | "ranking") => string | null;
  /** Che cosa cancellerebbe adesso un nuovo sorteggio (null = niente da perdere, nessuna conferma) */
  perdita: () => string | null;
}

export function SorteggioControls({ hasGironi, onSorteggia, perdita }: Props) {
  const [error, setError] = useState<string | null>(null);
  const { chiedi, finestra } = useConfermaPerdita(perdita);
  const run = (mode: "casuale" | "ranking") => chiedi("Rifare il sorteggio?", () => setError(onSorteggia(mode)));
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
        <Button onClick={() => run("casuale")}><Icon name="dice" size={16} /> Sorteggio casuale</Button>
        <Button variant="outline" onClick={() => run("ranking")}><Icon name="ranking" size={16} /> Sorteggio per ranking</Button>
        {hasGironi && <span className="text-xs font-semibold text-court">Un nuovo sorteggio azzera i punteggi già registrati.</span>}
      </div>
      <p className="m-0 text-xs text-chalk-muted">
        Il sorteggio per ranking usa i punti ranking del circuito inseriti nelle card delle squadre:
        le teste di serie vengono distribuite a serpentina per bilanciare i gironi.
      </p>
      {error && <p className="mt-1.5 text-[13px] font-semibold text-loss" role="alert">{error}</p>}
      {finestra}
    </div>
  );
}
