import type { SquadraTappa } from "../../types";
import { safeUrl } from "../../utils/safeUrl";
import { RosterEditor } from "./RosterEditor";
import { Input } from "../ui/Input";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import type { useTappa } from "../../hooks/useTappa";

export function SquadraCard({ s, index, h, onNameCommit }: {
  s: SquadraTappa;
  index: number;
  h: ReturnType<typeof useTappa>;
  /** Chiamato onBlur del nome: collega o crea la squadra nell'anagrafe */
  onNameCommit?: (nome: string) => void;
}) {
  const ok = h.teamComplete(s.id);
  const linked = !!s.regId; // collegata all'anagrafe
  const small = "h-8 py-0 text-[13px]";

  return (
    <div className={`rounded border bg-asphalt-900 p-3 ${ok ? "border-asphalt-700" : "border-loss/60"}`}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {s.logo && (
            <img src={safeUrl(s.logo)} alt={`Logo ${s.nome}`} className="h-10 w-10 object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          )}
          <span className="font-display text-lg text-chalk-dim">#{index + 1}</span>
        </div>
        {linked && <Badge tone="court"><Icon name="check" size={11} /> Anagrafe</Badge>}
      </div>

      {/* Nome: editabile solo se non collegata; onBlur trigger sync anagrafe */}
      <label className="input-label">
        Nome squadra
        <input className="statin mt-1" value={s.nome} readOnly={linked}
          onChange={linked ? undefined : (e) => h.renameTeam(s.id, e.target.value)}
          onBlur={linked ? undefined : () => onNameCommit?.(s.nome)} />
      </label>

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
        {ok ? "Roster completo" : "Giocatori obbligatori (min. 3)"}
      </div>
      <RosterEditor giocatori={s.giocatori || []}
        onAdd={() => h.addPlayer(s.id)}
        onRename={(pid, nome) => h.renamePlayer(s.id, pid, nome)}
        onRemove={(pid) => h.removePlayer(s.id, pid)} />

      {h.tappa!.squadre.length > 2 && (
        <Button variant="link" className="mt-2 text-chalk-dim" onClick={() => h.removeTeam(s.id)}>Rimuovi squadra</Button>
      )}
    </div>
  );
}
