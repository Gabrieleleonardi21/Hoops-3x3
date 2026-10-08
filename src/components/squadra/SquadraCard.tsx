import type { SquadraTappa } from "../../types";
import { RosterEditor } from "./RosterEditor";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { useConfermaPerdita } from "../../hooks/useConfermaPerdita";
import type { useTappa } from "../../hooks/useTappa";
import { TeamLogo } from "../ui/TeamLogo";
import { MIN_ROSTER } from "../../constants/rules";

export function SquadraCard({ s, index, h, erroreAnagrafe, onNameCommit }: {
  s: SquadraTappa;
  index: number;
  h: ReturnType<typeof useTappa>;
  /** Perché l'ultimo collegamento all'anagrafe non è riuscito: compare sotto il nome, con «Riprova» */
  erroreAnagrafe?: string | null;
  /** Chiamato onBlur del nome (e da «Riprova»): collega o crea la squadra nell'anagrafe */
  onNameCommit?: (nome: string) => void;
}) {
  const ok = h.teamComplete(s.id);
  const linked = !!s.regId; // collegata all'anagrafe
  const small = "h-8 py-0 text-[13px]";
  // Togliere una squadra cancella ciò che vi è stato scritto (nome, giocatori) e azzera il sorteggio: si chiede prima conferma,
  // tranne per una squadra appena aggiunta e vuota, che si toglie subito.
  // Il rifiuto di removeTeam non serve mostrarlo: il pulsante c'è solo con più di 2 squadre.
  // La stessa finestra serve per la X di un giocatore: si chiede solo se ha statistiche (perditaGiocatore).
  const { chiedi, finestra } = useConfermaPerdita(() => h.perditaSquadra(s.id));

  return (
    <div className={`rounded border bg-asphalt-900 p-3 ${ok ? "border-asphalt-700" : "border-loss/60"}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <TeamLogo src={s.logo} alt={`Logo ${s.nome}`} className="h-10 w-10" />
          <span className="font-display text-lg text-chalk-dim">#{index + 1}</span>
        </div>
        {linked && (
          <div className="flex flex-col items-end gap-1">
            <Badge tone="court"><Icon name="check" size={11} /> Anagrafe</Badge>
            {/* Il collegamento può essere partito da un nome scritto a metà: «Scollega» rende di nuovo modificabile il nome */}
            <Button variant="link" className="text-chalk-muted" onClick={() => h.unlinkReg(s.id)}>Scollega</Button>
          </div>
        )}
      </div>

      {/* Nome: editabile solo se non collegata; onBlur trigger sync anagrafe */}
      <label className="input-label">
        Nome squadra
        <input className="statin mt-1" value={s.nome} readOnly={linked}
          onChange={linked ? undefined : (e) => h.renameTeam(s.id, e.target.value)}
          onBlur={linked ? undefined : () => onNameCommit?.(s.nome)} />
      </label>
      {erroreAnagrafe && !linked && (
        <div className="mt-1.5" role="alert">
          <p className="m-0 text-[12px] font-semibold text-loss">{erroreAnagrafe}</p>
          <Button variant="link" onClick={() => onNameCommit?.(s.nome)}>Riprova</Button>
        </div>
      )}

      {/* Logo, rank, sito: visibili e modificabili solo se non collegata all'anagrafe.
          Se collegata, questi dati vengono dall'anagrafe e si modificano lì. */}
      {!linked && (
        <div className="mt-2 flex flex-col gap-1.5">
          <Input label="Logo (URL)" className={small} value={s.logo ?? ""} onChange={(e) => h.setTeamLogo(s.id, e.target.value)}
            placeholder="https://... oppure /logos/squadra.svg" />
          <Input label="Ranking circuito (punti)" className={small} type="number" min={0}
            value={s.rank ?? ""} onChange={(e) => h.setTeamRank(s.id, e.target.value)} placeholder="0" />
          <Input label="Sito web (opzionale)" className={small} value={s.website ?? ""}
            onChange={(e) => h.setTeamWebsite(s.id, e.target.value)} placeholder="https://squadra.it" />
        </div>
      )}

      {/* Giocatori: sempre editabili indipendentemente dall'anagrafe */}
      <div className={`kicker mt-3 mb-1.5 ${ok ? "text-win" : "text-loss"}`}>
        {ok ? "Roster completo" : `Giocatori obbligatori (min. ${MIN_ROSTER})`}
      </div>
      <RosterEditor giocatori={s.giocatori || []}
        onAdd={() => h.addPlayer(s.id)}
        onRename={(pid, nome) => h.renamePlayer(s.id, pid, nome)}
        onRemove={(pid) => chiedi("Rimuovere il giocatore?", () => h.removePlayer(s.id, pid), () => h.perditaGiocatore(s.id, pid))} />

      {(h.tappa?.squadre.length ?? 0) > 2 && (
        <Button variant="link" className="mt-2 text-chalk-dim"
          onClick={() => chiedi("Rimuovere la squadra?", () => h.removeTeam(s.id))}>Rimuovi squadra</Button>
      )}
      {finestra}
    </div>
  );
}
