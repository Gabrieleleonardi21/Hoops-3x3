/** Campo che si applica all'uscita o con Invio, non a ogni tasto: mentre si scrive mostra la bozza e il valore vero non cambia;
 *  dopo torna a mostrare il valore ricevuto (quello nuovo, oppure quello di prima se è stato rifiutato). Serve dove ogni valore
 *  intermedio farebbe danni: il nome della tappa (vuoto a metà scrittura), il numero di gironi e le regole (svuotare il campo
 *  per scrivere «15» non deve passare da 0 o da 1). */
import { useState, type InputHTMLAttributes } from "react";
import { Input } from "./Input";

export function CampoConfermato({ valore, onConferma, ...campo }: {
  label: string; valore: string; onConferma: (valore: string) => void;
} & Pick<InputHTMLAttributes<HTMLInputElement>, "type" | "min" | "maxLength">) {
  const [bozza, setBozza] = useState<string | null>(null);
  const conferma = () => {
    if (bozza !== null) onConferma(bozza);
    setBozza(null);
  };
  return (
    <Input {...campo} value={bozza ?? valore} onChange={(e) => setBozza(e.target.value)} onBlur={conferma}
      onKeyDown={(e) => { if (e.key === "Enter") conferma(); }} />
  );
}
