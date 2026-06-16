/** Pannello di configurazione delle regole FIBA 3x3 per la tappa (punteggio, durata, ecc.) */
import { INK } from "../../constants/colors";
import { Input } from "../ui/Input";
import type { Regole } from "../../types";

const FIELDS: [keyof Regole, string][] = [
  ["target", "Punteggio vittoria"],
  ["durata", "Durata (minuti)"],
  ["shot", "Possesso (secondi)"],
  ["ot", "Supplementare (punti)"],
];

export function TappaRules({ regole, onChange }: { regole: Regole; onChange: (k: keyof Regole, v: string) => void }) {
  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 16, margin: "16px 0" }}>
      <h3 className="disp" style={{ fontSize: 16, margin: "0 0 4px", textTransform: "uppercase" }}>Regole della tappa (base FIBA 3x3)</h3>
      <p style={{ fontSize: 13.5, fontStyle: "italic", margin: "0 0 12px" }}>
        Canestri da 1 e 2 punti. Vince chi arriva per primo al punteggio vittoria o chi è avanti allo scadere.
        Niente pareggi: supplementare al primo che segna {regole.ot} punti.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        {FIELDS.map(([k, label]) => (
          <Input key={k} label={label} type="number" min={1} value={regole[k]} onChange={(e) => onChange(k, e.target.value)} />
        ))}
      </div>
    </div>
  );
}
