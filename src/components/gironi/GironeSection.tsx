/** Sezione di un singolo girone: lista delle partite + classifica. Lettera del girone
 *  calcolata dal suo indice (0→A, 1→B…) tramite charCodeAt. */
import { standings } from "../../utils/standings";
import { MatchCard } from "../partita/MatchCard";
import { ClassificaTable } from "./ClassificaTable";
import { Section } from "../ui/Section";
import type { useTappa } from "../../hooks/useTappa";
import { letteraGirone } from "../../utils/formato";

export function GironeSection({ gi, girone, h }: { gi: number; girone: string[]; h: ReturnType<typeof useTappa> }) {
  const matches = h.tappa!.partite.filter((m) => m.g === gi);
  const rows = standings(girone, matches, h.nameOf);
  const letter = letteraGirone(gi);
  const done = matches.filter((m) => m.done).length;
  // mappa id → logo per la classifica
  const logos = Object.fromEntries(h.tappa!.squadre.map((s) => [s.id, s.logo]));
  return (
    <Section title={`Girone ${letter}`} kicker={`${girone.map(h.nameOf).join(" · ")} · ${done}/${matches.length} gare`}>
      <div className="flex flex-col gap-2">
        {matches.map((m, i) => <MatchCard key={m.id} m={m} h={h} label={`Partita ${i + 1}`} />)}
      </div>
      <ClassificaTable rows={rows} logos={logos} caption={`Classifica girone ${letter}`} />
    </Section>
  );
}
