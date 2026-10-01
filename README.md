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
- **Sessione persistente** — login e dati salvati nel browser; gli ospiti hanno dati locali separati

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
- Backend [Spring Boot 4](https://spring.io/projects/spring-boot) (Java 17+) con Spring Security + JWT, JPA/Hibernate e PostgreSQL — repo separato [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend)
- `localStorage` — solo per la modalità Ospite (dati che restano nel browser)

## Avvio rapido

Servono Node 20+, JDK 17+, Maven e PostgreSQL in ascolto su `localhost:5432`.

**1. Backend** — clona [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend) e segui il suo README (crea il DB `hoop3x3` con `db/schema.sql`, compila `env.properties`, poi `mvn spring-boot:run`):

```bash
git clone https://github.com/Gabrieleleonardi21/hoop3x3-backend.git
cd hoop3x3-backend && mvn spring-boot:run
```

L'API risponde su `http://localhost:3001` (Hibernate gira in `validate`: se lo schema non combacia con le entity si ferma all'avvio con un messaggio chiaro).

**2. Frontend**

```bash
npm install
npm run dev
```

L'app è disponibile su `http://localhost:5173`; in sviluppo le chiamate a `/api` passano dal proxy di Vite verso il backend. In produzione imposta `VITE_API_URL` (vedi `.env.example`).

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
| POST | `/api/auth/register` | pubblico | Crea l'account (ruolo `USER`) e restituisce token + utente |
| POST | `/api/auth/login` | pubblico | Login, restituisce token + utente |
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

- **Utente registrato**: leghe e tappe sono sul server (`leghe`, `tappe`), l'anagrafe e l'archivio sono condivisi tra tutti gli utenti. Lo store aggiorna subito lo stato in memoria e salva in background (le modifiche a una tappa sono raggruppate con un debounce di 400 ms); un salvataggio fallito è segnalato da una barra in alto.
- **Ospite**: la lega resta nel `localStorage` del browser; anagrafe e archivio sono consultabili in sola lettura.
- **Anagrafe**: viene scaricata una sola volta e tenuta in cache nello store (`useAnagrafeStore`), non a ogni apertura di pagina; ogni scrittura (dalle pagine o dal Coach AI) aggiorna server e cache. Le modifiche di altri utenti si vedono ricaricando la pagina.

Schema del database in `db/schema.sql` del repo backend. Con `SEED_DEMO=true` in `env.properties` il primo avvio carica i dati di prova del circuito Estathé 2025 (32 giocatori, 8 squadre, lega con 4 tappe concluse e archivio) intestandoli all'admin; gli avvii successivi non li duplicano.

I dati di gioco della tappa (squadre iscritte, gironi, partite con statistiche ed eventi, bracket, video) sono colonne `JSONB` della tabella `tappe`: il motore torneo li legge e li scrive sempre come blocco unico. Regole, nome, luogo, data e stato sono colonne normali.

La struttura dei package Java (controllers, dto, entities, security, services…) è descritta nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).
