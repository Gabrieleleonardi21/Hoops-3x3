/** Sezione leader della tappa: una LeaderCard (top 5) per ciascuna categoria in LEADER_CATS.
 *  Non mostra nulla se non ci sono ancora statistiche registrate. */
import { LEADER_CATS } from "../../constants/rules";
import { tappaLeaders } from "../../utils/tappaLeaders";
import { LeaderCard } from "./LeaderCard";
import { Section } from "../ui/Section";
import type { Tappa } from "../../types";

export function LeaderboardSection({ tappa }: { tappa: Tappa }) {
  const players = tappaLeaders(tappa);
  if (!players.length) return null;
  return (
    <Section title="Leader della tappa" kicker="Totali su tutte le gare · media a partita tra parentesi">
      <div className="grid gap-3 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
        {LEADER_CATS.map(([k, label]) => <LeaderCard key={k} label={label} statKey={k} players={players} />)}
      </div>
    </Section>
  );
}
