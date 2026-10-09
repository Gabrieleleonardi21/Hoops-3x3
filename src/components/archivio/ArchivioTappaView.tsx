import { useState } from "react";
import { standings } from "../../utils/standings";
import { ClassificaTable } from "../gironi/ClassificaTable";
import { ScoreCard } from "../partita/ScoreCard";
import { StatsView } from "../partita/StatsView";
import { EventLog } from "../partita/EventLog";
import { LeaderboardSection } from "../leaderboard/LeaderboardSection";
import { VideoGrid } from "../video/VideoGrid";
import { BracketSection } from "../gironi/BracketSection";
import { GiocatoreAnalisi } from "./GiocatoreAnalisi";
import { SquadraModal } from "./SquadraModal";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { Section } from "../ui/Section";
import type { Tappa, SquadraTappa } from "../../types";
import { giocatoriDi, logoSquadra, nomeGiocatore, nomeSquadra } from "../../utils/tappaInfo";
import { letteraGirone } from "../../utils/formato";
import { TeamLogo } from "../ui/TeamLogo";

/** Vista in sola lettura di una tappa: tappe concluse e archivio del circuito. `onRemoveVideo` c'è solo nella pagina della tappa
 *  conclusa di chi la organizza, dove i video si tolgono; nell'archivio pubblico manca e i video non hanno la X */
export function ArchivioTappaView({ t, lega, autore, onRemoveVideo }: {
  t: Tappa; lega?: string; autore?: string; onRemoveVideo?: (id: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [selPid, setSelPid] = useState<string | null>(null);
  const [selSquadra, setSelSquadra] = useState<SquadraTappa | null>(null);
  const hasStats = t.partite.some((m) => m.done && (Object.keys(m.pa || {}).length > 0 || Object.keys(m.pb || {}).length > 0));
  const nameOf = (id: string) => nomeSquadra(t.squadre, id);
  const logoOf = (id: string) => logoSquadra(t.squadre, id);
  const logos = Object.fromEntries(t.squadre.map((s) => [s.id, s.logo]));
  const playersOf = (teamId: string) => giocatoriDi(t.squadre, teamId);
  const playerNameById = (pid: string) => nomeGiocatore(t.squadre, pid);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-asphalt-700 pb-3">
        <div className="min-w-0">
          <h2 className="font-display text-[clamp(28px,5vw,44px)] text-chalk">{t.nome}</h2>
          <span className="text-[13px] text-chalk-muted">
            {[lega, t.luogo, t.data].filter(Boolean).join(" · ")} · {t.squadre.length} squadre
            {autore ? ` · organizzata da ${autore}` : ""}
          </span>
        </div>
        <Button variant="outline" size="sm" className="no-print" onClick={() => window.print()}><Icon name="download" size={14} /> Stampa / PDF</Button>
      </div>

      <Section title="Squadre e roster" kicker={`Clicca una squadra per vedere il roster${hasStats ? " e l'analisi dei giocatori" : ""}`}>
        <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(160px,1fr))]">
          {t.squadre.map((s) => (
            <button key={s.id} type="button" onClick={() => setSelSquadra(s)}
              className="hovercard flex w-full flex-col items-center gap-2 rounded border border-asphalt-700 bg-asphalt-900 p-3 text-center">
              <TeamLogo src={s.logo} alt={`Logo ${s.nome}`} className="h-14 w-14" ripiego={
                <span className="flex h-14 w-14 items-center justify-center rounded-sm bg-asphalt-800 font-display text-xl text-chalk-muted">3×3</span>
              } />
              {/* Dentro un <button> solo contenuto di testo (span), non div */}
              <span className="block">
                <span className="block font-display text-base leading-tight text-chalk">{s.nome}</span>
                {Number(s.rank) > 0 && <span className="mt-0.5 block text-[11px] font-semibold text-court">{s.rank} pt ranking</span>}
                <span className="mt-0.5 block text-[11px] text-chalk-muted">{(s.giocatori || []).filter((p) => p.nome.trim()).length} giocatori</span>
              </span>
            </button>
          ))}
        </div>
      </Section>

      {t.gironi && t.gironi.map((g, gi) => {
        const matches = t.partite.filter((m) => m.g === gi);
        const rows = standings(g, matches, nameOf);
        const letter = letteraGirone(gi);
        return (
          <Section key={gi} title={`Girone ${letter}`} kicker={g.map(nameOf).join(" · ")}>
            <div className="flex flex-col gap-2">
              {matches.map((m, i) => {
                const hasDetails =
                  Object.keys(m.pa || {}).length > 0 || Object.keys(m.pb || {}).length > 0 || (m.eventi || []).length > 0;
                const isOpen = open === m.id;
                const footer = hasDetails ? (
                  <div className="flex flex-col gap-2">
                    <Button variant="link" className="no-print self-start" onClick={() => setOpen(isOpen ? null : m.id)}>
                      {isOpen ? "Nascondi dettagli" : "Statistiche ed eventi"}
                    </Button>
                    {isOpen && (
                      <div className="grid gap-2">
                        {m.pa && Object.keys(m.pa).length > 0 && <StatsView teamName={nameOf(m.a)} players={playersOf(m.a)} sheet={m.pa} />}
                        {m.pb && Object.keys(m.pb).length > 0 && <StatsView teamName={nameOf(m.b)} players={playersOf(m.b)} sheet={m.pb} />}
                        {(m.eventi || []).length > 0 && (
                          <div>
                            <div className="kicker my-1">Eventi di gara</div>
                            <EventLog eventi={m.eventi || []} nameOf={nameOf} playerNameById={playerNameById} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : undefined;
                return (
                  <ScoreCard key={m.id} label={`Partita ${i + 1}`}
                    a={{ name: nameOf(m.a), logo: logoOf(m.a) }} b={{ name: nameOf(m.b), logo: logoOf(m.b) }}
                    sa={m.done ? m.sa : null} sb={m.done ? m.sb : null} done={m.done} footer={footer} />
                );
              })}
            </div>
            <ClassificaTable rows={rows} logos={logos} caption={`Classifica girone ${letter}`} />
          </Section>
        );
      })}

      {/* Fase finale in sola lettura (se presente) */}
      {t.bracket?.length ? <BracketSection tappa={t} readOnly /> : null}

      <LeaderboardSection tappa={t} />

      {(t.video || []).length > 0 && (
        <Section title="Video della tappa">
          <VideoGrid videos={t.video || []} onRemove={onRemoveVideo} />
        </Section>
      )}

      {selSquadra && (
        <SquadraModal
          squadra={selSquadra}
          hasStats={hasStats}
          onClose={() => setSelSquadra(null)}
          onSelectPlayer={(pid) => { setSelSquadra(null); setSelPid(pid); }}
        />
      )}
      {selPid && <GiocatoreAnalisi tappa={t} pid={selPid} onClose={() => setSelPid(null)} />}
    </div>
  );
}
