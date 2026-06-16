import type { SquadraTappa } from "../../types";
import { INK, RED } from "../../constants/colors";
import { RosterEditor } from "./RosterEditor";
import { Input } from "../ui/Input";
import type { useTappa } from "../../hooks/useTappa";

export function SquadraCard({ s, index, h }: { s: SquadraTappa; index: number; h: ReturnType<typeof useTappa> }) {
  const ok = h.teamComplete(s.id);
  return (
    <div style={{ background: "var(--card)", border: `1.5px solid ${ok ? INK : RED}`, padding: 10 }}>
      {/* Logo squadra (cliccabile solo nella modale, non qui) */}
      {s.logo && (
        <div style={{ marginBottom: 8 }}>
          <img src={s.logo} alt={`Logo ${s.nome}`}
            style={{ width: 48, height: 48, objectFit: "contain", display: "block" }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>
      )}
      <label className="ui" style={{ fontSize: 11, fontWeight: 700 }}>
        <span style={{ opacity: 0.6 }}>#{index + 1}</span>
        <input className="statin" style={{ marginTop: 3 }} value={s.nome} onChange={(e) => h.renameTeam(s.id, e.target.value)} />
      </label>
      <Input label="Ranking circuito (punti)" labelStyle={{ fontSize: 10, marginTop: 6 }}
        style={{ padding: "5px 8px", fontSize: 13 }} type="number" min={0}
        value={s.rank ?? ""} onChange={(e) => h.setTeamRank(s.id, e.target.value)} placeholder="0" />
      <Input label="Sito web (opzionale)" labelStyle={{ fontSize: 10, marginTop: 6 }}
        style={{ padding: "5px 8px", fontSize: 13 }}
        value={s.website ?? ""} onChange={(e) => h.setTeamWebsite(s.id, e.target.value)} placeholder="https://squadra.it" />
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
