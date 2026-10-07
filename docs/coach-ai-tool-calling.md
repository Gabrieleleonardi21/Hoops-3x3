# Coach AI — Tool Calling (azioni autonome)

## Panoramica

Il Coach AI può eseguire azioni nell'app in autonomo quando l'utente lo chiede esplicitamente.
Usa Groq (llama-3.3-70b-versatile) con il protocollo OpenAI function calling.

## File coinvolti

| File | Ruolo |
|---|---|
| `src/services/aiService.ts` | Chiamate HTTP a Groq; gestisce il ciclo tool call → risultato → risposta finale |
| `src/hooks/useCoachAI.ts` | Definisce i tool disponibili ed esegue le azioni: per le tappe chiama `tappaOps` e salva il risultato nello store con `replaceTappa` |
| `src/domain/tappaOps.ts` | Operazioni di tappa come funzioni pure (sorteggio, risultati, fasi dirette, conclusione): le stesse usate dall'interfaccia, testate in `tests/unit/tappaOps.test.ts` |

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
  1. Carica in parallelo squadre e giocatori dell'anagrafe condivisa dal server (`anagrafeApi`: lettura sempre fresca, per non registrare doppioni)
  2. Per ogni nome richiesto: cerca corrispondenza esatta, poi parziale (case-insensitive)
  3. Per le squadre trovate: popola `giocatori` dal loro roster, copia `regId`, `logo`, `rank`, `website`
  4. Per le squadre non trovate: le registra in anagrafe con i dati minimi (`saveSquadra` di `useAnagrafeStore`, così si aggiorna anche la cache letta dalle pagine); il roster resta vuoto, da completare manualmente
  5. Chiama `addTappa(tappa)` sullo store + naviga a `/lega/tappa/:id`
- **Nota:** Deve essere chiamato **UNA SOLA VOLTA** con tutte le squadre nell'array `squadre`.
- **Esempio:** *"Crea la tappa Roma Open con le squadre Ballers Roma, Street Kings e Wildcats"*

---

### `sorteggia_gironi`
- **Descrizione:** Esegue il sorteggio dei gironi per una tappa esistente.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `mode` (`"casuale"` o `"ranking"`)
- **Azione:**
  1. Trova la tappa per nome (parziale, case-insensitive) o usa l'ultima
  2. Chiama `sorteggia(tappa, modo)` di `tappaOps`: gironi con `buildGironi` (casuale) o `buildGironiSeeded` (a serpentina per ranking) e calendario con `buildMatches`; servono almeno 2 squadre
  3. Salva la nuova tappa con `replaceTappa` + naviga alla pagina tappa
