import { INK } from "../../constants/colors";
import { standings } from "../../utils/standings";
import { MatchCard } from "../partita/MatchCard";
import { ClassificaTable } from "./ClassificaTable";
import type { useTappa } from "../../hooks/useTappa";

export function GironeSection({ gi, girone, h }: { gi: number; girone: string[]; h: ReturnType<typeof useTappa> }) {
  const matches = h.tappa!.partite.filter((m) => m.g === gi);
  const rows = standings(girone, matches, h.nameOf);
  return (
    <section style={{ borderTop: `4px solid ${INK}`, marginBottom: 26 }}>
      <h3 className="disp" style={{ fontSize: 18, margin: "12px 0 8px", textTransform: "uppercase" }}>
        Girone {String.fromCharCode(65 + gi)}
        <span className="ui" style={{ fontSize: 12, fontWeight: 700, opacity: 0.6, marginLeft: 10 }}>
          {girone.map(h.nameOf).join(" · ")}
        </span>
      </h3>
      {matches.map((m) => <MatchCard key={m.id} m={m} h={h} />)}
      <ClassificaTable rows={rows} />
    </section>
  );
}
