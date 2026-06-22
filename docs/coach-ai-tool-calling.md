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
Utente scrive → AI risponde con uno o più tool_call
             → executeTool() esegue ogni azione IN SEQUENZA (async, legge/scrive storage)
             → risultati rispediti all'AI come messaggi tool
             → l'AI può richiedere altri tool (nuovo round) … oppure
             → AI risponde con messaggio di conferma in chat
```

Il ciclo è un **loop agentico**: ripete finché l'AI smette di chiedere tool o si raggiunge il cap di `MAX_TOOL_ROUNDS` (8). Questo abilita i flussi multi-step in un solo messaggio (es. *"crea la tappa e sorteggia"*). I tool dello stesso turno girano **in sequenza**, così un tool dipendente (es. `sorteggia_gironi` dopo `crea_tappa`) vede lo stato già aggiornato: niente race condition. Una **guardia anti-stallo** non riesegue una chiamata con firma (nome + argomenti) identica a una già fatta e interrompe il loop se un round è fatto solo di ricicli, così un modello bloccato non brucia tutti i round.

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
- **Nota:** Deve essere chiamato **UNA SOLA VOLTA** con tutte le squadre nell'array `squadre`.
- **Esempio:** *"Crea la tappa Roma Open con le squadre Ballers Roma, Street Kings e Wildcats"*

---

### `sorteggia_gironi`
- **Descrizione:** Esegue il sorteggio dei gironi per una tappa esistente.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `mode` (`"casuale"` o `"ranking"`)
- **Azione:**
  1. Trova la tappa per nome (parziale, case-insensitive) o usa l'ultima
  2. Costruisce i gironi con `buildGironi` (casuale) o `buildGironiSeeded` (a serpentina per ranking)
  3. Genera il calendario partite con `buildMatches`
  4. Chiama `updateTappa(id, { gironi, partite })` + naviga alla pagina tappa
- **Nota:** Usa `useAppStore.getState()` per leggere le tappe aggiornate dai tool precedenti dello stesso ciclo (la closure del hook è ferma all'ultimo render).
- **Esempio:** *"Sorteggia i gironi della tappa Roma Open"* oppure *"Fai il sorteggio per ranking"*

---

### `genera_fasi_dirette`
- **Descrizione:** Genera la fase a eliminazione diretta (bracket: semifinali, finale) dalla classifica dei gironi.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `qualificate` (squadre per girone che passano, default 2)
- **Prerequisiti:** gironi sorteggiati e **tutte** le partite dei gironi `done`.
- **Azione:**
  1. Valida che i gironi siano conclusi e che il bracket non esista già
  2. Costruisce il tabellone con `buildBracket(gironi, partite, squadre, nPass)` (cross-seeding 1°A vs 2°B…)
  3. Chiama `updateTappa(id, { bracket })` + naviga alla pagina tappa
- **Nota:** Con un solo girone `buildBracket` restituisce `[]` (nessun incrocio): il tool risponde con un errore descrittivo.
- **Esempio:** *"Genera le fasi dirette"* oppure *"Crea il tabellone, passano le prime 2 di ogni girone"*

---

### `registra_risultato`
- **Descrizione:** Registra il punteggio di una partita, **sia dei gironi sia della fase a eliminazione diretta** (semifinali, finale).
- **Parametri obbligatori:** `squadra_a`, `punti_a`, `squadra_b`, `punti_b`
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `fase` (`"girone"` o `"diretta"`)
- **Azione:**
  1. Trova la tappa e cerca, tra le due squadre, sia la partita di girone non registrata sia il match di bracket non giocato (con entrambe le squadre note)
  2. Valida: nessun pareggio (FIBA 3x3), punteggi numerici
  3. Gestisce l'ordine A/B corretto (non inverte i punteggi se l'utente li da nell'ordine inverso)
  4. Girone → `updateTappaPartita(... done: true)`. Bracket → `updateBracketMatch(... done: true)` **e fa avanzare il vincitore** allo slot TBD del round successivo via `nextBracketSlot`
- **Disambiguazione (zero ambiguità):** il bracket si genera solo a gironi conclusi, quindi quando esiste non c'è alcun girone aperto → al massimo **un** candidato. Nel caso limite di due candidati (es. un risultato di girone annullato dopo aver generato il bracket) il tool **non indovina**: chiede di specificare la fase, e il parametro `fase` permette di forzarla.
- **Nota:** Può essere chiamato più volte nello stesso turno per registrare più partite.
- **Esempio:** *"Risultato: Ballers Roma 21, Street Kings 15"* — *"Finale: Wildcats 22, Ballers Roma 18"*

---

### `concludi_tappa`
- **Descrizione:** Conclude e pubblica la tappa nell'Archivio circuito.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa)
- **Prerequisiti:** gironi sorteggiati, tutte le partite dei gironi `done`, **fase diretta completata se presente**, account non ospite
- **Azione:**
  1. Valida che tutte le partite dei gironi siano registrate
  2. Se esiste il `bracket`, valida che tutti i suoi match siano `done` (altrimenti blocca: la finale non può restare aperta)
  3. Chiama `replaceTappa` con `conclusa: true`
  4. Scrive `pub_${tappaId}` nello storage condiviso
- **Esempio:** *"Concludi la tappa Roma Open"*

---

### `registra_squadra`
- **Descrizione:** Registra una nuova squadra nell'anagrafe condivisa del circuito.
- **Parametri obbligatori:** `nome`
- **Parametri opzionali:** `citta`, `anno`, `rank`, `referente`, `logo`, `website`, `instagram`, `note`
- **Azione:** scrive `reg_s_<id>` nel namespace shared di localStorage
- **Esempio:** *"Registra la squadra Ballers Roma, città Roma"*

---

### `registra_giocatore`
- **Descrizione:** Registra un nuovo giocatore nell'anagrafe condivisa del circuito.
- **Parametri obbligatori:** `nome`, `cognome`
- **Parametri opzionali:** `squadra`, `ruolo`, `nascita`, `citta`, `nazionalita`, `altezza`, `peso`, `numero`, `soprannome`, `esperienza`, `note`
- **Azione:** scrive `reg_g_<id>` nel namespace shared di localStorage
- **Esempio:** *"Aggiungi il giocatore Marco Rossi, ruolo Playmaker, squadra Ballers Roma"*

---

## Flusso completo di una tappa via Coach AI

```
1. "Crea la tappa Roma Open con Ballers Roma, Street Kings, Wildcats"
   → crea_tappa (carica squadre dall'anagrafe, genera la tappa)

2. "Sorteggia i gironi"
   → sorteggia_gironi (casuale o per ranking)

3. "Registra: Ballers Roma 21 - Street Kings 14"
   → registra_risultato (ripetuto per ogni partita dei gironi)

4. "Genera le fasi dirette"
   → genera_fasi_dirette (bracket dalla classifica dei gironi)

5. "Finale: Wildcats 22 - Ballers Roma 18"
   → registra_risultato (gli stessi tool, ora sui match del bracket)

6. "Concludi la tappa"
   → concludi_tappa (pubblica nell'Archivio circuito)
```

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
  // Per tool che leggono stato potenzialmente modificato da altri tool nello stesso turno,
  // usa getState() invece della closure per avere valori freschi:
  const freshTappe = useAppStore.getState().tappe;
  const valore = str(args, "param") || "default";
  // azione sullo store o storage (può essere async)
  return `Azione completata: ${valore}`;
}
```

> `str(args, key)` è un helper interno che legge stringhe con fallback a `""`.
> `findTappa(tappe, nome?)` è un helper interno che cerca per nome parziale o restituisce l'ultima tappa.
> `fetchShared<T>(prefix)` è un helper interno per leggere liste dall'anagrafe condivisa.

### Esempi di tool futuri possibili

| Tool | Azione |
|---|---|
| `rinomina_lega` | `setLegaName(nome)` |
| `vai_a_anagrafe` | `navigate("/anagrafe")` |
| `aggiungi_video` | `addVideo(titolo, url)` sulla tappa attiva |

---

## Note tecniche

- Le letture/scritture anagrafe usano `storage` direttamente (senza `useAnagrafe`) per evitare il fetch dell'intera lista al mount.
- L'AI chiama i tool **solo se l'utente lo chiede esplicitamente** (istruzione nel preamble).
- La chat in UI mostra messaggi user/assistant; i messaggi tool restano interni all'API, ma sotto ogni risposta dell'assistant compaiono **badge** con le azioni eseguite (campo `tools` di `ChatMsg`, etichette in `CoachPanel`).
- La cronologia chat è in `sessionStorage` (si azzera alla chiusura della scheda).
- `crea_tappa` richiede una lega attiva (`legaId !== null`); se manca, restituisce un errore descrittivo.
- `crea_tappa` deve essere chiamato **una sola volta** con tutte le squadre nell'array. Il preamble e la descrizione del tool lo specificano esplicitamente. Se il modello lo chiama più volte con lo stesso nome, il guard `tappe.some(t => t.nome === nomeTappa)` blocca i duplicati.
- `sorteggia_gironi`, `genera_fasi_dirette`, `registra_risultato`, `concludi_tappa` usano `useAppStore.getState().tappe` per leggere lo stato aggiornato: combinato con l'esecuzione **in sequenza** dei tool dello stesso turno, ogni tool vede sempre gli effetti dei precedenti.
- L'avanzamento del vincitore nel bracket usa `nextBracketSlot(bracket, matchId, vincitoreId)` (in `utils/buildBracket.ts`), **lo stesso helper della UI** (`BracketSection`): la logica di promozione al round successivo è unica e non duplicata.
