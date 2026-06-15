import { useState } from "react";
import { askCoach, aiAvailable, type ChatMsg } from "../services/aiService";
import { useAppStore } from "../stores/useAppStore";
import { DEFAULT_RULES } from "../constants/rules";

export function useCoachAI() {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const legaName = useAppStore((s) => s.legaName);

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
      const preamble = `Sei Coach AI dell'app HOOP 3X3, dedicata al basket 3x3 e al circuito italiano (tornei, tappe, gironi). Conosci le regole FIBA 3x3: canestri da 1 e 2 punti, gara a ${DEFAULT_RULES.target} punti o ${DEFAULT_RULES.durata} minuti, possesso di ${DEFAULT_RULES.shot} secondi, supplementare al primo che segna ${DEFAULT_RULES.ot} punti, niente pareggi. Rispondi in italiano, tono da organizzatore/allenatore esperto, massimo 120 parole, senza markdown. Usa la ricerca web se servono dati reali.${legaName ? ` Lega dell'utente: ${legaName}.` : ""}`;
      const reply = await askCoach(preamble, history);
      setMsgs([...history, { role: "assistant", content: reply }]);
    } catch {
      setMsgs([...history, { role: "assistant", content: "Si è verificato un errore, riprova tra poco." }]);
    } finally {
      setLoading(false);
    }
  };

  return { msgs, loading, send };
}
