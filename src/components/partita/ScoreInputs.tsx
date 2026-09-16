/** Coppia di input numerici per il punteggio di una partita (squadra A vs squadra B).
 *  inputMode="numeric" attiva la tastiera numerica su mobile. */
export function ScoreInputs({ sa, sb, onSa, onSb, labelA, labelB }: {
  sa: string; sb: string;
  onSa: (v: string) => void; onSb: (v: string) => void;
  labelA: string; labelB: string;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <input className="scorein" type="number" inputMode="numeric" min={0} value={sa}
        onChange={(e) => onSa(e.target.value)} aria-label={`Punti ${labelA}`} />
      <span className="font-display text-chalk-dim">–</span>
      <input className="scorein" type="number" inputMode="numeric" min={0} value={sb}
        onChange={(e) => onSb(e.target.value)} aria-label={`Punti ${labelB}`} />
    </span>
  );
}
