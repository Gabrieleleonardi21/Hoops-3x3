/** Form per aggiungere un video alla tappa: titolo (opzionale) + URL.
 *  La prop compact riduce l'etichetta per uso nell'header della tappa conclusa. */
import { useState } from "react";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";

export function VideoForm({ onAdd, compact }: { onAdd: (titolo: string, url: string) => void; compact?: boolean }) {
  const [titolo, setTitolo] = useState("");
  const [url, setUrl] = useState("");
  const add = () => {
    if (!url.trim()) return;
    onAdd(titolo, url);
    setTitolo(""); setUrl("");
  };
  return (
    <div className="mb-3 flex flex-wrap items-end gap-2">
      <Input label={compact ? "Aggiungi un video (titolo)" : "Titolo"} labelStyle={{ flex: "1 1 140px" }}
        value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Es. Finale" />
      <Input label="Link video" labelStyle={{ flex: "2 1 220px" }}
        value={url} onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()} placeholder="https://youtube.com/..." />
      <Button variant="outline" onClick={add}>{compact ? "Aggiungi" : "Aggiungi video"}</Button>
    </div>
  );
}
