# HOOP 3X3

App web per la gestione di un circuito italiano di basket 3x3: tornei, gironi, statistiche e classifiche.

## Funzionalità

- **Lega** — crea e configura la tua lega con nome, stagione e regole personalizzate
- **Tappe** — organizza tornei con sorteggio gironi (casuale o con teste di serie), calendario partite e avanzamento automatico
- **Live scoring** — inserisci i punteggi in tempo reale con log eventi (canestro da 1, canestro da 2, fallo, timeout)
- **Statistiche** — traccia punti, rimbalzi, assist, palle rubate e stoppate per ogni giocatore
- **Anagrafe** — archivio centralizzato di giocatori e squadre (con logo e sito web cliccabile) riutilizzabile tra le tappe; i dati personali (data di nascita, misure, note, autore) li vede solo chi ha un account
- **Archivio** — storico di tutte le tappe concluse con classifiche finali
- **Leaderboard** — classifiche individuali per categoria statistica su tutta la stagione
- **Video** — galleria di highlight e partite (link YouTube)
- **Coach AI** — assistente virtuale che conosce le regole FIBA 3x3 e i dati della lega corrente (gratuito via Groq API)
- **Home dashboard** — tappa in corso, classifica live, ultimo risultato registrato, prossime partite e leader
- **Profilo giocatore** — pagina `/giocatore/:id` con statistiche aggregate, andamento punti e storico tappe
- **Campetti** — ricerca campi con filtri e mappa schematica (*dati di esempio*, dichiarati da un avviso in cima alla pagina; senza persistenza)
- **Sessione persistente** — login e dati salvati nel browser; la sessione si rinnova da sola e «Esci» la chiude anche sul server; gli ospiti hanno dati locali separati

### Regole FIBA 3x3 (default)
| Parametro | Valore |
|---|---|
| Punti per vincere | 21 |
| Durata massima | 10 minuti |
| Shot clock | 12 secondi |
| Overtime | primo a 2 punti |

## Stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite 6](https://vitejs.dev/) — bundler e dev server
- [Zustand](https://zustand-demo.pmnd.rs/) — state management
- [React Router 7](https://reactrouter.com/) — routing
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — form e validazione
- [Tailwind CSS 4](https://tailwindcss.com/) — styling; i token del design system "Asphalt" sono in `src/index.css` (`@theme`), documentati in `docs/design-system.md`; [tailwind-merge](https://github.com/dcastil/tailwind-merge) unisce le classi dei pulsanti, così quelle passate dall'esterno vincono su quelle della variante
- Backend [Spring Boot 4](https://spring.io/projects/spring-boot) (Java 25) con Spring Security + JWT, JPA/Hibernate e PostgreSQL — repo separato [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend)
- `localStorage` — lega dell'Ospite, JWT di accesso e utente di sessione (dati che restano nel browser)

## Avvio rapido

Servono Node 20.19 o superiore, JDK 25 e PostgreSQL in ascolto su `localhost:5432` (Maven lo scarica il wrapper `./mvnw` del backend).

**1. Backend** — clona [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend) e segui il suo README (crea un database `hoop3x3` vuoto, compila `env.properties`, poi `./mvnw spring-boot:run`: le tabelle le crea Flyway all'avvio, non c'è nessuno script da eseguire):

```bash
git clone https://github.com/Gabrieleleonardi21/hoop3x3-backend.git
cd hoop3x3-backend && ./mvnw spring-boot:run
```

L'API risponde su `http://localhost:3001` (Hibernate gira in `validate`: se lo schema non combacia con le entity si ferma all'avvio con un messaggio chiaro).

**2. Frontend**

```bash
npm install
npm run dev
```

L'app è disponibile su `http://localhost:5173`; in sviluppo le chiamate a `/api` passano dal proxy di Vite verso il backend.

In produzione la strada più semplice è un reverse proxy (su Render lo fa la rewrite del Blueprint, vedi «Deploy su Render») che serve frontend e API sulla stessa origine: lascia `VITE_API_URL` vuoto e la sessione si rinnova da sola (nel backend servono solo `CORS_ORIGINS` con l'origine pubblica del frontend e, con HTTPS, `AUTH_COOKIE_SECURE=true`). Se invece il backend ha un'origine propria, imposta `VITE_API_URL` con quell'origine (vedi `.env.example`) e metti l'origine del frontend in `CORS_ORIGINS` del backend: il login funziona, ma il cookie di refresh non viaggia e la sessione dura quanto il JWT (30 minuti) finché non si completano i passi di «Sessioni e refresh token» nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).

## Deploy su Render

`render.yaml` è un [Blueprint](https://render.com/docs/infrastructure-as-code) che crea tutto il progetto: il frontend come sito statico, il backend come container Docker (dal `Dockerfile` di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend)) e un database PostgreSQL, tutti nella regione di Francoforte.

Il sito statico inoltra `/api/*` al backend con una regola di rewrite: per il browser pagina e API hanno la stessa origine, quindi `VITE_API_URL` resta vuota e la sessione si rinnova da sola con il cookie di refresh, senza i passi per origini diverse. Ogni altro percorso torna a `index.html`, così React Router gestisce anche i link diretti (per esempio `/tappa/<id>`).

**Primo deploy**

1. Su Render collega l'account GitHub con l'accesso a tutti e due i repository (`Hoops-3x3` e `hoop3x3-backend`).
2. Dashboard → **New → Blueprint** → scegli questo repository: Render legge `render.yaml` e mostra i tre servizi.
3. Compila i valori richiesti: `ADMIN_EMAIL` e `ADMIN_PASSWORD` (almeno 8 caratteri, diversa da `admin123`, altrimenti l'admin non viene creato) e, facoltativa, `GROQ_API_KEY` per il Coach AI. `JWT_SECRET` lo genera Render, i dati del database arrivano da soli.
4. Al primo avvio il backend crea le tabelle con le migrazioni di Flyway (V1-V4: nessuno script da eseguire e nessuna variabile da impostare) e l'admin.
5. Render considera il backend pronto quando `/actuator/health` risponde 200, cioè con server e database funzionanti: un deploy rotto non sostituisce quello attivo.

**Dopo il deploy**

- Controlla gli URL assegnati. Oggi sono `https://hoop3x3.onrender.com` (frontend) e `https://hoop3x3-api-06m1.onrender.com` (backend: `hoop3x3-api.onrender.com` era già di un altro account e Render ha aggiunto il suffisso). Se cambiano, o con un nuovo Blueprint, aggiorna i punti segnati con «URL» in `render.yaml` (le rewrite di `/api/*` e `/actuator/health` e `CORS_ORIGINS`) oppure gli stessi valori nella dashboard. Con un dominio personalizzato vale lo stesso per `CORS_ORIGINS`.
- Un 503 con la pagina «Service Suspended» su login o registrazione vuol dire che la rewrite di `/api/*` punta a un servizio che non è il tuo: confronta l'indirizzo in `render.yaml` con quello mostrato nella dashboard del backend.
- Prova login, ricarica della pagina e un salvataggio: un 403 «Invalid CORS request» sulle POST vuol dire che `CORS_ORIGINS` non coincide con l'origine del frontend.
- Per i dati di prova imposta `SEED_DEMO=true` sul backend e riavvialo.
- Il Blueprint imposta sul backend `SERVER_FORWARD_HEADERS_STRATEGY=native` e `LIMITE_AUTH_AL_MINUTO=60`: dietro la rewrite il limite di login, registrazione e rinnovo potrebbe contare un solo indirizzo per tutto il sito, e 60 è il valore provvisorio finché non si verifica quale indirizzo arriva. Come verificarlo e quando riabbassare il limite: «Limiti di frequenza» nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend). Un servizio creato prima della fase 2 può avere ancora `DB_INIT_MODE` nella dashboard: non ha più effetto e si può togliere.

**Piani free** — il backend si spegne dopo 15 minuti senza richieste e la prima richiesta dopo la pausa aspetta il riavvio della JVM (anche più di un minuto, oltre i 15 secondi di attesa del client: la prima chiamata può fallire con «Il server non risponde»). Il database free scade dopo 30 giorni. Per ridurre l'attesa l'app chiama `/actuator/health` appena si apre (`svegliaServer` in `src/services/api.ts`): il backend riparte mentre l'utente guarda la home, e di solito al login è già pronto. Per una demo dal vivo conviene comunque il piano starter del backend, oppure aprire l'app qualche minuto prima.

Ogni push su `main` di uno dei due repository ripubblica il servizio corrispondente.

**Ordine di pubblicazione della fase 2** — frontend e backend non vanno online nello stesso istante, quindi l'ordine conta: prima questo frontend, subito dopo il backend, in un momento senza tornei in corso (nessuno sta salvando una tappa), poi si ricaricano le schede aperte. Perché non il contrario e che cosa succede nei minuti tra le due pubblicazioni: sezione «Ordine di pubblicazione della fase 2» nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Avvia il dev server con hot reload |
| `npm run build` | Build di produzione |
| `npm run preview` | Anteprima della build di produzione |
| `npm run test` | Esegue i test unitari (Vitest) |
| `npm run test:e2e` | Esegue i test end-to-end (Playwright) |
| `npm run lint` | Linting del codice sorgente |

## Coach AI (opzionale)

Il Coach AI usa [Groq](https://console.groq.com/) (tier gratuito, modello `openai/gpt-oss-120b`) attraverso il backend (`POST /api/coach/chat`), così la chiave non arriva mai al browser. Impostala nell'`env.properties` del backend:

```properties
GROQ_API_KEY=gsk_...
```

Senza chiave il Coach risponde "non configurato" e il resto dell'app funziona normalmente. Il Coach è riservato agli utenti registrati.

## API REST

Tutte le risposte di errore hanno il formato `{ "message": "...", "timestamp": "..." }`. Gli endpoint protetti richiedono `Authorization: Bearer <jwt>`.

| Metodo | Endpoint | Accesso | Descrizione |
|---|---|---|---|
| POST | `/api/auth/register` | pubblico | Crea l'account (ruolo `USER`), imposta il cookie di refresh e restituisce token + utente |
| POST | `/api/auth/login` | pubblico | Login, imposta il cookie di refresh e restituisce token + utente |
| POST | `/api/auth/refresh` | pubblico, con il cookie di refresh | Ruota il refresh token e restituisce un nuovo token + utente |
| POST | `/api/auth/logout` | pubblico | Revoca il refresh token e cancella il cookie (204) |
| GET | `/api/auth/me` | login | Utente del token corrente |
| GET | `/api/utenti` | ADMIN | Elenco utenti |
| GET/POST | `/api/leghe` | login | Indice leghe dell'utente / nuova lega (anche import con `tappe`) |
| GET/PATCH/DELETE | `/api/leghe/{id}` | proprietario | Dettaglio con tappe / rinomina / elimina |
| POST | `/api/leghe/{id}/tappe` | proprietario | Nuova tappa (id UUID generato dal client), con la `versione` 0 (409 se esiste già) |
| PUT/DELETE | `/api/tappe/{id}` | proprietario | Sostituisce la tappa, con la `versione` dell'ultima risposta (400 se manca, 409 se nel frattempo un altro dispositivo l'ha salvata; il 200 porta la versione nuova) / elimina la tappa (409 se salvata nello stesso istante: la tappa resta) |
| GET | `/api/anagrafe/giocatori`, `/squadre` | pubblico | Anagrafe circuito |
| POST | `/api/anagrafe/giocatori`, `/squadre` | login | Nuova voce (autore = utente) |
| PUT/DELETE | `/api/anagrafe/giocatori/{id}`, `/squadre/{id}` | autore o ADMIN | Modifica / elimina |
| GET | `/api/archivio` | pubblico | Elenco sintetico delle tappe pubblicate, già dalla più recente: per ogni voce `tappaId`, `nome`, `luogo`, `data`, `nSquadre`, `lega`, `autore`, `ts`, senza la tappa intera. Il client lo valida (zod) e non lo riordina: una risposta con un'altra forma, come quella di prima, dà l'errore con «Riprova» |
| GET | `/api/archivio/{tappaId}` | pubblico | Dettaglio: la tappa intera con lega, autore e `ts` (404 se non c'è) |
| PUT | `/api/archivio/{tappaId}` | proprietario della lega o ADMIN | Pubblica o ripubblica una tappa conclusa, senza corpo: la copia la costruisce il server da ciò che ha salvato (404 se la tappa non esiste, 403 se non è sua, 409 se non è conclusa) |
| DELETE | `/api/archivio/{tappaId}` | autore o ADMIN | Ritira la pubblicazione |
| GET | `/api/coach/status` | login | `{ available }` (chiave Groq configurata) |
| POST | `/api/coach/chat` | login | Proxy verso Groq (messaggi + tool in formato OpenAI) |

Un utente `ADMIN` iniziale viene creato al primo avvio dalle proprietà `ADMIN_EMAIL` / `ADMIN_PASSWORD` di `env.properties`.

## Struttura del progetto

```
src/
├── components/       # Componenti UI suddivisi per dominio
│   ├── anagrafe/     # Giocatori e squadre
│   ├── archivio/     # Storico tappe
│   ├── auth/         # Login e registrazione
│   ├── coach/        # Pannello Coach AI
│   ├── gironi/       # Gestione gironi e classifiche
│   ├── layout/       # Header (con navigazione) e Hero
│   ├── profile/      # Sparkline del profilo giocatore
│   ├── leaderboard/  # Classifiche stagionali
│   ├── partita/      # Live scoring e statistiche
│   ├── squadra/      # Roster editor
│   ├── tappa/        # Gestione tappa
│   ├── ui/           # Componenti base (Button, Input, Card, Badge, StatTile, Section, Modal, Icon…)
│   └── video/        # Galleria video
├── constants/        # Regole, ruoli, tipi di evento
├── data/             # Dati di esempio (campetti)
├── domain/           # Operazioni di tappa come funzioni pure (sorteggio, risultati, fasi dirette, conclusione)
├── hooks/            # Custom hooks
├── pages/            # Pagine dell'app
├── services/         # Client HTTP (api.ts), servizi REST (leghe, anagrafe, archivio, auth) e AI
├── stores/           # Store Zustand: stato globale (useAppStore) e cache dell'anagrafe (useAnagrafeStore)
├── types/            # Definizioni TypeScript
└── utils/            # Funzioni di utilità (gironi, classifica, ecc.)
```

## Design system

Tema unico dark "Asphalt": palette, font (Barlow Condensed + IBM Plex Sans), scala e regole di
accessibilità sono in [`docs/design-system.md`](docs/design-system.md). I mockup di riferimento
(Stitch) sono in `reference/stitch-screens/`, la hero in `reference/hero/`.

## Dati e persistenza

- **Utente registrato**: leghe e tappe sono sul server (`leghe`, `tappe`), l'anagrafe e l'archivio sono condivisi tra tutti gli utenti. Lo store aggiorna subito lo stato in memoria e salva in background.
  - **Coda dei salvataggi.** Creazione e modifiche delle tappe passano da una coda dei salvataggi (`src/stores/saveQueue.ts`): la tappa intera parte 400 ms dopo l'ultima modifica (POST per una tappa nuova, poi PUT), con una sola richiesta alla volta per tappa e sempre l'ultima versione. Se la rete manca, il server non risponde entro il tempo massimo, ha un guasto (5xx) o respinge il JWT senza che il rinnovo riesca (401), la coda riprova da sola dopo 2, 5 e 15 secondi, poi alla modifica successiva. Intanto una barra sotto l'intestazione dice quante tappe hanno modifiche non salvate e perché, con «Riprova ora», e resta finché tutto è salvato; i dati rifiutati dal server (gli altri errori 4xx) non si ritentano e compaiono in una riga a parte della barra, una frase per tappa, che un errore arrivato dopo non copre e che non si chiude: resta finché è vera, cioè finché la tappa non si salva, non si elimina o non si riapre la lega (sul server c'è la versione di prima). La frase dice che cosa fare: correggere la tappa, oppure riaprire la lega per tornare alla versione salvata sul server; se la tappa è di un'altra lega la nomina, e dice che la versione rifiutata non è più in memoria (aprendo l'altra lega lo store l'ha sostituita). «Esci» salva prima ciò che è in attesa (anche la rinomina della lega) e, se qualche tappa non arriva al server o ha nella lega aperta un salvataggio rifiutato, chiede conferma prima di uscire; un rifiuto di un'altra lega non conta, perché uscire non perde niente che sia ancora qui. Alla chiusura della pagina le versioni non ancora confermate dal server partono subito con keepalive, compresa quella di un salvataggio in corso (il browser lo interrompe), senza tempo massimo e senza aspettare un rinnovo del JWT. La DELETE di una tappa parte solo quando il suo salvataggio in volo è finito («Esci» la aspetta, e se la pagina si chiude prima parte subito con keepalive; un 404 della DELETE vuol dire che la tappa non c'è già più). Eliminando una lega i salvataggi in attesa delle sue tappe si fermano, e un nuovo tentativo partito mentre la DELETE della lega è in corso, che riceve 404, non è un errore.
  - **Versioni e conflitti.** Ogni tappa ha un numero di `versione`, che decide il server: la PUT manda quello dell'ultima risposta (GET della lega, POST o PUT) e, al 200, lo sostituisce con quello della risposta senza toccare le modifiche fatte nel frattempo. Se un altro dispositivo, o un'altra scheda, ha salvato la tappa nel frattempo, il server risponde 409: l'app rilegge la lega, mostra la tappa com'è sul server, scarta le modifiche non ancora salvate di quella tappa (rimandarle cancellerebbe il lavoro dell'altro) e lo dice nella barra degli avvisi, in una riga a parte che nomina tutte le tappe coinvolte finché non si chiude (un errore arrivato dopo non la nasconde); una pubblicazione in corso non parte. Se la tappa sul server non c'è più, l'ha eliminata un altro dispositivo: esce anche dallo store, con l'avviso. Di solito però una tappa eliminata altrove dà 404 alla PUT, non 409, perché il server controlla che la tappa esista prima della versione: anche dopo un 404 l'app rilegge la lega e, se la tappa non c'è più, la toglie allo stesso modo (niente più errore a ogni modifica né pubblicazione bloccata); se c'è, il 404 resta un salvataggio rifiutato. Se invece la tappa del server è uno dei salvataggi di questo dispositivo rimasti senza risposta (tempo scaduto mentre il server ripartiva, salvataggio alla chiusura della pagina; se ne ricordano gli ultimi 20 per tappa, senza doppioni), il conflitto è suo: prende la versione del server e rimanda le modifiche, senza avviso; un secondo 409 dopo quel nuovo invio fa valere la tappa del server. Lo stesso vale per il 409 della POST (tappa già creata): se la tappa del server è un corpo di questo dispositivo si passa alla PUT con la versione letta, altrimenti vale quella del server, con l'avviso. Il confronto normalizza i campi come il server (`src/utils/stessaTappa.ts`: spazi ai lati, campi assenti, blocchi di gioco come valori) e non guarda la versione. Una pagina aperta prima dell'aggiornamento del server riceve 400 «Manca la versione»: rilegge la lega e rimanda una volta. Una tappa che un altro dispositivo salva mentre la si elimina (409 sulla DELETE) torna al suo posto, com'è sul server, con un avviso; se invece il salvataggio arrivato insieme era uno di questo dispositivo rimasto senza risposta, la DELETE si rimanda una volta, senza avviso. La versione nota non scende mai, e una lettura della lega partita prima di un salvataggio o di un conflitto non riporta indietro i dati. Riaprendo la lega già aperta, per una tappa con un salvataggio in attesa o ancora in corso, o letta più vecchia della versione nota, vale la copia sullo schermo, che è sempre la più recente: la coda manda proprio quella, la risposta di un salvataggio ne cambia solo la versione e un conflitto la sostituisce con la tappa del server. Una tappa creata mentre la lettura era in corso resta anche se la lettura non la contiene; una che il server aveva già e che manca dalla lettura l'ha eliminata un altro dispositivo, ed esce. Non torna una tappa eliminata qui mentre la lettura era in corso, né una che un salvataggio di qui ha trovato eliminata altrove nel frattempo. Tornando da un'altra lega valgono le versioni non ancora confermate e, se un conflitto si è risolto mentre la lega era chiusa, la tappa del server. La versione non entra nel file della lega esportato e non riguarda l'ospite.
  - **Pubblicazione.** La pubblicazione nell'Archivio (alla conclusione di una tappa, dopo un video aggiunto a una tappa conclusa, dal Coach AI) manda al server solo l'id (`pubblica` dello store) e parte dopo che la coda si è svuotata: la copia pubblica la costruisce il server da ciò che ha salvato. Se la tappa non arriva al server (rete assente, dati rifiutati) non si pubblica e l'errore dice perché. Una rinomina della lega in attesa parte prima, ma non si controlla: se la PATCH fallisce la copia pubblica porta il nome che il server ha. La pagina di una tappa conclusa dice «pubblicata» solo se lo è: all'apertura lo chiede all'archivio (`GET /api/archivio/{tappaId}`, il 404 vuol dire che non c'è) e, se la pubblicazione non è riuscita, lo dice col motivo e indica «Riapri» e poi «Concludi». «Pubblicata» o «non pubblicata» solo se l'esito è certo: con rete assente o tempo scaduto sulla PUT la pagina dice solo «Conclusa» con il motivo, perché il server potrebbe aver pubblicato. «Riapri» toglie la tappa dall'archivio prima di riaprirla (anche nel dubbio, tollerando il 404): se il server non ci riesce la tappa resta conclusa e la pagina lo dice, e resta disattivato mentre è in corso una pubblicazione avviata dalla pagina (conclusione o video): quelle del Coach AI non lo disattivano. Un 502, 503 o 504 sulla PUT conta come esito ignoto, come la rete assente: dietro un proxy il server può aver pubblicato lo stesso. L'eliminazione di una tappa o di una lega non ritira niente dal client: il server toglie da solo le pubblicazioni.
- **Ospite**: la lega resta nel `localStorage` del browser; anagrafe e archivio sono consultabili in sola lettura. All'avvio la lega aperta si controlla con gli stessi campi dell'import (`src/utils/legaFile.ts`) ma senza i limiti del server (un nome vuoto, un numero di gironi o una regola fuori limite si tengono e si correggono dall'app): le tappe con la forma sbagliata (per esempio una tappa importata in passato senza l'elenco delle squadre) non si caricano e una barra sotto l'intestazione dice quali e perché, mentre il resto si usa; spariscono dal browser al primo salvataggio della lega, e l'avviso lo dice. Una lega illeggibile non si apre e si elimina dall'elenco delle leghe. Se il browser rifiuta una scrittura dei dati (spazio esaurito) la modifica resta in memoria e la barra lo dice (ricordare la lega aperta per la prossima visita è solo una comodità: se non si scrive non si dice niente); la X chiude il testo ma non la protezione: finché una scrittura della lega aperta non riesce (o la lega aperta non si elimina), aprire, creare o importare un'altra lega prova prima a salvarla, e «Esci» chiede la stessa conferma «Uscire senza salvare?» dei registrati.
- **Sessione**: il JWT di 30 minuti è in `localStorage`. `api.ts` lo rinnova da solo con il refresh token, che il server imposta e il browser conserva in un cookie httpOnly (30 giorni, ruotato a ogni rinnovo): in anticipo quando mancano meno di 2 minuti alla scadenza, anche a pagina ferma (un controllo ogni 60 secondi e al ritorno sulla scheda), oppure dopo un 401 ripetendo la richiesta una sola volta. Così anche dopo una pausa il salvataggio alla chiusura della pagina parte subito con un JWT valido. Ogni richiesta ha un tempo massimo di 15 secondi (65 per la chat del Coach, che sul server aspetta il modello fino a 60; nessuno per i salvataggi alla chiusura della pagina): oltre, conta come rete assente. Le schede dello stesso browser condividono la sessione e rinnovano una alla volta (con le Web Locks API). Quando la sessione finisce (refresh token scaduto o revocato, «Esci» o sessione finita in un'altra scheda, sessione scaduta all'avvio) si esce senza conferma, perché salvare non è più possibile, e si torna al form di accesso con «Sessione scaduta: accedi di nuovo» e il numero delle tappe con modifiche non salvate, se ce n'erano. Il logout cancella subito il JWT e revoca il refresh token sul server. Limite noto: il logout chiude la sessione di questo browser (un JWT già emesso resta valido fino a 30 minuti, gli altri dispositivi non vengono toccati).
- **Anagrafe**: viene scaricata una sola volta e tenuta in cache nello store (`useAnagrafeStore`), non a ogni apertura di pagina; ogni scrittura (dalle pagine o dal Coach AI) aggiorna server e cache. Le modifiche di altri utenti si vedono ricaricando la pagina. Se il caricamento fallisce la pagina lo dice, con «Riprova» (un'anagrafe, un archivio o una tappa pubblica che non si sono potuti caricare non si mostrano come vuoti o «non trovati»); una pagina che non si riesce a disegnare mostra un messaggio con «Ricarica» (`ErrorBoundary`) e il resto dell'app resta usabile.

Lo schema del database lo crea Flyway nel backend all'avvio, con le migrazioni V1-V4 (`src/main/resources/db/migration` del repo backend). Con `SEED_DEMO=true` in `env.properties` il primo avvio carica i dati di prova del circuito Estathé 2025 (32 giocatori, 8 squadre, lega con 4 tappe concluse e archivio) intestandoli all'admin; gli avvii successivi non li duplicano.

I dati di gioco della tappa (squadre iscritte, gironi, partite con statistiche ed eventi, bracket, video) sono colonne `JSONB` della tabella `tappe`: il motore torneo li legge e li scrive sempre come blocco unico. Regole, nome, luogo, data e stato sono colonne normali.

La struttura dei package Java (controllers, dto, entities, security, services…) è descritta nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).
