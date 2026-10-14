/** Elenco di VideoCard, una per riga: ogni video prende tutta la larghezza della colonna della pagina. onRemove è opzionale: assente nelle viste in sola lettura. */
import { VideoCard } from "./VideoCard";
import type { VideoItem } from "../../types";

export function VideoGrid({ videos, onRemove }: { videos: VideoItem[]; onRemove?: (id: string) => void }) {
  if (!videos.length) return <p className="text-sm text-chalk-muted">Nessun video caricato.</p>;
  return (
    <div className="grid gap-6">
      {videos.map((v) => <VideoCard key={v.id} v={v} onRemove={onRemove} />)}
    </div>
  );
}
