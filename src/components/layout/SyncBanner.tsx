/** Barra che segnala un salvataggio sul server non riuscito (lo store lo scrive in syncError).
 *  Lo stato in memoria resta corretto: l'utente può riprovare l'azione o ricaricare. */
import { useAppStore } from "../../stores/useAppStore";
import { Icon } from "../ui/Icon";

export function SyncBanner() {
  const error = useAppStore((s) => s.syncError);
  const clear = useAppStore((s) => s.clearSyncError);
  if (!error) return null;
  return (
    <div role="alert" className="border-b border-loss/40 bg-loss/10 px-4 py-2 text-[13px] font-semibold text-chalk">
      <div className="mx-auto flex max-w-5xl items-center gap-3">
        <span className="flex-1">{error}</span>
        <button type="button" onClick={clear} aria-label="Chiudi avviso" className="text-chalk-muted hover:text-chalk">
          <Icon name="close" size={16} />
        </button>
      </div>
    </div>
  );
}
