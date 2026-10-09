/** Profilo giocatore (route /giocatore/:id): anagrafica dalla RegGiocatore + statistiche
 *  aggregate sulle tappe della lega attiva. Il roster di tappa non ha un legame con l'anagrafe,
 *  quindi l'abbinamento avviene per nome ("Nome Cognome" o "Cognome Nome"; maiuscole, spazi in
 *  più, accenti e tipo di apostrofo non contano, come nella tabella «Statistiche stagione»). I totali sono la somma delle
 *  righe di quella tabella con lo stesso nome, in una o più squadre: la funzione è la stessa
 *  (utils/statGiocatori), quindi i numeri coincidono. */
import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAnagrafe } from "../hooks/useAnagrafe";
import { useAppStore } from "../stores/useAppStore";
import { normalizza, statGiocatori, tabellini, type StatGiocatore } from "../utils/statGiocatori";
import { eta } from "../utils/eta";
import { Loading } from "../components/ui/Loading";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ErroreCaricamento } from "../components/ui/ErroreCaricamento";
import { Section } from "../components/ui/Section";
import { StatTile } from "../components/ui/StatTile";
import { Icon } from "../components/ui/Icon";
import { Sparkline } from "../components/profile/Sparkline";
import type { RegGiocatore, Tappa } from "../types";
import { nomeSquadra } from "../utils/tappaInfo";
import { fmtMedia } from "../utils/formato";
import { TeamLogo } from "../components/ui/TeamLogo";

/** true se il nome nel roster corrisponde al giocatore dell'anagrafe, in un ordine o nell'altro. Si confronta con la
 *  stessa normalizzazione della tabella di stagione */
function sameName(rosterName: string, g: RegGiocatore): boolean {
  const n = normalizza(rosterName);
  return n === normalizza(`${g.nome} ${g.cognome}`) || n === normalizza(`${g.cognome} ${g.nome}`);
}

/** Gare e statistiche sommate di una o più righe di stagione */
interface Totali { g: number; pt: number; rb: number; as: number; ru: number; st: number }
interface TappaRow { tappa: Tappa; row: Totali; piazzamento: number | null }
/** Come finisce una partita per il giocatore. La parità c'è solo in un file di lega importato (tappaOps la rifiuta): non è né
 *  una vittoria né una sconfitta */
type Esito = "vinta" | "persa" | "pari";
/** `ts` è il momento in cui il risultato è stato registrato (Partita.ts): manca nelle partite registrate prima che esistesse */
interface GameRow { tappa: string; avversario: string; mio: number; suo: number; esito: Esito; pt: number; rb: number; as: number; ts?: number }

const esitoDi = (mio: number, suo: number): Esito => {
  if (mio > suo) return "vinta";
  if (mio < suo) return "persa";
  return "pari";
};

/** Come l'elenco delle ultime partite mostra l'esito */
const BADGE_ESITO: Record<Esito, { tone: "win" | "loss" | "neutral"; lettera: string }> = {
  vinta: { tone: "win", lettera: "W" },
  persa: { tone: "loss", lettera: "L" },
  pari: { tone: "neutral", lettera: "=" },
};


/** Somma le righe di stagione dello stesso giocatore: sono più d'una se il nome compare in più squadre */
const somma = (righe: StatGiocatore[]): Totali => righe.reduce((acc, r) => ({
  g: acc.g + r.g, pt: acc.pt + r.pt, rb: acc.rb + r.rb, as: acc.as + r.as, ru: acc.ru + r.ru, st: acc.st + r.st,
}), { g: 0, pt: 0, rb: 0, as: 0, ru: 0, st: 0 });

