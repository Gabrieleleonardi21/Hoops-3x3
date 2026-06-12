import { useAppStore } from "../stores/useAppStore";
import { uid } from "../utils/uid";
import { DEFAULT_RULES } from "../constants/rules";
import type { Tappa } from "../types";

export interface NuovaTappaInput {
  nome: string;
  luogo: string;
  data: string;
  nTeams: number | string;
  nGironi: number | string;
}

export function useLega() {
  const { user, legaName, tappe, setLegaName, addTappa } = useAppStore();

  const createTappa = (input: NuovaTappaInput): Tappa => {
    const n = Math.max(2, Math.min(64, Number(input.nTeams) || 8));
    const nG = Math.max(1, Math.min(Math.floor(n / 2) || 1, Number(input.nGironi) || 1));
    const t: Tappa = {
      id: uid(),
      nome: input.nome.trim() || `Tappa ${tappe.length + 1}`,
      luogo: input.luogo.trim(),
      data: input.data,
      nGironi: nG,
      regole: { ...DEFAULT_RULES },
      squadre: Array.from({ length: n }, (_, i) => ({
        id: uid(), nome: `Squadra ${i + 1}`, giocatori: [], rank: "",
      })),
      gironi: null,
      partite: [],
      video: [],
    };
    addTappa(t);
    return t;
  };

  return { user, legaName, tappe, setLegaName, createTappa };
}
