import type { Tappa } from "../../types";
import { INK, ORANGE, RED } from "../../constants/colors";

export function TappaCard({ t, onOpen }: { t: Tappa; onOpen: () => void }) {
  return (
    <button className="tapparow" onClick={onOpen}>
      <span style={{ fontSize: 16 }}>
        {t.conclusa && <span className="ui" style={{ fontSize: 11, fontWeight: 700, color: ORANGE, marginRight: 8 }}>🏁 CONCLUSA</span>}
        <strong className="disp" style={{ fontSize: 15 }}>{t.nome}</strong>
        <span className="ui" style={{ fontSize: 12.5, opacity: 0.7, marginLeft: 8 }}>
          {[t.luogo, t.data].filter(Boolean).join(" · ")} · {t.squadre.length} squadre
        </span>
      </span>
      <span className="ui" style={{ fontSize: 12.5, fontWeight: 700, color: t.gironi ? INK : RED }}>
        {t.gironi ? `${t.nGironi} gironi · ${t.partite.filter((m) => m.done).length}/${t.partite.length} gare` : "Gironi da sorteggiare"}
      </span>
    </button>
  );
}
