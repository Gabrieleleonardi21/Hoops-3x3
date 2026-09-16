/** Home: se l'utente non è loggato mostra hero + form di accesso; altrimenti una dashboard
 *  della lega attiva: tappa in corso, classifica live, prossime partite, ultimo risultato e leader.
 *  Nessuna logica nuova: compone standings(), tappaLeaders() e i dati già nello store. */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthForm } from "../components/auth/AuthForm";
import { Hero } from "../components/layout/Hero";
import { StandingsTable } from "../components/leaderboard/StandingsTable";
import { ScoreCard } from "../components/partita/ScoreCard";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Kicker } from "../components/ui/Kicker";
import { Section } from "../components/ui/Section";
import { StatTile } from "../components/ui/StatTile";
import { LEADER_CATS } from "../constants/rules";
import { useAppStore } from "../stores/useAppStore";
import { standings } from "../utils/standings";
import { tappaLeaders } from "../utils/tappaLeaders";
import type { Tappa } from "../types";

/** Tappa "in corso": la più recente non conclusa con gironi sorteggiati, altrimenti l'ultima creata */
function tappaInCorso(tappe: Tappa[]): Tappa | null {
  const aperte = tappe.filter((t) => !t.conclusa);
  const conGironi = aperte.filter((t) => t.gironi);
  return conGironi.at(-1) ?? aperte.at(-1) ?? tappe.at(-1) ?? null;
}

export function HomePage() {
  const user = useAppStore((s) => s.user);
  const legaId = useAppStore((s) => s.legaId);
  const legaName = useAppStore((s) => s.legaName);
  const tappe = useAppStore((s) => s.tappe);
  const navigate = useNavigate();

  const t = useMemo(() => tappaInCorso(tappe), [tappe]);
  const nameOf = (id: string) => t?.squadre.find((s) => s.id === id)?.nome ?? id;
  const logoOf = (id: string) => t?.squadre.find((s) => s.id === id)?.logo;
  const logos = Object.fromEntries((t?.squadre ?? []).map((s) => [s.id, s.logo]));

  // Girone da mostrare: il primo con almeno una partita giocata, altrimenti il primo
  const gi = useMemo(() => {
    if (!t?.gironi) return -1;
    const withGames = t.gironi.findIndex((_, i) => t.partite.some((m) => m.g === i && m.done));
    return withGames >= 0 ? withGames : 0;
  }, [t]);
  const rows = t?.gironi && gi >= 0 ? standings(t.gironi[gi], t.partite.filter((m) => m.g === gi), nameOf) : [];
  const prossime = (t?.partite ?? []).filter((m) => !m.done).slice(0, 3);
  const ultima = (t?.partite ?? []).filter((m) => m.done).at(-1) ?? null;
  const live = !!t && !t.conclusa && !!t.gironi && t.partite.some((m) => m.done) && t.partite.some((m) => !m.done);
  const leaders = t ? tappaLeaders(t) : [];

  /* ── Non loggato: hero + accesso ── */
  if (!user) {
    return (
      <Hero kicker="Circuito italiano 3x3" title={<>Hoop <span className="text-court">3x3</span></>}
        subtitle="Crea la tua lega, organizza le tappe, sorteggia i gironi e registra i punteggi. Regole FIBA 3x3, niente pareggi."
        aside={<AuthForm />} />
    );
  }

  /* ── Loggato senza lega ── */
  if (!legaId || !t) {
    return (
      <Hero kicker={legaName || "Nessuna lega attiva"} title="Si parte dal campetto"
        subtitle={legaId ? "La lega è vuota: crea la prima tappa per vedere qui classifica e leader." : "Apri una lega esistente o creane una nuova."}
        actions={<>
          <Button onClick={() => navigate(legaId ? "/lega" : "/leghe")}>{legaId ? "Crea una tappa" : "Le mie leghe"}</Button>
          <Button variant="outline" onClick={() => navigate("/anagrafe")}>Anagrafe</Button>
        </>} />
    );
  }

  /* ── Dashboard ── */
  const stato = t.conclusa ? "Tappa conclusa" : t.gironi ? "Tappa in corso" : "Tappa in preparazione";
  return (
    <>
      <Hero
        badge={live ? <Badge tone="live">Live</Badge> : undefined}
        kicker={`${stato} · ${[t.luogo, t.data].filter(Boolean).join(" · ") || legaName}`}
        title={t.nome}
        subtitle={`${legaName} · ${t.squadre.length} squadre · ${t.nGironi} gironi · ${t.partite.filter((m) => m.done).length}/${t.partite.length} gare giocate`}
        actions={<>
          <Button onClick={() => navigate(`/lega/tappa/${t.id}`)}>Vai alla tappa</Button>
          <Button variant="outline" onClick={() => navigate("/lega")}>Tutte le tappe</Button>
        </>}
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Section title="Classifica live" kicker={t.gironi ? `Girone ${String.fromCharCode(65 + gi)}` : "In attesa del sorteggio"} className="mb-0">
          {rows.length ? (
            <StandingsTable rows={rows} logos={logos} caption={`Classifica girone ${String.fromCharCode(65 + gi)}`} compact />
          ) : (
            <Card>
              <p className="text-[13px] text-chalk-muted">I gironi non sono ancora stati sorteggiati.</p>
              <Link to={`/lega/tappa/${t.id}`} className="linkbtn mt-2 inline-block">Vai al sorteggio →</Link>
            </Card>
          )}
        </Section>

        <div className="flex flex-col gap-4">
          {ultima && (
            <ScoreCard accent live={live} label="Ultimo risultato"
              a={{ name: nameOf(ultima.a), logo: logoOf(ultima.a) }} b={{ name: nameOf(ultima.b), logo: logoOf(ultima.b) }}
              sa={ultima.sa} sb={ultima.sb} done />
          )}
          <Card padded={false}>
            <div className="flex items-center justify-between border-b border-asphalt-700 px-3 py-2">
              <Kicker>Prossime partite</Kicker>
              <span className="text-[11px] text-chalk-dim">{prossime.length ? `${prossime.length} in programma` : "—"}</span>
            </div>
            {prossime.length === 0 && <p className="px-3 py-3 text-[13px] text-chalk-muted">Nessuna partita in attesa.</p>}
            <ol className="m-0 list-none p-0">
              {prossime.map((m) => (
                <li key={m.id} className="flex items-center gap-2 border-b border-asphalt-700 px-3 py-2 text-[13px] last:border-b-0">
                  <span className="min-w-0 flex-1 truncate text-right font-display text-base">{nameOf(m.a)}</span>
                  <span className="shrink-0 rounded-sm bg-asphalt-800 px-1.5 text-[10.5px] font-semibold text-chalk-muted">G{String.fromCharCode(65 + m.g)}</span>
                  <span className="min-w-0 flex-1 truncate font-display text-base">{nameOf(m.b)}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>

      {leaders.length > 0 && (
        <Section title="Leader della tappa" kicker="Totale · media a partita" className="mt-8">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {LEADER_CATS.map(([k, label]) => {
              const top = [...leaders].filter((p) => p[k] > 0).sort((a, b) => b[k] - a[k] || b.pt - a.pt)[0];
              if (!top) return null;
              return (
                <StatTile key={k} label={label} value={top[k]} sub={`(${(top[k] / top.g).toFixed(1)})`}
                  meta={<><span className="font-semibold">{top.nome}</span> <span className="text-chalk-muted">· {top.squadra}</span></>}
                  highlight={k === "pt"} />
              );
            })}
          </div>
        </Section>
      )}
    </>
  );
}
