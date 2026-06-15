/** Chiamata al modello per Coach AI via Groq (gratuito).
 *  Imposta VITE_GROQ_API_KEY nel file .env — ottieni la chiave gratis su console.groq.com.
 *  IN PRODUZIONE: non esporre mai la chiave nel client, usa un backend proxy. */
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/** Codici di errore tipizzati per mostrare messaggi specifici all'utente. */
export type AiErrorCode = "GROQ_AUTH" | "GROQ_RATE" | "GROQ_SERVER" | "GROQ_NETWORK";

export class AiError extends Error {
  constructor(public code: AiErrorCode, message: string) {
    super(message);
  }
}

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

export const aiAvailable = Boolean(GROQ_KEY);

export async function askCoach(preamble: string, history: ChatMsg[]): Promise<string> {
  if (!GROQ_KEY) throw new AiError("GROQ_AUTH", "Chiave API non configurata");

  let res: Response;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        // llama-3.3-70b-versatile: ottimo equilibrio qualità/velocità, gratuito su Groq
        model: "llama-3.3-70b-versatile",
        max_tokens: 400,
        messages: [
          { role: "system", content: preamble },
          ...history,
        ],
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

  const reply = data.choices?.[0]?.message?.content?.trim();
  return reply || "Non ho una risposta ora, riprova.";
}
