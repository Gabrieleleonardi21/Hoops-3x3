/** Griglia responsiva di VideoCard. onRemove è opzionale: assente nelle viste in sola lettura. */
import { VideoCard } from "./VideoCard";
import type { VideoItem } from "../../types";

export function VideoGrid({ videos, onRemove }: { videos: VideoItem[]; onRemove?: (id: string) => void }) {
  if (!videos.length) return <p className="text-sm text-chalk-muted">Nessun video caricato.</p>;
  return (
    <div className="grid gap-3 grid-cols-[repeat(auto-fill,minmax(300px,1fr))]">
      {videos.map((v) => <VideoCard key={v.id} v={v} onRemove={onRemove} />)}
    </div>
  );
}
