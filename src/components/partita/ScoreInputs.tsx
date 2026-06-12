export function ScoreInputs({ sa, sb, onSa, onSb, labelA, labelB }: {
  sa: string; sb: string;
  onSa: (v: string) => void; onSb: (v: string) => void;
  labelA: string; labelB: string;
}) {
  return (
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input className="scorein" type="number" inputMode="numeric" min={0} value={sa}
        onChange={(e) => onSa(e.target.value)} aria-label={`Punti ${labelA}`} />
      <span className="disp">-</span>
      <input className="scorein" type="number" inputMode="numeric" min={0} value={sb}
        onChange={(e) => onSb(e.target.value)} aria-label={`Punti ${labelB}`} />
    </span>
  );
}