- **Nota:** Usa `useAppStore.getState()` per leggere le tappe aggiornate dai tool precedenti dello stesso ciclo (la closure del hook è ferma all'ultimo render).
- **Esempio:** *"Sorteggia i gironi della tappa Roma Open"* oppure *"Fai il sorteggio per ranking"*

---

### `genera_fasi_dirette`
- **Descrizione:** Genera la fase a eliminazione diretta (bracket: semifinali, finale) dalla classifica dei gironi.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `qualificate` (squadre per girone che passano, default 2)
- **Prerequisiti:** gironi sorteggiati e **tutte** le partite dei gironi `done`.
- **Azione:**
  1. Chiama `generaFasiDirette(tappa, nPass)` di `tappaOps`, che valida (gironi conclusi, bracket non ancora generato) e costruisce il tabellone con `buildBracket` (cross-seeding 1°A vs 2°B…)
  2. Salva la nuova tappa con `replaceTappa` + naviga alla pagina tappa
- **Nota:** Con un solo girone `buildBracket` restituisce `[]` (nessun incrocio): `generaFasiDirette` risponde con un errore descrittivo.
- **Esempio:** *"Genera le fasi dirette"* oppure *"Crea il tabellone, passano le prime 2 di ogni girone"*

---

### `registra_risultato`
- **Descrizione:** Registra il punteggio di una partita, **sia dei gironi sia della fase a eliminazione diretta** (semifinali, finale).
- **Parametri obbligatori:** `squadra_a`, `punti_a`, `squadra_b`, `punti_b`
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `fase` (`"girone"` o `"diretta"`)
- **Azione:**
  1. Trova la tappa e cerca, tra le due squadre, sia la partita di girone non registrata sia il match di bracket non giocato (con entrambe le squadre note)
  2. Gestisce l'ordine A/B corretto (non inverte i punteggi se l'utente li da nell'ordine inverso)
  3. Girone → `registraRisultato(tappa, partitaId, { sa, sb })`. Bracket → `registraRisultatoBracket(tappa, matchId, pA, pB)`, che **fa anche avanzare il vincitore** allo slot TBD del round successivo. In entrambi i casi la nuova tappa si salva con `replaceTappa`
  4. La validazione è quella di `tappaOps`, la stessa dell'inserimento manuale: punteggi interi non negativi, nessun pareggio (FIBA 3x3) e, per i gironi, non oltre `target + 4`
- **Disambiguazione (zero ambiguità):** il bracket si genera solo a gironi conclusi, quindi quando esiste non c'è alcun girone aperto → al massimo **un** candidato. Nel caso limite di due candidati (es. un risultato di girone annullato dopo aver generato il bracket) il tool **non indovina**: chiede di specificare la fase, e il parametro `fase` permette di forzarla.
- **Nota:** Può essere chiamato più volte nello stesso turno per registrare più partite.
- **Esempio:** *"Risultato: Ballers Roma 21, Street Kings 15"* — *"Finale: Wildcats 22, Ballers Roma 18"*

---

### `concludi_tappa`
- **Descrizione:** Conclude e pubblica la tappa nell'Archivio circuito.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa)
- **Prerequisiti:** gironi sorteggiati, tutte le partite dei gironi `done`, **fase diretta completata se presente**, account non ospite
- **Azione:**
  1. Chiama `concludi(tappa)` di `tappaOps`, che valida che tutte le partite dei gironi siano registrate e che, se esiste il `bracket`, tutti i suoi match siano `done` (altrimenti blocca: la finale non può restare aperta). È la stessa regola del bottone "Concludi" dell'interfaccia
  2. Salva la tappa con `conclusa: true` tramite `replaceTappa`
  3. Aspetta che la coda dei salvataggi sia vuota (la tappa conclusa deve essere arrivata al server) e la pubblica con `pubblica` dello store, che manda al server solo l'id (`PUT /api/archivio/{tappaId}`): la copia la costruisce il server da ciò che ha salvato. È la stessa funzione della pagina della tappa. Se la tappa non arriva al server o la pubblicazione non riesce, la tappa resta conclusa e il risultato dello strumento dice il motivo e indica «Riapri» e poi «Concludi» nella pagina della tappa. Se invece un conflitto con un altro dispositivo ha rimesso nello store la tappa del server, non conclusa (o l'ha tolta, perché lì è stata eliminata), il risultato dice che la tappa non è pubblicata e che nella lega aperta non risulta conclusa, con il motivo. Il motivo passa da `senzaTag` (`<` e `>` diventano ‹ ›), perché può riportare il nome della tappa scritto sul server. Una rinomina della lega ancora in attesa parte prima della pubblicazione, ma non si controlla: se la PATCH fallisce l'errore compare solo nella barra degli avvisi e la copia pubblica porta il nome che il server ha
- **Esempio:** *"Concludi la tappa Roma Open"*

---

### `registra_squadra`
- **Descrizione:** Registra una nuova squadra nell'anagrafe condivisa del circuito.
- **Parametri obbligatori:** `nome`
- **Parametri opzionali:** `citta`, `anno`, `rank`, `referente`, `logo`, `website`, `instagram`, `note`
- **Azione:** `saveSquadra` di `useAnagrafeStore`: `POST /api/anagrafe/squadre` sul backend e aggiornamento della cache dell'anagrafe
- **Esempio:** *"Registra la squadra Ballers Roma, città Roma"*

