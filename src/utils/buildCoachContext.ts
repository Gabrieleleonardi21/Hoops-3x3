import type { Tappa } from "../types";
import { standings } from "./standings";
import { tappaLeaders } from "./tappaLeaders";

/** Classifica cumulativa del circuito: aggrega vittorie e partite su tutte le tappe. */
function circuitStandings(tappe: Tappa[]): string {
  const wins: Record<string, { nome: string; v: number; g: number }> = {};
  for (const t of tappe) {
    for (const sq of t.squadre) {
      if (!wins[sq.id]) wins[sq.id] = { nome: sq.nome, v: 0, g: 0 };
    }
    for (const m of t.partite) {
      if (!m.done) continue;
      const vincitore = m.sa > m.sb ? m.a : m.b;
      const perdente  = m.sa > m.sb ? m.b : m.a;
      if (wins[vincitore]) { wins[vincitore].v++; wins[vincitore].g++; }
      if (wins[perdente])  { wins[perdente].g++; }
    }
  }
  return Object.values(wins)
    .sort((a, b) => b.v - a.v || b.g - a.g)
    .map((r, i) => `${i + 1}. ${r.nome} (${r.v}V/${r.g}P totali)`)
    .join("; ");
}

/** Costruisce un riassunto testuale della lega per il preamble del Coach AI. */
export function buildCoachContext(legaName: string, tappe: Tappa[]): string {
  if (!legaName && !tappe.length) return "";

  const lines: string[] = [];
  if (legaName) lines.push(`Lega: ${legaName}`);
  if (!tappe.length) return lines.join("\n");

  const tappeResume = tappe
    .map((t) => `"${t.nome}" (${t.data}, ${t.luogo})${t.conclusa ? " [conclusa]" : ""}`)
    .join("; ");
  lines.push(`Tappe (${tappe.length}): ${tappeResume}`);

  // Classifica cumulativa del circuito (solo se ci sono partite concluse)
  const tappeConPartite = tappe.filter((t) => t.partite.some((m) => m.done));
  if (tappeConPartite.length > 0) {
    lines.push(`Classifica circuito: ${circuitStandings(tappeConPartite)}`);
  }

  // Focus sulla tappa attiva più recente, altrimenti l'ultima
  const attiva = [...tappe].reverse().find((t) => !t.conclusa) ?? tappe[tappe.length - 1];
  lines.push(`\nTappa in primo piano: ${attiva.nome} — ${attiva.luogo}, ${attiva.data}`);

  const nameOf = (id: string) => attiva.squadre.find((s) => s.id === id)?.nome ?? id;

  if (attiva.squadre.length) {
    lines.push(`Squadre (${attiva.squadre.length}): ${attiva.squadre.map((s) => s.nome).join(", ")}`);
  }

  // Classifiche per girone
  if (attiva.gironi?.length) {
    attiva.gironi.forEach((girone, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C…
      const st = standings(girone, attiva.partite, nameOf);
      const rows = st
        .map((r, pos) => `${pos + 1}. ${r.nome} (${r.v}V ${r.p}P, pf ${r.pf} ps ${r.ps})`)
        .join("; ");
      lines.push(`Girone ${label}: ${rows}`);
    });
  }

  const done = attiva.partite.filter((p) => p.done).length;
  lines.push(`Partite: ${done}/${attiva.partite.length} disputate`);

  // Top 5 marcatori
  const leaders = tappaLeaders(attiva)
    .filter((l) => l.g > 0)
    .sort((a, b) => b.pt / b.g - a.pt / a.g)
    .slice(0, 5);
  if (leaders.length) {
    const top = leaders
      .map((l) => `${l.nome} (${l.squadra}) ${(l.pt / l.g).toFixed(1)}pt/g`)
      .join(", ");
    lines.push(`Top marcatori: ${top}`);
  }

  // I tag delimitano i dati utente dal resto del prompt: l'AI è istruita a non eseguire
  // comandi trovati all'interno di questi tag (difesa contro prompt injection).
  return `<dati_lega>\n${lines.join("\n")}\n</dati_lega>`;
}
