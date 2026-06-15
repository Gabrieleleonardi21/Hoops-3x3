import { useEffect, useState } from "react";
import { askCoach, aiAvailable, AiError, type ChatMsg } from "../services/aiService";
import { useAppStore } from "../stores/useAppStore";
import { DEFAULT_RULES } from "../constants/rules";
import { buildCoachContext } from "../utils/buildCoachContext";

const CHAT_KEY = "coach_chat";

/** Messaggi di errore specifici per codice Groq. */
function errorMsg(err: unknown): string {
  if (err instanceof AiError) {
    if (err.code === "GROQ_AUTH") return "Chiave API non valida. Controlla VITE_GROQ_API_KEY nel file .env.";
    if (err.code === "GROQ_RATE") return "Limite richieste Groq raggiunto: aspetta qualche secondo e riprova.";
    if (err.code === "GROQ_NETWORK") return "Nessuna connessione: controlla la rete e riprova.";
  }
  return "Si è verificato un errore, riprova tra poco.";
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
  const tappe = useAppStore((s) => s.tappe);

  // Sincronizza la chat in sessionStorage ad ogni aggiornamento
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAT_KEY, JSON.stringify(msgs));
    } catch { /* quota exceeded: ignora */ }
  }, [msgs]);

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
      // Contesto ricco: regole FIBA + dati reali della lega
      const context = buildCoachContext(legaName, tappe);
      const preamble = [
        "Sei Coach AI dell'app HOOP 3X3, dedicata al basket 3x3 e al circuito italiano (tornei, tappe, gironi).",
        `Regole FIBA 3x3: canestri da 1 e 2 punti, gara a ${DEFAULT_RULES.target} punti o ${DEFAULT_RULES.durata} minuti,`,
        `possesso di ${DEFAULT_RULES.shot} secondi, supplementare al primo che segna ${DEFAULT_RULES.ot} punti, niente pareggi.`,
        "Rispondi in italiano, tono da organizzatore/allenatore esperto, massimo 120 parole, senza markdown.",
        context ? `\nDati lega dell'utente:\n${context}` : "",
      ].filter(Boolean).join(" ");

      const reply = await askCoach(preamble, history);
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
