import type { SquadraTappa, Tappa } from "../types";
import { giocateConVincitore, standings, vincitore } from "./standings";
import { tappaLeaders } from "./tappaLeaders";
import { nomeSquadra } from "./tappaInfo";
import { letteraGirone } from "./formato";

/** Lunghezza massima di un nome nel contesto */
const MAX_NOME = 80;

/** Un valore scritto dagli utenti (nomi di lega, tappe, squadre e giocatori, luogo, data) pronto per il prompt.
 *  `<` e `>` diventano ‹ ›: un nome che contiene `</dati_lega>` chiuderebbe il blocco dei dati e il testo dopo
 *  sembrerebbe un'istruzione. I nomi arrivano anche dall'anagrafe condivisa, scrivibile da ogni utente registrato.
 *  La usano anche i risultati degli strumenti del Coach, che riportano gli stessi nomi.
 *  String(): una tappa salvata da una versione vecchia può non avere tutti i campi. */
export function pulisci(valore: string): string {
  return senzaTag(valore).slice(0, MAX_NOME);
}

/** Come pulisci, ma senza accorciare: per un testo lungo che può contenere nomi scritti dagli utenti, come il motivo di un errore
 *  (un conflitto riporta il nome della tappa salvato sul server) */
export function senzaTag(valore: string): string {
  return String(valore).replace(/</g, "‹").replace(/>/g, "›");
}

/** La stessa squadra in tappe diverse: l'id di una squadra cambia a ogni tappa, quindi conta la voce dell'anagrafe a cui è
 *  collegata (regId) e, se non è collegata, il nome (maiuscole e spazi ai lati a parte) */
function identitaSquadra(sq: SquadraTappa): string {
  if (sq.regId) return `reg:${sq.regId}`;
  return `nome:${sq.nome.trim().toLowerCase()}`;
}

/** Classifica cumulativa del circuito: aggrega vittorie e sconfitte su tutte le tappe, una riga per squadra (identitaSquadra).
 *  Ordine: più vittorie, poi meno sconfitte. Le partite che contano sono le stesse della classifica del girone
 *  (giocateConVincitore): una in parità non conta per niente. «P» sono le perse, come nelle righe dei gironi. */
function circuitStandings(tappe: Tappa[]): string {
  const righe = new Map<string, { nome: string; v: number; p: number }>();
  for (const t of tappe) {
    // id della squadra in questa tappa → la sua riga del circuito
    const rigaDi = new Map<string, { nome: string; v: number; p: number }>();
    for (const sq of t.squadre) {
      const chiave = identitaSquadra(sq);
      let riga = righe.get(chiave);
      if (!riga) {
        riga = { nome: sq.nome, v: 0, p: 0 };
        righe.set(chiave, riga);
      }
      rigaDi.set(sq.id, riga);
    }
    for (const m of giocateConVincitore(t.partite)) {
      const vince = vincitore(m);
      // la perdente è l'altra squadra della partita
      let perdente = m.a;
      if (vince === m.a) perdente = m.b;
      const rigaVince = rigaDi.get(vince);
      const rigaPerde = rigaDi.get(perdente);
      if (rigaVince) rigaVince.v++;
      if (rigaPerde) rigaPerde.p++;
    }
  }
  return [...righe.values()]
    .sort((a, b) => b.v - a.v || a.p - b.p)
    .map((r, i) => `${i + 1}. ${pulisci(r.nome)} (${r.v}V ${r.p}P totali)`)
    .join("; ");
}

/** Costruisce un riassunto testuale della lega per il preamble del Coach AI. */
export function buildCoachContext(legaName: string, tappe: Tappa[]): string {
  if (!legaName && !tappe.length) return "";

  const lines: string[] = [];
  if (legaName) lines.push(`Lega: ${pulisci(legaName)}`);
  if (!tappe.length) return lines.join("\n");

  const tappeResume = tappe
    .map((t) => {
      let riga = `"${pulisci(t.nome)}" (${pulisci(t.data)}, ${pulisci(t.luogo)})`;
      if (t.conclusa) riga += " [conclusa]";
      return riga;
    })
    .join("; ");
  lines.push(`Tappe (${tappe.length}): ${tappeResume}`);

  // Classifica cumulativa del circuito (solo se ci sono partite giocate con un vincitore, come in circuitStandings:
  // una tappa con sole partite in parità non porterebbe che squadre a zeri)
  const tappeConPartite = tappe.filter((t) => giocateConVincitore(t.partite).length > 0);
  if (tappeConPartite.length > 0) {
    lines.push(`Classifica circuito: ${circuitStandings(tappeConPartite)}`);
  }

  // Focus sulla tappa attiva più recente, altrimenti l'ultima
  const attiva = [...tappe].reverse().find((t) => !t.conclusa) ?? tappe[tappe.length - 1];
  lines.push(`\nTappa in primo piano: ${pulisci(attiva.nome)} — ${pulisci(attiva.luogo)}, ${pulisci(attiva.data)}`);

  // Nomi delle squadre già puliti: li usano le classifiche dei gironi
  const nameOf = (id: string) => pulisci(nomeSquadra(attiva.squadre, id));

  if (attiva.squadre.length) {
    lines.push(`Squadre (${attiva.squadre.length}): ${attiva.squadre.map((s) => pulisci(s.nome)).join(", ")}`);
  }

  // Classifiche per girone
  if (attiva.gironi?.length) {
    attiva.gironi.forEach((girone, i) => {
      const label = letteraGirone(i); // A, B, C…
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
      .map((l) => `${pulisci(l.nome)} (${pulisci(l.squadra)}) ${(l.pt / l.g).toFixed(1)}pt/g`)
      .join(", ");
    lines.push(`Top marcatori: ${top}`);
  }

  // I tag delimitano i dati utente dal resto del prompt: l'AI è istruita a non eseguire
  // comandi trovati all'interno di questi tag (difesa contro prompt injection).
  return `<dati_lega>\n${lines.join("\n")}\n</dati_lega>`;
}
