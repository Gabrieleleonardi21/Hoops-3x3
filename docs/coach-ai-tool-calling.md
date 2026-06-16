# Coach AI — Tool Calling (azioni autonome)

## Panoramica

Il Coach AI può eseguire azioni nell'app in autonomo quando l'utente lo chiede esplicitamente.
Usa Groq (llama-3.3-70b-versatile) con il protocollo OpenAI function calling.

## File coinvolti

| File | Ruolo |
|---|---|
| `src/services/aiService.ts` | Chiamate HTTP a Groq; gestisce il ciclo tool call → risultato → risposta finale |
| `src/hooks/useCoachAI.ts` | Definisce i tool disponibili ed esegue le azioni sullo store / storage |

## Flusso di esecuzione

```
Utente scrive → AI risponde con tool_call
             → executeTool() esegue l'azione (async, può leggere/scrivere storage)
             → risultato rispedito all'AI come messaggio tool
             → AI risponde con messaggio di conferma in chat
```

Il ciclo è al massimo a **due turni API**: prima chiamata (possibile tool call) + seconda (risposta finale).

---

## Tool attualmente disponibili

### `crea_lega`
- **Descrizione:** Crea una nuova lega e la imposta come attiva.
- **Parametri:** `nome` (string, obbligatorio)
- **Azione:** `createLega(nome)` sullo store Zustand + naviga a `/lega`
- **Esempio:** *"Crea una lega chiamata Circuito Roma 2025"*

---

### `crea_tappa`
- **Descrizione:** Crea una tappa nella lega attiva, cercando le squadre per nome nell'anagrafe e caricando automaticamente i loro giocatori dal roster registrato.
- **Parametri obbligatori:** `nome`, `squadre` (array di stringhe)
- **Parametri opzionali:** `luogo`, `data` (YYYY-MM-DD), `nGironi`
- **Azione:**
  1. Carica in parallelo tutte le squadre (`reg_s_*`) e giocatori (`reg_g_*`) dall'anagrafe condivisa
  2. Per ogni nome richiesto: cerca corrispondenza esatta, poi parziale (case-insensitive)
  3. Per le squadre trovate: popola `giocatori` dal loro roster, copia `regId`, `logo`, `rank`, `website`
  4. Per le squadre non trovate: aggiunge un placeholder senza giocatori (da completare manualmente)
  5. Chiama `addTappa(tappa)` sullo store + naviga a `/lega/tappa/:id`
- **Esempio:** *"Crea la tappa Roma Open con le squadre Ballers Roma, Street Kings e Wildcats"*

---

### `registra_squadra`
- **Descrizione:** Registra una nuova squadra nell'anagrafe condivisa.
- **Parametri obbligatori:** `nome`
- **Parametri opzionali:** `citta`, `anno`, `rank`, `referente`, `logo`, `website`, `instagram`, `note`
- **Azione:** scrive `reg_s_<id>` nel namespace shared di localStorage
- **Esempio:** *"Registra la squadra Ballers Roma, città Roma"*

---

### `registra_giocatore`
- **Descrizione:** Registra un nuovo giocatore nell'anagrafe condivisa.
- **Parametri obbligatori:** `nome`, `cognome`
- **Parametri opzionali:** `squadra`, `ruolo`, `nascita`, `citta`, `nazionalita`, `altezza`, `peso`, `numero`, `soprannome`, `esperienza`, `note`
- **Azione:** scrive `reg_g_<id>` nel namespace shared di localStorage
- **Esempio:** *"Aggiungi il giocatore Marco Rossi, ruolo Playmaker, squadra Ballers Roma"*

---

## Come aggiungere un nuovo tool

### 1. Aggiorna `ToolDef` se serve un tipo di parametro nuovo

Il tipo `ToolParamProp` in `aiService.ts` supporta scalari e array:
```ts
{ type: "string", description: "..." }
{ type: "array",  description: "...", items: { type: "string" } }
```

### 2. Aggiungi la definizione in `COACH_TOOLS` (useCoachAI.ts)

```ts
{
  type: "function",
  function: {
    name: "nome_tool",
    description: "Descrizione chiara per l'AI.",
    parameters: {
      type: "object",
      properties: {
        param: { type: "string", description: "..." },
      },
      required: ["param"],
    },
  },
},
```

### 3. Aggiungi il caso in `executeTool` (useCoachAI.ts)

```ts
if (name === "nome_tool") {
  const valore = str(args, "param") || "default";
  // azione sullo store o storage (può essere async)
  return `Azione completata: ${valore}`;
}
```

> `str(args, key)` è un helper interno che legge stringhe con fallback a `""`.
> `fetchShared<T>(prefix)` è un helper interno per leggere liste dall'anagrafe condivisa.

### Esempi di tool futuri possibili

| Tool | Azione |
|---|---|
| `sorteggia_gironi` | esegue il sorteggio sulla tappa attiva |
| `rinomina_lega` | `setLegaName(nome)` |
| `vai_a_anagrafe` | `navigate("/anagrafe")` |

---

## Note tecniche

- Le letture/scritture anagrafe usano `storage` direttamente (senza `useAnagrafe`) per evitare il fetch dell'intera lista al mount.
- L'AI chiama i tool **solo se l'utente lo chiede esplicitamente** (istruzione nel preamble).
- La chat in UI mostra **solo messaggi user/assistant**; i messaggi tool restano interni all'API.
- La cronologia chat è in `sessionStorage` (si azzera alla chiusura della scheda).
- `crea_tappa` richiede una lega attiva (`legaId !== null`); se manca, restituisce un errore descrittivo.
