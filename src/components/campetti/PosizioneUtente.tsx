/** Il pulsante «Usa la mia posizione» e l'esito della richiesta (usePosizione): i tre esiti hanno un messaggio che dice anche che cosa
 *  cambia nella pagina (l'ordine dei campetti), con `role="status"` così il lettore di schermo lo annuncia senza spostare il focus. */
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import type { StatoPosizione } from "../../hooks/usePosizione";

/** Il messaggio per ogni stato; «mai chiesta» non ne ha */
const MESSAGGI: Partial<Record<StatoPosizione, string>> = {
  "in corso": "Sto leggendo la tua posizione…",
  concessa: "Posizione trovata: i campetti intorno a te, in ordine di distanza. La posizione resta nel browser.",
  negata: "Posizione negata: i campetti sono in ordine di città e nome. Per usarla, consentila nelle impostazioni del browser.",
  "non disponibile": "Posizione non disponibile: i campetti sono in ordine di città e nome. Riprova più tardi.",
};

export function PosizioneUtente({ stato, onChiedi }: { stato: StatoPosizione; onChiedi: () => void }) {
  const messaggio = MESSAGGI[stato];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="sm" onClick={onChiedi} disabled={stato === "in corso"}>
        <Icon name="pin" size={16} /> Usa la mia posizione
      </Button>
      {/* Lo status c'è sempre, anche vuoto: una regione viva che compare dopo non sempre viene annunciata */}
      <p role="status" className="m-0 text-[13px] text-chalk-muted">{messaggio}</p>
    </div>
  );
}
