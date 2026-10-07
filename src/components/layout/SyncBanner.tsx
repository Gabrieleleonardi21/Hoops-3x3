/** Barra degli avvisi di sincronizzazione con il server, sotto l'header. Tre righe possibili:
 *  - salvataggio delle tappe non riuscito per un problema temporaneo (rete, sessione, server): quante tappe
 *    aspettano e perché. La coda riprova da sola, «Riprova ora» anticipa il tentativo e l'avviso sparisce
 *    da solo quando tutto è salvato;
 *  - i conflitti con un altro dispositivo (T2.7), una frase per tappa: salvata altrove (ora nello store c'è quella del
 *    server), eliminata altrove, o non eliminata perché salvata nello stesso istante. Sta a parte dagli errori, così
 *    un errore arrivato dopo non nasconde che delle modifiche sono state scartate; si chiude a mano;
 *  - gli altri errori (dati rifiutati dal server, rinomina, eliminazione, caricamento), che si chiudono a mano.
 *  Lo stato in memoria resta corretto in tutti i casi.
 *  Ogni riga ha il suo ruolo, così il lettore di schermo legge solo quella che cambia: `alert` per le righe da chiudere
 *  (errori e conflitti), `status` per le modifiche non salvate, che cambiano spesso e da sole. */
import { useAppStore } from "../../stores/useAppStore";
import { tappeNonSalvate } from "../../utils/tappeNonSalvate";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";

/** Una riga della barra che si chiude a mano: `etichetta` è il nome accessibile del pulsante di chiusura */
function RigaDaChiudere({ testo, etichetta, onChiudi }: { testo: string; etichetta: string; onChiudi: () => void }) {
  return (
    <div role="alert" className="mx-auto flex max-w-5xl items-center gap-3">
      <span className="flex-1">{testo}</span>
      <button type="button" onClick={onChiudi} aria-label={etichetta} className="area-tocco text-chalk-muted hover:text-chalk">
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}

export function SyncBanner() {
  const error = useAppStore((s) => s.syncError);
  const clear = useAppStore((s) => s.clearSyncError);
  const conflitti = useAppStore((s) => s.avvisoConflitti);
  const chiudiConflitti = useAppStore((s) => s.chiudiAvvisoConflitti);
  const inSospeso = useAppStore((s) => s.inSospeso);
  const motivo = useAppStore((s) => s.erroreSalvataggio);
  const salvaTutto = useAppStore((s) => s.salvaTutto);
  // Solo dopo un salvataggio non riuscito: le tappe in viaggio verso il server durante un salvataggio normale non si segnalano
  const nonSalvate = motivo !== null && inSospeso > 0;
  if (!error && !nonSalvate && !conflitti) return null;
  return (
    <div className="space-y-1.5 border-b border-loss/40 bg-loss/10 px-4 py-2 text-[13px] font-semibold text-chalk">
      {nonSalvate && (
        <div role="status" className="mx-auto flex max-w-5xl items-center gap-3">
          <span className="flex-1">
            {tappeNonSalvate(inSospeso)}. <span className="font-normal text-chalk-muted">{motivo}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => { void salvaTutto(); }}>Riprova ora</Button>
        </div>
      )}
      {conflitti && <RigaDaChiudere testo={conflitti} etichetta="Chiudi avviso dei conflitti" onChiudi={chiudiConflitti} />}
      {error && <RigaDaChiudere testo={error} etichetta="Chiudi avviso" onChiudi={clear} />}
    </div>
  );
}
