/** Vista tabellone a eliminazione diretta, puramente presentazionale: una colonna per round
 *  (su mobile i round si impilano), ogni match una card con due righe squadra/punteggio.
 *  In un match `bye` (turno superato d'ufficio) la seconda riga dice «Passa il turno».
 *  I controlli di inserimento arrivano da `renderControls` così la logica resta nel chiamante. */
import type { BracketMatch } from "../../types";
import { Badge } from "../ui/Badge";
import { Icon } from "../ui/Icon";
import { TeamLogo } from "../ui/TeamLogo";

interface Props {
  rounds: BracketMatch[][];
  nameOf: (id: string | null) => string;
  logoOf?: (id: string | null) => string | undefined;
  renderControls?: (m: BracketMatch) => React.ReactNode;
}

function Row({ name, logo, score, winner, loser, tbd }: {
  name: string; logo?: string; score: number | null; winner: boolean; loser: boolean; tbd: boolean;
}) {
  const nameCls = loser || tbd ? "text-chalk-dim" : "text-chalk";
  // Il punteggio di chi vince in evidenza, di chi perde attenuato
  let scoreCls = "text-chalk-muted";
  if (winner) scoreCls = "text-court";
  else if (loser) scoreCls = "text-chalk-dim";
  return (
    <div className={`flex h-9 items-center gap-2 px-3 ${winner ? "bg-asphalt-800" : ""}`}>
      <TeamLogo src={logo} className="h-5 w-5 shrink-0" />
      <span className={`min-w-0 flex-1 truncate font-display text-base ${nameCls}`}>{name}</span>
      {winner && <Icon name="check" size={12} className="shrink-0 text-court" />}
      <span className={`font-display text-lg ${scoreCls}`}>{score ?? "–"}</span>
    </div>
  );
}

/** Righe di un match bye: la squadra presente (`id`) passa il turno senza giocare e, al posto
 *  dell'avversaria, c'è la dicitura. Niente punteggio: il match non si gioca. */
function ByeRows({ id, nameOf, logoOf }: { id: string | null } & Pick<Props, "nameOf" | "logoOf">) {
  return (
    <>
      <Row name={nameOf(id)} logo={logoOf?.(id)} score={null} winner loser={false} tbd={false} />
      <div className="border-t border-asphalt-700" />
      <div className="flex h-9 items-center px-3 text-[13px] text-chalk-dim">Passa il turno</div>
    </>
  );
}

/** Chi ha vinto la finale, se è stata giocata; null per gli altri match */
function campione(m: BracketMatch): string | null {
  if (!m.done || m.label !== "Finale") return null;
  if (m.pA > m.pB) return m.squadraA;
  return m.squadraB;
}

export function Bracket({ rounds, nameOf, logoOf, renderControls }: Props) {
  return (
    <div className="grid gap-4 md:grid-flow-col md:auto-cols-fr">
      {rounds.map((round, ri) => {
        const title = round[0]?.label.replace(/\s\d+$/, "") ?? `Round ${ri + 1}`;
        return (
          <div key={ri} className="flex flex-col gap-3">
            <div className="kicker">{title}</div>
            {/* i match dei round successivi si centrano verticalmente rispetto alla colonna precedente */}
            <div className="flex flex-1 flex-col justify-around gap-3">
            {round.map((m) => {
              const isFinale = m.label === "Finale";
              const champion = campione(m);
              return (
                <div key={m.id} className={`overflow-hidden rounded border bg-asphalt-900 ${isFinale ? "border-gold/50" : "border-asphalt-700"}`}>
                  <div className="flex items-center justify-between border-b border-asphalt-700 px-3 py-1">
                    <span className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-chalk-muted">{m.label}</span>
                    {champion && <Badge tone="gold"><Icon name="trophy" size={11} /> Campione</Badge>}
                  </div>
                  {/* bye: una sola squadra (di norma la A), l'altra posizione è vuota */}
                  {m.bye && <ByeRows id={m.squadraA ?? m.squadraB} nameOf={nameOf} logoOf={logoOf} />}
                  {!m.bye && (
                    <>
                      <Row name={nameOf(m.squadraA)} logo={logoOf?.(m.squadraA)} score={m.done ? m.pA : null}
                        winner={m.done && m.pA > m.pB} loser={m.done && m.pA < m.pB} tbd={!m.squadraA} />
                      <div className="border-t border-asphalt-700" />
                      <Row name={nameOf(m.squadraB)} logo={logoOf?.(m.squadraB)} score={m.done ? m.pB : null}
                        winner={m.done && m.pB > m.pA} loser={m.done && m.pB < m.pA} tbd={!m.squadraB} />
                    </>
                  )}
                  {renderControls && !m.done && m.squadraA && m.squadraB && (
                    <div className="border-t border-asphalt-700 px-3 py-2">{renderControls(m)}</div>
                  )}
                </div>
              );
            })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
