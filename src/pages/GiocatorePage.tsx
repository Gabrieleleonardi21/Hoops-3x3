/** Profilo giocatore (route /giocatore/:id): anagrafica dalla RegGiocatore + statistiche
 *  aggregate sulle tappe della lega attiva. Il roster di tappa non ha un legame con l'anagrafe,
 *  quindi l'abbinamento avviene per nome ("Nome Cognome" o "Cognome Nome", case-insensitive):
 *  è lo stesso criterio usato altrove nell'app per collegare squadre e giocatori. */
import { useMemo } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAnagrafe } from "../hooks/useAnagrafe";
import { useAppStore } from "../stores/useAppStore";
import { tappaLeaders, type LeaderRow } from "../utils/tappaLeaders";
import { eta } from "../utils/eta";
import { safeUrl } from "../utils/safeUrl";
import { Loading } from "../components/ui/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Kicker } from "../components/ui/Kicker";
import { Section } from "../components/ui/Section";
import { StatTile } from "../components/ui/StatTile";
import { Icon } from "../components/ui/Icon";
import { Sparkline } from "../components/profile/Sparkline";
import type { RegGiocatore, StatLine, Tappa } from "../types";

/** true se il nome nel roster corrisponde al giocatore dell'anagrafe */
function sameName(rosterName: string, g: RegGiocatore): boolean {
  const n = rosterName.trim().toLowerCase();
  const a = `${g.nome} ${g.cognome}`.trim().toLowerCase();
  const b = `${g.cognome} ${g.nome}`.trim().toLowerCase();
  return n === a || n === b;
}

interface TappaRow { tappa: Tappa; row: LeaderRow; piazzamento: number | null }
interface GameRow { tappa: string; avversario: string; mio: number; suo: number; pt: number; rb: number; as: number }

const f1 = (n: number) => n.toFixed(1);

