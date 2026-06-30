import { INK, RED } from "../../constants/colors";
import { ytId } from "../../utils/ytId";
import { safeUrl } from "../../utils/safeUrl";
import type { VideoItem } from "../../types";

export function VideoCard({ v, onRemove }: { v: VideoItem; onRemove?: (id: string) => void }) {
  const id = ytId(v.url);
  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${INK}`, padding: 8 }}>
      <div className="ui flex between items-base" style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>
        <span>{v.titolo}</span>
        {onRemove && <button onClick={() => onRemove(v.id)} className="linkbtn" style={{ color: INK, opacity: 0.5 }}>×</button>}
      </div>
      {id ? (
        <div style={{ position: "relative", paddingTop: "56.25%" }}>
          <iframe src={`https://www.youtube.com/embed/${id}`} title={v.titolo} allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} />
        </div>
      ) : (
        <a href={safeUrl(v.url)} target="_blank" rel="noopener noreferrer" className="ui t-red" style={{ fontSize: 13, fontWeight: 700 }}>
          Apri il video ↗
        </a>
      )}
    </div>
  );
}
