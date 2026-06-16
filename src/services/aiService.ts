/** Chiamata al modello per Coach AI via Groq (gratuito).
 *  Imposta VITE_GROQ_API_KEY nel file .env — ottieni la chiave gratis su console.groq.com.
 *  IN PRODUZIONE: non esporre mai la chiave nel client, usa un backend proxy. */
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
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
        max_tokens: 400,
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
  const messages: ApiMsg[] = [{ role: "system", content: preamble }, ...history];
  const { content } = await callGroq(messages);
  return content || "Non ho una risposta ora, riprova.";
}

/**
 * Chiamata con tool calling. Se l'AI invoca uno strumento:
 * 1. esegue onToolCall (callback del chiamante)
 * 2. manda il risultato all'AI come messaggio tool
 * 3. restituisce la risposta testuale finale
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

  const first = await callGroq(messages, tools);

  // Nessun tool call: risposta diretta
  if (!first.tool_calls?.length) {
    return { text: first.content || "Non ho una risposta ora, riprova.", calledTools: [] };
  }

  // Esegui ogni tool call in parallelo e raccoglie i risultati
  const calledTools: string[] = [];
  const toolResultMsgs: ApiMsg[] = await Promise.all(
    first.tool_calls.map(async (tc) => {
      let args: Record<string, unknown> = {};
      try { args = JSON.parse(tc.function.arguments) as Record<string, unknown>; } catch { /* args vuoti */ }
      const result = await Promise.resolve(onToolCall(tc.function.name, args));
      calledTools.push(tc.function.name);
      return { role: "tool" as const, tool_call_id: tc.id, content: result };
    }),
  );

  // Secondo turno: l'AI conferma l'azione eseguita
  const enriched: ApiMsg[] = [
    ...messages,
    { role: "assistant", content: null, tool_calls: first.tool_calls },
    ...toolResultMsgs,
  ];

  const second = await callGroq(enriched);
  return { text: second.content || "Fatto!", calledTools };
}
