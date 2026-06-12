/** Chiamata al modello per Coach AI.
 *  In sviluppo usa VITE_ANTHROPIC_API_KEY dal file .env (mai committarla).
 *  IN PRODUZIONE: instradare la richiesta verso un proprio backend proxy,
 *  la chiave non deve mai arrivare nel bundle client. */
export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined;

export const aiAvailable = Boolean(API_KEY);

export async function askCoach(preamble: string, history: ChatMsg[]): Promise<string> {
  if (!API_KEY) throw new Error("Chiave API non configurata: imposta VITE_ANTHROPIC_API_KEY nel file .env");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        { role: "user", content: preamble },
        { role: "assistant", content: "Capito, sono pronto." },
        ...history,
      ],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "errore API");
  const reply = (data.content || [])
    .map((i: { type: string; text?: string }) => (i.type === "text" ? i.text : ""))
    .join("")
    .trim();
  return reply || "Non ho una risposta ora, riprova.";
}
