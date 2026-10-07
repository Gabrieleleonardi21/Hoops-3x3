# Coach AI — Tool calling (azioni autonome)

## Panoramica

Il Coach AI può eseguire azioni nell'app in autonomo quando l'utente lo chiede esplicitamente. Gli strumenti sono **10**
(elencati sotto); ognuno ha una definizione per il modello (`src/coach/toolDefs.ts`) e un esecutore (`src/coach/toolHandlers.ts`).

Il frontend parla solo con il backend, mai con Groq: ogni giro di conversazione è una `POST /api/coach/chat` con
`{ messages, tools }` (`chiamaCoach` in `src/services/aiService.ts`). Il backend tiene la chiave `GROQ_API_KEY`, sceglie il
modello (`GROQ_MODEL`, predefinito `openai/gpt-oss-120b`) e inoltra la richiesta a Groq con il protocollo OpenAI function
calling. Il browser non conosce né la chiave né il modello.

**Chi può usarlo.** Solo gli utenti registrati (vedi «Restrizione per gli ospiti»).

## File coinvolti

| File | Ruolo |
|---|---|
| `src/services/aiService.ts` | Chiamata HTTP al Coach del backend (`chiamaCoach`) e ciclo tool call → risultato → risposta finale (`askCoachWithTools`) |
| `src/coach/toolDefs.ts` | Le definizioni dei tool come le vede il modello (`COACH_TOOLS`) |
| `src/coach/toolHandlers.ts` | Una funzione per tool, senza React, nella `Map` `ESECUTORI`; `eseguiStrumento` la cerca per nome. Per le tappe chiama `tappaOps` e salva il risultato nello store con `replaceTappa` |
| `src/hooks/useCoachAI.ts` | La chat (messaggi, attesa, conferma in corso), il prompt di sistema e l'invio; passa ai tool navigazione, segnale della richiesta e richiesta di conferma (`ContestoStrumenti`) |
| `src/components/coach/CoachPanel.tsx` | Il pannello: messaggi, badge delle azioni eseguite (`TOOL_LABELS`), richiesta di conferma con «Annulla» e «Conferma» |
| `src/domain/tappaOps.ts` | Operazioni di tappa come funzioni pure (sorteggio, risultati, fasi dirette, conclusione): le stesse usate dall'interfaccia, testate in `tests/unit/tappaOps.test.ts` |
| `src/utils/buildCoachContext.ts` | Il riassunto della lega nel prompt (`<dati_lega>`) e i filtri `pulisci` / `senzaTag` per i nomi scritti dagli utenti |

