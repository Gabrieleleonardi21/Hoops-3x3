import { ytId } from "../../utils/ytId";
import { safeUrl } from "../../utils/safeUrl";
import { Icon } from "../ui/Icon";
import type { VideoItem } from "../../types";

export function VideoCard({ v, onRemove }: { v: VideoItem; onRemove?: (id: string) => void }) {
  const id = ytId(v.url);
  return (
    <div className="overflow-hidden rounded border border-asphalt-700 bg-asphalt-900">
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-chalk">
          <Icon name="video" size={14} className="shrink-0 text-court" />
          <span className="truncate">{v.titolo || "Video"}</span>
        </span>
        {onRemove && (
          <button onClick={() => onRemove(v.id)} className="text-chalk-dim hover:text-loss" aria-label="Rimuovi video">
            <Icon name="close" size={14} />
          </button>
        )}
      </div>
      {id ? (
        <div className="relative pt-[56.25%]">
          <iframe src={`https://www.youtube.com/embed/${id}`} title={v.titolo} allowFullScreen loading="lazy"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
            className="absolute inset-0 h-full w-full border-0" />
        </div>
      ) : (
        <a href={safeUrl(v.url)} target="_blank" rel="noopener noreferrer" className="block border-t border-asphalt-700 px-3 py-2 text-[13px] font-semibold text-court hover:underline">
          Apri il video ↗
        </a>
      )}
    </div>
  );
}
