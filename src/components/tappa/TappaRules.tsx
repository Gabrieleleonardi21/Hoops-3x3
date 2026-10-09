/** Pannello di configurazione delle regole FIBA 3x3 per la tappa (punteggio, durata, ecc.). Ogni campo si applica all'uscita o
 *  con Invio (CampoConfermato): svuotarlo per scrivere «15» non fa passare la regola da 1, e il valore si controlla una volta sola
 *  (useTappa.setRule: intero da 1 in su, i decimali si troncano). */
import { CampoConfermato } from "../ui/CampoConfermato";
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
          <CampoConfermato key={k} label={label} type="number" min={1} valore={String(regole[k])} onConferma={(v) => onChange(k, v)} />
        ))}
      </div>
    </Card>
  );
}