I test del Coach sono in `tests/unit/coachStrumenti.test.ts` (definizioni ed esecutori corrispondono, e ogni strumento ha la sua
sezione `` ### `nome` `` in questo documento: uno strumento nuovo senza sezione fa fallire il test) e
`tests/unit/coachTools.test.ts` (strumenti, conferme, chat, pannello, errori del server).

## Flusso di esecuzione

```
Utente scrive → il modello risponde con uno o più tool_call
             → eseguiStrumento() esegue ogni azione IN SEQUENZA (async, legge/scrive gli store)
             → risultati rispediti al modello come messaggi tool
             → il modello può richiedere altri tool (nuovo round) … oppure
             → risponde con un messaggio di testo in chat
```

Il ciclo è un **loop agentico**: ripete finché il modello smette di chiedere tool o si raggiungono i limiti qui sotto. Questo
abilita i flussi multi-step in un solo messaggio (es. *"crea la tappa e sorteggia"*).

- **Ordine.** I tool dello stesso turno girano **in sequenza**, così un tool dipendente (es. `sorteggia_gironi` dopo
  `crea_tappa`) vede lo stato già aggiornato: gli strumenti leggono lega, tappe e utente con `useAppStore.getState()` nel momento
  in cui agiscono, non da una copia presa prima.
- **Limite dei round (`MAX_TOOL_ROUNDS` = 8).** Al massimo 8 chiamate al modello con gli strumenti a disposizione. Se anche
  all'ottavo il modello chiede ancora tool, il ciclo si ferma e parte una chiamata finale **senza** strumenti che costringe il
  modello a chiudere con una risposta (testo di ripiego: «Fatto!»). Il numero copre un flusso completo di tappa (crea →
  sorteggia → risultati → fasi dirette → risultati → concludi).
- **Guardia anti-stallo.** La firma di una chiamata è «nome dello strumento + argomenti» (il testo JSON del modello). Una
  chiamata con la stessa firma di una già fatta nella richiesta, riuscita o no, **non viene rieseguita**: il modello riceve
  `Azione "<nome dello strumento>" già chiamata con gli stessi argomenti in questa richiesta (vedi il suo risultato): non
  ripeterla, rispondi all'utente.` (il testo non dice «eseguita», perché la prima chiamata può essere fallita). Se un round è fatto **solo** di ricicli il ciclo si interrompe e parte
  la chiamata finale senza strumenti: un modello bloccato non brucia tutti i round.
- **Errori degli strumenti.** Uno strumento che fallisce non ferma gli altri. Argomenti che non sono un oggetto JSON: lo
  strumento non parte, il risultato è «Argomenti non validi». Un errore lanciato dallo strumento (un rifiuto di `tappaOps`, un
  403, la rete) diventa il suo risultato (`Errore: <motivo>`): il modello lo legge e lo spiega. Gli strumenti falliti o non partiti
  **non** hanno il badge sotto la risposta.
- **Richiesta abbandonata.** «Cancella» e il logout interrompono la richiesta (`AbortController` in `useCoachAI`): prima di ogni
  chiamata al modello e di ogni strumento si controlla il segnale, quindi non partono altre chiamate né altre azioni. Gli
  strumenti che leggono l'anagrafe prima di scrivere (`crea_tappa`, `aggiorna_squadra`) lo controllano di nuovo dopo la lettura.
  Le scritture già spedite al server finiscono comunque. Una conferma in attesa si chiude come «Annulla».
- **Tempo massimo.** 65 secondi per ogni chiamata alla chat (il server aspetta Groq fino a 60). Gli errori del backend arrivano
  all'utente così: 401 «Sessione scaduta», 429 «Limite richieste raggiunto», 503 «Coach AI non è configurato sul server»
  (manca `GROQ_API_KEY`), rete assente «Server non raggiungibile», 400 con il messaggio del server (es. «Conversazione troppo
  lunga»), il resto «Si è verificato un errore» (`errorMsg` in `useCoachAI.ts`).

### Come si sceglie la tappa

Tutti gli strumenti di tappa accettano `tappa_nome` (facoltativo):

- assente → l'**ultima** tappa della lega aperta;
- presente → il nome esatto (maiuscole a parte) oppure una parte del nome, purché si trovi in **una sola** tappa. Se la parte
  corrisponde a più tappe è un errore che chiede il nome completo (con «Roma Open» e «Roma Open 2», «Roma» non sceglie la prima);
- un `tappa_nome` non valido (un numero, un testo vuoto) è un errore, non diventa «l'ultima tappa»;
- nessuna tappa nella lega → errore «Nessuna tappa trovata».

### Come si sceglie la squadra dell'anagrafe

`crea_tappa` (per ogni nome in `squadre`) e `aggiorna_squadra` (per `nome`) trovano la squadra con la stessa regola delle tappe
(`trovaPerNome` in `toolHandlers.ts`, usata anche da `findTappa`; per le squadre la chiama `findSquadra`):

- vince il nome **esatto** (maiuscole a parte): con «Roma Kings» elencata prima di «Roma», chiedere «Roma» sceglie «Roma»;
- altrimenti basta una **parte** del nome, purché corrisponda a **una sola** squadra (con la sola «Roma Kings», «Kings» la trova);
- se la parte corrisponde a più squadre è un errore che elenca i nomi (passati da `pulisci`) e chiede il nome completo:
  `Più squadre in anagrafe corrispondono a "Roma": "Roma Kings", "Roma Stars". Indica il nome completo.` Per `crea_tappa` il
  controllo riguarda **tutti** i nomi richiesti ed è fatto prima di registrare qualsiasi squadra;
- nessuna corrispondenza: `aggiorna_squadra` risponde «non trovata in anagrafe», `crea_tappa` registra la squadra.

---

## Tool disponibili

### `crea_lega`
- **Descrizione:** Crea una nuova lega e la imposta come attiva.
- **Parametri:** `nome` (string, obbligatorio)
- **Azione:** `createLega(nome)` sullo store, poi apre `/lega`
- **Esempio:** *"Crea una lega chiamata Circuito Roma 2025"*

---

### `crea_tappa`
- **Descrizione:** Crea una tappa nella lega attiva, cercando le squadre per nome nell'anagrafe e caricando automaticamente i loro giocatori dal roster registrato.
- **Parametri obbligatori:** `nome`, `squadre` (array di nomi, da 2 a 64)
- **Parametri opzionali:** `luogo`, `data` (YYYY-MM-DD), `nGironi` (intero da 1 a metà delle squadre, al massimo 32; se manca: 2, oppure 1 con meno di 4 squadre)
- **Azione:**
  1. Controlla i limiti (`erroreLimitiTappa` di `tappaOps`: numero di squadre e di gironi, nome fino a 120 caratteri, luogo fino a 160, data vuota o aaaa-mm-gg) **prima** di toccare l'anagrafe: una tappa rifiutata non lascia squadre registrate
  2. Carica in parallelo squadre e giocatori dell'anagrafe condivisa dal server (`anagrafeApi`: lettura sempre fresca, per non registrare doppioni). Se una delle due letture non riesce lo strumento si ferma con l'errore «L'anagrafe condivisa non risponde (<motivo>): non ho registrato né modificato niente, riprova tra poco.»: non registra niente, perché con un elenco vuoto passerebbero per nuove squadre che esistono già
  3. Abbina **tutti** i nomi richiesti alle squadre dell'anagrafe con la regola di «Come si sceglie la squadra dell'anagrafe» (nome esatto, altrimenti una parte che corrisponde a una squadra sola); un nome che ne corrisponde a più ferma lo strumento con un errore, prima di registrare qualsiasi squadra
  4. Per le squadre trovate: popola `giocatori` con il roster dell'anagrafe, al massimo `MAX_ROSTER` (4, il tetto che l'interfaccia impone alle squadre di una tappa): i primi del roster. Gli altri restano fuori e il testo per il modello lo dice con le squadre e il numero di giocatori esclusi («Giocatori oltre il massimo di 4 per squadra, rimasti fuori dal roster (tenuti i primi dell'anagrafe): Alfa 2, Gamma 1. L'utente può sceglierli dalla pagina della tappa.»); le altre squadre non compaiono. Copia inoltre `regId`, `logo`, `rank`, `website`, `instagram`
  5. Per le squadre non trovate: le registra in anagrafe con i dati minimi (`saveSquadra` di `useAnagrafeStore`, così si aggiorna anche la cache letta dalle pagine); il roster resta vuoto, da completare a mano
  6. Se intanto la chat è stata cancellata o si è aperta un'altra lega non crea la tappa (le squadre già registrate restano in anagrafe, e con un'altra lega aperta l'errore le elenca); altrimenti `creaTappa` di `tappaOps` + `addTappa` sullo store, poi apre `/lega/tappa/:id`
- **Errori:** nessuna lega attiva; esiste già una tappa con lo stesso nome nella lega (il modello che lo richiama non crea doppioni); elenco squadre mancante o con un nome vuoto; un nome che corrisponde a più squadre dell'anagrafe; anagrafe che non risponde
- **Nota:** Deve essere chiamato **UNA SOLA VOLTA** con tutte le squadre nell'array `squadre`.
- **Esempio:** *"Crea la tappa Roma Open con le squadre Ballers Roma, Street Kings e Wildcats"*

---

### `sorteggia_gironi`
- **Descrizione:** Esegue il sorteggio dei gironi per una tappa esistente.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `mode` (`"casuale"`, il default, o `"ranking"`; un altro valore è un errore)
- **Conferma:** **sì, se la tappa ha già dei risultati** (vedi «Conferme»)
- **Azione:**
  1. Trova la tappa (vedi «Come si sceglie la tappa»)
  2. Se ha risultati, prova il sorteggio senza salvarlo (una tappa conclusa, o con meno di 2 squadre, è rifiutata **senza** chiedere niente) e poi chiede conferma
  3. Chiama `sorteggia(tappa, modo)` di `tappaOps`: gironi con `buildGironi` (casuale) o `buildGironiSeeded` (a serpentina per ranking) e calendario con `buildMatches`; un nuovo sorteggio riparte da zero (risultati e tabellone si perdono)
  4. Salva la nuova tappa con `replaceTappa` e apre la pagina della tappa
- **Nota:** A differenza dell'interfaccia, il Coach non controlla che ogni squadra abbia almeno 3 giocatori né che per il sorteggio per ranking ci siano i punti ranking (controlli che `useTappa` applica solo ai registrati, nella pagina): il flusso «crea la tappa e sorteggia» deve poter funzionare anche con squadre dal roster vuoto.
- **Esempio:** *"Sorteggia i gironi della tappa Roma Open"* oppure *"Fai il sorteggio per ranking"*

---

### `genera_fasi_dirette`
- **Descrizione:** Genera la fase a eliminazione diretta (bracket) dalla classifica dei gironi.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `qualificate` (squadre per girone che passano: intero da 1 in su, default 2; un valore diverso è un errore)
- **Prerequisiti:** gironi sorteggiati, **tutte** le partite dei gironi registrate, tabellone non ancora generato, almeno 2 gironi
- **Azione:**
  1. Chiama `generaFasiDirette(tappa, qualificate)` di `tappaOps`, che valida e costruisce il tabellone con `buildBracket`: un tabellone con tanti posti quanti la potenza di due che contiene tutte le qualificate (ottavi, quarti, semifinali, finale), teste di serie ordinate per piazzamento e a parità per % vittorie, media punti e differenza punti; le migliori passano il primo turno senza giocare (`bye`) se le qualificate non riempiono i posti; al primo turno si evitano, dove possibile, le rivincite tra squadre dello stesso girone
  2. Salva la nuova tappa con `replaceTappa` e apre la pagina della tappa
- **Nota:** Con un solo girone `buildBracket` restituisce `[]` (nessun incrocio): `generaFasiDirette` risponde con un errore descrittivo. L'interfaccia genera sempre con 2 qualificate per girone; il parametro `qualificate` esiste solo per il Coach.
- **Esempio:** *"Genera le fasi dirette"* oppure *"Crea il tabellone, passano le prime 2 di ogni girone"*

---

### `registra_risultato`
- **Descrizione:** Registra il punteggio di una partita, **sia dei gironi sia della fase a eliminazione diretta** (ottavi, quarti, semifinali, finale).
- **Parametri obbligatori:** `squadra_a`, `punti_a`, `squadra_b`, `punti_b` (i nomi anche in parte; un nome vuoto è un errore)
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa), `fase` (`"girone"` o `"diretta"`)
- **Conferma:** no
- **Azione:**
  1. Trova la tappa (deve essere sorteggiata) e cerca, tra le due squadre, sia la partita di girone non registrata sia il match di bracket non giocato (con entrambe le squadre note)
  2. Gestisce l'ordine A/B corretto (non inverte i punteggi se l'utente li dà nell'ordine inverso)
  3. Girone → `registraRisultato(tappa, partitaId, { sa, sb })`. Bracket → `registraRisultatoBracket(tappa, matchId, pA, pB)`, che **fa anche avanzare il vincitore** al turno successivo. In entrambi i casi la nuova tappa si salva con `replaceTappa`
  4. La validazione è quella di `tappaOps`, la stessa dell'inserimento manuale: punteggi interi non negativi, nessun pareggio (FIBA 3x3) e, per i gironi, non oltre `target + 4`; una tappa conclusa è rifiutata e, con la fase finale già generata, i gironi non cambiano più
