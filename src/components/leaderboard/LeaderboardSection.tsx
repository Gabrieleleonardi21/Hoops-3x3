/** Sezione leader della tappa: raggruppa una LeaderCard per ciascuna categoria definita in LEADER_CATS.
 *  Non mostra nulla se non ci sono ancora statistiche registrate. */
import { INK, ORANGE } from "../../constants/colors";
import { LEADER_CATS } from "../../constants/rules";
import { tappaLeaders } from "../../utils/tappaLeaders";
import { LeaderCard } from "./LeaderCard";
import type { Tappa } from "../../types";

export function LeaderboardSection({ tappa }: { tappa: Tappa }) {
  const players = tappaLeaders(tappa);
  if (!players.length) return null;
  return (
    <section style={{ borderTop: `4px solid ${INK}`, marginBottom: 26 }}>
      <h3 className="disp" style={{ fontSize: 18, margin: "12px 0 2px", textTransform: "uppercase" }}>
        Leader della tappa <span style={{ color: ORANGE }}>★</span>
      </h3>
      <p className="ui" style={{ fontSize: 12, fontWeight: 600, opacity: 0.7, margin: "0 0 12px" }}>
        Totali su tutte le gare giocate · tra parentesi la media a partita.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12 }}>
        {LEADER_CATS.map(([k, label]) => <LeaderCard key={k} label={label} statKey={k} players={players} />)}
      </div>
    </section>
  );
}
