/** Finestra che si apre quando più squadre dell'anagrafe si chiamano come la squadra di una tappa: l'utente sceglie quale collegare, oppure
 *  ne registra una nuova con lo stesso nome. «Annulla», Esc e lo sfondo non collegano niente. Il nome, la città e l'autore sono testo
 *  React, mai HTML. */
import { useState } from "react";
import type { RegSquadra } from "../../types";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Button } from "../ui/Button";
import { TeamLogo } from "../ui/TeamLogo";
import { AVVISO_NUOVA_OMONIMA, TITOLO_SCELTA_SQUADRA } from "../../utils/testi";

/** La riga di una voce: città e autore, come una frase sola («Torino · di Gabriele») */
function descrizione(reg: RegSquadra): string {
  const luogo = reg.citta || "senza città";
  if (!reg.autore) return `${luogo} · autore sconosciuto`;
  return `${luogo} · di ${reg.autore}`;
}

export function SceltaSquadraDialog({ nome, candidate, onScegli, onNuova, onAnnulla }: {
  /** Il nome scritto nella squadra di tappa, senza spazi ai lati */
  nome: string;
  /** Le voci dell'anagrafe con questo nome, almeno due. La prima è quella selezionata all'apertura */
  candidate: RegSquadra[];
  /** «Collega» con la voce selezionata */
  onScegli: (reg: RegSquadra) => void;
  /** «Registra una nuova squadra con questo nome» */
  onNuova: () => void;
  onAnnulla: () => void;
}) {
  const [selezionata, setSelezionata] = useState(candidate[0]);

  return (
    <ConfirmDialog title={TITOLO_SCELTA_SQUADRA(nome)} confermaTesto="Collega" onConfirm={() => onScegli(selezionata)} onCancel={onAnnulla}>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="sr-only">Squadra da collegare</legend>
        {candidate.map((reg) => (
          // Ogni riga è l'etichetta del suo radio: un clic sulla riga la seleziona, e il lettore di schermo legge città e autore
          <label key={reg.id} className="flex cursor-pointer items-center gap-3 rounded border border-asphalt-700 p-2.5">
            <input type="radio" name="squadra" checked={reg.id === selezionata.id} onChange={() => setSelezionata(reg)} />
            <TeamLogo src={reg.logo} alt={`Logo ${reg.nome}`} className="h-8 w-8" />
            <span className="min-w-0">
              <span className="block font-semibold text-chalk">{reg.nome}</span>
              <span className="block text-[12px] text-chalk-muted">{descrizione(reg)}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {/* Con un'altra squadra dello stesso nome il numero cresce: l'avviso dice quale posto prenderebbe la nuova */}
      <div className="mt-3">
        <Button variant="link" onClick={onNuova}>Registra una nuova squadra con questo nome</Button>
        <p className="m-0 text-[12px] text-chalk-muted">{AVVISO_NUOVA_OMONIMA(candidate.length + 1)}</p>
      </div>
    </ConfirmDialog>
  );
}