- **Disambiguazione (zero ambiguità):** il bracket si genera solo a gironi conclusi, quindi quando esiste non c'è alcun girone aperto → al massimo **un** candidato. Nel caso limite di due candidati il tool **non indovina**: chiede di specificare la fase, e il parametro `fase` permette di forzarla. Se non trova nessuna partita da giocare tra le due squadre risponde «non trovata o già registrata».
- **Nota:** Registra solo il **totale** della squadra: non scrive il tabellino dei giocatori che l'interfaccia chiede ai registrati. Può essere chiamato più volte nello stesso turno per registrare più partite.
- **Esempio:** *"Risultato: Ballers Roma 21, Street Kings 15"* — *"Finale: Wildcats 22, Ballers Roma 18"*

---

### `annulla_risultato`
- **Descrizione:** Annulla il risultato di una partita **dei gironi** già registrata, riportandola a non disputata. Serve se l'utente segnala un errore di inserimento.
- **Parametri obbligatori:** `squadra_a`, `squadra_b` (anche in parte)
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa)
- **Conferma:** **sì, sempre** (vedi «Conferme»)
- **Azione:**
  1. Trova la tappa (sorteggiata) e, tra le sue partite dei gironi già registrate, quella delle due squadre; i match del tabellone non si annullano da qui
  2. Prova `annullaRisultato(tappa, partitaId)` di `tappaOps` senza salvarla: è la stessa regola di «Correggi» nell'interfaccia, quindi una tappa conclusa o con la fase finale già generata è rifiutata **senza** chiedere niente. Se durante l'attesa della conferma la partita è già tornata da giocare, non si salva una copia identica
  3. Chiede conferma; con «Conferma» salva la tappa con la partita `done: false` (i punteggi restano come bozza, la partita non conta più in classifica)
