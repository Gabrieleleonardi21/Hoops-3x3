/** Hook per la gestione della lega: crea nuove tappe con squadre e gironi pre-configurati. */
import { useAppStore } from "../stores/useAppStore";
import { uid } from "../utils/uid";
import { creaTappa, erroreLimitiTappa } from "../domain/tappaOps";
import type { Esito } from "../domain/tappaOps";

export interface NuovaTappaInput {
  nome: string;
  luogo: string;
  data: string;
  nTeams: number | string;
  nGironi: number | string;
}

export function useLega() {
  const { user, legaName, tappe, setLegaName, addTappa } = useAppStore();

  /** Crea la tappa con squadre segnaposto «Squadra N». Limiti uguali a quelli del Coach (tappaOps): da 2 a 64 squadre
   *  e un numero di gironi intero tra 1 e metà delle squadre; fuori dai limiti non crea niente e dice perché. */
  const createTappa = (input: NuovaTappaInput): Esito => {
    const nSquadre = Number(input.nTeams);
    const nGironi = Number(input.nGironi);
    // Prima i limiti: le squadre segnaposto si preparano solo per un numero valido
    const limiti = erroreLimitiTappa(nSquadre, nGironi);
    if (limiti) return { ok: false, errore: limiti };
    const esito = creaTappa({
      nome: input.nome.trim() || `Tappa ${tappe.length + 1}`,
      luogo: input.luogo,
      data: input.data,
      nGironi,
      squadre: Array.from({ length: nSquadre }, (_, i) => ({
        id: uid(), nome: `Squadra ${i + 1}`, giocatori: [], rank: "",
      })),
    });
    if (esito.ok) addTappa(esito.tappa);
    return esito;
  };

  return { user, legaName, tappe, setLegaName, createTappa };
}
