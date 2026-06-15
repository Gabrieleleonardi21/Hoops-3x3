/** Chiamata al modello per Coach AI via Groq (gratuito).
 *  Imposta VITE_GROQ_API_KEY nel file .env — ottieni la chiave gratis su console.groq.com.
 *  IN PRODUZIONE: non esporre mai la chiave nel client, usa un backend proxy. */
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

export const aiAvailable = Boolean(GROQ_KEY);

export async function askCoach(preamble: string, history: ChatMsg[]): Promise<string> {
  if (!GROQ_KEY) throw new Error("Chiave API non configurata: imposta VITE_GROQ_API_KEY nel file .env (ottienila gratis su console.groq.com)");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "errore API Groq");

  const reply = data.choices?.[0]?.message?.content?.trim();
  return reply || "Non ho una risposta ora, riprova.";
}