- **Esempio:** *"Annulla il risultato di Ballers Roma contro Street Kings"*

---

### `concludi_tappa`
- **Descrizione:** Conclude e pubblica la tappa nell'Archivio circuito.
- **Parametri opzionali:** `tappa_nome` (default: ultima tappa)
- **Prerequisiti:** gironi sorteggiati, tutte le partite dei gironi registrate, **fase diretta completata se presente**, account non ospite
- **Conferma:** **sì, sempre** (vedi «Conferme»)
- **Azione:**
  1. Un ospite (o l'assenza di un utente) è rifiutato: «richiede un account registrato»
  2. Prova `concludi(tappa)` di `tappaOps` senza salvare, che valida che tutte le partite dei gironi siano registrate e che, se esiste il `bracket`, tutti i suoi match siano `done` (altrimenti blocca: la finale non può restare aperta). È la stessa regola del bottone «Concludi» dell'interfaccia. Se rifiuta, non si chiede niente
  3. Chiede conferma; con «Conferma» salva la tappa con `conclusa: true` tramite `replaceTappa`
  4. Aspetta che la coda dei salvataggi sia vuota (la tappa conclusa deve essere arrivata al server) e la pubblica con `pubblica` dello store, che manda al server solo l'id (`PUT /api/archivio/{tappaId}`): la copia la costruisce il server da ciò che ha salvato. È la stessa funzione della pagina della tappa
  5. Gli esiti, che arrivano al modello come testo:
     - tutto riuscito: la tappa è conclusa e pubblicata;
     - la tappa non arriva al server o la pubblicazione non riesce: la tappa resta conclusa, e il risultato dice il motivo e indica «Riapri» e poi «Concludi» nella pagina della tappa;
     - un conflitto con un altro dispositivo ha rimesso nello store la tappa del server, non conclusa (o l'ha tolta, perché lì è stata eliminata): il risultato dice che la tappa non è pubblicata e che nella lega aperta non risulta conclusa, con il motivo.
     Il motivo passa da `senzaTag` (`<` e `>` diventano ‹ ›), perché può riportare il nome della tappa scritto sul server. Una rinomina della lega ancora in attesa parte prima della pubblicazione, ma non si controlla: se la PATCH fallisce l'errore compare solo nella barra degli avvisi e la copia pubblica porta il nome che il server ha
- **Esempio:** *"Concludi la tappa Roma Open"*

---

### `registra_squadra`
- **Descrizione:** Registra una nuova squadra nell'anagrafe condivisa del circuito.
- **Parametri obbligatori:** `nome`
- **Parametri opzionali:** `citta`, `anno`, `rank`, `referente`, `logo`, `website`, `instagram`, `note`
- **Azione:** `saveSquadra` di `useAnagrafeStore`: `POST /api/anagrafe/squadre` sul backend e aggiornamento della cache dell'anagrafe. Il roster parte vuoto
- **Esempio:** *"Registra la squadra Ballers Roma, città Roma"*

---

### `registra_giocatore`
- **Descrizione:** Registra un nuovo giocatore nell'anagrafe condivisa del circuito.
- **Parametri obbligatori:** `nome`, `cognome`
- **Parametri opzionali:** `squadra`, `ruolo`, `nascita`, `citta`, `nazionalita`, `altezza`, `peso`, `numero`, `soprannome`, `esperienza`, `note`
- **Azione:** `saveGiocatore` di `useAnagrafeStore`: `POST /api/anagrafe/giocatori` sul backend e aggiornamento della cache dell'anagrafe
- **Esempio:** *"Aggiungi il giocatore Marco Rossi, ruolo Playmaker, squadra Ballers Roma"*

---

### `aggiorna_squadra`
- **Descrizione:** Aggiorna i dati di una squadra già presente nell'anagrafe. Passa solo i campi da modificare.
- **Parametro obbligatorio:** `nome` (nome attuale, per trovarla: il nome esatto, maiuscole a parte, o una parte del nome che corrisponde a una squadra sola; se ne corrispondono più d'una è un errore che chiede il nome completo, vedi «Come si sceglie la squadra dell'anagrafe»)
- **Parametri opzionali:** `citta`, `referente`, `logo`, `website`, `instagram`, `anno`, `rank`, `note`
- **Azione:**
  1. Legge l'anagrafe dal server e trova la squadra (vedi «Come si sceglie la squadra dell'anagrafe»). Se il server non risponde l'errore dice il motivo vero («L'anagrafe condivisa non risponde (<motivo>)…»), non «non trovata»
  2. Aggiorna **solo** i campi passati e non vuoti (con nessun campo: errore «Nessun campo da aggiornare»; un campo non si può svuotare da qui); gli altri e il roster restano invariati
  3. `updateSquadra` di `useAnagrafeStore`: `PUT /api/anagrafe/squadre/{id}` e aggiornamento della cache. Il server accetta solo l'autore della voce o un ADMIN: con un altro utente la risposta è 403 e il modello lo legge come errore
