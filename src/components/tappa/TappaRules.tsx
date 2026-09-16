/** Pannello di configurazione delle regole FIBA 3x3 per la tappa (punteggio, durata, ecc.) */
import { Input } from "../ui/Input";
import { Card } from "../ui/Card";
import type { Regole } from "../../types";

const FIELDS: [keyof Regole, string][] = [
  ["target", "Punteggio vittoria"],
  ["durata", "Durata (minuti)"],
  ["shot", "Possesso (secondi)"],
  ["ot", "Supplementare (punti)"],
];

export function TappaRules({ regole, onChange }: { regole: Regole; onChange: (k: keyof Regole, v: string) => void }) {
  return (
    <Card className="my-4">
      <h3 className="font-display text-lg mb-1">Regole della tappa <span className="text-chalk-muted">(base FIBA 3x3)</span></h3>
      <p className="mb-3 text-[13px] text-chalk-muted">
        Canestri da 1 e 2 punti. Vince chi arriva per primo al punteggio vittoria o chi è avanti allo scadere.
        Niente pareggi: supplementare al primo che segna {regole.ot} punti.
      </p>
      <div className="grid-auto">
        {FIELDS.map(([k, label]) => (
          <Input key={k} label={label} type="number" min={1} value={regole[k]} onChange={(e) => onChange(k, e.target.value)} />
        ))}
      </div>
    </Card>
  );
}