---

### `registra_giocatore`
- **Descrizione:** Registra un nuovo giocatore nell'anagrafe condivisa del circuito.
- **Parametri obbligatori:** `nome`, `cognome`
- **Parametri opzionali:** `squadra`, `ruolo`, `nascita`, `citta`, `nazionalita`, `altezza`, `peso`, `numero`, `soprannome`, `esperienza`, `note`
- **Azione:** `saveGiocatore` di `useAnagrafeStore`: `POST /api/anagrafe/giocatori` sul backend e aggiornamento della cache dell'anagrafe
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

> Se il tool modifica una tappa, la regola va in `src/domain/tappaOps.ts` (funzione pura `(tappa, …) → Esito`, con il suo test in `tests/unit/tappaOps.test.ts`): nel tool ci si limita a leggere la tappa fresca, chiamare la funzione e salvare con `replaceTappa`.
>
> `str(args, key)` è un helper interno che legge stringhe con fallback a `""`.
> `findTappa(tappe, nome?)` è un helper interno che cerca per nome parziale o restituisce l'ultima tappa.
> `fetchSquadre()` / `fetchGiocatori()` sono helper interni che leggono l'anagrafe condivisa dal server (lista vuota in caso di errore).

### Esempi di tool futuri possibili

| Tool | Azione |
|---|---|
| `rinomina_lega` | `setLegaName(nome)` |
| `vai_a_anagrafe` | `navigate("/anagrafe")` |
| `aggiungi_video` | `addVideo(titolo, url)` sulla tappa attiva |

---

## Note tecniche

- Anagrafe: le **scritture** dei tool passano da `useAnagrafeStore` (`saveSquadra`, `saveGiocatore`, `updateSquadra`), che aggiorna il server e la cache letta dalle pagine (`useAnagrafe`); le **letture** (`fetchSquadre` / `fetchGiocatori`) vanno dirette al server con `anagrafeApi`, perché al Coach servono dati freschi per non registrare doppioni.
- L'AI chiama i tool **solo se l'utente lo chiede esplicitamente** (istruzione nel preamble).
- La chat in UI mostra messaggi user/assistant; i messaggi tool restano interni all'API, ma sotto ogni risposta dell'assistant compaiono **badge** con le azioni eseguite (campo `tools` di `ChatMsg`, etichette in `CoachPanel`).
- La cronologia chat è in `sessionStorage` (si azzera alla chiusura della scheda).
- `crea_tappa` richiede una lega attiva (`legaId !== null`); se manca, restituisce un errore descrittivo.
- `crea_tappa` deve essere chiamato **una sola volta** con tutte le squadre nell'array. Il preamble e la descrizione del tool lo specificano esplicitamente. Se il modello lo chiama più volte con lo stesso nome, il guard `tappe.some(t => t.nome === nomeTappa)` blocca i duplicati.
- `sorteggia_gironi`, `genera_fasi_dirette`, `registra_risultato`, `concludi_tappa` usano `useAppStore.getState().tappe` per leggere lo stato aggiornato: combinato con l'esecuzione **in sequenza** dei tool dello stesso turno, ogni tool vede sempre gli effetti dei precedenti. La tappa letta passa a `tappaOps` e il risultato viene salvato subito con `replaceTappa`, senza `await` in mezzo: due risultati ravvicinati non si sovrascrivono.
- Le regole di questi quattro tool (validazioni comprese) stanno in `src/domain/tappaOps.ts` e sono **le stesse funzioni chiamate dalla UI** (`useTappa`, `BracketSection`): una modifica al salvataggio di un risultato si fa in un posto solo. L'avanzamento del vincitore nel bracket è dentro `registraRisultatoBracket`, che usa `nextBracketSlot(bracket, matchId, vincitoreId)` di `utils/buildBracket.ts`.
- `annulla_risultato` è l'unico tool di tappa che aggiorna ancora lo store direttamente (`updateTappaPartita`).
