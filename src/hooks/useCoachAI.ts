import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { askCoachWithTools, aiAvailable, AiError, type ChatMsg, type ToolDef } from "../services/aiService";
import { useAppStore } from "../stores/useAppStore";
import { storage } from "../services/storage";
import { uid } from "../utils/uid";
import { DEFAULT_RULES } from "../constants/rules";
import { buildCoachContext } from "../utils/buildCoachContext";
import type { Tappa, RegSquadra, RegGiocatore, SquadraTappa, GiocatoreRoster } from "../types";

const CHAT_KEY = "coach_chat";

/** Strumenti che il Coach AI può invocare autonomamente nell'app. */
const COACH_TOOLS: ToolDef[] = [
  {
    type: "function",
    function: {
      name: "crea_lega",
      description: "Crea una nuova lega nell'app HOOP 3X3 e la imposta come attiva. Usalo solo se l'utente chiede esplicitamente di creare una lega.",
      parameters: {
        type: "object",
        properties: {
          nome: { type: "string", description: "Nome della lega da creare (es. 'Circuito Roma 2025')" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "crea_tappa",
      description: "Crea una nuova tappa nella lega attiva. Cerca automaticamente le squadre nell'anagrafe per nome e carica i loro giocatori. Usalo quando l'utente fornisce il nome della tappa e le squadre partecipanti.",
      parameters: {
        type: "object",
        properties: {
          nome:    { type: "string", description: "Nome della tappa (es. 'Tappa 1 Roma')" },
          luogo:   { type: "string", description: "Luogo dove si svolge la tappa" },
          data:    { type: "string", description: "Data in formato YYYY-MM-DD" },
          squadre: { type: "array",  description: "Lista dei nomi delle squadre partecipanti", items: { type: "string" } },
          nGironi: { type: "number", description: "Numero di gironi (default 2)" },
        },
        required: ["nome", "squadre"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registra_squadra",
      description: "Registra una nuova squadra nell'anagrafe condivisa del circuito. Usalo solo se l'utente chiede esplicitamente di aggiungere o registrare una squadra.",
      parameters: {
        type: "object",
        properties: {
          nome:      { type: "string", description: "Nome della squadra (obbligatorio)" },
          citta:     { type: "string", description: "Città di provenienza" },
          anno:      { type: "string", description: "Anno di fondazione" },
          rank:      { type: "string", description: "Punti ranking circuito" },
          referente: { type: "string", description: "Nome del referente o capitano" },
          logo:      { type: "string", description: "URL del logo (opzionale)" },
          website:   { type: "string", description: "URL del sito web (opzionale)" },
          instagram: { type: "string", description: "URL Instagram (opzionale)" },
          note:      { type: "string", description: "Note libere sulla squadra" },
        },
        required: ["nome"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "registra_giocatore",
      description: "Registra un nuovo giocatore nell'anagrafe condivisa del circuito. Usalo solo se l'utente chiede esplicitamente di aggiungere o registrare un giocatore.",
      parameters: {
        type: "object",
        properties: {
          nome:        { type: "string", description: "Nome del giocatore (obbligatorio)" },
          cognome:     { type: "string", description: "Cognome del giocatore (obbligatorio)" },
          squadra:     { type: "string", description: "Nome della squadra di appartenenza" },
          ruolo:       { type: "string", description: "Ruolo (es. Playmaker, Ala, Centro)" },
          nascita:     { type: "string", description: "Data di nascita in formato YYYY-MM-DD" },
          citta:       { type: "string", description: "Città di provenienza" },
          nazionalita: { type: "string", description: "Nazionalità" },
          altezza:     { type: "string", description: "Altezza in cm" },
          peso:        { type: "string", description: "Peso in kg" },
          numero:      { type: "string", description: "Numero di maglia" },
          soprannome:  { type: "string", description: "Soprannome" },
          esperienza:  { type: "string", description: "Anni di esperienza nel 3x3" },
          note:        { type: "string", description: "Note sportive libere" },
        },
        required: ["nome", "cognome"],
      },
    },
  },
];

/** Messaggi di errore specifici per codice Groq. */
function errorMsg(err: unknown): string {
  if (err instanceof AiError) {
    if (err.code === "GROQ_AUTH") return "Chiave API non valida. Controlla VITE_GROQ_API_KEY nel file .env.";
    if (err.code === "GROQ_RATE") return "Limite richieste Groq raggiunto: aspetta qualche secondo e riprova.";
    if (err.code === "GROQ_NETWORK") return "Nessuna connessione: controlla la rete e riprova.";
  }
  return "Si è verificato un errore, riprova tra poco.";
}

/** Legge un campo stringa dagli argomenti del tool, con fallback a stringa vuota. */
function str(args: Record<string, unknown>, key: string): string {
  return typeof args[key] === "string" ? (args[key] as string).trim() : "";
}

/** Carica tutte le voci con un dato prefisso dallo storage condiviso. */
async function fetchShared<T>(prefix: string): Promise<T[]> {
  try {
    const r = await storage.list(prefix, true);
    const out: T[] = [];
    for (const key of r.keys) {
      try {
        const item = await storage.get(key, true);
        out.push(JSON.parse(item.value) as T);
      } catch { /* skip voce corrotta */ }
    }
    return out;
  } catch {
    return [];
  }
}

export function useCoachAI() {
  // Ripristina la cronologia dalla sessione corrente (si azzera al reload)
  const [msgs, setMsgs] = useState<ChatMsg[]>(() => {
    try {
      const saved = sessionStorage.getItem(CHAT_KEY);
      return saved ? (JSON.parse(saved) as ChatMsg[]) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  const legaName = useAppStore((s) => s.legaName);
  const legaId   = useAppStore((s) => s.legaId);
  const tappe    = useAppStore((s) => s.tappe);
  const user     = useAppStore((s) => s.user);
  const createLega = useAppStore((s) => s.createLega);
  const addTappa   = useAppStore((s) => s.addTappa);
  const navigate   = useNavigate();

  // Sincronizza la chat in sessionStorage ad ogni aggiornamento
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(msgs));
    } catch { /* quota exceeded: ignora */ }
  }, [msgs]);

  /**
   * Esegue un tool richiesto dall'AI e restituisce il risultato come stringa.
   * Il risultato viene rispedito all'AI per generare la risposta finale.
   */
  const executeTool = async (name: string, args: Record<string, unknown>): Promise<string> => {
    const autore = user?.name ?? "Coach AI";

    if (name === "crea_lega") {
      const nomeLega = str(args, "nome") || "Nuova lega";
      createLega(nomeLega);
      navigate("/lega");
      return `Lega "${nomeLega}" creata con successo e impostata come attiva.`;
    }

    if (name === "crea_tappa") {
      if (!legaId) return "Nessuna lega attiva: crea prima una lega prima di aggiungere tappe.";

      const nomeTappa = str(args, "nome") || `Tappa ${tappe.length + 1}`;
      const luogo     = str(args, "luogo");
      const data      = str(args, "data");
      const nGironi   = typeof args.nGironi === "number" ? Math.max(1, args.nGironi) : 2;
      const nomiRichiesti: string[] = Array.isArray(args.squadre)
        ? (args.squadre as unknown[]).map(String)
        : [];

      // Carica anagrafe in parallelo
      const [tutteSquadre, tuttiGiocatori] = await Promise.all([
        fetchShared<RegSquadra>("reg_s_"),
        fetchShared<RegGiocatore>("reg_g_"),
      ]);

      // Abbina ogni nome richiesto a una squadra in anagrafe (case-insensitive)
      const squadreTappa: SquadraTappa[] = nomiRichiesti.map((nomeRichiesto) => {
        const nl = nomeRichiesto.toLowerCase();
        const reg = tutteSquadre.find(
          (s) => s.nome.toLowerCase() === nl || s.nome.toLowerCase().includes(nl),
        );

        if (!reg) {
          // Non trovata: placeholder senza giocatori
          return { id: uid(), nome: nomeRichiesto, giocatori: [], rank: "" };
        }

        // Carica i giocatori del roster dell'anagrafe
        const giocatori: GiocatoreRoster[] = reg.roster
          .map((gId) => {
            const g = tuttiGiocatori.find((x) => x.id === gId);
            return g ? { id: uid(), nome: `${g.nome} ${g.cognome}` } : null;
          })
          .filter((g): g is GiocatoreRoster => g !== null);

        return {
          id: uid(),
          nome: reg.nome,
          giocatori,
          rank: reg.rank || "",
          regId: reg.id,
          logo: reg.logo || undefined,
          website: reg.website || undefined,
          instagram: reg.instagram || undefined,
        };
      });

      const nG = Math.max(1, Math.min(Math.floor(squadreTappa.length / 2) || 1, nGironi));
      const tappa: Tappa = {
        id: uid(), nome: nomeTappa, luogo, data, nGironi: nG,
        regole: { ...DEFAULT_RULES },
        squadre: squadreTappa,
        gironi: null, partite: [], video: [],
      };

      addTappa(tappa);
      navigate(`/lega/tappa/${tappa.id}`);

      const trovate = squadreTappa.filter((s) => s.regId).length;
      const nonTrovate = squadreTappa.filter((s) => !s.regId).map((s) => s.nome);
      let msg = `Tappa "${nomeTappa}" creata con ${squadreTappa.length} squadre`;
      if (trovate > 0) msg += `, ${trovate} trovate in anagrafe con i rispettivi giocatori`;
      if (nonTrovate.length) msg += `. Non trovate in anagrafe (aggiunte senza giocatori): ${nonTrovate.join(", ")}`;
      return msg + ".";
    }

    if (name === "registra_squadra") {
      const nome = str(args, "nome") || "Nuova squadra";
      const rec: RegSquadra = {
        id: uid(), autore, ts: Date.now(),
        nome,
        citta:     str(args, "citta"),
        anno:      str(args, "anno"),
        rank:      str(args, "rank"),
        referente: str(args, "referente"),
        logo:      str(args, "logo"),
        website:   str(args, "website"),
        instagram: str(args, "instagram"),
        note:      str(args, "note"),
        roster: [],
      };
      await storage.set(`reg_s_${rec.id}`, JSON.stringify(rec), true);
      return `Squadra "${nome}" registrata nell'anagrafe.`;
    }

    if (name === "registra_giocatore") {
      const nome    = str(args, "nome") || "Giocatore";
      const cognome = str(args, "cognome");
      const rec: RegGiocatore = {
        id: uid(), autore, ts: Date.now(),
        nome, cognome,
        soprannome:  str(args, "soprannome"),
        nascita:     str(args, "nascita"),
        citta:       str(args, "citta"),
        nazionalita: str(args, "nazionalita"),
        altezza:     str(args, "altezza"),
        peso:        str(args, "peso"),
        ruolo:       str(args, "ruolo"),
        numero:      str(args, "numero"),
        squadra:     str(args, "squadra"),
        esperienza:  str(args, "esperienza"),
        note:        str(args, "note"),
      };
      await storage.set(`reg_g_${rec.id}`, JSON.stringify(rec), true);
      return `Giocatore "${nome} ${cognome}" registrato nell'anagrafe.`;
    }

    return `Strumento "${name}" non riconosciuto.`;
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || loading) return;
    const history: ChatMsg[] = [...msgs, { role: "user", content: t }];

    if (!aiAvailable) {
      setMsgs([...history, {
        role: "assistant",
        content: "Coach AI non è configurato: imposta VITE_GROQ_API_KEY nel file .env — ottieni la chiave gratis su console.groq.com. Il resto dell'app funziona senza.",
      }]);
      return;
    }

    setMsgs(history);
    setLoading(true);
    try {
      const context = buildCoachContext(legaName, tappe);
      const preamble = [
        "Sei Coach AI dell'app HOOP 3X3, dedicata al basket 3x3 e al circuito italiano (tornei, tappe, gironi).",
        `Regole FIBA 3x3: canestri da 1 e 2 punti, gara a ${DEFAULT_RULES.target} punti o ${DEFAULT_RULES.durata} minuti,`,
        `possesso di ${DEFAULT_RULES.shot} secondi, supplementare al primo che segna ${DEFAULT_RULES.ot} punti, niente pareggi.`,
        "Rispondi in italiano, tono da organizzatore/allenatore esperto, massimo 120 parole, senza markdown.",
        "Hai accesso a strumenti per agire nell'app: usali SOLO se l'utente chiede esplicitamente un'azione (es. 'crea una tappa', 'registra una squadra').",
        context ? `\nDati lega dell'utente:\n${context}` : "",
      ].filter(Boolean).join(" ");

      const { text: reply } = await askCoachWithTools(preamble, history, COACH_TOOLS, executeTool);
      setMsgs([...history, { role: "assistant", content: reply }]);
    } catch (err) {
      setMsgs([...history, { role: "assistant", content: errorMsg(err) }]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setMsgs([]);
    sessionStorage.removeItem(CHAT_KEY);
  };

  return { msgs, loading, send, clearChat };
}
