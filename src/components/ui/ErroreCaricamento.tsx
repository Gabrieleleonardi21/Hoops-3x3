/** Un caricamento non riuscito: dice che cosa non si è potuto caricare e perché, con «Riprova». Prende il posto dell'elenco:
 *  mostrarlo vuoto direbbe una cosa falsa (che non c'è niente) invece di dire che non si sa. Lo usano le pagine che caricano
 *  dal server (anagrafe, archivio) e l'avviso all'avvio dell'app. */
import { Button } from "./Button";

export function ErroreCaricamento({ cosa, motivo, onRiprova }: { cosa: string; motivo: string; onRiprova: () => void }) {
  return (
    <div role="alert" className="rounded border border-loss/40 bg-loss/10 p-4 text-[13px] text-chalk">
      <p className="m-0 font-semibold">{cosa}</p>
      <p className="mt-1 mb-3 text-chalk-muted">{motivo}</p>
      <Button size="sm" onClick={onRiprova}>Riprova</Button>
    </div>
  );
}