- **Esempio:** *"Metti il logo https://… alla squadra Street Kings"*

---

## Conferme prima delle azioni distruttive (D4)

Tre azioni cancellano o rendono definitivo qualcosa: il nuovo **sorteggio** su una tappa con risultati, **`annulla_risultato`** e
**`concludi_tappa`**. Prima di eseguirle il Coach chiede conferma **nella chat** (non in una finestra a parte): sotto i messaggi
compare un riquadro con il titolo, il testo e due pulsanti, «Annulla» e «Conferma». Finché l'utente non sceglie, lo strumento
aspetta e nel pannello non compare «Il coach sta pensando…».

| Strumento | Quando chiede | Titolo | Testo |
|---|---|---|---|
| `sorteggia_gironi` | solo se la tappa ha risultati registrati (nei gironi o nel tabellone) | `Rifare il sorteggio di "<tappa>"?` | che cosa si perde, es. «Verranno eliminati il sorteggio e 1 risultato.» (`perditaRisultati` di `tappaOps`, la stessa frase dell'interfaccia) |
| `annulla_risultato` | sempre | `Togliere il risultato Alfa 21-15 Beta?` | «La partita di "<tappa>" torna da giocare e non conta più in classifica.» (il titolo non dice «Annullare»: accanto al pulsante «Annulla» si potrebbe premerlo volendo dire «sì, annulla il risultato») |
| `concludi_tappa` | sempre | `Concludere "<tappa>"?` | «La tappa viene pubblicata nell'Archivio circuito e da lì non si modifica più: per cambiarla andrà riaperta.» |

- **L'azione si prova prima di chiedere.** Se `tappaOps` la rifiuterebbe (tappa conclusa, gare ancora da giocare, fase finale già
  generata…) l'utente non vede nessuna conferma: il modello riceve l'errore e lo spiega.
