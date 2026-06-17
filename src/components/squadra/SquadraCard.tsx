import type { SquadraTappa } from "../../types";
import { INK, ORANGE, RED } from "../../constants/colors";
import { safeUrl } from "../../utils/safeUrl";
import { RosterEditor } from "./RosterEditor";
import { Input } from "../ui/Input";
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

  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${ok ? INK : RED}`, padding: 10 }}>

      {/* Logo (da anagrafe se collegata) */}
      {s.logo && (
        <div style={{ marginBottom: 8 }}>
          <img src={safeUrl(s.logo)} alt={`Logo ${s.nome}`}
            style={{ width: 48, height: 48, objectFit: "contain", display: "block" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}

      {/* Badge anagrafe */}
      {linked && (
        <div className="ui" style={{ fontSize: 10, fontWeight: 700, color: ORANGE, marginBottom: 4 }}>
          ✓ collegata all'anagrafe
        </div>
      )}

      {/* Nome: editabile solo se non collegata; onBlur trigger sync anagrafe */}
      <label className="ui" style={{ fontSize: 11, fontWeight: 700 }}>
        <span style={{ opacity: 0.6 }}>#{index + 1}</span>
        <input
          className="statin"
          style={{ marginTop: 3 }}
          value={s.nome}
          readOnly={linked}
          onChange={linked ? undefined : (e) => h.renameTeam(s.id, e.target.value)}
          onBlur={linked ? undefined : () => onNameCommit?.(s.nome)}
        />
      </label>

      {/* Logo, rank, sito: visibili e modificabili solo se non collegata all'anagrafe.
          Se collegata, questi dati vengono dall'anagrafe e si modificano lì. */}
      {!linked && (
        <>
          <Input label="Logo (URL)" labelStyle={{ fontSize: 10, marginTop: 6 }}
            style={{ padding: "5px 8px", fontSize: 13 }}
            value={s.logo ?? ""} onChange={(e) => h.setTeamLogo(s.id, e.target.value)}
            placeholder="https://... oppure /logos/squadra.svg" />
          <Input label="Ranking circuito (punti)" labelStyle={{ fontSize: 10, marginTop: 6 }}
            style={{ padding: "5px 8px", fontSize: 13 }} type="number" min={0}
            value={s.rank ?? ""} onChange={(e) => h.setTeamRank(s.id, e.target.value)} placeholder="0" />
          <Input label="Sito web (opzionale)" labelStyle={{ fontSize: 10, marginTop: 6 }}
            style={{ padding: "5px 8px", fontSize: 13 }}
            value={s.website ?? ""} onChange={(e) => h.setTeamWebsite(s.id, e.target.value)} placeholder="https://squadra.it" />
        </>
      )}

      {/* Giocatori: sempre editabili indipendentemente dall'anagrafe */}
      <div className="ui" style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", margin: "8px 0 5px", color: ok ? INK : RED }}>
        {ok ? "Roster completo ✓" : "Giocatori obbligatori (min. 3)"}
      </div>
      <RosterEditor giocatori={s.giocatori || []}
        onAdd={() => h.addPlayer(s.id)}
        onRename={(pid, nome) => h.renamePlayer(s.id, pid, nome)}
        onRemove={(pid) => h.removePlayer(s.id, pid)} />

      {h.tappa!.squadre.length > 2 && (
        <div>
          <button onClick={() => h.removeTeam(s.id)} className="linkbtn"
            style={{ fontSize: 11, color: INK, opacity: 0.5, marginTop: 4 }}>Rimuovi squadra</button>
        </div>
      )}
    </div>
  );
}
