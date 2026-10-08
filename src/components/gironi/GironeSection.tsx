/** Sezione di un singolo girone: lista delle partite + classifica. Lettera del girone
 *  calcolata dal suo indice (0→A, 1→B…) tramite charCodeAt. */
import { standings } from "../../utils/standings";
import { MatchCard } from "../partita/MatchCard";
import { ClassificaTable } from "./ClassificaTable";
import { Section } from "../ui/Section";
import type { useTappa } from "../../hooks/useTappa";
import { letteraGirone } from "../../utils/formato";
import { squadraDi } from "../../utils/tappaInfo";

export function GironeSection({ gi, girone, h }: { gi: number; girone: string[]; h: ReturnType<typeof useTappa> }) {
  // La pagina mostra i gironi solo con la tappa aperta: senza, non c'è niente da disegnare
  const { tappa } = h;
  if (!tappa) return null;
  const matches = tappa.partite.filter((m) => m.g === gi);
  const rows = standings(girone, matches, h.nameOf);
  const letter = letteraGirone(gi);
  const done = matches.filter((m) => m.done).length;
  // mappa id → logo per la classifica
  const logos = Object.fromEntries(tappa.squadre.map((s) => [s.id, s.logo]));
  const guest = !!h.user?.guest;
  return (
    <Section title={`Girone ${letter}`} kicker={`${girone.map(h.nameOf).join(" · ")} · ${done}/${matches.length} gare`}>
      <div className="flex flex-col gap-2">
        {/* Ogni scheda riceve solo la sua partita e le sue due squadre (gli stessi oggetti finché non cambiano) e azioni stabili:
            è memo, e si ridisegna solo quando cambia qualcosa di suo (F11) */}
        {matches.map((m, i) => (
          <MatchCard key={m.id} m={m} label={`Partita ${i + 1}`} guest={guest} azioni={h.azioniPartita}
            squadraA={squadraDi(tappa.squadre, m.a)} squadraB={squadraDi(tappa.squadre, m.b)} />
        ))}
      </div>
      <ClassificaTable rows={rows} logos={logos} caption={`Classifica girone ${letter}`} />
    </Section>
  );
}