- **«Annulla».** Lo strumento non fa niente: la tappa resta la stessa di prima (stessa istanza nello store), non parte nessun
  salvataggio e nessuna pubblicazione, e non compare il badge. Il modello riceve «Errore: L'utente ha annullato: azione non
  eseguita. Non riprovarla se non te lo chiede di nuovo.» e risponde all'utente; la guardia anti-stallo gli impedisce comunque di
  ripetere la stessa chiamata nella stessa richiesta. Vale lo stesso se la chat viene cancellata o l'utente esce mentre la
  conferma aspetta.
- **«Conferma».** L'azione riparte dalla tappa **di adesso** nello store (riletta per id), non da quella vista prima: un risultato
  registrato durante l'attesa non si perde. Se nel frattempo la tappa non è più nella lega aperta, il modello riceve un errore
  leggibile e niente si salva.
- **Il pannello può essere chiuso:** la richiesta resta nello store e ricompare alla riapertura.
- **Gli altri strumenti non chiedono conferma** (compresi `registra_risultato`, che scrive su una partita non ancora giocata, e
  `aggiorna_squadra`).

---

## Chiamate REST che gli strumenti provocano

Il Coach non chiama mai le API di leghe e tappe da solo: usa le stesse azioni dello store dell'interfaccia, quindi la tappa
viene salvata dalla **coda dei salvataggi** (`src/stores/saveQueue.ts`, 400 ms dopo l'ultima modifica, con la `versione` della
tappa e nuovi tentativi dopo 2, 5 e 15 secondi). Per un utente registrato, le chiamate sono:

| Strumento | Chiamate al backend |
|---|---|
| (ogni giro di conversazione) | `POST /api/coach/chat` — `aiService.chiamaCoach` |
| `crea_lega` | `POST /api/leghe` — `legheApi.create`, da `createLega` |
| `crea_tappa` | `GET /api/anagrafe/squadre` e `GET /api/anagrafe/giocatori` (insieme); `POST /api/anagrafe/squadre` per ogni squadra non trovata; poi, dalla coda, `POST /api/leghe/{legaId}/tappe` (tappa nuova) |
| `registra_squadra` | `POST /api/anagrafe/squadre` |
| `registra_giocatore` | `POST /api/anagrafe/giocatori` |
| `aggiorna_squadra` | `GET /api/anagrafe/squadre`; `PUT /api/anagrafe/squadre/{id}` |
| `sorteggia_gironi`, `genera_fasi_dirette`, `registra_risultato`, `annulla_risultato` | nessuna diretta: `replaceTappa` mette la tappa in coda → `PUT /api/tappe/{id}` (con la `versione` nota) |
| `concludi_tappa` | `replaceTappa` (tappa conclusa) → `pubblica`: prima si svuota la coda (`PUT /api/tappe/{id}` e, se c'è una rinomina in attesa, `PATCH /api/leghe/{id}`), poi `PUT /api/archivio/{tappaId}` senza corpo |

Un 409 (un altro dispositivo ha salvato la tappa) o gli altri errori della coda sono gestiti dallo store come per qualunque
modifica fatta a mano: avvisi nella barra sotto l'intestazione, tappa del server che prende il posto di quella locale.

---

## Restrizione per gli ospiti

Il Coach è riservato agli utenti registrati, su tre livelli:

1. **Interfaccia.** Se non c'è un utente o l'utente è un ospite (`user.guest`), `send` in `useCoachAI.ts` non chiama nessun
   endpoint: aggiunge la domanda e risponde in chat «Coach AI è riservato agli utenti registrati: crea un account gratuito dalla
   home per usarlo.» Il pulsante «Consigli personalizzati del Coach AI» dell'analisi del giocatore (`GiocatoreAnalisi`) compare
   solo con un account. Provato in `coachTools.test.ts` («riservato agli utenti registrati»): l'ospite riceve il messaggio fisso e
   `fetch` non viene chiamato.
2. **Backend.** `/api/coach/**` richiede il JWT (`anyRequest().authenticated()` in `SecurityConfig`, repository backend): senza,
   401, che l'app mostra come «Sessione scaduta: esci e accedi di nuovo per usare Coach AI.».
3. **Strumenti.** `concludi_tappa` ricontrolla l'utente prima di concludere e rifiuta un ospite («richiede un account
   registrato»), anche se per l'ospite i tool non arrivano mai fin lì. Provato eseguendo lo strumento direttamente, con un ospite e
   senza utente: nessuna richiesta di conferma, la tappa non cambia e non si pubblica.

