import { useState } from "react";
import { Input } from "../ui/Input";

export function VideoForm({ onAdd, compact }: { onAdd: (titolo: string, url: string) => void; compact?: boolean }) {
  const [titolo, setTitolo] = useState("");
  const [url, setUrl] = useState("");
  const add = () => {
    if (!url.trim()) return;
    onAdd(titolo, url);
    setTitolo(""); setUrl("");
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
      <Input label={compact ? "Aggiungi un video (titolo)" : "Titolo"} labelStyle={{ flex: "1 1 140px" }}
        value={titolo} onChange={(e) => setTitolo(e.target.value)} placeholder="Es. Finale" />
      <Input label="Link video" labelStyle={{ flex: "2 1 220px" }}
        value={url} onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && add()} placeholder="https://youtube.com/..." />
      <button onClick={add} className="blackbtn">{compact ? "Aggiungi" : "Aggiungi video"}</button>
    </div>
  );
}
