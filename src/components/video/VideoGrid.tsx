/** Griglia responsiva di VideoCard. onRemove è opzionale: assente nelle viste in sola lettura. */
import { VideoCard } from "./VideoCard";
import type { VideoItem } from "../../types";

export function VideoGrid({ videos, onRemove }: { videos: VideoItem[]; onRemove?: (id: string) => void }) {
  if (!videos.length) return <p style={{ fontStyle: "italic", fontSize: 14 }}>Nessun video caricato.</p>;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: 12 }}>
      {videos.map((v) => <VideoCard key={v.id} v={v} onRemove={onRemove} />)}
    </div>
  );
}