La chat appartiene a chi l'ha scritta: cambiando utente (accesso, registrazione, uscita) si cancella, in memoria e nella
`sessionStorage`.

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
   → concludi_tappa (chiede conferma, poi pubblica nell'Archivio circuito)
```

Lo stesso flusso è indicato al modello nel prompt di sistema di `useCoachAI.ts`.

---

## Come aggiungere un nuovo tool

### 1. Aggiorna `ToolDef` se serve un tipo di parametro nuovo

Il tipo `ToolParamProp` in `aiService.ts` supporta scalari, array ed `enum`:
```ts
{ type: "string", description: "..." }
{ type: "string", enum: ["a", "b"], description: "..." }
{ type: "array",  description: "...", items: { type: "string" } }
```

### 2. Aggiungi la definizione in `COACH_TOOLS` (src/coach/toolDefs.ts)

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

Il backend accetta al massimo 20 strumenti per richiesta e 50.000 caratteri di definizioni (`CoachAiService`).

### 3. Aggiungi l'esecutore in `src/coach/toolHandlers.ts`

Una funzione per tool, con lo stesso nome della definizione nella `Map` `ESECUTORI` (il test `coachStrumenti.test.ts`
controlla che definizioni ed esecutori corrispondano):

```ts
/** Che cosa fa il tool, e perché quando serve */
async function eseguiNomeTool(args: Argomenti, ctx: ContestoStrumenti): Promise<string> {
  // Lo stato si legge con getState() nel momento in cui il tool agisce: altri tool dello stesso turno possono averlo cambiato
  const tappe = useAppStore.getState().tappe;
  const valore = obbligatorio(args, "param", "il parametro");
  // azione sullo store o sul server (può essere async); ctx.vai(percorso) apre una pagina, ctx.chiediConferma(...) chiede conferma
  return `Azione completata: ${valore}`;
}

const ESECUTORI = new Map<string, Esecutore>([
  // …
  ["nome_tool", eseguiNomeTool],
]);
```

### 4. Aggiungi l'etichetta del badge in `CoachPanel.tsx`

`TOOL_LABELS` (al passato: «Squadra aggiornata») dà il testo del badge sotto la risposta; senza, il badge mostra il nome del tool.

### 5. Documenta lo strumento in questo file

Una sezione `` ### `nome_tool` `` in «Tool disponibili», come le altre: `coachStrumenti.test.ts` controlla che ogni strumento ne abbia una.

> Se il tool modifica una tappa, la regola va in `src/domain/tappaOps.ts` (funzione pura `(tappa, …) → Esito`, con il suo test in `tests/unit/tappaOps.test.ts`): nel tool ci si limita a leggere la tappa fresca, chiamare la funzione e salvare con `applica`.
>
> Se l'azione cancella o rende definitivo qualcosa, **chiedi conferma** (D4): prima `prova(tappa, operazione)` (così l'utente non conferma un'azione che verrebbe rifiutata), poi `await confermata(ctx, titolo, testo)`, poi `applica`. Un titolo che dice «Annullare…» è da evitare: confonde con il pulsante «Annulla».
>
> Gli aiuti interni di `toolHandlers.ts`:
> `str(args, key)` legge una stringa con ripiego a `""`; `obbligatorio(args, key, cosa)` la vuole non vuota, altrimenti l'errore dice che cosa manca; `numero(args, key)` legge un numero (o un testo che lo contiene).
> `tappaRichiesta(args)` trova la tappa di `tappa_nome` (nome esatto, o una parte che corrisponde a una tappa sola) oppure l'ultima; `findSquadra(squadre, nome)` fa lo stesso con le squadre dell'anagrafe. Tutte e due usano `trovaPerNome`: una regola sola per scegliere per nome.
> `prova(tappa, operazione)` / `applica(tappa, operazione)` eseguono una funzione di `tappaOps` senza salvare / salvando sulla tappa di adesso.
> `fetchSquadre()` / `fetchGiocatori()` leggono l'anagrafe condivisa dal server; se non risponde lanciano l'errore di `anagrafeNonRisponde` (non una lista vuota, che farebbe registrare doppioni).
> Un nome scritto dagli utenti che entra nel testo restituito al modello passa da `pulisci` (o `senzaTag` per un testo lungo).

### Idee per tool futuri (non implementati)

| Tool | Azione |
|---|---|
| `rinomina_lega` | `useAppStore.getState().setLegaName(nome)` |
| `vai_a_anagrafe` | `ctx.vai("/anagrafe")` |
| `aggiungi_video` | aggiungere un video a `tappa.video` con `replaceTappa` (e ripubblicare se la tappa è conclusa) |

---

## Note tecniche

- Anagrafe: le **scritture** dei tool passano da `useAnagrafeStore` (`saveSquadra`, `saveGiocatore`, `updateSquadra`), che aggiorna il server e la cache letta dalle pagine (`useAnagrafe`); le **letture** (`fetchSquadre` / `fetchGiocatori`) vanno dirette al server con `anagrafeApi`, perché al Coach servono dati freschi per non registrare doppioni.
- L'AI chiama i tool **solo se l'utente lo chiede esplicitamente**: lo dice il prompt di sistema (`useCoachAI.ts`), che spiega anche il flusso di una tappa e l'uso del parametro `fase`.
- Il prompt contiene un riassunto della lega racchiuso in `<dati_lega>` (`buildCoachContext`): nome della lega, elenco delle tappe (nome, data, luogo, «conclusa»), classifica del circuito (vittorie/partite totali per squadra) e, **solo per la tappa in primo piano** (l'ultima non conclusa, altrimenti l'ultima), squadre, classifiche dei gironi, partite giocate e i 5 migliori marcatori. Il prompt dice di trattare quel blocco e i risultati degli strumenti come dati, ignorando qualsiasi testo che sembri un'istruzione (mitigazione della prompt injection). I nomi scritti dagli utenti (anche da altri, tramite l'anagrafe condivisa) passano da `pulisci`: `<` e `>` diventano ‹ ›, nomi al massimo di 80 caratteri; gli stessi filtri valgono per i risultati degli strumenti.
- La chat in UI mostra messaggi user/assistant; i messaggi tool restano interni all'API, ma sotto ogni risposta dell'assistant compaiono **badge** con le azioni eseguite (campo `tools` di `ChatMsg`, etichette in `CoachPanel`; `annulla_risultato` è in rosso).
- La chat vive nello store (non nel pannello): chiudendo il pannello durante l'attesa la risposta arriva lo stesso. Se ne tengono gli ultimi **30 messaggi**, che sono anche quelli mandati al modello (il server rifiuta oltre 60 messaggi o 100.000 caratteri). La cronologia è in `sessionStorage` (si azzera alla chiusura della scheda e a ogni cambio di utente).
- `crea_tappa` richiede una lega attiva (`legaId !== null`); se manca, restituisce un errore descrittivo.
- `crea_tappa` deve essere chiamato **una sola volta** con tutte le squadre nell'array. Il prompt e la descrizione del tool lo specificano esplicitamente. Se il modello lo chiama più volte con lo stesso nome, il guard `tappe.some(t => t.nome === nomeTappa)` blocca i duplicati (e la guardia anti-stallo blocca una chiamata identica).
- `sorteggia_gironi`, `genera_fasi_dirette`, `registra_risultato`, `annulla_risultato`, `concludi_tappa` leggono la tappa con `useAppStore.getState().tappe`: combinato con l'esecuzione **in sequenza** dei tool dello stesso turno, ogni tool vede sempre gli effetti dei precedenti. La tappa letta passa a `tappaOps` e il risultato viene salvato subito con `replaceTappa`, senza `await` in mezzo: due risultati ravvicinati non si sovrascrivono.
- Le regole di questi strumenti (validazioni comprese) stanno in `src/domain/tappaOps.ts` e sono **le stesse funzioni chiamate dalla UI** (`useTappa`, `BracketSection`): una modifica al salvataggio di un risultato si fa in un posto solo. I controlli sui roster e sul tabellino dei giocatori restano invece nella sola interfaccia (`useTappa`). L'avanzamento del vincitore nel bracket è dentro `registraRisultatoBracket`, che usa `nextBracketSlot(bracket, matchId, vincitoreId)` di `utils/buildBracket.ts`.
- Con la lega aperta che cambia mentre uno strumento aspetta (un'altra lega, la tappa eliminata) la modifica non si salva e il modello riceve un errore: `applica` rilegge la tappa per id e non scrive su una tappa che non c'è più.
