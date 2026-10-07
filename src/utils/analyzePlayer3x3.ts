import type { Tappa } from "../types";
import { tappaLeaders, type LeaderRow } from "./tappaLeaders";
import { SCONOSCIUTO } from "./tappaInfo";

export interface AreaMiglioramento {
  area: string;
  motivo: string;
  esercizi: string[];
}

export interface PlayerAnalysis {
  pid: string;
  nome: string;
  squadra: string;
  partite: number;
  medie: { pt: number; rb: number; as: number; ru: number; st: number; pe: number; fa: number };
  forti: string[];
  migliorare: AreaMiglioramento[];
}

export const DRILLS: Record<string, string[]> = {
  Realizzazione: [
    "Gioco del 21 da solo: 5 posizioni dietro l'arco, 2 tiri per posizione; se ne sbagli 3 di fila ricominci da zero.",
    "Mikan drill: 3 serie da 10 appoggi alternati sotto canestro, senza far cadere la palla.",
    "1c1 dal check: 10 azioni concluse entro i 12 secondi di possesso, alternando arresto e tiro e penetrazione.",
  ],
  Rimbalzo: [
    "Box-out a coppie: al tiro dell'allenatore trova il contatto, sigilla e vai a prendere la palla. 3 serie da 10.",
    "Tip drill a tabellone: 3 serie da 10 tocchi consecutivi con una mano, poi con l'altra.",
    "Rimbalzo e clear: cattura il rimbalzo e porta la palla fuori dall'arco in massimo 2 palleggi (regola 3x3).",
  ],
  "Creazione di gioco": [
    "Passaggi a coppie sotto pressione: un difensore raddoppia, devi trovare la linea di passaggio entro 3 secondi.",
    "Lettura del blocco: 10 ripetizioni di pick & roll a metà campo scegliendo tra scarico, penetrazione e tiro.",
    "2c2 a tema: il canestro vale solo se nasce da un assist.",
  ],
  "Gestione del possesso": [
    "Palleggio con due palloni: 3 serie da 30 secondi alternando altezza e ritmo, occhi sempre alti.",
    "3c3 a tema: ogni palla persa regala 2 punti agli avversari — impari a proteggere ogni possesso.",
    "Slalom in palleggio sui coni con cambio di mano, chiusura con arresto e tiro entro i 12 secondi.",
  ],
  Difesa: [
    "Closeout drill: scivolamenti e chiusura corta sul tiratore senza saltare. 3 serie da 30 secondi.",
    "1c1 difensivo a metà campo con l'attaccante che parte in vantaggio: recupera la posizione.",
    "Specchio a coppie: 30 secondi di scivolamenti seguendo i cambi di direzione del compagno senza palla.",
  ],
  "Disciplina nei falli": [
    "1c1 con le mani dietro la schiena: difendi solo con i piedi e la posizione del corpo.",
    "Verticalità sotto canestro: contesta il tiro a braccia alte senza scendere sul tiratore.",
    "Rivedi i tuoi falli a video: nel 3x3 dal 7° fallo di squadra ogni fallo regala tiri liberi.",
  ],
};

const f = (v: number) => v.toFixed(1).replace(".", ",");

export function analyzePlayer3x3(tappa: Tappa, pid: string): PlayerAnalysis | null {
  const rows = tappaLeaders(tappa);
  const me = rows.find((r) => r.pid === pid);
  const team = tappa.squadre.find((s) => (s.giocatori || []).some((p) => p.id === pid));
  const nome = team?.giocatori.find((p) => p.id === pid)?.nome || me?.nome || SCONOSCIUTO;
  if (!me || me.g === 0) {
    return team
      ? { pid, nome, squadra: team.nome, partite: 0, medie: { pt: 0, rb: 0, as: 0, ru: 0, st: 0, pe: 0, fa: 0 }, forti: [], migliorare: [] }
      : null;
  }

  const avgOf = (k: keyof LeaderRow) =>
    rows.reduce((t, r) => t + (Number(r[k]) || 0) / r.g, 0) / rows.length;

  const medie = {
    pt: me.pt / me.g, rb: me.rb / me.g, as: me.as / me.g,
    ru: me.ru / me.g, st: me.st / me.g, pe: me.pe / me.g, fa: me.fa / me.g,
  };
  const tappaAvg = {
    pt: avgOf("pt"), rb: avgOf("rb"), as: avgOf("as"),
    def: avgOf("ru") + avgOf("st"),
  };
  const myDef = medie.ru + medie.st;

  const ratio = (mine: number, avg: number) => mine / Math.max(avg, 0.3);

  const candidates: { area: string; r: number; motivo: string }[] = [
    { area: "Realizzazione", r: ratio(medie.pt, tappaAvg.pt), motivo: `media di ${f(medie.pt)} punti a partita contro i ${f(tappaAvg.pt)} di media della tappa` },
    { area: "Rimbalzo", r: ratio(medie.rb, tappaAvg.rb), motivo: `${f(medie.rb)} rimbalzi a partita contro i ${f(tappaAvg.rb)} di media della tappa` },
    { area: "Creazione di gioco", r: ratio(medie.as, tappaAvg.as), motivo: `${f(medie.as)} assist a partita contro i ${f(tappaAvg.as)} di media della tappa` },
    { area: "Difesa", r: ratio(myDef, tappaAvg.def), motivo: `${f(myDef)} tra recuperi e stoppate a partita contro i ${f(tappaAvg.def)} di media della tappa` },
  ];

  const migliorare: AreaMiglioramento[] = [];

  if (medie.pe >= 1 && medie.pe > medie.as)
    migliorare.push({
      area: "Gestione del possesso",
      motivo: `perde ${f(medie.pe)} palloni a partita, più degli assist che distribuisce (${f(medie.as)})`,
      esercizi: DRILLS["Gestione del possesso"],
    });
  if (medie.fa >= 2.5)
    migliorare.push({
      area: "Disciplina nei falli",
      motivo: `${f(medie.fa)} falli a partita: nel 3x3 il bonus di squadra arriva in fretta`,
      esercizi: DRILLS["Disciplina nei falli"],
    });

  candidates
    .filter((c) => c.r < 0.8)
    .sort((a, b) => a.r - b.r)
    .forEach((c) => {
      if (migliorare.length < 3) migliorare.push({ area: c.area, motivo: c.motivo, esercizi: DRILLS[c.area] });
    });

  if (migliorare.length === 0) {
    const lowest = [...candidates].sort((a, b) => a.r - b.r)[0];
    migliorare.push({
      area: lowest.area,
      motivo: `è l'area con più margine: ${lowest.motivo}`,
      esercizi: DRILLS[lowest.area],
    });
  }

  const forti = candidates.filter((c) => c.r >= 1.3).map((c) => c.area);

  return { pid, nome: me.nome, squadra: me.squadra, partite: me.g, medie, forti, migliorare };
}
