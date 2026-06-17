import type { Tappa } from "../types";
import { standings } from "./standings";
import { tappaLeaders } from "./tappaLeaders";

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
