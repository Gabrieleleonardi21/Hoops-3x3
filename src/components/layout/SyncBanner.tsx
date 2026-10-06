/** Barra degli avvisi di sincronizzazione con il server, sotto l'header. Due righe possibili:
 *  - salvataggio delle tappe non riuscito per un problema temporaneo (rete, sessione, server): quante tappe
 *    aspettano e perché. La coda riprova da sola, «Riprova ora» anticipa il tentativo e l'avviso sparisce
 *    da solo quando tutto è salvato;
 *  - gli altri errori (dati rifiutati dal server, rinomina, eliminazione, caricamento), che si chiudono a mano.
 *  Lo stato in memoria resta corretto in entrambi i casi. */
import { useAppStore } from "../../stores/useAppStore";
import { tappeNonSalvate } from "../../utils/tappeNonSalvate";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

export function SyncBanner() {
  const error = useAppStore((s) => s.syncError);
  const clear = useAppStore((s) => s.clearSyncError);
  const inSospeso = useAppStore((s) => s.inSospeso);
  const motivo = useAppStore((s) => s.erroreSalvataggio);
  const salvaTutto = useAppStore((s) => s.salvaTutto);
  // Solo dopo un salvataggio non riuscito: le tappe in viaggio verso il server durante un salvataggio normale non si segnalano
  const nonSalvate = motivo !== null && inSospeso > 0;
  if (!error && !nonSalvate) return null;
  return (
    <div role="alert" className="space-y-1.5 border-b border-loss/40 bg-loss/10 px-4 py-2 text-[13px] font-semibold text-chalk">
      {nonSalvate && (
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex-1">
            {tappeNonSalvate(inSospeso)}. <span className="font-normal text-chalk-muted">{motivo}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => { void salvaTutto(); }}>Riprova ora</Button>
        </div>
      )}
      {error && (
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex-1">{error}</span>
          <button type="button" onClick={clear} aria-label="Chiudi avviso" className="area-tocco text-chalk-muted hover:text-chalk">
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