export function GiocatorePage() {
  const { id } = useParams();
  const user = useAppStore((s) => s.user);
  const tappe = useAppStore((s) => s.tappe);
  const navigate = useNavigate();
  const { giocatori, squadre } = useAnagrafe();

  const g = giocatori?.find((x) => x.id === id) ?? null;
  const logo = g ? squadre?.find((s) => s.nome === g.squadra)?.logo : undefined;

  // Statistiche per tappa: una riga per ogni tappa in cui il giocatore ha giocato
  const perTappa = useMemo<TappaRow[]>(() => {
    if (!g) return [];
    const out: TappaRow[] = [];
    for (const t of tappe) {
      const row = tappaLeaders(t).find((r) => sameName(r.nome, g));
      if (!row) continue;
      // piazzamento: dalla finale del bracket se disponibile (1° o 2°), altrimenti sconosciuto
      const team = t.squadre.find((s) => s.nome === row.squadra);
      const finale = t.bracket?.find((m) => m.label === "Finale" && m.done);
      let piazzamento: number | null = null;
      if (finale && team) {
        const winner = finale.pA > finale.pB ? finale.squadraA : finale.squadraB;
        if (winner === team.id) piazzamento = 1;
        else if (finale.squadraA === team.id || finale.squadraB === team.id) piazzamento = 2;
      }
      out.push({ tappa: t, row, piazzamento });
    }
    return out;
  }, [g, tappe]);

  // Partite singole (per sparkline e "ultime partite"), in ordine cronologico di inserimento
  const games = useMemo<GameRow[]>(() => {
    if (!g) return [];
    const out: GameRow[] = [];
    for (const t of tappe) {
      const team = t.squadre.find((s) => (s.giocatori || []).some((p) => sameName(p.nome, g)));
      const pid = team?.giocatori.find((p) => sameName(p.nome, g))?.id;
      if (!team || !pid) continue;
      const nameOf = (tid: string) => t.squadre.find((s) => s.id === tid)?.nome ?? tid;
      for (const m of t.partite) {
        if (!m.done) continue;
        const mine = m.a === team.id ? m.pa : m.b === team.id ? m.pb : undefined;
        if (!mine || mine[pid] === undefined) continue;
        const raw = mine[pid];
        const st: StatLine = typeof raw === "object" && raw !== null ? raw : { pt: raw as number };
        const isA = m.a === team.id;
        out.push({
          tappa: t.nome, avversario: nameOf(isA ? m.b : m.a),
          mio: isA ? m.sa : m.sb, suo: isA ? m.sb : m.sa,
          pt: st.pt ?? 0, rb: st.rb ?? 0, as: st.as ?? 0,
        });
      }
    }
    return out;
  }, [g, tappe]);

  if (!user) return <Navigate to="/" replace />;
  if (giocatori === null) return <Loading>Sto aprendo la scheda…</Loading>;
  if (!g) {
    return (
      <p className="text-chalk-muted">Giocatore non trovato nell'anagrafe. <Link to="/anagrafe" className="linkbtn">Torna all'anagrafe</Link></p>
    );
  }

  const tot = perTappa.reduce((acc, { row }) => ({
    g: acc.g + row.g, pt: acc.pt + row.pt, rb: acc.rb + row.rb, as: acc.as + row.as, ru: acc.ru + row.ru, st: acc.st + row.st,
  }), { g: 0, pt: 0, rb: 0, as: 0, ru: 0, st: 0 });
  const avg = (v: number) => (tot.g ? `(${f1(v / tot.g)}/g)` : undefined);
  const age = eta(g.nascita);
  const bio = [g.ruolo, g.squadra, g.citta, age !== null ? `${age} anni` : "", g.altezza ? `${g.altezza} cm` : "", g.peso ? `${g.peso} kg` : ""].filter(Boolean);
  const wins = games.filter((x) => x.mio > x.suo).length;

  return (
    <>
      <Link to="/anagrafe" className="mb-3 inline-flex items-center gap-1 text-[13px] text-chalk-muted hover:text-chalk">
        <Icon name="arrowLeft" size={14} /> Anagrafe
      </Link>

      {/* Intestazione */}
      <Card accent className="mb-6">
        <div className="flex flex-wrap items-start gap-5">
          {g.numero && <div className="font-display text-[clamp(56px,10vw,96px)] leading-none text-court">#{g.numero}</div>}
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-[clamp(28px,5vw,44px)] text-chalk">{g.nome} {g.cognome}</h1>
            {g.soprannome && <div className="mt-0.5 font-display text-lg text-court">"{g.soprannome}"</div>}
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {logo && <img src={safeUrl(logo)} alt="" className="h-6 w-6 object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />}
              {bio.map((b) => <Badge key={b}>{b}</Badge>)}
              {g.nazionalita && <Badge>{g.nazionalita}</Badge>}
            </div>
            {g.note && <p className="mt-3 text-[13px] text-chalk-muted">{g.note}</p>}
          </div>
          <div className="text-xs text-chalk-dim">Registrato da {g.autore}</div>
        </div>
      </Card>

      {/* Stat tile */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Punti" value={tot.pt} sub={avg(tot.pt)} highlight={tot.pt > 0} />
        <StatTile label="Rimbalzi" value={tot.rb} sub={avg(tot.rb)} />
        <StatTile label="Assist" value={tot.as} sub={avg(tot.as)} />
        <StatTile label="Rubate" value={tot.ru} sub={avg(tot.ru)} />
        <StatTile label="Stoppate" value={tot.st} sub={avg(tot.st)} />
        <StatTile label="Gare" value={tot.g} sub={tot.g ? `${wins}V · ${tot.g - wins}P` : undefined} />
      </div>

      {tot.g === 0 && (
        <Card className="mb-6">
          <p className="m-0 text-[13px] text-chalk-muted">
            Nessuna statistica nella lega attiva: il giocatore compare nei roster di tappa come «{g.nome} {g.cognome}»
            solo se il nome coincide. <Button variant="link" onClick={() => navigate("/lega")}>Vai alle tappe</Button>
          </p>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <Section title="Andamento punti" kicker={games.length ? `${games.length} partite · max ${Math.max(...games.map((x) => x.pt))}` : "Nessuna partita"} className="mb-0">
          <Card>
            {games.length ? <Sparkline values={games.map((x) => x.pt)} height={72} label="Punti per partita" /> : <p className="m-0 text-[13px] text-chalk-muted">—</p>}
          </Card>
        </Section>

        <Section title="Storico tappe" kicker="Lega attiva" className="mb-0">
          <div className="overflow-x-auto rounded border border-asphalt-700">
            <table className="standtable">
              {/* la colonna tappa prende lo spazio rimanente, le numeriche sono fisse */}
              <colgroup><col /><col className="w-14" /><col className="w-10" /><col className="w-12" /><col className="w-12" /><col className="w-12" /></colgroup>
              <thead><tr><th className="text-left" scope="col">Tappa</th><th scope="col">Piazz.</th><th scope="col">G</th><th scope="col">PT</th><th scope="col">REB</th><th scope="col">AST</th></tr></thead>
              <tbody>
                {perTappa.length === 0 && <tr><td colSpan={6} className="text-chalk-muted">Nessuna tappa giocata.</td></tr>}
                {perTappa.map(({ tappa, row, piazzamento }) => (
                  <tr key={tappa.id}>
                    <td className="tname"><Link to={`/lega/tappa/${tappa.id}`} className="hover:text-court">{tappa.nome}</Link></td>
                    <td className={piazzamento === 1 ? "text-gold font-display text-base" : ""}>{piazzamento ? `${piazzamento}°` : "—"}</td>
                    <td>{row.g}</td><td className="font-semibold">{row.pt}</td><td>{row.rb}</td><td>{row.as}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      {games.length > 0 && (
        <Section title="Ultime partite" kicker="Dalla più recente" className="mt-8">
          <ol className="m-0 list-none divide-y divide-asphalt-700 rounded border border-asphalt-700 bg-asphalt-900 p-0">
            {[...games].reverse().slice(0, 6).map((x, i) => {
              const win = x.mio > x.suo;
              return (
                <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]">
                  <Badge tone={win ? "win" : "loss"}>{win ? "W" : "L"}</Badge>
                  <span className="min-w-0 flex-1 truncate"><span className="text-chalk-muted">vs</span> <span className="font-display text-base">{x.avversario}</span> <span className="text-chalk-dim">· {x.tappa}</span></span>
                  <span className="font-display text-lg">{x.mio}–{x.suo}</span>
                  <span className="text-chalk-muted">{x.pt} PT · {x.rb} REB · {x.as} AST</span>
                </li>
              );
            })}
          </ol>
        </Section>
      )}
    </>
  );
}