export function GiocatorePage() {
  const { id } = useParams();
  const tappe = useAppStore((s) => s.tappe);
  const navigate = useNavigate();
  const { giocatori, squadre, errore, load } = useAnagrafe();

  const g = giocatori?.find((x) => x.id === id) ?? null;
  const logo = g ? squadre?.find((s) => s.nome === g.squadra)?.logo : undefined;

  // Le righe della tabella di stagione di questo giocatore: lo stesso nome (normalizzato) in una o più squadre. I totali
  // sono la loro somma e le squadre sono quelle da cui vengono. Anche lo storico per tappa usa la stessa funzione
  const stagione = useMemo(() => {
    if (!g) return [];
    return statGiocatori(tappe).filter((r) => sameName(r.nome, g));
  }, [g, tappe]);

  // Statistiche per tappa: una riga per ogni tappa in cui il giocatore ha giocato
  const perTappa = useMemo<TappaRow[]>(() => {
    if (!g) return [];
    const out: TappaRow[] = [];
    for (const t of tappe) {
      const righe = statGiocatori([t]).filter((r) => sameName(r.nome, g));
      if (righe.length === 0) continue;
      // piazzamento: dalla finale del bracket se disponibile (1° o 2°), altrimenti sconosciuto. Con più squadre nella
      // stessa tappa vale la prima
      const team = t.squadre.find((s) => s.nome === righe[0].squadra);
      const finale = t.bracket?.find((m) => m.label === "Finale" && m.done);
      let piazzamento: number | null = null;
      if (finale && team) {
        const winner = finale.pA > finale.pB ? finale.squadraA : finale.squadraB;
        if (winner === team.id) piazzamento = 1;
        else if (finale.squadraA === team.id || finale.squadraB === team.id) piazzamento = 2;
      }
      out.push({ tappa: t, row: somma(righe), piazzamento });
    }
    return out;
  }, [g, tappe]);

  // Partite singole (per sparkline e "ultime partite"), nell'ordine in cui le partite sono state inserite. Sono i tabellini di
  // tabellini(), gli stessi dei totali: comprendono tutte le squadre della tappa che hanno un giocatore con questo nome
  const games = useMemo<GameRow[]>(() => {
    if (!g) return [];
    const out: GameRow[] = [];
    for (const t of tappe) {
      const nameOf = (tid: string) => nomeSquadra(t.squadre, tid);
      for (const { nome, stat, partita: m, lato } of tabellini(t)) {
        if (!sameName(nome, g)) continue;
        // Punti fatti, punti subiti e squadra avversaria, dal lato della scheda in cui sta il tabellino
        let mio = m.sa, suo = m.sb, avversario = m.b;
        if (lato === "b") { mio = m.sb; suo = m.sa; avversario = m.a; }
        out.push({ tappa: t.nome, avversario: nameOf(avversario), mio, suo, esito: esitoDi(mio, suo), pt: stat.pt, rb: stat.rb, as: stat.as, ts: m.ts });
      }
    }
    return out;
  }, [g, tappe]);

  // «Ultime partite, dalla più recente»: l'ordine è quello di registrazione del risultato (ts), non del calendario. Le partite senza
  // ts (registrate prima che esistesse) contano come più vecchie e stanno in coda, nell'ordine inverso del calendario (il sort è stabile)
  const ultime = useMemo(
    () => [...games].reverse().sort((x, y) => (y.ts ?? 0) - (x.ts ?? 0)).slice(0, 6),
    [games],
  );

  if (giocatori === null && errore) {
    return <ErroreCaricamento cosa="Non è stato possibile caricare l'anagrafe." motivo={errore} onRiprova={() => { void load(); }} />;
  }
  if (giocatori === null) return <Loading>Sto aprendo la scheda…</Loading>;
  if (!g) {
    return (
      <p className="text-chalk-muted">Giocatore non trovato nell'anagrafe. <Link to="/anagrafe" className="linkbtn">Torna all'anagrafe</Link></p>
    );
  }

  const tot = somma(stagione);
  // Le squadre da cui vengono i totali, ognuna una volta: lo stesso nome scritto nei due ordini nella stessa squadra sono due
  // righe di stagione, ma una squadra sola. Vale la grafia dell'ultima riga
  const squadreStat = [...new Map(stagione.map((row): [string, string] => [normalizza(row.squadra), row.squadra])).values()];
  const avg = (v: number) => (tot.g ? `(${fmtMedia(v / tot.g)}/g)` : undefined);
  const age = eta(g.nascita);
  const bio = [g.ruolo, g.squadra, g.citta, age !== null ? `${age} anni` : "", g.altezza ? `${g.altezza} cm` : "", g.peso ? `${g.peso} kg` : ""].filter(Boolean);
  // Vinte e perse si contano sulle stesse partite dell'elenco; una parità non è nessuna delle due, quindi V e P possono non sommare G
  const wins = games.filter((x) => x.esito === "vinta").length;
  const losses = games.filter((x) => x.esito === "persa").length;

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
              <TeamLogo src={logo} className="h-6 w-6" />
              {bio.map((b) => <Badge key={b}>{b}</Badge>)}
              {g.nazionalita && <Badge>{g.nazionalita}</Badge>}
            </div>
            {g.note && <p className="mt-3 text-[13px] text-chalk-muted">{g.note}</p>}
          </div>
          {g.autore && <div className="text-xs text-chalk-dim">Registrato da {g.autore}</div>}
        </div>
      </Card>

      {/* Stat tile */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Punti" value={tot.pt} sub={avg(tot.pt)} highlight={tot.pt > 0} />
        <StatTile label="Rimbalzi" value={tot.rb} sub={avg(tot.rb)} />
        <StatTile label="Assist" value={tot.as} sub={avg(tot.as)} />
        <StatTile label="Rubate" value={tot.ru} sub={avg(tot.ru)} />
        <StatTile label="Stoppate" value={tot.st} sub={avg(tot.st)} />
        <StatTile label="Gare" value={tot.g} sub={tot.g > 0 && `${wins}V · ${losses}P`} />
        {/* Le squadre di tappa da cui vengono i totali: il legame è solo il nome, e chi legge deve vedere che cosa è stato sommato */}
        {squadreStat.length > 0 && (
          <p className="col-span-full text-[13px] text-chalk-muted">
            Statistiche sommate per nome sulle squadre di tappa: {squadreStat.join(", ")}.
          </p>
        )}
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
              <caption className="sr-only">Storico tappe di {g.nome} {g.cognome}: piazzamento e statistiche per tappa</caption>
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
            {ultime.map((x, i) => {
              const { tone, lettera } = BADGE_ESITO[x.esito];
              return (
                <li key={i} className="flex flex-wrap items-center gap-3 px-3 py-2 text-[13px]">
                  <Badge tone={tone}>{lettera}</Badge>
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
