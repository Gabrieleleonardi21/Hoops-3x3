/** Chiamata al modello per Coach AI via Groq (gratuito).
 *  Imposta VITE_GROQ_API_KEY nel file .env — ottieni la chiave gratis su console.groq.com.
 *  IN PRODUZIONE: non esporre mai la chiave nel client, usa un backend proxy. */
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
  /** Nomi dei tool eseguiti per produrre questa risposta (solo assistant; mostrati come badge in chat). */
  tools?: string[];
}

/** Definizione di una proprietà parametro (supporta scalari e array). */
export interface ToolParamProp {
  type: string;
  description: string;
  items?: { type: string }; // usato quando type === "array"
}

/** Definizione di uno strumento che l'AI può invocare (formato OpenAI function calling). */
export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, ToolParamProp>;
      required: string[];
    };
  };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** Codici di errore tipizzati per mostrare messaggi specifici all'utente. */
export type AiErrorCode = "GROQ_AUTH" | "GROQ_RATE" | "GROQ_SERVER" | "GROQ_NETWORK";

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

// Messaggio a livello API: superset di ChatMsg, include messaggi tool non mostrati in UI
interface ApiMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

export const aiAvailable = Boolean(GROQ_KEY);

/** Chiamata HTTP base verso Groq. Accetta messaggi API-level e opzionali tool definitions. */
async function callGroq(
  messages: ApiMsg[],
  tools?: ToolDef[],
): Promise<{ content: string | null; tool_calls?: ToolCall[] }> {
  if (!GROQ_KEY) throw new AiError("GROQ_AUTH", "Chiave API non configurata");

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        // llama-3.3-70b-versatile: ottimo equilibrio qualità/velocità, gratuito su Groq
        model: "llama-3.3-70b-versatile",
        max_tokens: 650,
        messages,
        ...(tools?.length ? { tools, tool_choice: "auto" } : {}),
      }),
    });
  } catch {
    throw new AiError("GROQ_NETWORK", "Errore di rete");
  }

  if (!res.ok) {
    if (res.status === 401) throw new AiError("GROQ_AUTH", "Chiave API non valida");
    if (res.status === 429) throw new AiError("GROQ_RATE", "Limite richieste raggiunto");
    throw new AiError("GROQ_SERVER", `Errore server Groq: ${res.status}`);
  }

  const data = await res.json();
  if (data.error) throw new AiError("GROQ_SERVER", data.error.message || "errore API Groq");

  const msg = data.choices?.[0]?.message;
  return { content: msg?.content?.trim() ?? null, tool_calls: msg?.tool_calls };
}

/** Chiamata semplice senza tool calling (compatibilità con il vecchio flusso). */
export async function askCoach(preamble: string, history: ChatMsg[]): Promise<string> {
  // Mappa a {role, content}: scarta eventuali campi extra (es. `tools`) dal payload API
  const messages: ApiMsg[] = [
    { role: "system", content: preamble },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const { content } = await callGroq(messages);
  return content || "Non ho una risposta ora, riprova.";
}

/**
 * Chiamata con tool calling in loop agentico. Finché l'AI invoca strumenti:
 * 1. registra il turno assistant che li richiede
 * 2. esegue onToolCall per ogni tool e rimanda i risultati come messaggi tool
 * 3. richiama il modello; ripete finché risponde con testo o si raggiunge il cap
 *
 * I tool dello stesso turno girano IN SEQUENZA: così un tool che dipende da un altro
 * (es. sorteggia_gironi dopo crea_tappa) legge lo stato già aggiornato, senza race.
 *
 * Guardia anti-stallo: una chiamata con firma (nome + argomenti) identica a una già
 * eseguita non viene rieseguita; se un round contiene solo ricicli il loop si chiude,
 * evitando di bruciare i round con un modello bloccato che ripete la stessa azione.
 *
 * @param onToolCall - riceve nome e argomenti dello strumento; può essere async
 * @returns testo finale da mostrare in chat + nomi degli strumenti chiamati
 */
export async function askCoachWithTools(
  preamble: string,
  history: ChatMsg[],
  tools: ToolDef[],
  onToolCall: (name: string, args: Record<string, unknown>) => string | Promise<string>,
): Promise<{ text: string; calledTools: string[] }> {
  const messages: ApiMsg[] = [
    { role: "system", content: preamble },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const calledTools: string[] = [];
  // Firme (nome + argomenti) dei tool già eseguiti in questa richiesta: blocca i ricicli
  // identici di un modello bloccato (es. richiama crea_tappa che risponde "già creata").
  const seen = new Set<string>();
  // Cap ai round di tool: copre un flusso completo di tappa (crea → sorteggia →
  // risultati → fasi dirette → risultati → concludi) e blocca eventuali loop infiniti.
  const MAX_TOOL_ROUNDS = 8;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await callGroq(messages, tools);

    // Nessun tool richiesto: è la risposta finale da mostrare in chat
    if (!res.tool_calls?.length) {
      return { text: res.content || "Non ho una risposta ora, riprova.", calledTools };
    }

    // Registra il turno assistant che ha richiesto i tool
    messages.push({ role: "assistant", content: res.content, tool_calls: res.tool_calls });

    // Esegue i tool in sequenza e accoda ogni risultato come messaggio tool
    let eseguitoQualcosa = false; // false se il round contiene SOLO ricicli → si esce
    for (const tc of res.tool_calls) {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* args vuoti */ }

      // Guardia anti-stallo: stesso tool con gli stessi argomenti già eseguito → non ripetere
      const firma = `${tc.function.name}:${tc.function.arguments}`;
      if (seen.has(firma)) {
        messages.push({ role: "tool", tool_call_id: tc.id, content: `Azione "${tc.function.name}" già eseguita in questa richiesta: non ripeterla, rispondi all'utente.` });
        continue;
      }

      seen.add(firma);
      eseguitoQualcosa = true;
      const result = await Promise.resolve(onToolCall(tc.function.name, args));
      calledTools.push(tc.function.name);
      messages.push({ role: "tool", tool_call_id: tc.id, content: result });
    }

    // Round di soli ricicli: il modello è bloccato, esci e chiudi con una risposta testuale
    if (!eseguitoQualcosa) break;
  }

  // Cap raggiunto o loop interrotto: una chiamata finale senza tool forza la risposta di chiusura.
  const final = await callGroq(messages);
  return { text: final.content || "Fatto!", calledTools };
}
