/** Un caricamento non riuscito: dice che cosa non si è potuto caricare e perché, con un pulsante per ripetere («Riprova»).
 *  Prende il posto dell'elenco: mostrarlo vuoto direbbe una cosa falsa (che non c'è niente) invece di dire che non si sa. Lo
 *  usano le pagine che caricano dal server (anagrafe, archivio, tappa pubblica) e l'avviso all'avvio dell'app; lo usa anche
 *  l'ErrorBoundary per una pagina che non si disegna, dove l'azione è «Ricarica» (`azione`). */
import { Button } from "./Button";

export function ErroreCaricamento({ cosa, motivo, azione = "Riprova", onRiprova }: {
  cosa: string; motivo: string;
  /** Etichetta del pulsante */
  azione?: string;
  onRiprova: () => void;
}) {
  return (
    <div role="alert" className="rounded border border-loss/40 bg-loss/10 p-4 text-[13px] text-chalk">
      <p className="m-0 font-semibold">{cosa}</p>
      <p className="mt-1 mb-3 text-chalk-muted">{motivo}</p>
      <Button size="sm" onClick={onRiprova}>{azione}</Button>
    </div>
  );
}
