/** Form per aggiungere un video alla tappa: titolo (opzionale) + URL. Il link si controlla prima di aggiungerlo, con il criterio
 *  del server (http(s)://, utils/safeUrl.erroreUrl): un link rifiutato resta nel campo con il motivo sotto.
 *  La prop compact riduce l'etichetta per uso nell'header della tappa conclusa. */
import { useState } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { erroreUrl } from "../../utils/safeUrl";

export function VideoForm({ onAdd, compact }: { onAdd: (titolo: string, url: string) => void; compact?: boolean }) {
  const [titolo, setTitolo] = useState("");
  const [url, setUrl] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  const add = () => {
    if (!url.trim()) return;
    const motivo = erroreUrl(url);
    if (motivo) { setErrore(`Link non aggiunto: ${motivo}`); return; }
    onAdd(titolo, url);
    setTitolo(""); setUrl("");
  };
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2">
      <Input label={compact ? "Aggiungi un video (titolo)" : "Titolo"} labelStyle={{ flex: "1 1 140px" }}
        value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Es. Finale" />
      <Input label="Link video" labelStyle={{ flex: "2 1 220px" }}
        value={url} onChange={(e) => { setUrl(e.target.value); setErrore(null); }}
        onKeyDown={(e) => e.key === "Enter" && add()} placeholder="https://youtube.com/..." />
      <Button variant="outline" onClick={add}>{compact ? "Aggiungi" : "Aggiungi video"}</Button>
      {errore && <p className="m-0 w-full text-[13px] font-semibold text-loss" role="alert">{errore}</p>}
    </div>
  );
}
