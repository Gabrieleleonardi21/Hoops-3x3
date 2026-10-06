# HOOP 3X3

App web per la gestione di un circuito italiano di basket 3x3: tornei, gironi, statistiche e classifiche.

## Funzionalità

- **Lega** — crea e configura la tua lega con nome, stagione e regole personalizzate
- **Tappe** — organizza tornei con sorteggio gironi (casuale o con teste di serie), calendario partite e avanzamento automatico
- **Live scoring** — inserisci i punteggi in tempo reale con log eventi (canestro da 1, canestro da 2, fallo, timeout)
- **Statistiche** — traccia punti, rimbalzi, assist, palle rubate e stoppate per ogni giocatore
- **Anagrafe** — archivio centralizzato di giocatori e squadre (con logo e sito web cliccabile) riutilizzabile tra le tappe
- **Archivio** — storico di tutte le tappe concluse con classifiche finali
- **Leaderboard** — classifiche individuali per categoria statistica su tutta la stagione
- **Video** — galleria di highlight e partite (link YouTube)
- **Coach AI** — assistente virtuale che conosce le regole FIBA 3x3 e i dati della lega corrente (gratuito via Groq API)
- **Home dashboard** — tappa in corso, classifica live, ultimo risultato, prossime partite e leader
- **Profilo giocatore** — pagina `/giocatore/:id` con statistiche aggregate, andamento punti e storico tappe
- **Campetti** — ricerca campi con filtri e mappa schematica (*dati di esempio*, senza persistenza)
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
- [Tailwind CSS 4](https://tailwindcss.com/) — styling; i token del design system "Asphalt" sono in `src/index.css` (`@theme`), documentati in `docs/design-system.md`
- Backend [Spring Boot 4](https://spring.io/projects/spring-boot) (Java 25) con Spring Security + JWT, JPA/Hibernate e PostgreSQL — repo separato [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend)
- `localStorage` — lega dell'Ospite, JWT di accesso e utente di sessione (dati che restano nel browser)

## Avvio rapido

Servono Node 20.19 o superiore, JDK 25 e PostgreSQL in ascolto su `localhost:5432` (Maven lo scarica il wrapper `./mvnw` del backend).

**1. Backend** — clona [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend) e segui il suo README (crea il DB `hoop3x3` con `db/schema.sql`, compila `env.properties`, poi `./mvnw spring-boot:run`):

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
4. Al primo avvio il backend crea le tabelle da `db/schema.sql` (`DB_INIT_MODE=always`) e l'admin.

**Dopo il deploy**

- Controlla gli URL assegnati. Se il frontend non è `https://hoop3x3.onrender.com` o il backend non è `https://hoop3x3-api.onrender.com` (succede quando il nome è già preso), aggiorna i due punti segnati con «URL» in `render.yaml` (la rewrite di `/api/*` e `CORS_ORIGINS`) oppure gli stessi valori nella dashboard. Con un dominio personalizzato vale lo stesso per `CORS_ORIGINS`.
- Prova login, ricarica della pagina e un salvataggio: un 403 «Invalid CORS request» sulle POST vuol dire che `CORS_ORIGINS` non coincide con l'origine del frontend.
- Per i dati di prova imposta `SEED_DEMO=true` sul backend e riavvialo.

**Piani free** — il backend si spegne dopo 15 minuti senza richieste e la prima richiesta dopo la pausa aspetta il riavvio della JVM (anche più di un minuto, oltre i 15 secondi di attesa del client: la prima chiamata può fallire con «Il server non risponde»). Il database free scade dopo 30 giorni. Per una demo dal vivo conviene il piano starter del backend, oppure aprire l'app qualche minuto prima.

Ogni push su `main` di uno dei due repository ripubblica il servizio corrispondente.

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
| POST | `/api/leghe/{id}/tappe` | proprietario | Nuova tappa (id UUID generato dal client) |
| PUT/DELETE | `/api/tappe/{id}` | proprietario | Sostituisce / elimina la tappa |
| GET | `/api/anagrafe/giocatori`, `/squadre` | pubblico | Anagrafe circuito |
| POST | `/api/anagrafe/giocatori`, `/squadre` | login | Nuova voce (autore = utente) |
| PUT/DELETE | `/api/anagrafe/giocatori/{id}`, `/squadre/{id}` | autore o ADMIN | Modifica / elimina |
| GET | `/api/archivio`, `/api/archivio/{tappaId}` | pubblico | Tappe pubblicate |
| PUT | `/api/archivio` | login | Pubblica o ripubblica una tappa conclusa |
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

- **Utente registrato**: leghe e tappe sono sul server (`leghe`, `tappe`), l'anagrafe e l'archivio sono condivisi tra tutti gli utenti. Lo store aggiorna subito lo stato in memoria e salva in background. Creazione e modifiche delle tappe passano da una coda dei salvataggi (`src/stores/saveQueue.ts`): la tappa intera parte 400 ms dopo l'ultima modifica (POST per una tappa nuova, poi PUT), con una sola richiesta alla volta per tappa e sempre l'ultima versione. Se la rete manca, il server non risponde entro il tempo massimo, ha un guasto (5xx) o respinge il JWT senza che il rinnovo riesca (401), la coda riprova da sola dopo 2, 5 e 15 secondi, poi alla modifica successiva. Intanto una barra sotto l'intestazione dice quante tappe hanno modifiche non salvate e perché, con «Riprova ora», e resta finché tutto è salvato; i dati rifiutati dal server (gli altri errori 4xx) non si ritentano e compaiono come avviso da chiudere. «Esci» salva prima ciò che è in attesa (anche la rinomina della lega) e, se qualche tappa non arriva al server, chiede conferma prima di uscire. Alla chiusura della pagina le versioni non ancora confermate dal server partono subito con keepalive, compresa quella di un salvataggio in corso (il browser lo interrompe), senza tempo massimo e senza aspettare un rinnovo del JWT.
- **Ospite**: la lega resta nel `localStorage` del browser; anagrafe e archivio sono consultabili in sola lettura.
- **Sessione**: il JWT di 30 minuti è in `localStorage`. `api.ts` lo rinnova da solo con il refresh token, che il server imposta e il browser conserva in un cookie httpOnly (30 giorni, ruotato a ogni rinnovo): in anticipo quando mancano meno di 2 minuti alla scadenza, anche a pagina ferma (un controllo ogni 60 secondi e al ritorno sulla scheda), oppure dopo un 401 ripetendo la richiesta una sola volta. Così anche dopo una pausa il salvataggio alla chiusura della pagina parte subito con un JWT valido. Ogni richiesta ha un tempo massimo di 15 secondi (65 per la chat del Coach, che sul server aspetta il modello fino a 60; nessuno per i salvataggi alla chiusura della pagina): oltre, conta come rete assente. Le schede dello stesso browser condividono la sessione e rinnovano una alla volta (con le Web Locks API). Quando la sessione finisce (refresh token scaduto o revocato, «Esci» o sessione finita in un'altra scheda, sessione scaduta all'avvio) si esce senza conferma, perché salvare non è più possibile, e si torna al form di accesso con «Sessione scaduta: accedi di nuovo» e il numero delle tappe con modifiche non salvate, se ce n'erano. Il logout cancella subito il JWT e revoca il refresh token sul server. Limite noto: il logout chiude la sessione di questo browser (un JWT già emesso resta valido fino a 30 minuti, gli altri dispositivi non vengono toccati).
- **Anagrafe**: viene scaricata una sola volta e tenuta in cache nello store (`useAnagrafeStore`), non a ogni apertura di pagina; ogni scrittura (dalle pagine o dal Coach AI) aggiorna server e cache. Le modifiche di altri utenti si vedono ricaricando la pagina.

Schema del database in `db/schema.sql` del repo backend. Con `SEED_DEMO=true` in `env.properties` il primo avvio carica i dati di prova del circuito Estathé 2025 (32 giocatori, 8 squadre, lega con 4 tappe concluse e archivio) intestandoli all'admin; gli avvii successivi non li duplicano.

I dati di gioco della tappa (squadre iscritte, gironi, partite con statistiche ed eventi, bracket, video) sono colonne `JSONB` della tabella `tappe`: il motore torneo li legge e li scrive sempre come blocco unico. Regole, nome, luogo, data e stato sono colonne normali.

La struttura dei package Java (controllers, dto, entities, security, services…) è descritta nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).
