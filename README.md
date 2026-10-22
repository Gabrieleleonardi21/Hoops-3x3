# HOOP 3X3

App web per organizzare un circuito di basket 3x3: leghe, tappe, gironi, tabellone, statistiche, archivio pubblico e un assistente che conosce il regolamento.

Questo è il documento principale del progetto. La prima parte spiega com'è fatto e perché, anche a chi non conosce le tecnologie usate. La seconda parte, «Riferimento», serve a chi lo avvia, lo prova o lo modifica.

## Indice

- [Il progetto in breve](#il-progetto-in-breve)
- [Come leggere questo README](#come-leggere-questo-readme)
- [Architettura](#architettura)
- [Tecnologie, una per una, con il perché](#tecnologie-una-per-una-con-il-perché)
- [Le scelte di progetto, con il perché](#le-scelte-di-progetto-con-il-perché)
- [Come funziona, passo per passo](#come-funziona-passo-per-passo)
- [Glossario](#glossario)
- [Limiti noti e prossimi passi](#limiti-noti-e-prossimi-passi)
- [Com'è cresciuto il progetto](#comè-cresciuto-il-progetto)
- [Riferimento](#riferimento)
  - [Funzionalità](#funzionalità)
  - [Regole FIBA 3x3 (default)](#regole-fiba-3x3-default)
  - [Avviare, provare, pubblicare](#avviare-provare-pubblicare)
  - [Lettura delle foto](#lettura-delle-foto)
  - [API REST](#api-rest)
  - [Struttura del progetto](#struttura-del-progetto)
  - [Design system](#design-system)
  - [Dati e persistenza](#dati-e-persistenza)
  - [Campetti](#campetti)

## Il progetto in breve

### Il problema

Un circuito di basket 3x3 è fatto di **tappe**: tornei che si giocano in luoghi e date diversi. In ogni tappa si iscrivono le squadre, si giocano i gironi e poi un tabellone a eliminazione diretta. Iscrizioni, risultati e classifiche finiscono spesso in fogli di calcolo e chat. HOOP 3X3 tiene tutto in un posto solo, dal sorteggio dei gironi alla pagina pubblica dei risultati.

### Chi lo usa

- **L'organizzatore registrato.** Ha un account. Le sue leghe e le sue tappe stanno sul server e le vede da ogni dispositivo. Pubblica le tappe concluse nell'archivio e usa il Coach AI.
- **L'Ospite.** Prova l'app senza account. La sua lega resta nel browser. Legge anagrafe, archivio e campetti, ma non scrive sul server.
- **Il pubblico.** Apre il link di una tappa conclusa, senza account: squadre, risultati, classifiche, tabellone, leader e video.

### Che cosa fa

- Crea leghe e tappe da 2 a 64 squadre, con roster da 3-4 giocatori.
- Sorteggia i gironi a caso o a serpentina per ranking e genera il calendario.
- Registra i risultati con il tabellino di ogni giocatore e il cronometro da tavolo.
- Calcola le classifiche dei gironi con i criteri del regolamento FIBA 3x3 (FIBA è la federazione internazionale di pallacanestro).
- Costruisce il tabellone a eliminazione diretta e conclude la tappa.
- Pubblica la tappa conclusa in un archivio che chiunque può leggere.
- Tiene un'anagrafe condivisa di giocatori e squadre, con le statistiche di stagione.
- Mostra i campetti da streetball su una mappa, con la ricerca per città o intorno a sé.
- Offre il Coach AI, un assistente in chat che risponde sul 3x3 e agisce nell'app con quattordici strumenti. Con «Importa file» legge anche la foto di un foglio di tappa scritto a mano.
- Gestisce il profilo: nome, password, email, recupero della password ed eliminazione dell'account.

L'elenco completo, schermata per schermata, è in [`FUNZIONALITA.txt`](FUNZIONALITA.txt).

### Dove provarlo

- L'app pubblicata: <https://hoop3x3.onrender.com>.
- L'archivio pubblico: <https://hoop3x3.onrender.com/archivio>. Da lì si apre la pagina pubblica di ogni tappa (`/tappa/<id>`), quella che un organizzatore condivide con il pubblico.

Il server gira sul piano gratuito di Render: dopo 15 minuti senza visite si spegne. La prima apertura può aspettare il risveglio, anche più di un minuto.

### I numeri, al 22 ottobre 2026

Misurati il 22 ottobre 2026 con `npm run check` e `npx playwright test`, senza fallimenti. I test con il backend vero si contano con la lista (`--list`), senza eseguirli. I numeri del backend non sono stati ricontati in questa fase: sono quelli del 19 ottobre, e la pull request hoop3x3-backend#33 può cambiarli. I test di integrazione del backend richiedono un database di prova. I test del frontend comprendono il test di guardia di questo README (`tests/unit/readme.test.ts`).

| Che cosa | Quanti | Come si misura |
|---|---|---|
| Test unitari e di componenti del frontend | 2.275, in 120 file | `npm test` |
| Test end-to-end del frontend, con il server finto | 84 | `npx playwright test` |
| Test end-to-end con il backend vero | 6 | `npm run test:e2e:backend` (nella CI, l'integrazione continua di GitHub) |
| Test unitari del backend, compreso il test di guardia del suo README | 997 | `./mvnw test` |
| Test di integrazione del backend, su PostgreSQL | 298 | `./mvnw verify -Pintegrazione` |
| Endpoint dell'API | 42, più 2 controlli di salute | le mappature dei controller del backend |
| Migrazioni del database | 11 (da V1 a V11), per 12 tabelle | i file di `hoop3x3-backend/src/main/resources/db/migration` |

## Come leggere questo README

Tre percorsi, secondo che cosa ti serve:

- **Valuti il progetto.** Leggi la parte 1 dall'inizio: architettura, tecnologie, scelte, come funziona, glossario, limiti. Ogni tecnologia e ogni scelta hanno il loro perché e il file in cui guardare.
- **Vuoi avviarlo.** Vai a [Avviare, provare, pubblicare](#avviare-provare-pubblicare), nella parte 2: requisiti, avvio, script e pubblicazione su Render.
- **Devi modificarlo.** Parti da [Architettura](#architettura) e da [Le scelte di progetto, con il perché](#le-scelte-di-progetto-con-il-perché), poi la [struttura del progetto](#struttura-del-progetto) e i documenti in `docs/`: il [design system](docs/design-system.md) e la [guida del Coach AI](docs/coach-ai-tool-calling.md).

Due documenti stanno accanto a questo. [`FUNZIONALITA.txt`](FUNZIONALITA.txt) elenca tutte le funzioni, schermata per schermata. Il README del [backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend) è il riferimento tecnico del server: endpoint, limiti, variabili, migrazioni.

## Architettura

### Lo schema

HOOP 3X3 è una **SPA** (Single Page Application, applicazione a pagina singola): il browser scarica una volta l'app React e poi cambia pagina senza ricaricare il sito. I dati arrivano da un'**API REST**: un server che risponde a indirizzi come `GET /api/leghe` con dati in **JSON** (il formato di testo degli oggetti JavaScript).

Le parole dello schema, in breve (sono anche nel [Glossario](#glossario)):

- **JWT** (JSON Web Token): il biglietto firmato dal server che il browser manda a ogni richiesta per dire chi è.
- **Cookie httpOnly**: un cookie che il browser rimanda al server ma che JavaScript non può leggere; qui porta il refresh token, che rinnova il JWT.
- **Rewrite**: la regola con cui il sito statico passa le richieste `/api/*` al backend, senza che il browser lo sappia.
- **JSONB**: il tipo di PostgreSQL che conserva un JSON in forma binaria.
- **Flyway**: lo strumento che applica le migrazioni, i file SQL numerati che cambiano lo schema del database.

```
                BROWSER: una sola pagina React (src/)
+--------------------------------------------------------------------+
|  pages/ ---> hooks/ ---> stores/ (Zustand) ---> services/api.ts    |
|                |              |                       |            |
|                v              v                       |            |
|     domain/tappaOps.ts    Ospite: localStorage        |            |
|     (funzioni pure)       Registrato: sul server <----+            |
+--------------------------------------------------------------------+
        |  /api/*  sulla stessa origine del sito
        |  Authorization: Bearer <JWT, 30 minuti>
        |  cookie httpOnly hoop3x3_refresh (30 giorni, solo /api/auth)
        v
+--------------------------------------------------------------------+
|  RENDER, sito statico: build di Vite + rewrite /api/* -> backend   |
+--------------------------------------------------------------------+
        |
        v
                BACKEND: Spring Boot (repository hoop3x3-backend)
+--------------------------------------------------------------------+
|  JwtFilter ---> LimiteRichiesteFilter ---> LimiteDimensioneFilter  |
|  (chi sei?)     (troppe richieste?)        (corpo oltre 2 MB?)     |
|       |                                                            |
|       v                                                            |
|  controllers/ --> services/ (AccessGuard: è tuo?) --> repositories/|
+--------------------------------------------------------------------+
        |                                   |
        v                                   v
+-----------------------------+   +----------------------------------+
| PostgreSQL                  |   | Servizi esterni, chiavi sul      |
| schema di Flyway, V1-V11    |   | server:                          |
| tappe: blocchi JSONB        |   |  Anthropic (Coach AI, foto)      |
| colonna versione            |   |  Brevo (email)                   |
+-----------------------------+   |  Nominatim (ricerca dei luoghi)  |
                                  +----------------------------------+
```

Le parti del backend, senza presupporre Spring: un **filtro** guarda ogni richiesta prima di tutto il resto e può fermarla; un **controller** riceve la richiesta di un indirizzo e la passa avanti; un **service** applica le regole (chi può, che cosa si salva); un **repository** legge e scrive le tabelle del database.

Dal browser partono anche, direttamente, le tessere della mappa di OpenStreetMap, i font di Google Fonts, i video di YouTube e i loghi delle squadre. La Content-Security-Policy (l'elenco delle origini da cui la pagina può caricare risorse) li ammette uno per uno (vedi [Le scelte di progetto, con il perché](#le-scelte-di-progetto-con-il-perché)).

### Dove sta il codice di ogni riquadro

| Riquadro | Che cosa fa | Dove |
|---|---|---|
| Pagine | Una per indirizzo: home, leghe, tappa, anagrafe, archivio, campetti, profilo | `src/pages/`, rotte in `src/App.tsx` |
| Hook | Collegano una pagina allo stato e alle operazioni | `src/hooks/`, per esempio `src/hooks/useTappa.ts` |
| Operazioni di tappa | Sorteggio, risultati, tabellone, conclusione: funzioni pure | `src/domain/tappaOps.ts` |
| Store | Lo stato dell'app in memoria e il suo salvataggio | `src/stores/useAppStore.ts`, `src/stores/saveQueue.ts`, `src/stores/memoriaBrowser.ts` |
| Client HTTP | Ogni chiamata al server, con il JWT e il suo rinnovo | `src/services/api.ts` e gli altri file di `src/services/` |
| Sito statico e rewrite | Serve la build e inoltra `/api/*` al backend | `render.yaml` |
| Filtri del backend | Identità, limiti di frequenza, dimensione del corpo | `JwtFilter`, `LimiteRichiesteFilter`, `LimiteDimensioneFilter` (cartella `security/` del backend) |
| Servizi del backend | Le regole, compresa la proprietà dei dati | `LegaService`, `ArchivioService`, `AccessGuard`… (cartella `services/` del backend) |
| Database | Lo schema, versionato | le migrazioni `V1`-`V11` in `hoop3x3-backend/src/main/resources/db/migration` |

### Le due modalità, uno stesso motore

L'Ospite e il registrato usano le stesse pagine e le stesse operazioni di `src/domain/tappaOps.ts`. Cambia solo dove finisce la tappa quando lo store la salva:

- **Ospite**: nel `localStorage` del browser (`src/stores/memoriaBrowser.ts`). Niente server, niente account. I controlli obbligatori su roster e punteggi sono spenti: l'Ospite fa prove libere.
- **Registrato**: sul server, con la coda dei salvataggi (`src/stores/saveQueue.ts`) e il numero di versione della tappa. Solo il registrato pubblica nell'archivio, scrive nell'anagrafe e usa il Coach AI.

### Perché due repository

Il frontend ([Hoops-3x3](https://github.com/Gabrieleleonardi21/Hoops-3x3)) e il backend ([hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend)) sono due servizi diversi su Render: un sito statico e un container. Ognuno ha la sua CI, e ogni push sul suo ramo principale ripubblica solo il suo servizio. Il prezzo: una modifica che tocca tutti e due diventa due pull request, da rivedere e unire in coppia.

## Tecnologie, una per una, con il perché

Ogni riga risponde a quattro domande: che cos'è, a che cosa serve qui (con un file in cui vederla), perché questa, che prezzo ha o quale alternativa è stata scartata. Le versioni sono quelle installate il 14 ottobre 2026, lette da `package-lock.json`, da `pom.xml` e dalle dipendenze che Spring Boot 4.1.1 fissa per il backend. I limiti dei piani gratuiti (Render, Brevo) sono quelli del 14 ottobre 2026.

### Frontend

| Tecnologia | Che cos'è | A che cosa serve qui | Perché questa | Prezzo o alternativa scartata |
|---|---|---|---|---|
| **React** 19.3 | Una libreria per costruire interfacce a componenti: descrivi come appare la pagina per un certo stato, React aggiorna lo schermo | Tutte le pagine (`src/pages/`) e i componenti (`src/components/`) | Componenti e stato dichiarativi. `useEffectEvent`, arrivato con React 19.2, serve agli ascoltatori della sessione in `src/App.tsx` | Vue o Svelte avrebbero fatto lo stesso: scelta di partenza del progetto |
| **TypeScript** 5.9, modalità `strict` | JavaScript con i tipi, controllati prima di eseguire il codice | Tutto il codice; le regole sono in `tsconfig.json` | Un errore di forma, come un campo che manca in una tappa, esce alla compilazione e non in produzione. `noUnusedLocals` e `noUnusedParameters` tengono il codice pulito | Più codice da scrivere: i tipi |
| **Vite** 6.4 | Lo strumento di sviluppo e di build: un server con la ricarica a caldo e il pacchetto finale per il sito | `vite.config.ts` | In sviluppo inoltra `/api` al backend sulla porta 3001, quindi il browser vede una sola origine. `vite preview` applica la stessa Content-Security-Policy di produzione, e i test end-to-end la provano. Vitest riusa la stessa configurazione | Next.js avrebbe portato un server di pagine che qui non serve: il sito è statico |
| **Tailwind CSS** 4.3 e **tailwind-merge** 3.7 | Tailwind: un CSS fatto di classi piccole, scritte direttamente nel markup. tailwind-merge: risolve i conflitti tra classi | I colori e i font del tema in `@theme` di `src/index.css`; tailwind-merge in `src/components/ui/Button.tsx` | Un posto solo per colori e font, senza file di configurazione. tailwind-merge fa vincere le classi passate da fuori su quelle della variante del pulsante | Classi lunghe nel markup |
| **Zustand** 5.0 | Una libreria per lo stato condiviso tra le pagine: uno store è una funzione con dati e azioni | `src/stores/useAppStore.ts`, `src/stores/useAnagrafeStore.ts`, `src/stores/useCampettiStore.ts` | Uno store piccolo, senza codice di contorno né provider. Con un selettore un componente si ridisegna solo quando cambia la parte che legge. Il salvataggio nel browser è scritto a mano (`src/stores/memoriaBrowser.ts`), così le chiavi `hoop3x3_*` sono sotto controllo | Redux avrebbe chiesto azioni e reducer per uno stato semplice. Due hook leggono ancora lo store intero e si ridisegnano a ogni cambio (`src/hooks/useLega.ts`, `src/hooks/useAuth.ts`) |
| **React Router** 7.18 | Fa corrispondere un indirizzo a una pagina, senza ricaricare il sito | `src/App.tsx` e `src/components/auth/RequireAuth.tsx` | Le rotte pubbliche (`/tappa/:id`, `/archivio`) stanno accanto a quelle riservate a chi è entrato, raccolte sotto `RequireAuth` | Un'app a pagina singola chiede al server di rimandare ogni percorso a `index.html`: è la regola di rewrite in `render.yaml` |
| **React Hook Form** 7.89 e **Zod** 3.25 | React Hook Form: gestisce i moduli lasciando i campi al browser. Zod: descrive la forma di un dato e la controlla | I moduli (`src/components/auth/AuthForm.tsx`); le regole di password ed email in `src/utils/credenziali.ts`; i file importati in `src/utils/legaFile.ts` | Moduli con pochi ridisegni e **una regola sola**, scritta come schema Zod: la usa il modulo e, dove serve, la stessa forma controlla le risposte del server | Due librerie in più. Schema e tipo TypeScript vanno tenuti allineati (`z.ZodType<…>`) |
| **Leaflet** 1.9, **OpenStreetMap** e **Nominatim** | Leaflet: una libreria per mappe interattive. OpenStreetMap: la mappa libera fatta da volontari. Nominatim: il servizio che trova le coordinate di un luogo | La mappa in `src/components/campetti/MappaCampetti.tsx`; Nominatim solo dal backend, con `GET /api/luoghi` | Nessuna chiave nel browser, nessun costo, la Content-Security-Policy non cambia, la mappa si trascina (vedi [Perché OpenStreetMap con Leaflet e non Google Maps](#perché-openstreetmap-con-leaflet-e-non-google-maps)) | L'aspetto è diverso da Google Maps; le tessere sono di un servizio comunitario, con una politica d'uso da rispettare |
| **Vitest** 4.1, **Testing Library** e **jsdom** 30.1 | Vitest: esegue i test. Testing Library: prova un componente come lo usa una persona, per ruoli ed etichette. jsdom: un DOM (la struttura della pagina che il browser costruisce dall'HTML) simulato dentro Node | `tests/unit/`; le soglie di copertura in `vite.config.ts` | Vitest usa la configurazione di Vite e misura la copertura con v8. Testing Library cerca i pulsanti per nome, non per classe di stile: così un cambio di grafica non rompe quei test | jsdom non è un browser: le misure, la stampa e la Content-Security-Policy si provano con Playwright |
| **Playwright** 1.63, solo Chromium | Pilota un browser vero, come farebbe una persona | `tests/e2e/` (`playwright.config.ts`) e `tests/e2e-backend/` (`playwright.backend.config.ts`) | Prova l'app vera, costruita, su `vite preview` con la Content-Security-Policy; con il jar del backend (il pacchetto eseguibile Java del server) prova i contratti veri. Un solo browser tiene la CI breve | Niente Safari né Firefox nella CI |
| **ESLint** 9.39, con typescript-eslint, jsx-a11y e react-hooks | Un analizzatore del codice: trova errori e cattive abitudini senza eseguirlo | `eslint.config.js`; `npm run lint` | Le regole dell'accessibilità (jsx-a11y) e degli hook di React si controllano a ogni push e pull request (CI); `npm run check` li esegue prima del commit. Lo script ammette zero avvisi (`--max-warnings 0`), quindi un avviso ferma la CI | Quattro regole sono ancora «warn» nella configurazione: le rende bloccanti lo zero avvisi dello script |
| **Node** 22 | L'ambiente che esegue JavaScript fuori dal browser: serve agli strumenti, non all'app | La CI (`.github/workflows/ci.yml`) e la build su Render (`NODE_VERSION` in `render.yaml`) | jsdom 30 chiede Node 22.22.2 o più nuovo nella serie 22, 24.15 nella serie 24, oppure 26. La stessa versione in CI e su Render | `package.json` non dichiara `engines`: il vincolo è scritto solo qui, nella CI e in `render.yaml` |
| **Google Fonts** | Un servizio che distribuisce font sul web | `index.html` carica Barlow Condensed (titoli e numeri) e IBM Plex Sans (testo) | I due font del design system ([`docs/design-system.md`](docs/design-system.md)); dal servizio di Google non serve tenere i file nel repository | Una richiesta a Google a ogni visita, ammessa nella Content-Security-Policy. L'alternativa è servire i font dal sito |

### Le API del browser

Funzioni che il browser offre già, senza librerie.

| API | Che cos'è | A che cosa serve qui | Perché questa | Prezzo o limite |
|---|---|---|---|---|
| **Web Locks** (`navigator.locks`) | Un lucchetto condiviso tra le schede dello stesso sito | Il rinnovo del JWT in `src/services/api.ts` (lucchetto `hoop3x3_refresh`) | Con più schede aperte rinnova una scheda alla volta: il server ruota il refresh token a ogni rinnovo, e di due rinnovi insieme con lo stesso cookie uno viene respinto | Dove manca (browser vecchi, pagine non HTTPS) il rinnovo parte senza lucchetto |
| **`fetch` con `keepalive`** | Una richiesta che il browser porta a termine anche dopo la chiusura della pagina | I salvataggi alla chiusura (`src/stores/useAppStore.ts`) e il logout (`src/services/authService.ts`) | Una modifica fatta un attimo prima di chiudere arriva lo stesso al server | Il browser accetta al massimo 64 KiB di corpi `keepalive` in volo: le tappe più pesanti restano nel browser e partono alla prossima apertura |
| **`crypto.randomUUID`** | Un generatore di identificativi casuali, sicuro per la crittografia | Gli id di tappe, squadre e partite, in `src/utils/uid.ts` | Il backend accetta solo UUID (identificativi universali di 128 bit) come id di tappa; un id casuale non si indovina | Esiste solo su HTTPS o localhost: altrove `src/utils/uid.ts` costruisce lo stesso UUID con `crypto.getRandomValues` |
| **Geolocation** | La posizione del dispositivo, con il permesso dell'utente | «Usa la mia posizione» nei campetti, `src/hooks/usePosizione.ts` | Si chiede solo al clic, mai all'apertura della pagina | Con il permesso negato la pagina lo dice e resta usabile |
| **Evento `storage`** | Avvisa una scheda quando un'altra scheda scrive nel `localStorage` | `src/services/api.ts` e `src/stores/useAppStore.ts` | Uscita, accesso e leghe dell'Ospite restano allineati tra le schede dello stesso browser | L'accesso fatto in un'altra scheda non si vede finché non si ricarica (nel `TODO.md`) |
| **`AbortSignal.timeout`** | Interrompe una richiesta dopo un certo tempo | Il tempo massimo di ogni richiesta, in `src/services/api.ts`; i 65 secondi del Coach in `src/services/aiService.ts` | 15 secondi per le richieste normali, 65 per il Coach, 90 per il rinnovo: oltre, conta come rete assente | Dove manca (Safari prima della 16) la richiesta parte senza tempo massimo |
| **`localStorage` e `sessionStorage`** | Due archivi chiave-valore del browser: il primo resta, il secondo si svuota alla chiusura della scheda | `localStorage`: lega dell'Ospite, JWT, utente di sessione (`src/stores/memoriaBrowser.ts`). `sessionStorage`: la chat del Coach, con la chiave `coach_chat` (`src/hooks/useCoachAI.ts`) | Nessun server per l'Ospite; la chat non sopravvive alla scheda | Lo spazio è limitato: se il browser rifiuta una scrittura, una barra lo dice |

### Backend, in breve

Il server ha un README suo, con la sezione completa delle tecnologie: [Tecnologie e scelte, con il perché](https://github.com/Gabrieleleonardi21/hoop3x3-backend#tecnologie-e-scelte-con-il-perché). Qui le righe essenziali, con i file del repository [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).

| Tecnologia | Che cos'è | A che cosa serve qui | Perché questa | Prezzo o alternativa scartata |
|---|---|---|---|---|
| **Java** 25 | Il linguaggio e la piattaforma del server | Tutto il backend; la versione è `java.version` in `pom.xml` | Ultima versione a supporto lungo (LTS). I **thread virtuali** (thread leggeri della JVM, la Java Virtual Machine che esegue il codice) sono accesi: una chiamata lenta al fornitore del Coach non tiene occupato un thread di sistema (`application.properties`) | Il JDK 25 (Java Development Kit, il compilatore e la macchina virtuale) va installato per lavorare in locale |
| **Spring Boot** 4.1 | Un framework che mette insieme server web, sicurezza, accesso al database, validazione e controlli di salute | `pom.xml`: gli starter `webmvc`, `security`, `data-jpa`, `validation`, `actuator`, `flyway` | Un solo framework con tutto già integrato, configurato da proprietà (`application.properties`) | Qualche secondo di avvio e molti automatismi da conoscere |
| **Spring Security** 7.1 e **JJWT** 0.13 | Spring Security: filtri e regole di accesso per ogni rotta. JJWT: la libreria che firma e legge i JWT | `SecurityConfig`, `JwtFilter`, `JwtTools` | Regole per rotta già pronte; JJWT firma e verifica i token. Il suo JSON passa da `JwtJson` con Jackson 3, per non portarsi dietro Jackson 2 (`pom.xml`) | Le regole di sicurezza vanno lette in un posto solo, `SecurityConfig` |
| **BCrypt**, costo 12 | Una funzione di hash per le password, lenta apposta | `SecurityConfig` | Se il database venisse rubato, provare password a ripetizione costerebbe molto calcolo. Ogni punto di costo raddoppia il lavoro: 12 è quattro volte il valore di base di Spring (10) | Ogni login costa calcolo al server: per questo login e registrazione hanno un limite di frequenza |
| **JPA** con **Hibernate** 7.4 | Un ORM (Object-Relational Mapping): legge e scrive le tabelle come oggetti Java | Le entity in `entities/`, i repository in `repositories/` | Niente SQL scritto a mano per le operazioni normali. `ddl-auto=validate` ferma l'avvio se le entity non combaciano con le tabelle. `open-in-view=false`: il database si legge solo dentro i servizi, non mentre si scrive la risposta, quindi nessuna query nascosta parte dal controller | Le query fuori dal comune restano native |
| **Flyway** 12.4 | Applica le migrazioni del database: file SQL numerati, in ordine | `hoop3x3-backend/src/main/resources/db/migration`, da V1 a V11 | Lo schema è versionato nel repository e si applica da solo all'avvio: nessuno esegue SQL a mano | Una migrazione applicata non si modifica: un errore si corregge con una migrazione nuova |
| **PostgreSQL** e **JSONB** | Un database relazionale; JSONB è il suo tipo per il JSON, salvato in forma binaria | Le tabelle di leghe, tappe, anagrafe, archivio, campetti, create da `V1__schema_iniziale.sql` e dalle migrazioni dopo | Transazioni e vincoli; i blocchi di gioco della tappa stanno in colonne JSONB perché il motore li legge e li scrive sempre interi. Gratuito su Render | Le statistiche tra tappe non si calcolano in SQL: le calcola il frontend |
| **Jackson** 3.1 | La libreria che converte oggetti Java in JSON e ritorno | Ogni risposta dell'API; anche il JSON dei token, in `JwtJson` | È il JSON di Spring Boot 4 (pacchetto `tools.jackson`) | Le annotazioni restano nel vecchio pacchetto `com.fasterxml` |
| **RestClient** | Il client HTTP di Spring | Le chiamate ad Anthropic o Groq, Brevo e Nominatim (`CoachAiService`, `EmailSenderBrevo`, `LuoghiService`) | Nessuna dipendenza in più; i tempi massimi sono scritti nel codice | È sincrono: la chiamata tiene occupato il suo thread, che però è virtuale |
| **Lombok** 1.18 | Genera getter, setter e costruttori al posto di chi scrive | Le entity in `entities/`, per esempio `Lega` | Meno codice ripetuto | Un processore di annotazioni in più da conoscere |
| **JUnit** 6, **Mockito**, **AssertJ**, **MockMvc** | Gli strumenti dei test Java: esecuzione, oggetti finti, asserzioni leggibili, richieste HTTP simulate | `hoop3x3-backend/src/test` | I test unitari girano senza database; quelli di integrazione (`*IT`) usano un PostgreSQL vero | Un database di prova da tenere a portata |
| **PostgreSQL vero nei test**, niente Testcontainers | I test di integrazione parlano con un database vero, non con un'imitazione | Il profilo Maven `integrazione` | Lo stesso database della produzione; Testcontainers avrebbe chiesto Docker sulla macchina di sviluppo, che non c'è. In CI è un servizio `postgres:18` | In locale serve un database di prova, mai quello vero: i test lo svuotano |
| **Docker** | Impacchetta il server con il suo ambiente in un'immagine | Il `Dockerfile` del backend | Render non ha un ambiente Java pronto: l'immagine porta il suo. Due fasi, un utente senza privilegi, heap al 60% della memoria | Un'immagine da costruire a ogni pubblicazione |
| **Groq**, modello `openai/gpt-oss-120b` | Un servizio che esegue modelli linguistici, con un'API compatibile con quella di OpenAI | Il Coach AI, attraverso `POST /api/coach/chat` (`CoachAiService`), con `COACH_FORNITORE=groq` | Scelta di partenza del progetto: il Coach nasce con Groq. Il modello sa chiamare gli strumenti (il precedente, `llama-3.3-70b-versatile`, è stato dismesso) | Non è bastato: per avere risposte costanti e ridurre al minimo la possibilità di errore, il deploy usa Anthropic. Groq resta disponibile |
| **Anthropic**, modello `claude-haiku-5-5` | Un servizio che esegue i modelli Claude con la Messages API | Il Coach AI (`CoachAnthropic`) e la lettura delle foto dei fogli (`LettoreFoglioAnthropic`), con `COACH_FORNITORE=anthropic` e `AI_LETTORE_FOGLIO=anthropic` | Scelto per avere una risposta costante e ridurre al minimo la possibilità di errore. Un solo fornitore e un solo modello per il Coach e per le foto, con la stessa chiave | Alternativa scartata: Groq. Il modello si cambia con `ANTHROPIC_MODEL` |
| **Brevo** | Un servizio che invia email con un'API HTTP | Le email del recupero password e del cambio email (`EmailSenderBrevo`) | Sul piano gratuito di Render le porte SMTP (il protocollo classico della posta) sono chiuse: l'API di Brevo passa dalla porta 443. Fino a 300 email al giorno gratis | Oltre 300 email al giorno serve un piano a pagamento |
| **Actuator** | Le sonde di salute di Spring Boot | `/actuator/health` e `/actuator/health/liveness`, configurati da `management.*` in `application.properties` | Render riavvia il servizio se la sonda non risponde; il frontend la chiama all'apertura per svegliare il server | Gli altri endpoint dell'actuator restano chiusi |
| **Maven Wrapper** | Uno script che scarica la versione giusta di Maven | `./mvnw` | Nessuna installazione di Maven; lo portano i progetti generati con Spring Initializr | Il primo avvio scarica Maven |

### Strumenti di consegna

| Strumento | Che cos'è | A che cosa serve qui | Perché questo | Prezzo o limite |
|---|---|---|---|---|
| **GitHub Actions** | La CI (integrazione continua) di GitHub: esegue i controlli a ogni push e pull request | `.github/workflows/ci.yml`: lint, tipi, test con copertura, build, end-to-end e end-to-end con il backend vero | Gratuita per i repository pubblici, accanto al codice | Un passo che fallisce ferma la pull request |
| **Dependabot** | Un servizio di GitHub che propone l'aggiornamento delle dipendenze | `.github/dependabot.yml` | Una volta alla settimana, con versioni minori e patch raggruppate in una pull request sola | Ogni aggiornamento passa dalla CI prima di essere unito |
| **Render** | Un servizio che ospita siti, container e database | `render.yaml`: sito statico, backend in Docker e PostgreSQL, a Francoforte | Un piano gratuito con le tre parti insieme, descritte in un solo file. Francoforte è l'unica regione europea di Render | Il backend gratuito si spegne dopo 15 minuti senza visite; il database gratuito scade dopo 30 giorni |

## Le scelte di progetto, con il perché

Una tecnologia è uno strumento; una scelta è il modo in cui lo si usa. Ogni riga dice la scelta, il perché, che cosa costa o che cosa si è scartato, e dove guardare nel codice. I file del backend sono nel repository [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).

### Sicurezza

| Scelta | Perché | Alternativa scartata o limite | Dove nel codice |
|---|---|---|---|
| Il **JWT** (JSON Web Token, un biglietto firmato dal server che dice chi sei) porta l'id dell'utente, non l'email | Cambiare nome o email dal profilo non invalida il token in corso | Con l'email nel token, ogni cambio d'indirizzo avrebbe chiesto un token nuovo | `JwtTools` del backend |
| JWT di 30 minuti nel `localStorage`, **refresh token** di 30 giorni in un cookie **httpOnly** (che JavaScript non può leggere) | Il JWT va letto dal codice per metterlo nell'intestazione `Authorization`; dura poco, quindi un JWT rubato vale al massimo 30 minuti. Il refresh token, che dura a lungo, sta dove uno script non arriva | Un attacco **XSS** (codice estraneo eseguito nella pagina) potrebbe leggere il JWT finché vale: per questo la Content-Security-Policy e niente `innerHTML`. Un JWT già emesso non si revoca: resta valido fino alla scadenza | `src/services/api.ts`; `AuthCookies` e `RefreshTokenService` del backend |
| Protezione **CSRF** spenta (CSRF: un altro sito che fa partire richieste a nome tuo usando i tuoi cookie) | Le richieste autenticate usano l'intestazione `Authorization`, che un altro sito non può aggiungere. L'unico cookie è `SameSite=Lax` e lo leggono solo il rinnovo e l'uscita | Con frontend e backend su siti diversi servirebbero `SameSite=None` e un'intestazione di controllo: i passi sono nel README del backend, «Sessioni e refresh token» | `SecurityConfig` del backend |
| Password con **BCrypt** a costo 12, e massimo 72 byte | Un hash lento rende costoso provare password a ripetizione. 72 byte è il limite di BCrypt, controllato in byte UTF-8 (una lettera accentata ne vale 2) | Ogni login costa calcolo al server: da qui il limite di frequenza sul login | `SecurityConfig`, `UtenteService` del backend; `src/utils/credenziali.ts` |
| **Limiti di frequenza**: 10 al minuto per indirizzo su login, registrazione, rinnovo e richiesta del link di recupero; 10 al minuto per utente sui tre endpoint del profilo con la password; 20 al minuto e 300 al giorno per utente sul Coach. Oltre, 429 con `Retry-After` | Senza limite le password si proverebbero a ripetizione e la chiave del fornitore del Coach diventerebbe un servizio gratuito per chiunque si registri | I contatori stanno nella memoria del processo: valgono finché l'istanza è una sola, e non fermano un attacco da molti indirizzi | `LimiteRichiesteFilter` del backend |
| Una **Content-Security-Policy** (CSP: l'elenco delle origini da cui la pagina può caricare script, stili, immagini, frame) uguale in `render.yaml` e in `vite.config.ts` | Uno script iniettato non parte, perché gli script ammessi sono solo quelli della build. La copia in `vite.config.ts` fa girare i test end-to-end con la policy di produzione | Ogni risorsa esterna nuova va aggiunta in tutti e due i posti: un test unitario fallisce se le copie divergono | `render.yaml`, `vite.config.ts`, `tests/unit/csp.test.ts`, `tests/e2e/csp.spec.ts` |
| Video di YouTube da `youtube-nocookie.com` | L'embed non mette cookie di profilazione finché il video non parte; è anche l'unico host che la policy ammette nei frame | Un video di un altro sito si apre in una nuova scheda, non nella pagina | `src/components/video/VideoCard.tsx` |
| Niente `innerHTML`; ogni indirizzo scritto da un utente passa da `safeUrl`; i loghi si caricano senza `Referer` | Un testo non diventa mai codice. `safeUrl` blocca `javascript:`, `data:` e gli indirizzi che portano a un altro sito. Senza `Referer` l'host di un logo non sa da quale pagina arriva la richiesta | Un indirizzo bloccato diventa `#`, un logo bloccato lascia il posto al ripiego. Il server applica la stessa regola agli indirizzi (`IndirizzoWeb`) | `src/utils/safeUrl.ts`, `src/components/ui/TeamLogo.tsx` |
| Zod controlla la forma di alcune risposte del server: l'elenco e le tappe dell'archivio, i campetti, i luoghi, il profilo, i messaggi del recupero password. Le altre risposte (leghe e tappe, anagrafe, accesso, Coach) hanno solo i tipi TypeScript | Una risposta fuori forma diventa un errore con «Riprova» invece di una pagina disegnata a metà. Lo schema è arrivato con i client scritti o rivisti dal 7 ottobre 2026 in poi; quelli delle prime versioni sono rimasti com'erano | Le risposte senza schema si fidano del contratto del backend: un cambio di forma si vedrebbe solo nell'uso. Anche i file importati e la lega dell'Ospite letta dal browser passano da Zod | `src/services/archivioApi.ts`, `src/services/campettiApi.ts`, `src/utils/legaFile.ts` |
| Contro la **prompt injection** (testo che prova a dare ordini al modello): i dati della lega vanno al Coach dentro `<dati_lega>`, e ogni nome scritto da un utente passa da `pulisci` | Il prompt dice al modello di trattare come dati ciò che sta nel blocco. `pulisci` trasforma `<` e `>`, così un nome come `</dati_lega>` non chiude il blocco | Una mitigazione, non una garanzia: un modello può comunque seguire un testo ostile. Le azioni distruttive chiedono conferma all'utente | `src/utils/buildCoachContext.ts`, `src/hooks/useCoachAI.ts` |
| Le chiavi dei servizi esterni stanno solo sul server, e il backend fa da proxy verso il fornitore del Coach con una lista degli strumenti ammessi | Una chiave nel browser è pubblica. Con strumenti diversi da quelli del Coach, Groq attiverebbe i suoi strumenti integrati, pagati con la chiave del server | Il prompt di sistema lo scrive il frontend, perché i dati della lega sono nel browser; il server aggiunge la sua regola del contesto e controlla quantità e strumenti (60 messaggi, 100.000 caratteri, 20 strumenti) | `src/services/aiService.ts`; `CoachAiService` e `AmbitoCoach` del backend |

### Dati

| Scelta | Perché | Alternativa scartata o limite | Dove nel codice |
|---|---|---|---|
| I dati di gioco della tappa (squadre, gironi, partite, tabellone, video) sono colonne **JSONB** | Il motore del torneo li legge e li scrive sempre come un blocco unico. Nome, luogo, data, regole e stato restano colonne normali | Le classifiche tra tappe non si calcolano in SQL: le calcola il frontend. Separarle in tabelle è nel `TODO.md` | `V1__schema_iniziale.sql` del backend; `src/stores/saveQueue.ts` |
| Ogni tappa ha un numero di `versione`; un salvataggio con la versione vecchia riceve **409** | Il salvataggio sostituisce la tappa intera: senza versione, due dispositivi sulla stessa tappa si sovrascriverebbero in silenzio | Il client deve rileggere la lega dopo un 409 e decidere: la logica sta in `src/stores/versioniTappe.ts` e `src/utils/stessaTappa.ts` | migrazione V4 del backend; `src/stores/useAppStore.ts` |
| La copia pubblica di una tappa la costruisce il server, dalla tappa che ha salvato | Nessuno può pubblicare risultati inventati: la pubblicazione non ha corpo | Il client salva prima e pubblica dopo; se la rinomina della lega non arriva al server, la copia porta il nome di prima | `ArchivioService` del backend; `pubblica` in `src/stores/useAppStore.ts` |
| Le migrazioni dicono che cosa succede a chi resta: V2 lega le pubblicazioni alle tappe (cancellate con loro), V6 copia in colonne i campi dell'elenco dell'archivio, V8 e V11 lasciano campetti e schede dell'anagrafe senza autore invece di cancellarli | V2: una pubblicazione di una tappa eliminata restava orfana. V6: l'elenco pubblico non deve aprire il JSONB di ogni tappa. V8 e V11: campetti e schede sono dati del circuito, stanno nei roster degli altri | Un campetto o una scheda senza autore li modifica solo un ADMIN | `hoop3x3-backend/src/main/resources/db/migration` |
| Gli id delle tappe li genera il browser, con un generatore sicuro (**UUID** casuali) | La tappa nasce nel browser, anche per l'Ospite che non ha server, e si salva dopo. Il backend accetta solo UUID; un id casuale non si indovina | Gli id sono pubblici e li sceglie il client: il server controlla che l'id di una nuova tappa non sia di una pubblicazione di un altro utente | `src/utils/uid.ts` |
| Lo schema lo applica **Flyway**; Hibernate gira in `validate` | Nessuno esegue SQL a mano su un ambiente; una entity che non combacia ferma l'avvio con un messaggio chiaro | Una migrazione applicata non si tocca più: un errore si corregge con una nuova | `application.properties` del backend |
| Le date del server sono in **UTC** (il tempo coordinato universale, senza fuso né ora legale) | Il `ts` dell'API non dipende dal fuso della macchina | Un database scritto prima da un server con il fuso italiano ha le date di allora spostate di una o due ore | `Tempo` nella cartella `support/` del backend |
| La lega si aggiorna con `@DynamicUpdate` | L'aggiornamento scrive solo le colonne cambiate: aggiungere una tappa non riporta indietro una rinomina fatta nel frattempo da un altro dispositivo | Un'annotazione da conoscere | `Lega` del backend |
| L'anagrafe ha due forme: pubblica, senza dati personali, e completa per chi ha un account | Data di nascita, città, misure e referente sono dati personali | La cache del client va svuotata quando cambia chi guarda, all'accesso e all'uscita | `AnagrafeService` del backend; `src/stores/useAnagrafeStore.ts` |

### Prodotto

| Scelta | Perché | Alternativa scartata o limite | Dove nel codice |
|---|---|---|---|
| L'**Ospite** prova l'app senza account | Chi arriva vede subito come funziona, senza registrarsi | I suoi dati stanno solo in quel browser; niente pubblicazione, niente Coach, anagrafe e archivio in sola lettura | `src/stores/memoriaBrowser.ts`, `src/components/auth/GuestBanner.tsx` |
| L'account si elimina con `POST /api/auth/me/elimina`, non con `DELETE` | La richiesta porta la password nel corpo, e un corpo in una `DELETE` non è garantito attraverso i proxy | Un verbo meno «parlante» | `src/services/profiloApi.ts`; `ProfiloController` del backend |
| L'email cambia solo dopo la conferma dal **nuovo** indirizzo, con un clic sulla pagina | Un errore di battitura non lascia l'account con un indirizzo che nessuno legge. La pagina non manda niente finché non si preme il pulsante: uno scanner della posta che apre il link non consuma il token | Due passi invece di uno; nessuna email parte verso l'indirizzo vecchio | `src/pages/ConfermaEmailPage.tsx`; migrazione V10 del backend |
| L'ADMIN nasce da `ADMIN_EMAIL` e non cambia email né si elimina dall'app | Il server lo riconosce da quella variabile: con un'email cambiata, al riavvio nascerebbe un secondo admin | Si gestisce dalla configurazione del server | `DataSeeder` del backend |
| Le regole di gara sono quelle FIBA 3x3: 21 punti o 10 minuti, 12 secondi di possesso, niente pareggi. Le classifiche dei gironi seguono l'articolo 13 del regolamento | È il regolamento del circuito. Gli spareggi, in ordine: scontri diretti, media dei punti fatti, testa di serie | Le regole si cambiano per tappa | `src/constants/rules.ts`, `src/utils/standings.ts` |
| Il supplementare parte con il pulsante «Avvia supplementare», non da solo | Nel 3x3 c'è una pausa prima del supplementare, e il tavolo può ancora registrare un canestro del tempo regolamentare: con l'avvio automatico diventerebbe un punto del supplementare | Un clic in più per il tavolo | `src/components/partita/MatchTimer.tsx`, `src/utils/statoGara.ts` |
| I dati di prova del circuito (il **seed**: dati caricati al primo avvio; 32 giocatori, 8 squadre, 4 tappe) hanno persone di fantasia | Il file sta nel jar del backend anche quando il seed è spento: non deve contenere dati di persone reali. Un test lo controlla | Squadre, tappe e risultati restano quelli del circuito | `DatiDiProvaTest` del backend |
| Nomi del codice, interfaccia e messaggi d'errore in italiano | Gli utenti e chi valuta il progetto sono italiani; i termini del gioco (tappa, girone, tabellone) sono quelli del circuito. Il server risponde in italiano qualunque lingua chieda il browser | Nessuna traduzione dell'interfaccia | `src/utils/testi.ts`; `spring.web.locale=it` in `application.properties` del backend |
| Gli strumenti del Coach girano nel browser, con le stesse funzioni dell'interfaccia; il server fa solo da proxy | Il modello non scrive mai sul server da solo: ogni azione passa dagli stessi controlli di un clic. Sorteggiare su una tappa con risultati, annullare un risultato, concludere una tappa e inventare i risultati mancanti chiedono conferma nella chat | Il Coach risponde solo su basket e HOOP 3X3: la regola la aggiunge il server. È una regola di prodotto, non un confine di sicurezza | `src/coach/toolHandlers.ts`, [`docs/coach-ai-tool-calling.md`](docs/coach-ai-tool-calling.md); `AmbitoCoach` del backend |

### Qualità

| Scelta | Perché | Alternativa scartata o limite | Dove nel codice |
|---|---|---|---|
| Le operazioni di tappa sono **funzioni pure** (ricevono una tappa e ne restituiscono una nuova, senza toccare altro) | Prima il Coach duplicava la logica dell'interfaccia: ogni correzione andava fatta in due posti. Ora interfaccia e Coach chiamano le stesse funzioni, provate senza React | Lo store resta il solo punto che salva | `src/domain/tappaOps.ts`, `TODO.md` |
| Test di guardia nel backend: test che non provano una funzione, ma una regola valida anche per il codice futuro | Sei regole, e ognuna fa cadere un test: ogni endpoint sta in una lista della tabella degli accessi, con i casi 403 e 404 per quelli con un id e il corpo validato (`AccessoEndpointIT`); ogni campo di testo con un tetto è nella tabella dei tetti (`CampiDiTestoTest`); nessun tetto supera la lunghezza della sua colonna (`LimitiColonneIT`); un carattere oltre il tetto dà 400, su un endpoint per ogni modulo (`ValidazioneWebTest`); ogni tabella nuova è svuotata da `svuota.sql` prima dei test (`MigrazioniIT`); il README del backend cita file che esistono e ha un indice che combacia (`ReadmeTest`) | Controllano la forma (annotazioni, tabelle), non ogni comportamento | `AccessoEndpointIT`, `CampiDiTestoTest`, `LimitiColonneIT`, `MigrazioniIT` e `hoop3x3-backend/src/test/java/com/hoop3x3/backend/web/ValidazioneWebTest.java` del backend |
| Copertura minima dell'80% per file in `src/domain`, `src/utils`, `src/stores` e `src/services` | Con la media di cartella un file piccolo senza test (era `safeUrl`, l'unica difesa contro gli indirizzi `javascript:`) restava nascosto dietro quelli grandi | I componenti non hanno soglia: si provano di più dal browser | `vite.config.ts` |
| Test end-to-end sulla build servita da `vite preview` | Il dev server non può avere la Content-Security-Policy di produzione; la build sì, e una risorsa esterna non ammessa si scopre nei test | La build si rifà prima di ogni corsa | `playwright.config.ts` |
| Test end-to-end con il jar del backend vero | Provano ciò che il server finto può solo imitare: registrazione, rinnovo con il cookie vero, salvataggio e versioni | Servono Java e un database di prova; nella CI il jar si compila dal ramo principale del backend | `playwright.backend.config.ts`, `tests/e2e-backend/` |
| Lint con zero avvisi e controllo dei tipi a ogni push e pull request (CI); `npm run check` prima del commit | `npm run check` fa lint, tipi e test in un comando: gli stessi passi che la CI ripete | Un avviso ferma la CI anche quando è innocuo | `package.json` |
| CI su ogni pull request e aggiornamenti settimanali con Dependabot | Un errore si scopre prima di unire, non dopo la pubblicazione | Una pull request del frontend che dipende da una modifica del backend passa solo dopo che quella è unita | `.github/workflows/ci.yml`, `.github/dependabot.yml` |

### Deploy

| Scelta | Perché | Alternativa scartata o limite | Dove nel codice |
|---|---|---|---|
| Tutto su Render con un solo **Blueprint** (un file che descrive i servizi da creare) | Sito, backend e database nascono insieme, dalla stessa descrizione | Gli indirizzi pubblici vanno aggiornati a mano se Render li cambia | `render.yaml` |
| Il sito statico inoltra `/api/*` al backend con una **rewrite** (una regola che passa la richiesta a un altro server senza che il browser lo sappia) | Per il browser pagina e API hanno la stessa origine: il cookie di refresh `SameSite=Lax` funziona senza altro | Il limite di frequenza per indirizzo deve vedere l'indirizzo del visitatore e non quello del proxy: da qui due variabili del backend in `render.yaml` | `render.yaml` |
| Render controlla `/actuator/health/liveness`, non `/actuator/health` | La sonda di liveness dice solo se il processo è vivo. Quella intera comprende il database, e un database lento farebbe riavviare a vuoto un backend sano | Il frontend all'apertura aspetta `/actuator/health`, che il database lo comprende | `render.yaml`; `application.properties` del backend |
| Il container limita l'heap Java al 60% della memoria ed esce a un `OutOfMemoryError` | Con il 75% il processo intero superava i 512 MB del piano gratuito e Render lo uccideva senza una riga nei log. Uscire subito fa ripartire il servizio | Circa 300 MB di heap | `Dockerfile` del backend |
| Si pubblica prima il frontend, poi il backend | Quando un contratto cambia, il frontend nuovo sa parlare anche con il backend di prima | Una scheda rimasta aperta con il frontend vecchio va ricaricata | Nessun file: è una procedura, descritta in «Ordine di pubblicazione» di [Deploy su Render](#deploy-su-render) |
| All'apertura l'app chiama `/actuator/health` | Il backend gratuito dorme dopo 15 minuti: svegliarlo subito fa sì che al login sia già pronto | Il primo avvio dopo la pausa può superare il minuto | `svegliaServer` in `src/services/api.ts` |

### Interfaccia

| Scelta | Perché | Alternativa scartata o limite | Dove nel codice |
|---|---|---|---|
| Un tema scuro unico, «Asphalt»: asfalto quasi nero, un solo accento arancio, testo color gesso | Un campetto di notte sotto le luci. Prodotto con molti numeri: bordi al posto delle ombre, cifre tabulari | Nessun tema chiaro, tranne in stampa | `src/index.css` (`@theme`), [`docs/design-system.md`](docs/design-system.md) |
| Barlow Condensed per titoli e numeri, IBM Plex Sans per il testo | Un carattere condensato dà impatto ai punteggi senza allargare le colonne; IBM Plex Sans ha cifre leggibili a 12-13 px | Due font da caricare | `index.html`, [`docs/design-system.md`](docs/design-system.md) |
| Testo almeno 4,5:1 (valori in `docs/design-system.md`); bordi dei campi almeno 3:1, provati da `contrastoCampi.test.ts` | Leggibilità secondo le linee guida WCAG (le regole internazionali di accessibilità del web) | Il colore non è mai l'unico segnale: vittoria e sconfitta hanno anche la lettera, la differenza punti il segno | [`docs/design-system.md`](docs/design-system.md), `tests/unit/contrastoCampi.test.ts` |
| Ogni partita del tabellone è un gruppo con un nome (`role="group"`, «Semifinale 1: Alfa contro Beta») | Un lettore di schermo annuncia la partita; i test cercano la card per nome, non per classe di stile | Un attributo in più da tenere vero | `src/components/gironi/Bracket.tsx` |
| Area di tocco di almeno 44×44 px sotto i 640 px di larghezza o con un puntatore grossolano | I pulsanti piccoli si toccano senza sbagliare; con il mouse l'aspetto non cambia | Le voci della navigazione e le schede dell'anagrafe restano come sono | `area-tocco` in `src/index.css`, `tests/e2e/area-di-tocco.spec.ts` |
| Le finestre trattengono il focus, lo restituiscono alla chiusura e si chiudono con Esc una alla volta | Chi usa la tastiera non si perde dietro una finestra aperta | Il pannello del Coach non è modale: la pagina sotto resta raggiungibile | `src/components/ui/Modal.tsx`, `src/hooks/usePilaFinestre.ts` |
| In stampa spariscono intestazione, navigazione, Coach e i comandi `.no-print`, e il tema si inverte | Nella pagina di una tappa sono pulsanti anche le schede delle squadre e le intestazioni della classifica, che sulla carta servono. Su carta bianca i colori scuri darebbero testo chiaro su bianco | Ogni comando nuovo va marcato `.no-print` | `@media print` in `src/index.css`, `tests/e2e/stampa.spec.ts` |

## Come funziona, passo per passo

Cinque percorsi raccontati dall'inizio alla fine, con i file in cui succede ogni passo. Non serve conoscere React o Spring: basta seguire le frecce.

### Una sessione

1. **Registrazione o accesso.** Il modulo (`src/components/auth/AuthForm.tsx`) manda email e password a `POST /api/auth/register` o `POST /api/auth/login`. Il server controlla la password con BCrypt.
2. **Due credenziali.** La risposta contiene `{token, user}`: il token è il JWT di 30 minuti, che `src/services/api.ts` salva nel `localStorage`. Nella stessa risposta il server imposta il cookie `hoop3x3_refresh`, di 30 giorni: httpOnly, quindi invisibile a JavaScript, e mandato solo agli indirizzi `/api/auth`.
3. **Ogni richiesta.** `src/services/api.ts` aggiunge l'intestazione `Authorization: Bearer <JWT>`. Sul server il `JwtFilter` verifica la firma e la scadenza e riconosce l'utente dall'id scritto nel token. Più avanti, nei servizi, `AccessGuard` controlla che la risorsa sia sua, o che lui sia ADMIN.
4. **Il rinnovo.** Quando al JWT mancano meno di 2 minuti, il client chiama `POST /api/auth/refresh` con il cookie. Controlla ogni 60 secondi e quando si torna sulla scheda. Il server **ruota** il refresh token: quello vecchio smette di valere, ne arriva uno nuovo insieme a un JWT nuovo. Nel database c'è solo l'hash SHA-256 del token (un'impronta da cui non si risale al token), mai il token.
5. **Una scheda alla volta.** Con più schede aperte, il lucchetto Web Locks `hoop3x3_refresh` fa rinnovare una scheda sola: le altre aspettano il lucchetto e trovano il JWT nuovo già nel `localStorage`.
6. **L'uscita.** «Esci» cancella il JWT dal browser e chiama `POST /api/auth/logout`, che cancella il cookie e la riga del refresh token. Le altre schede se ne accorgono dall'evento `storage`.

**Perché 30 minuti e 30 giorni.** Un JWT già emesso non si può revocare: vale finché scade. Per questo dura poco, e un JWT rubato serve al massimo per 30 minuti. Il refresh token invece si revoca, perché il server lo cerca nella sua tabella: può durare a lungo, e chi torna dopo una settimana non rifà l'accesso.

**E se…**

- **…passano 30 giorni senza aprire l'app?** Il refresh token è scaduto: il rinnovo riceve 401 e l'app torna al modulo con «Sessione scaduta: accedi di nuovo».
- **…qualcuno ruba il cookie?** Chi lo usa per primo ottiene una sessione che si rinnova. Il proprietario, al suo rinnovo successivo, riceve 401 ed esce, perché il suo token è già stato ruotato. Il server non riconosce il riuso di un token ruotato: è tra i [limiti noti](#limiti-noti-e-prossimi-passi).
- **…cambio la password?** Il server chiude tutte le sessioni dell'account e ne riapre una sola, per il browser che ha fatto il cambio. Gli altri dispositivi escono al loro prossimo rinnovo, al più tardi dopo 30 minuti.

### Il viaggio di un risultato

1. **Il clic.** Nella card della partita (`src/components/partita/MatchCard.tsx`) l'organizzatore scrive il punteggio e preme «Salva risultato».
2. **La regola.** `src/hooks/useTappa.ts` chiama `registraRisultato` di `src/domain/tappaOps.ts`. È una funzione pura: riceve la tappa e restituisce una tappa nuova, oppure un errore (per esempio un pareggio, che il 3x3 non ammette).
3. **Lo schermo.** `replaceTappa` mette la tappa nuova nello store (`src/stores/useAppStore.ts`). La classifica del girone si ricalcola subito, prima di qualunque risposta del server.
4. **Il salvataggio.** Per l'Ospite lo store scrive la lega nel `localStorage`, e il viaggio finisce qui. Per il registrato la coda dei salvataggi (`src/stores/saveQueue.ts`) aspetta 400 millisecondi dall'ultima modifica, poi manda la tappa intera con `PUT /api/tappe/{id}` e la `versione` che conosce.
5. **Il server.** `TappaController` passa la richiesta a `LegaService`. Il servizio controlla, in ordine: che la versione ci sia, che la tappa esista e sia dell'utente, che la versione sia quella del database. Poi salva e risponde 200 con la versione nuova, che il client userà al salvataggio successivo.
6. **Il conflitto.** Se un altro dispositivo ha salvato la stessa tappa nel frattempo, il server risponde **409**.
   - Il client rilegge la lega con `GET /api/leghe/{id}`, mostra la tappa com'è sul server e lo dice nella barra degli avvisi (`src/components/layout/SyncBanner.tsx`).
   - Se invece la tappa del server è un suo salvataggio rimasto senza risposta, il conflitto è suo: prende la versione nuova e rimanda, senza avvisi.
7. **La rete che manca.** La coda riprova da sola dopo 2, 5 e 15 secondi. Intanto la barra dice quante tappe aspettano, con «Riprova ora». Alla chiusura della pagina ciò che resta parte con `keepalive`.

### La pubblicazione nell'archivio

1. **La conclusione.** L'organizzatore conclude la tappa: `concludi` di `src/domain/tappaOps.ts` la segna conclusa.
2. **Prima il salvataggio.** `pubblica` dello store aspetta che la coda dei salvataggi si svuoti: la copia pubblica deve partire dalla tappa che il server ha davvero.
3. **Solo l'id.** Il client chiama `PUT /api/archivio/{tappaId}` senza corpo. Il server (`ArchivioService`) costruisce la copia pubblica, lo **snapshot**, dalla tappa salvata; se la tappa non è conclusa risponde 409.
4. **L'elenco.** Alla pubblicazione il server scrive anche nome, luogo, data e numero di squadre in colonne normali (migrazione V6). `GET /api/archivio` legge solo quelle, senza aprire i blocchi JSONB. Con le colonne `legaId` e `autoreId` (il server della fase 12) l'elenco si raggruppa per lega, e «Ritira» si mostra solo a chi può: l'autore o l'ADMIN. Il frontend accetta anche il server di prima, che non li manda.
5. **La pagina pubblica.** Chiunque apre `/tappa/<id>` (`src/pages/TappaViewPage.tsx`): la pagina legge `GET /api/archivio/{tappaId}`, senza account, e offre «Stampa / PDF».

Se il proprietario elimina la tappa o la lega, il database toglie anche la pubblicazione, con la cascata della migrazione V2.

### Il Coach

1. **La domanda.** Il registrato scrive nel pannello (`src/components/coach/CoachPanel.tsx`). Un Ospite riceve l'invito a creare un account, e non parte nessuna chiamata.
2. **Il prompt.** `src/hooks/useCoachAI.ts` scrive il prompt di sistema: chi è il Coach, le regole FIBA 3x3, come usare gli strumenti. Aggiunge i dati della lega aperta, preparati da `src/utils/buildCoachContext.ts` dentro il blocco `<dati_lega>`; il blocco si ricostruisce a ogni giro di strumenti, così vede anche le tappe appena create. Insieme vanno gli ultimi 30 messaggi della chat.
3. **Il proxy.** `src/services/aiService.ts` manda tutto a `POST /api/coach/chat`, con le definizioni dei quattordici strumenti (`src/coach/toolDefs.ts`). Il backend controlla i limiti (20 richieste al minuto e 300 al giorno per utente, 60 messaggi, 100.000 caratteri, solo strumenti del Coach), aggiunge la sua regola del contesto e chiama il fornitore scelto con la chiave che tiene lui.
4. **Gli strumenti.** Se il modello chiede uno strumento, per esempio `registra_risultato`, la risposta torna al browser. `src/coach/toolHandlers.ts` lo esegue con le stesse funzioni dell'interfaccia (`src/domain/tappaOps.ts`, lo store), e il risultato torna al modello.
5. **Le conferme.** Sorteggiare su una tappa con risultati, annullare un risultato, concludere una tappa e inventare i risultati mancanti (`simula_risultati`) chiedono «Conferma» o «Annulla» nella chat, prima di toccare qualcosa. Per `crea_tappa`, `crea_tappa_simulata`, `registra_squadra` e `registra_giocatore` la conferma c'è solo davanti a un omonimo: una tappa o una voce dell'anagrafe con lo stesso nome.
6. **Il ciclo.** Domanda, strumento, risultato e nuova chiamata si ripetono al massimo 8 volte per domanda. Poi il Coach risponde con il testo, e i badge sotto la risposta dicono quali azioni ha fatto.
7. **Fuori tema.** Se la domanda non riguarda il basket né l'app, il modello risponde con un marcatore e il server lo sostituisce con una frase fissa: «Sono il Coach di HOOP 3X3: posso aiutarti con il basket, le tue leghe e tappe, squadre, giocatori e regole del torneo. Chiedimi qualcosa su questo.»

**Tappa di prova con il Coach.** Su richiesta («creami una tappa di prova con 8 squadre») il Coach usa un solo strumento, `crea_tappa_simulata`: sceglie le squadre dall'anagrafe, tra quelle con almeno 3 giocatori, e le porta nella lega aperta con il loro roster (al massimo 4 giocatori). Poi sorteggia i gironi, gioca tutte le gare dei gironi con i tabellini (la somma dei punti di ciascun tabellino è il punteggio della squadra) e la fase finale fino alla finale. I punteggi li genera l'app, non il modello, e sono numeri di prova, non risultati veri: il Coach lo dice nel riepilogo. La tappa non è conclusa: la pubblicazione nell'archivio resta un passo a parte, con `concludi_tappa` e la sua conferma. Le gare che restano si completano con `simula_risultati` (con conferma), i risultati dettati con `registra_risultati`.

Strumenti, conferme e chiamate al server, uno per uno: [`docs/coach-ai-tool-calling.md`](docs/coach-ai-tool-calling.md).

### La mappa dei campetti

La pagina dei campetti chiede i campi al backend, li cerca per raggio, per testo o per luogo, e li mostra su una mappa Leaflet. La posizione dell'utente si chiede solo con il suo clic. I passi, con i file, sono nella parte di riferimento, in [Campetti](#campetti).

## Glossario

Una o due righe per termine, con la sezione in cui compare.

### Il gioco

- **3x3** — Il basket a tre contro tre, su mezzo campo e un canestro solo. Si vince a 21 punti o allo scadere dei 10 minuti. Vedi [Regole FIBA 3x3](#regole-fiba-3x3-default).
- **Bye** — Il passaggio del turno senza giocare: nel tabellone, le migliori teste di serie quando le qualificate non riempiono i posti.
- **Girone** — Un gruppo di squadre che giocano tutte contro tutte. Le prime passano al tabellone.
- **Lega** — Il contenitore delle tappe di un organizzatore, per esempio un circuito di una stagione.
- **Rank** (punti ranking) — Il punteggio di una squadra nel circuito: serve al sorteggio a serpentina e alla classifica del circuito.
- **Roster** — L'elenco dei giocatori di una squadra: 3 o 4 in una tappa, fino a 6 nella scheda dell'anagrafe.
- **Scontri diretti** — Il primo criterio di spareggio tra squadre a pari vittorie: contano solo le partite giocate tra loro.
- **Serpentina** — Un sorteggio per ranking: la prima testa di serie va nel girone A, la seconda nel B e così via, poi si torna indietro. I gironi restano equilibrati.
- **Shot clock** — Il tempo per tirare: nel 3x3, 12 secondi per ogni possesso.
- **Supplementare** — Il tempo in più quando la gara finisce in parità: vince chi segna per primo 2 punti.
- **Tabellino** — Le statistiche di ogni giocatore in una partita: punti, rimbalzi, assist, palle rubate, stoppate, palle perse, falli.
- **Tabellone** — La fase a eliminazione diretta dopo i gironi: ottavi, quarti, semifinali, finale.
- **Tappa** — Un torneo del circuito, con il suo nome, luogo, data e le sue squadre.

### La tecnica

- **ADMIN** — Il ruolo dell'amministratore: modifica ed elimina i dati di chiunque. Nasce dalla configurazione del server (`ADMIN_EMAIL`).
- **API REST** — Un server che risponde a indirizzi e verbi HTTP (`GET`, `POST`, `PUT`, `DELETE`) con dati in JSON. Vedi [Architettura](#architettura).
- **Bearer** — Il modo di mandare il JWT: l'intestazione `Authorization: Bearer <token>`, «al portatore», cioè vale per chi lo presenta.
- **BCrypt e hash** — Un hash trasforma una password in un'impronta da cui non si torna indietro. BCrypt è un hash lento apposta. Vedi [Sicurezza](#sicurezza).
- **CI** (integrazione continua) — Un servizio che a ogni modifica esegue lint, test e build. Qui GitHub Actions.
- **Container** — Un pacchetto che contiene un programma con tutto ciò che gli serve per girare. Qui il backend, costruito dal `Dockerfile`.
- **Cookie httpOnly** — Un cookie che il browser manda al server ma che JavaScript non può leggere.
- **CORS e stessa origine** — L'origine è schema, host e porta di un sito. Il browser limita le richieste verso un'altra origine (CORS è il permesso di farle). Qui pagina e API stanno sulla stessa origine.
- **Copertura** — La parte del codice che i test eseguono, in percentuale. Vedi [Qualità](#qualità).
- **CSP** (Content-Security-Policy) — L'elenco delle origini da cui una pagina può caricare script, stili, immagini e frame. Vedi [Sicurezza](#sicurezza).
- **CSRF** (Cross-Site Request Forgery) — Un sito estraneo che fa partire una richiesta a nome tuo, con i tuoi cookie.
- **Endpoint** — Un indirizzo dell'API con il suo verbo, per esempio `PUT /api/tappe/{id}`.
- **Heap** — La memoria in cui la JVM tiene gli oggetti del programma; nel container è limitata al 60% della memoria.
- **JSON** — Il formato di testo con cui viaggiano i dati: oggetti con chiavi e valori.
- **JSONB** — Il tipo di PostgreSQL che conserva un JSON in forma binaria, interrogabile.
- **JWT** (JSON Web Token) — Un biglietto firmato dal server che dice chi sei e fino a quando vale. Vedi [Una sessione](#una-sessione).
- **Limite di frequenza** — Un tetto al numero di richieste in una finestra di tempo; oltre, il server risponde 429.
- **Lint** — Un controllo automatico del codice che trova errori e cattive abitudini senza eseguirlo.
- **Migrazione** — Un file SQL numerato che cambia lo schema del database; si applicano in ordine, una volta sola.
- **ORM** (Object-Relational Mapping) — Una libreria che fa leggere e scrivere le tabelle come oggetti del linguaggio.
- **Proxy e rewrite** — Un proxy fa da intermediario tra due parti. Una rewrite è la regola con cui il sito statico passa `/api/*` al backend.
- **Refresh token** — Una credenziale lunga, nel cookie httpOnly, che serve solo a ottenere un JWT nuovo.
- **SPA** (Single Page Application) — Un'app web che si carica una volta e cambia pagina senza ricaricare il sito.
- **Starter** — Un pacchetto di Spring Boot che porta con sé una funzione intera (web, sicurezza, database) con la sua configurazione di base.
- **Test end-to-end** — Un test che usa l'app intera in un browser vero, come una persona.
- **Test di integrazione** — Un test che fa lavorare insieme più parti vere, per esempio il server e il database.
- **Test unitario** — Un test che prova una parte piccola da sola, per esempio una funzione.
- **Tool calling** — La capacità di un modello linguistico di chiedere l'esecuzione di uno strumento con dei parametri. Vedi [Il Coach](#il-coach).
- **Transazione** — Un gruppo di scritture sul database che riesce tutto insieme o non riesce affatto.
- **UUID** — Un identificativo di 128 bit, scritto in esadecimale; quelli casuali non si indovinano.
- **USER** — Il ruolo di ogni utente registrato: modifica solo i dati che ha creato.
- **Variabile d'ambiente** — Un valore di configurazione dato al programma da fuori, senza scriverlo nel codice: qui le chiavi e gli indirizzi.
- **XSS** (Cross-Site Scripting) — Codice estraneo che riesce a girare dentro la pagina.

## Limiti noti e prossimi passi

Sapere che cosa manca vale quanto sapere che cosa c'è. Questi sono i limiti di oggi, scritti nel codice, nei README e nel `TODO.md`.

### Sessione e sicurezza

- Il logout chiude la sessione del browser da cui parte. Un JWT già emesso resta valido fino alla scadenza, al massimo 30 minuti; gli altri dispositivi non vengono toccati.
- Il server non riconosce il riuso di un refresh token già ruotato e non ha un «esci da tutti i dispositivi»: le sessioni si chiudono tutte solo cambiando la password.
- Se la risposta di un rinnovo si perde (pagina chiusa, rete caduta), al rinnovo dopo si torna al login. Un periodo di grazia di qualche decina di secondi lo eviterebbe (`TODO.md`).
- L'accesso fatto in una scheda non si vede nelle altre finché non si ricaricano (`TODO.md`).
- I log del login fallito e della registrazione scrivono l'email intera; quelli del recupero password la mascherano.

### Server e dati

- C'è una sola istanza del server: i contatori dei limiti di frequenza stanno in memoria e si azzerano a ogni riavvio.
- Sul piano gratuito di Render il backend dorme dopo 15 minuti senza visite, e il database scade dopo 30 giorni.
- L'anagrafe è condivisa tra tutti i registrati e i nomi non sono unici: due squadre o due giocatori possono chiamarsi allo stesso modo. I doppioni restano permessi e il form avvisa, senza bloccare. Le statistiche li distinguono per id dell'anagrafe quando la squadra di tappa è collegata; senza collegamento, o con due omonimi nello stesso roster, le loro gare si sommano nella stessa riga, segnata con ⚠ (`src/utils/statGiocatori.ts`).
- L'anagrafe si scarica intera: la ricerca e la paginazione sul server sono nel `TODO.md`.
- `GET /api/archivio/tappe` porta tutte le tappe pubblicate per intero, senza cache: va bene per decine di tappe, con centinaia servirà una paginazione o un calcolo sul server.
- Le statistiche tra tappe le calcola il browser: in SQL servirebbe separare partite e statistiche dal JSONB.

### Coach AI

- La regola del contesto è di prodotto, non di sicurezza: un prompt costruito apposta può aggirarla, a spese della quota dell'utente.
- `annulla_risultato` vale per i gironi, non per il tabellone.
- Le gare del tabellone di una tappa di prova non hanno tabellini: il modello dati li prevede per i gironi, non per il tabellone (come per le statistiche di stagione).
- La lettura delle foto dipende da un modello: un foglio scritto male o una foto storta possono dare una bozza sbagliata. La bozza si controlla prima di creare la lega, e i dubbi del modello lo segnalano. La lettura va provata con fogli scritti a mano veri.

### Video

- Gli indirizzi `youtube.com/live/…` non si riconoscono come YouTube: si aprono in una nuova scheda.

### Tabellini live (da progettare)

Oggi chi guarda una tappa vede i risultati ricaricando la pagina, o quando la tappa è pubblicata nell'archivio. Un tabellino in diretta vorrebbe dire mandare ogni salvataggio a chi guarda, senza ricaricare.

L'idea è un canale WebSocket dal backend, con una connessione per tappa: a ogni salvataggio il server manda il tabellino aggiornato. Non è ancora progettato. Restano da decidere:

- chi può guardare: la tappa pubblica, o solo il registrato proprietario della lega;
- come autenticare la connessione: il browser non manda l'intestazione `Authorization` con un WebSocket, quindi il JWT andrebbe passato in un altro modo;
- la Content-Security-Policy: `connect-src` oggi ammette solo la stessa origine, e va verificata per il canale;
- il limite di connessioni contemporanee sul piano gratuito di Render, dove il backend si spegne dopo 15 minuti senza richieste;
- la versione della tappa: il tabellino arriva dal server, quindi la coda dei salvataggi e i conflitti restano la fonte di verità.

Un'alternativa più semplice, se basta il flusso dal server al browser, sono gli eventi inviati dal server (Server-Sent Events).

## Com'è cresciuto il progetto

Il progetto nasce a giugno 2026 con il frontend; il repository del backend parte a settembre. Da ottobre il lavoro procede per fasi: ognuna ha un piano scritto, una pull request per repository e una revisione prima dell'unione. I numeri delle pull request sono quelli di GitHub: `Hoops-3x3#N` per il frontend, `hoop3x3-backend#N` per il backend.

| Quando | Che cosa è entrato | Pull request |
|---|---|---|
| giugno 2026 | Prima versione dell'app: leghe, tappe, gironi e fasi dirette, anagrafe, Coach AI | commit diretti sul ramo principale |
| 17 settembre 2026 | Il backend: API REST con JWT e PostgreSQL, proxy verso Groq | primo commit di hoop3x3-backend |
| 1-2 ottobre | Operazioni di tappa come funzioni pure; sessione con refresh token; il design system «Asphalt» | Hoops-3x3#1, #2, #3; hoop3x3-backend#1 |
| 2 ottobre | Fase 0: lint, test, end-to-end e CI; Java 25 e Maven Wrapper | Hoops-3x3#4; hoop3x3-backend#2 |
| 5 ottobre | Fase 1: correzioni funzionali (tabellone, salvataggi, regole, Coach, sessione, permessi, import) | Hoops-3x3#5; hoop3x3-backend#3 |
| 6 ottobre | Pubblicazione su Render: Blueprint, Dockerfile, controllo di salute | Hoops-3x3#6, #7, #8; hoop3x3-backend#4, #5 |
| 7 ottobre | Fase 2: robustezza (errori visibili, conferme, accessibilità, versione delle tappe, archivio dal server, Flyway, limiti di frequenza) | Hoops-3x3#9; hoop3x3-backend#6 |
| 7 ottobre | Fase 3: pulizia e struttura (Coach in tre file, store diviso, date in UTC, proprietà di configurazione) | Hoops-3x3#10; hoop3x3-backend#7 |
| 8 ottobre | Fase 4: test e documentazione (soglie di copertura, test di guardia degli endpoint, README allineati) | Hoops-3x3#11; hoop3x3-backend#8 |
| 8-9 ottobre | Revisione del codice: test con il backend vero, avvio a freddo, liveness, correzioni minori | Hoops-3x3#12, #13; hoop3x3-backend#9, #10 |
| 9 ottobre | Aggiornamenti delle dipendenze proposti da Dependabot | Hoops-3x3#14, #15, #16, #19; hoop3x3-backend#11, #12 |
| 12 ottobre | Fase 5: campetti con la mappa (prima un'immagine di Google, poi Leaflet e OpenStreetMap), ricerca di un luogo, tabellone accessibile | Hoops-3x3#20, da #24 a #30; hoop3x3-backend da #13 a #18 |
| 12 ottobre | Recupero della password via email, con Brevo | Hoops-3x3#31; hoop3x3-backend da #19 a #23 |
| 13 ottobre | Fase 6: la pagina Profilo (nome, password, email, eliminazione dell'account) | Hoops-3x3#32; hoop3x3-backend#24 |
| 14 ottobre | Fase 7: il Coach resta nel suo contesto, statistiche di stagione per tutti, video a tutta larghezza | Hoops-3x3#33; hoop3x3-backend#25 |
| 14 ottobre | Fase 8: il README con le tecnologie e le scelte spiegate | Hoops-3x3#34 |
| 17 ottobre | Fase 9: «Importa file» legge la foto di un foglio di tappa, con la finestra dei dubbi; il Coach corregge le squadre | Hoops-3x3#35; hoop3x3-backend#27 |
| 19 ottobre | Fase 10: il Coach costruisce una tappa completa (tappa di prova, simulazione, registrazione in blocco) | Hoops-3x3#42; hoop3x3-backend#31 |
| 20 ottobre | Fase 11a: omonimi, identità per id, statistiche e avvisi sui doppioni | Hoops-3x3#43; hoop3x3-backend#32 |
| 20 ottobre | Fase 11b: collegamento con scelta tra squadre omonime, Coach con il dettaglio tra parentesi | Hoops-3x3#44 |
| 20 ottobre | Fase 11c: i rilievi rimandati (Coach: ripetizioni, «Tappa N» e limite di tappe; voce eliminata; testi degli avvisi; documenti) | Hoops-3x3#45 |
| 22 ottobre | Fase 12: Coach (rilievi della fase 10), ospite senza allineamento, squadra del giocatore dal roster, archivio per lega con «Ritira» | questa pull request; Gabrieleleonardi21/hoop3x3-backend#33 |

## Riferimento

La parte 2 è il riferimento tecnico di oggi: che cosa fa ogni funzione, come si avvia e si pubblica l'app, come sono fatti i dati. Il contratto del server (endpoint, limiti, variabili) è nel README del [backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).

### Funzionalità

L'elenco completo, schermata per schermata, è in [`FUNZIONALITA.txt`](FUNZIONALITA.txt). Qui le funzioni in breve.

#### Leghe e tappe

- **Leghe.** Un utente registrato ha più leghe, ognuna con le sue tappe: al massimo 100, il tetto del server; il nome fino a 120 caratteri.
  - Si creano, si rinominano, si aprono dall'elenco e si eliminano, con una conferma che per un registrato ricorda che le tappe pubblicate escono dall'archivio.
  - Se l'elenco non arriva dal server la pagina lo dice, con «Riprova», invece di mostrarlo vuoto; se non si legge solo l'ultima lega aperta, l'elenco resta.
  - Una lega si esporta in un file JSON e si importa da file: l'import crea sempre una lega nuova.
  - «Importa file» accetta anche la foto di un foglio di tappa scritto a mano: la foto diventa una lega nuova con la sua tappa. I dubbi del modello compaiono in una finestra, con «Apri il Coach» per correggerli (vedi «Lettura delle foto»).
  - La classifica del circuito ordina le squadre con punti ranking per il punteggio più alto ottenuto nelle tappe, con il numero di tappe giocate. Le segnaposto «Squadra N» e quelle senza punti restano fuori.
- **Tappe.** Nome, luogo, data, da 2 a 64 squadre con roster di 3-4 giocatori (almeno 3 per sorteggiare), un numero di gironi da 1 a metà delle squadre (al massimo 32) e regole di gara per tappa. Sorteggio dei gironi casuale o a serpentina per ranking, calendario all'italiana, fase finale a eliminazione diretta, conclusione e riapertura.
- **Gironi e fase finale.** La classifica del girone ordina per vittorie, poi scontri diretti, media dei punti fatti per gara e, a parità, ordine delle teste di serie (articolo 13 del regolamento FIBA 3x3). Il tabellone va a turni (ottavi, quarti, semifinali, finale); con più di un girone, le migliori teste di serie passano il primo turno senza giocare quando le qualificate non riempiono i posti.
- **Punteggi.** Il risultato di ogni gara (niente pareggi), il tabellino per giocatore (punti, rimbalzi, assist, palle rubate, stoppate, palle perse, falli) e il registro degli eventi (fallo, sostituzione, timeout, infortunio, altro). Ai registrati i punti dei giocatori sono richiesti e devono sommare al totale; l'Ospite fa prove libere.
- **Timer di gara.** Una finestra per il tavolo con il cronometro, lo shot clock, il punteggio +1/+2, la fine della partita rilevata da sola e il supplementare.
- **Conferme.** Ciò che fa perdere dati apre una finestra che dice che cosa si perde: eliminare una tappa, una lega, il tabellone, una voce dell'anagrafe o un campetto; rifare il sorteggio o cambiare squadre e gironi con dei risultati; rimuovere una squadra con dati o un giocatore con statistiche; riaprire una tappa pubblicata.
- **Home.** La tappa in corso, la classifica dal vivo, l'ultimo risultato registrato, le prossime partite e i leader.

#### Statistiche, anagrafe, archivio e video

- **Statistiche.** I leader della tappa per categoria (punti, rimbalzi, assist, palle rubate, stoppate) e le statistiche di stagione per giocatore. Queste sommano le tappe pubblicate nell'archivio e quelle della lega aperta, e sono uguali per tutti: Ospite, USER e ADMIN (`src/hooks/useStatisticheCircuito.ts`, `GET /api/archivio/tappe`). Stanno nella scheda «Statistiche stagione» dell'anagrafe. Ogni giocatore si riconosce per l'id dell'anagrafe quando la tappa ce l'ha; altrimenti per nome nella squadra collegata, se nel suo roster c'è un solo giocatore con quel nome; altrimenti per nome e squadra. Chi cambia squadra collegata resta una riga, e il segno ⚠ indica due omonimi non collegati sommati in una stessa riga (`src/utils/identita.ts`).
- **Profilo del giocatore.** La pagina `/giocatore/:id`, con le statistiche della scheda «Statistiche stagione», l'andamento dei punti, lo storico delle tappe e le ultime partite. Conta solo le gare della persona: due omonimi registrati hanno ciascuno la propria pagina, e le gare che non si possono attribuire sono indicate a parte.
- **Anagrafe.** Un archivio condiviso di giocatori e squadre che le tappe riutilizzano.
  - Una squadra ha logo e sito web cliccabile, e un roster fino a 6 giocatori (`MAX_ROSTER_ANAGRAFE`), diverso dai 4 di una squadra di tappa (`MAX_ROSTER`).
  - Logo, sito, Instagram e link dei video sono vuoti oppure indirizzi `http(s)://` o percorsi del sito come `/logos/nome.svg`, fino a 2048 caratteri, come vuole il server. I moduli lo controllano prima dell'invio (`erroreUrl` in `src/utils/safeUrl.ts`).
  - Scrivendo il nome di una squadra di tappa, questa si collega alla voce dell'anagrafe (nome, logo, ranking e sito; il roster non si copia) o ne crea una, solo se all'arrivo della risposta la squadra ha ancora quel nome. Una squadra già collegata resta collegata alla sua voce, anche se la cache non la conosce ancora: finché la voce c'è non si ricollega mai per nome. Per nome si collegano solo le squadre senza collegamento. Con due squadre omonime in anagrafe la pagina non sceglie la prima: chiede quale collegare (`src/components/squadra/SceltaSquadraDialog.tsx`). Se la voce di una squadra collegata viene eliminata dalla pagina Anagrafe, all'apertura della tappa la squadra si scollega (tiene nome, logo e ranking) e la card lo dice sotto il nome (`AVVISO_VOCE_ELIMINATA`, che sparisce quando si scrive un nome nuovo). Se in anagrafe resta una sola squadra con quel nome, la squadra si ricollega a quella nello stesso giro, senza avviso. L'Ospite non si collega: `syncFromAnagrafe` (`src/hooks/useTappa.ts`) esce subito per lui, senza richieste al server e senza scritture nel browser, e la tappa non cambia all'apertura.
  - «Scollega» toglie il collegamento e rende di nuovo modificabile il nome. Serve a cambiarlo, e resta anche alla riapertura della tappa: per ricollegarla si scrive di nuovo il nome.
  - Modifica ed eliminazione solo per l'autore o un ADMIN.
  - I dati personali li vede solo chi ha un account: del giocatore data di nascita, città, nazionalità, altezza, peso, esperienza, note e autore; della squadra referente e autore.
  - Nei testi (scheda, card, avviso di omonimia, ricerca) la squadra di un giocatore è quella del roster in cui sta, e il testo scritto nella scheda vale solo per chi non è in nessun roster (`nomeSquadraDi` in `src/utils/identita.ts`). Il logo segue lo stesso roster (`squadraDelGiocatore`): senza roster, il ripiego per nome vale solo se la squadra si chiama così una volta sola.
- **Archivio.** Le tappe concluse e pubblicate (pubblicano solo i registrati), consultabili senza account in `/archivio` e `/tappa/:id`. L'elenco è raggruppato per lega; l'autore e l'ADMIN possono ritirare una pubblicazione dall'elenco, con conferma (non dalla pagina della tappa).
  - Squadre e roster, risultati, classifiche dei gironi, tabellone, leader e video, con «Stampa / PDF».
  - Il link pubblico di una tappa conclusa si copia dalla sua pagina.
- **Video.** Link video per tappa, che si aggiungono e si tolgono anche a tappa conclusa: ogni cambio ripubblica la copia nell'archivio.
  - Quelli di YouTube si incorporano nella pagina con l'embed `youtube-nocookie.com`: uno per riga, a tutta la larghezza della colonna, 16:9 e mai più alti dello schermo (`.video-pieno` in `src/index.css`). La sezione non si stampa.
  - Gli altri si aprono in una nuova scheda.

#### Coach AI e campetti

- **Coach AI.** Un assistente che conosce le regole FIBA 3x3 e i dati della lega aperta.
  - Agisce nell'app con 14 strumenti: crea lega e tappa, crea una tappa di prova con le squadre dell'anagrafe, sorteggia, registra e annulla risultati (anche più di uno in un colpo), inventa i risultati mancanti di una tappa, genera le fasi dirette, conclude la tappa, scrive nell'anagrafe, corregge nomi e giocatori di una squadra (per esempio dopo la lettura di una foto).
  - Chiede conferma prima di sorteggiare su una tappa con risultati, di annullare un risultato, di concludere una tappa e di inventare i risultati mancanti; `crea_tappa`, `crea_tappa_simulata`, `registra_squadra` e `registra_giocatore` la chiedono solo davanti a un omonimo.
  - Solo per i registrati, attraverso il backend: vedi [Coach AI (facoltativo)](#coach-ai-facoltativo) e [`docs/coach-ai-tool-calling.md`](docs/coach-ai-tool-calling.md).
- **Campetti.** I campi da streetball del circuito, letti dal server senza account (vedi [Campetti](#campetti)).
  - All'apertura quelli intorno a Roma; con «Usa la mia posizione» quelli intorno a chi guarda, con le distanze e in ordine di distanza. La casella di ricerca cerca per nome o città su tutta l'Italia.
  - Filtri sui risultati: illuminato, coperto, 4 canestri, gratuito, retine, fontanella, stato del campo.
  - Una mappa interattiva (Leaflet, con le tessere di OpenStreetMap) con i pin dei campetti, e per ogni campo «Indicazioni» e «Apri in Google Maps».
  - Ogni registrato aggiunge un campetto, con la posizione presa da «Usa la mia posizione», da un clic sulla mappa o scritta a mano. L'autore o un ADMIN lo modifica ed elimina; l'Ospite legge soltanto.

#### Accesso, sessione e profilo

- **Ospite.** Un accesso senza account per provare l'app: la lega sta nel `localStorage` del browser, anagrafe e archivio sono in sola lettura, pubblicazione e Coach AI non ci sono.
- **Sessione persistente.** Accesso e dati restano nel browser; la sessione si rinnova da sola e «Esci» la chiude anche sul server. Gli Ospiti hanno dati locali separati.
- **Recupero della password.** «Password dimenticata?», nella scheda «Accedi», apre `/password-dimenticata`.
  - Si scrive la mail e «Invia il link» manda la richiesta a `POST /api/auth/password/dimenticata`. Il messaggio è sempre quello del server, uguale per una mail registrata e per una che non lo è: la pagina non rivela chi ha un account. Senza rete compare un errore con «Riprova».
  - Il link della mail apre `/reimposta-password?token=…`: «Nuova password» e «Ripeti la password», con le regole della registrazione (da 8 caratteri a 72 byte UTF-8, `passwordSchema` in `src/utils/credenziali.ts`) e il confronto dei due prima dell'invio a `POST /api/auth/password/reimposta`.
  - Il token si legge dall'indirizzo, quindi la pagina regge il ricaricamento; senza token dice subito «Il link non è valido».
  - Riuscita, mostra il messaggio del server e «Accedi» riporta al modulo. Con un link scaduto, già usato o respinto, il messaggio del server resta accanto a «Richiedi un nuovo link».
- **Profilo dell'utente.** La voce «Profilo», in fondo al menu, apre `/profilo` (dentro `RequireAuth`), con quattro schede.
  - **Nome utente**, da 2 a 80 caratteri (`nomeUtenteSchema`; `PATCH /api/auth/me`). Il nome nuovo compare subito nell'intestazione; le cache dell'anagrafe e dei campetti si svuotano, perché hanno il vecchio nome come autore.
  - **Password** (`POST /api/auth/me/password`). Serve quella attuale; la nuova ha le regole della registrazione e va ripetuta. Il server chiude le altre sessioni e rinnova questa: il JWT nuovo sostituisce quello nel `localStorage`, e le altre schede dello stesso browser lo vedono dall'evento `storage`.
  - **Email** (`POST /api/auth/me/email`), con la password attuale. Il server manda un link al **nuovo** indirizzo. L'email cambia solo quando si apre `/conferma-email?token=…` e si preme «Conferma l'indirizzo» (`POST /api/auth/email/conferma`): la pagina è pubblica e non manda niente prima del clic, così uno scanner della posta non consuma il token.
  - **Elimina account** (`POST /api/auth/me/elimina`, un `POST` perché il corpo porta la password). Una finestra di conferma dice quante leghe spariscono e che campetti e schede dell'anagrafe restano senza autore. Dopo il 204 nel browser non resta niente e si torna alla home con «Account eliminato.».
  - Un rifiuto del server (password attuale sbagliata, email già registrata, troppe richieste) compare sotto il modulo com'è, e ciò che l'utente ha scritto resta.
  - L'Ospite vede un messaggio al posto delle schede. L'ADMIN non cambia email né si elimina dall'app (`ADMIN_EMAIL` nella configurazione del server).
  - Limite noto: se il rinnovo automatico del JWT è già partito quando si cambia la password, può arrivare dopo il cambio. Il refresh token che usa è stato chiuso dal server, quindi l'utente esce al rinnovo successivo, solo in quel caso raro.
  - Se si preme «Esci» mentre una richiesta del profilo è in volo, la risposta non rimette dentro l'utente, e il JWT nuovo della password non si salva.

### Regole FIBA 3x3 (default)

Le regole di gara di base di ogni tappa nuova (`src/constants/rules.ts`), modificabili tappa per tappa. Sono quelle del regolamento ufficiale, le [FIBA 3x3 Official Rules of the Game](https://fiba3x3.com/docs/fiba-3x3-basketball-rules-full-version.pdf).

| Parametro | Valore |
|---|---|
| Punti per vincere | 21 |
| Durata massima | 10 minuti |
| Shot clock | 12 secondi |
| Supplementare | primo a 2 punti |

La classifica di un girone segue l'articolo 13 («Classification») dello stesso regolamento. A pari vittorie decidono, in ordine e ciascuno una volta sola: gli scontri diretti (solo vittorie e sconfitte), la media dei punti fatti per gara, la testa di serie. Il criterio sta in un punto solo, `src/utils/standings.ts`, usato da tabella, home, archivio, tabellone e Coach.

### Avviare, provare, pubblicare

#### Requisiti

| Per | Serve |
|---|---|
| Il frontend | [Node](https://nodejs.org/) 22.22.2 o più nuovo nella serie 22, 24.15 o più nuovo nella serie 24, oppure 26 e oltre, con npm. Il vincolo più stretto è quello di jsdom 30, usato dai test; Vite 6 e React Router 7 chiedono meno. `package.json` non dichiara `engines` e non c'è un `.nvmrc`: la CI e Render usano la 22 |
| Le funzioni da registrato | Il backend [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend) in ascolto su `localhost:3001`: JDK 25 e PostgreSQL su `localhost:5432` (Maven lo scarica il wrapper `./mvnw`) |

Il backend serve per registrazione e accesso, leghe e tappe sul server, anagrafe, archivio, campetti e Coach AI. Senza, l'app parte lo stesso e l'Ospite crea e gioca una tappa nel browser; le pagine che leggono dal server mostrano l'errore con «Riprova».

I test unitari e quelli end-to-end di `tests/e2e/` non hanno bisogno del backend. Quelli di `tests/e2e-backend/` lo avviano da soli (vedi [Test end-to-end con il backend vero](#test-end-to-end-con-il-backend-vero)).

#### Variabili d'ambiente

Il frontend ne ha una sola, facoltativa, tipizzata in `src/vite-env.d.ts`. Il modello è `.env.example`, da copiare in `.env`, che git ignora.

| Variabile | A che cosa serve |
|---|---|
| `VITE_API_URL` | L'origine del backend, letta in `src/services/api.ts`. Vuota va bene in sviluppo, dove il proxy di Vite (`vite.config.ts`) inoltra `/api` e `/actuator/health` a `http://localhost:3001`, e dietro un reverse proxy sulla stessa origine. Va impostata solo se il backend ha un'origine propria (vedi sotto) |

La chiave del Coach AI non è qui ma nell'`env.properties` del backend.

#### Avvio rapido

**1. Backend.** Clona [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend) e segui il suo README: crea un database `hoop3x3` vuoto, compila `env.properties`, poi `./mvnw spring-boot:run`. Le tabelle le crea Flyway all'avvio: non c'è nessuno script da eseguire.

```bash
git clone https://github.com/Gabrieleleonardi21/hoop3x3-backend.git
cd hoop3x3-backend && ./mvnw spring-boot:run
```

L'API risponde su `http://localhost:3001`. Hibernate gira in `validate`: se lo schema non combacia con le entity, si ferma all'avvio con un messaggio chiaro.

**2. Frontend.**

```bash
npm install
npm run dev
```

L'app è su `http://localhost:5173`; in sviluppo le chiamate a `/api` passano dal proxy di Vite verso il backend.

**In produzione** la strada più semplice è un reverse proxy che serve frontend e API sulla stessa origine: su Render lo fa la rewrite del Blueprint. `VITE_API_URL` resta vuota e la sessione si rinnova da sola. Nel backend servono solo `CORS_ORIGINS` con l'origine pubblica del frontend e, con HTTPS, `AUTH_COOKIE_SECURE=true`.

**Con un backend su un'altra origine** imposta `VITE_API_URL` con quell'origine (vedi `.env.example`) e metti l'origine del frontend in `CORS_ORIGINS` del backend. Il login funziona, ma il cookie di refresh non viaggia e la sessione dura quanto il JWT, 30 minuti, finché non si completano i passi di «Sessioni e refresh token» nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).

#### Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Dev server con la ricarica a caldo su `http://localhost:5173`; le chiamate a `/api` passano dal proxy verso il backend |
| `npm run build` | Controllo dei tipi (`tsc -b`) e build di produzione in `dist/` |
| `npm run preview` | Serve `dist/` su `http://localhost:4173`, dopo `npm run build`; è tra le origini che il backend ammette di base |
| `npm run lint` | ESLint su tutto il progetto, senza avvisi ammessi (`--max-warnings 0`) |
| `npm run typecheck` | Controllo dei tipi (`tsc -b`) |
| `npm test` | Test unitari (Vitest, `tests/unit/`) |
| `npm run check` | `lint` + `typecheck` + `test`: il controllo da fare prima di ogni commit. Non comprende copertura, build ed end-to-end |
| `npm run test:e2e` | Test end-to-end (Playwright, `tests/e2e/`): fanno da soli la build e la servono con `vite preview` sulla porta 5199, con la Content-Security-Policy di produzione |
| `npm run test:e2e:backend` | Test end-to-end con il backend vero (`tests/e2e-backend/`): avviano il jar del backend sulla porta 3199 e il dev server sulla 5299; servono `E2E_BACKEND_JAR` e un database di prova (vedi sotto) |

#### Test end-to-end

La prima volta: `npx playwright install chromium`. I test sono provati solo con Chromium.

Per `tests/e2e/` non serve il backend. I percorsi da registrato ricevono risposte finte alle chiamate a `/api` (`tests/e2e/helpers.ts`), gli altri lavorano da Ospite. Girano sulla build servita da `vite preview`, non sul dev server: così provano anche la Content-Security-Policy. Senza proxy, una chiamata a `/api` senza risposta finta riceve dal preview la pagina dell'app, non un errore di rete.

#### Test end-to-end con il backend vero

`tests/e2e-backend/` (configurazione in `playwright.backend.config.ts`) prova senza risposte finte ciò che il server finto può solo imitare:

- registrazione, uscita e accesso con le credenziali controllate dal server;
- lega e tappa salvate sul server e rilette dopo una ricarica;
- il rinnovo del JWT con il cookie di refresh vero, due volte di seguito (il server ruota il refresh token a ogni rinnovo);
- il profilo: nome, password (con la vecchia respinta dopo il cambio), richiesta di cambio email, eliminazione dell'account con l'accesso poi respinto. Gli endpoint del profilo sono nel backend dal 13 ottobre 2026 (hoop3x3-backend#24);
- i campetti: creazione, modifica ed eliminazione.

Fissano anche il contratto che il server finto di `tests/e2e/` imita: le creazioni rispondono 201, la prima versione di una tappa è 0 e ogni PUT la aumenta di uno.

Servono Java 25, il jar del backend (`./mvnw -B package -DskipTests` nel repository `hoop3x3-backend`) e un database PostgreSQL di prova, vuoto o già usato da questi test. Le tabelle le crea Flyway all'avvio; i test non svuotano niente, e ogni test registra un utente nuovo e lavora sui suoi dati.

```bash
createdb hoop3x3_e2e   # una volta
E2E_BACKEND_JAR=../hoop3x3-backend/target/hoop-3x3-backend-1.0.0.jar npm run test:e2e:backend
```

Il database si sceglie con `E2E_DB_NAME`, `E2E_DB_USERNAME` e `E2E_DB_PASSWORD` (di base `hoop3x3_e2e`, `postgres`, vuota). Il backend parte con un `JWT_SECRET` fisso di prova, `CORS_ORIGINS` sull'origine del dev server e il limite di login alzato (`LIMITE_AUTH_AL_MINUTO`), tutto in `playwright.backend.config.ts`: non legge `env.properties`, che sta nella cartella del backend.

#### Copertura

`npm test -- --coverage` misura la copertura di `src/` e **fallisce** se un file scende sotto l'80% di righe, funzioni, rami o istruzioni, ogni file per conto suo (`perFile`). Vale per `src/domain`, `src/utils`, `src/stores` e `src/services`; le soglie sono in `vite.config.ts`. I componenti si provano più dal browser e non hanno soglia. Il report è in `coverage/`.

#### Integrazione continua

`.github/workflows/ci.yml` gira a ogni push su `main` e a ogni pull request, con Node 22, in due job:

- `frontend`: `npm ci`, lint, controllo dei tipi, `npm test -- --coverage` (con le soglie), build, installazione di Chromium e `npm run test:e2e` (sul preview della build, con la CSP);
- `e2e-backend`: scarica il ramo `main` di `hoop3x3-backend`, ne compila il jar con Java 25, avvia un PostgreSQL 18 di servizio e lancia `npm run test:e2e:backend`.

Un solo passo che fallisce ferma la CI. Una pull request del frontend che dipende da una modifica del backend passa `e2e-backend` solo dopo che quella è unita nel `main` del backend.

Il workflow ha solo il permesso di lettura del repository (`permissions: contents: read`). Un push nuovo sullo stesso ramo ferma il giro in corso (`concurrency`), e Chromium viene dalla cache quando la versione di Playwright non cambia (`~/.cache/ms-playwright`). `.github/dependabot.yml` propone ogni settimana gli aggiornamenti di npm (minori e patch raggruppati, al massimo 5 pull request aperte) e delle action (al massimo 3).

#### Coach AI (facoltativo)

Il Coach AI passa dal backend (`POST /api/coach/chat`): la chiave non arriva mai al browser. Il fornitore lo sceglie `COACH_FORNITORE`: sul deploy è [Anthropic](https://www.anthropic.com/) con `claude-haiku-5-5`; il codice supporta anche [Groq](https://console.groq.com/) con `openai/gpt-oss-120b`. Le chiavi vanno nell'`env.properties` del backend:

```properties
ANTHROPIC_API_KEY=...
COACH_FORNITORE=anthropic
```

- **Senza chiave** il Coach risponde «Coach AI non è disponibile su questo server. Il resto dell'app funziona normalmente.» (il 503 del backend).
- **Solo per i registrati.** Un Ospite riceve in chat l'invito a creare un account, e non parte nessuna chiamata.
- **La quota.** Il rifiuto conta nella quota del Coach (20 richieste al minuto e 300 al giorno per utente), perché il modello viene chiamato comunque. È una regola di prodotto, non un confine di sicurezza: un prompt costruito apposta può aggirarla.

Strumenti, conferme, chiamate al backend e limiti del ciclo: [`docs/coach-ai-tool-calling.md`](docs/coach-ai-tool-calling.md).

#### Deploy su Render

`render.yaml` è un [Blueprint](https://render.com/docs/infrastructure-as-code) che crea tutto il progetto, nella regione di Francoforte: il frontend come sito statico, il backend come container Docker (dal `Dockerfile` di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend)) e un database PostgreSQL.

Il sito statico inoltra `/api/*` al backend con una regola di rewrite. Per il browser pagina e API hanno la stessa origine: `VITE_API_URL` resta vuota e la sessione si rinnova da sola con il cookie di refresh. Ogni altro percorso torna a `index.html`, così React Router gestisce anche i link diretti, per esempio `/tappa/<id>`.

**Primo deploy**

1. Su Render collega l'account GitHub con l'accesso a tutti e due i repository (`Hoops-3x3` e `hoop3x3-backend`).
2. Dashboard → **New → Blueprint** → scegli questo repository: Render legge `render.yaml` e mostra i tre servizi.
3. Compila i valori richiesti: `ADMIN_EMAIL` e `ADMIN_PASSWORD` (almeno 8 caratteri e diversa da `admin123`, altrimenti l'admin non viene creato) e, sul servizio backend, la chiave del Coach e della lettura delle foto: `ANTHROPIC_API_KEY`, con `COACH_FORNITORE=anthropic` e `AI_LETTORE_FOGLIO=anthropic`. `JWT_SECRET` lo genera Render, i dati del database arrivano da soli.
4. Per le email del recupero password e del cambio email imposta a mano sul servizio backend `BREVO_API_KEY` (un segreto), `MAIL_USERNAME` (il mittente) e `APP_FRONTEND_URL`: non stanno nel repository né in `render.yaml` (vedi «Recupero password» nel README del backend).
5. Al primo avvio il backend crea le tabelle con le migrazioni di Flyway, da V1 a V11, e l'admin. Nessuno script da eseguire e nessuna variabile da impostare.
6. Render considera pronto il backend quando `/actuator/health/liveness` risponde 200 (`healthCheckPath` in `render.yaml`). È la sonda che dice se il processo è vivo, e con quella Render riavvia un servizio che non risponde. Non si usa `/actuator/health` intero, che comprende il database: un database in pausa o lento farebbe riavviare a vuoto un backend sano.

L'app, per svegliare il backend all'apertura, continua a chiamare `/actuator/health`, attraverso la rewrite del Blueprint.

**Content-Security-Policy.** Il sito statico manda a ogni pagina una Content-Security-Policy (`headers` in `render.yaml`) che ammette solo ciò che l'app usa davvero:

- script e stili della build (`'self'`; gli stili inline di React passano dal CSSOM, l'interfaccia JavaScript degli stili, che la policy non blocca);
- i font di Google Fonts (`style-src` e `font-src`);
- i loghi delle squadre da qualsiasi host `https:` (`img-src`);
- le chiamate al backend sulla stessa origine (`connect-src 'self'`: passano dalla rewrite di `/api`);
- i video di YouTube nell'embed senza cookie (`frame-src https://www.youtube-nocookie.com`);
- `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` e `form-action 'self'` chiudono il resto.

La stessa policy è in `vite.config.ts` (`CSP`, applicata da `vite preview`), su cui girano i test end-to-end. `tests/e2e/csp.spec.ts` apre una pagina con logo esterno e video e controlla che non ci siano violazioni; `tests/unit/csp.test.ts` verifica che le due copie siano identiche.

**Se si aggiunge una risorsa esterna** (un'altra CDN, cioè una rete che distribuisce file statici, di font, un'API su un'altra origine con `VITE_API_URL`, un embed diverso da YouTube) va aggiunta alla direttiva giusta in tutti e due i posti. Altrimenti in produzione il browser la blocca in silenzio; il test unitario fallisce se se ne aggiorna una sola.

**Dopo il deploy**

- Controlla gli URL assegnati.
  - Oggi sono `https://hoop3x3.onrender.com` (frontend) e `https://hoop3x3-api-06m1.onrender.com` (backend: `hoop3x3-api.onrender.com` era già di un altro account e Render ha aggiunto il suffisso).
  - Se cambiano, o con un nuovo Blueprint, aggiorna i punti segnati con «URL» in `render.yaml` (le rewrite di `/api/*` e `/actuator/health` e `CORS_ORIGINS`) oppure gli stessi valori nella dashboard.
  - Con un dominio personalizzato vale lo stesso per `CORS_ORIGINS`.
- Un 503 con la pagina «Service Suspended» su login o registrazione vuol dire che la rewrite di `/api/*` punta a un servizio che non è il tuo: confronta l'indirizzo in `render.yaml` con quello della dashboard del backend.
- Prova login, ricarica della pagina e un salvataggio. Un 403 «Invalid CORS request» sulle POST vuol dire che `CORS_ORIGINS` non coincide con l'origine del frontend.
- I dati di prova: `SEED_CAMPETTI=true` carica solo i nove campetti di esempio (sei di Torino e tre di Roma, intestati all'admin); `SEED_DEMO=true` carica il circuito Estathé 2025 (leghe, squadre, giocatori di fantasia e tappe). Il Blueprint imposta `SEED_CAMPETTI=true` e `SEED_DEMO=false`.
- Il Blueprint imposta sul backend `SERVER_FORWARD_HEADERS_STRATEGY=native` e `LIMITE_AUTH_AL_MINUTO=60`.
  - Dietro la rewrite il limite di login, registrazione e rinnovo potrebbe contare un solo indirizzo per tutto il sito, e 60 è il valore provvisorio finché non si verifica quale indirizzo arriva.
  - Come verificarlo: «Limiti di frequenza» nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).
- Un servizio creato prima del 7 ottobre 2026 può avere ancora `DB_INIT_MODE` nella dashboard: non ha più effetto e si può togliere. Lo stesso vale per `MAPS_API_KEY`, che il backend non usa più (vedi [Campetti](#campetti)).

**Piani gratuiti.** Il backend si spegne dopo 15 minuti senza richieste. La prima richiesta dopo la pausa aspetta il riavvio della JVM, anche più di un minuto: oltre i 15 secondi di attesa del client, la prima chiamata può fallire con «Il server non risponde». Il database gratuito scade dopo 30 giorni.

Per ridurre l'attesa l'app chiama `/actuator/health` appena si apre (`svegliaServer` in `src/services/api.ts`): il backend riparte mentre l'utente guarda la home, e di solito al login è già pronto. Per una demo dal vivo conviene il piano starter del backend, oppure aprire l'app qualche minuto prima. Ogni push su `main` di uno dei due repository ripubblica il servizio corrispondente.

**Ordine di pubblicazione.** Frontend e backend non vanno online nello stesso istante, quindi l'ordine conta: prima questo frontend, subito dopo il backend, in un momento senza tornei in corso (nessuno sta salvando una tappa), poi si ricaricano le schede aperte.

Il backend rifiuta con 400 il salvataggio di una tappa senza `versione`.

- Una scheda di questo frontend rimasta aperta dal backend precedente rilegge la lega e rimanda da sola (vedi [Versioni e conflitti](#versioni-e-conflitti)).
- Una scheda di un frontend più vecchio riceve il 400 finché non si ricarica la pagina.

Il perché, visto dal backend, è nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend): «Sessioni e refresh token» e «Tappe e modifiche da più dispositivi».

### Lettura delle foto

«Importa file» accetta, oltre al JSON di una lega, la foto di un foglio di tappa scritto a mano.

- **Nel browser.** La foto viene ridotta prima dell'invio (`src/utils/ridimensionaFoto.ts`), così resta sotto il limite del server.
- **Sul server.** `POST /api/coach/foglio` (autenticato) manda la foto al fornitore di lettura, che sul deploy è [Anthropic](https://www.anthropic.com/) con il modello `claude-haiku-5-5`. Il server restituisce una bozza: nome, luogo, data, squadre con i giocatori, gironi, partite e dubbi. Non decide niente della lega.
- **Nel browser, di nuovo.** La bozza (`src/utils/foglioTappa.ts`) diventa una lega nuova con la sua tappa. I dubbi del modello compaiono in una finestra (`src/components/lega/DialogoDubbi.tsx`), con «Apri il Coach» per correggerli con il Coach.
- **Privacy.** La foto va al fornitore e contiene nomi di persone. Il server non la salva e non la logga: vive per la durata della richiesta. Nei log restano solo utente, dimensione, durata e numeri della bozza. Il dettaglio è nel README del backend, «Lettura dei fogli (foto)».
- **Se il lettore non è configurato** il server risponde 503, la pagina lo dice con il messaggio, e nessuna lega nasce.

I limiti di dimensione e di frequenza sono nel README del backend, «Limiti dell'API» e «Limiti di frequenza».

### API REST

Il contratto del backend (endpoint per endpoint, chi può chiamarlo, codici di stato) è nella sezione «Endpoint» del README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend), che lo ricava dai test di accesso. I limiti (dimensioni, lunghezze, frequenza) sono in «Limiti dell'API» e «Limiti di frequenza». Qui non si ripetono, per non farli divergere.

Il frontend chiama il backend solo da `src/services/`, e ogni servizio ha il suo gruppo di endpoint:

| Servizio | Gruppo di endpoint |
|---|---|
| `api.ts` (client HTTP: JWT, rinnovo, tempo massimo) | `POST /api/auth/refresh` (il rinnovo della sessione) e `GET /actuator/health` (all'apertura, per svegliare il backend dei piani gratuiti: `svegliaServer`). Se l'utente esce mentre un rinnovo è in corso, chiama anche `POST /api/auth/logout` per chiudere la sessione appena rinnovata; se il rinnovo è respinto (401) toglie solo il token e avvisa l'app che la sessione è finita |
| `authService.ts` | `/api/auth/*`: registrazione, accesso, uscita e verifica della sessione (`/api/auth/me`) |
| `legheApi.ts` | `/api/leghe` (indice, nuova lega, import con le tappe), `/api/leghe/{id}` (dettaglio, rinomina, eliminazione), `/api/leghe/{id}/tappe` (nuova tappa), `/api/tappe/{id}` (salvataggio ed eliminazione di una tappa) |
| `anagrafeApi.ts` | `/api/anagrafe/giocatori` e `/api/anagrafe/squadre` (lettura, creazione, modifica, eliminazione) |
| `archivioApi.ts` | `/api/archivio` (elenco), `/api/archivio/tappe` (tutte le tappe pubblicate, per le statistiche) e `/api/archivio/{tappaId}` (dettaglio, pubblicazione, ritiro) |
| `campettiApi.ts` | `/api/campetti` (lettura pubblica per raggio o per testo, creazione) e `/api/campetti/{id}` (modifica, eliminazione) |
| `luoghiApi.ts` | `GET /api/luoghi?q=` (dove si trova un luogo, per spostare la mappa quando la ricerca non trova campetti) |
| `recuperoApi.ts` | `/api/auth/password/dimenticata` (richiesta del link) e `/api/auth/password/reimposta` (nuova password con il token del link): rotte pubbliche, senza JWT |
| `profiloApi.ts` | `PATCH /api/auth/me` (nome), `POST /api/auth/me/password`, `POST /api/auth/me/email` (richiesta del cambio), `POST /api/auth/email/conferma` (conferma con il token del link, pubblica) e `POST /api/auth/me/elimina` (eliminazione dell'account, con la password nel corpo) |
| `aiService.ts` | `POST /api/coach/chat` (il Coach AI) |
| `foglioApi.ts` | `POST /api/coach/foglio` (la lettura della foto di un foglio, da «Importa file») |

Il frontend non usa `GET /api/utenti` (solo ADMIN) né `GET /api/coach/status`: la chiave del fornitore mancante la scopre dal 503 della chat.

Negli store e nelle pagine il client mostra all'utente il campo `message` delle risposte d'errore del backend (`testoErrore`), o «Errore <status>» se il corpo manca. La chat del Coach ha testi suoi (`messaggioErroreCoach` in `src/hooks/useCoachAI.ts`) e riporta il `message` del backend per il 400 e per il 429, che dice quale limite è finito.

Un utente `ADMIN` iniziale viene creato al primo avvio dalle proprietà `ADMIN_EMAIL` e `ADMIN_PASSWORD` di `env.properties`.

### Struttura del progetto

```
tests/
├── unit/             # Test unitari e di componenti (Vitest; jsdom dove serve il DOM)
├── e2e/              # Test end-to-end con il server finto (Playwright, playwright.config.ts)
└── e2e-backend/      # Test end-to-end con il backend vero (playwright.backend.config.ts)
docs/                 # Coach AI, design system e mockup di riferimento
.github/workflows/    # CI (ci.yml)
render.yaml           # Blueprint di Render
src/
├── components/       # Componenti dell'interfaccia, divisi per dominio
│   ├── anagrafe/     # Giocatori e squadre
│   ├── archivio/     # Storico tappe
│   ├── auth/         # Accesso, registrazione e rotta riservata (RequireAuth)
│   ├── campetti/     # Mappa (MappaCampetti), posizione dell'utente, card, modulo (CampettoForm) e finestra di un campetto (CampettoModal)
│   ├── coach/        # Pannello del Coach AI
│   ├── gironi/       # Gironi, classifiche e tabellone
│   ├── layout/       # Intestazione con la navigazione, Hero, barra degli avvisi (SyncBanner) e piè di pagina
│   ├── leaderboard/  # Leader della tappa per categoria e classifica a righe (StandingsTable)
│   ├── partita/      # Punteggio, timer e statistiche della partita
│   ├── profile/      # Sparkline del profilo giocatore
│   ├── profilo/      # Schede del profilo dell'utente (nome, password, email, eliminazione dell'account)
│   ├── squadra/      # Roster
│   ├── tappa/        # Gestione della tappa
│   ├── ui/           # Componenti di base (Button, Input, Card, Badge, StatTile, Section, Modal, ConfirmDialog, Icon…)
│   └── video/        # Video della tappa
├── coach/            # Coach AI: definizioni degli strumenti (toolDefs) ed esecutori (toolHandlers)
├── constants/        # Regole, ruoli, tipi di evento, limiti del server
├── domain/           # Operazioni di tappa come funzioni pure (sorteggio, risultati, fasi dirette, conclusione)
├── hooks/            # Hook di React
├── pages/            # Le pagine dell'app
├── services/         # Client HTTP (api.ts) e servizi REST: leghe, anagrafe, archivio, campetti, luoghi, accesso, recupero della password, profilo, Coach
├── stores/           # Store Zustand: stato globale (useAppStore, con memoriaBrowser e versioniTappe), cache dell'anagrafe (useAnagrafeStore) e dei campetti (useCampettiStore)
├── types/            # Tipi TypeScript
└── utils/            # Funzioni di utilità (gironi, classifica, geometria dei campetti in geo.ts…)
```

La struttura dei package Java (controllers, dto, entities, security, services…) è descritta nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).

### Design system

Un tema scuro unico, «Asphalt»: palette, font (Barlow Condensed e IBM Plex Sans), scala, accessibilità e stampa sono in [`docs/design-system.md`](docs/design-system.md). I token stanno in `src/index.css` (`@theme`). I mockup di riferimento sono in `docs/design/`; la foto della hero è `public/hero-court.jpg`.

### Dati e persistenza

Per un **utente registrato** leghe e tappe sono sul server (tabelle `leghe` e `tappe`); anagrafe e archivio sono condivisi tra tutti gli utenti. Lo store aggiorna subito lo stato in memoria e salva in background. Per l'**Ospite** tutto sta nel browser.

#### La coda dei salvataggi

Creazione e modifiche delle tappe passano da una coda (`src/stores/saveQueue.ts`):

- la tappa intera parte 400 ms dopo l'ultima modifica: POST per una tappa nuova, poi PUT, una sola richiesta alla volta per tappa e sempre l'ultima versione;
- se la rete manca, il server non risponde entro il tempo massimo, ha un guasto (5xx) o respinge il JWT senza che il rinnovo riesca (401), la coda riprova da sola dopo 2, 5 e 15 secondi, poi alla modifica successiva;
- intanto una barra sotto l'intestazione dice quante tappe hanno modifiche non salvate e perché, con «Riprova ora», e resta finché tutto è salvato.

**I dati rifiutati dal server** (gli altri errori 4xx) non si ritentano. Compaiono in una riga a parte della barra, una frase per tappa, che un errore arrivato dopo non copre e che non si chiude: resta finché la versione rifiutata è l'ultima della tappa. Sparisce quando la tappa si salva, si modifica di nuovo, si elimina o la lega si riapre. Un rifiuto arrivato quando in coda c'è già una versione più nuova non si registra: decide il salvataggio di quella.

La frase dice che cosa fare:

- correggere la tappa, oppure riaprire la lega per tornare alla versione salvata sul server;
- per una tappa nuova, la cui creazione è stata rifiutata: che sul server non c'è e che va corretta, perché riaprendo la lega sparirebbe;
- per una tappa di un'altra lega: la nomina, e dice che la versione rifiutata non è più in memoria (aprendo l'altra lega lo store l'ha sostituita). Riaprendo si trova quella salvata sul server, e una tappa nuova è andata persa.

**«Esci»** salva prima ciò che è in attesa, anche la rinomina della lega. Se qualche tappa non arriva al server, o ha nella lega aperta un salvataggio rifiutato, chiede conferma prima di uscire. Un rifiuto di un'altra lega non conta: uscire non perde niente che sia ancora qui.

**Quando la scheda viene nascosta** (cambio di scheda o di app, spesso l'ultimo momento prima della chiusura su mobile) ciò che è in attesa parte subito, con una richiesta normale.

**Alla chiusura della pagina** le versioni non ancora confermate dal server partono con `keepalive`, compresa quella di un salvataggio in corso che il browser interrompe, senza tempo massimo e senza aspettare un rinnovo del JWT. Se si chiude con versioni non ancora confermate, il browser chiede conferma prima di uscire.

**Il limite di `keepalive`.** La specifica Fetch non accetta una richiesta `keepalive` se, con quelle già in volo, i corpi superano 64 KiB. Una tappa con i tabellini pesa 34-46 KiB con 16 squadre e 64-89 KiB con 32 (commento di `SOGLIA_KEEPALIVE` in `src/stores/useAppStore.ts`).

- Le tappe che porterebbero il totale oltre 60 KiB non partono: restano nel browser (`hoop3x3_da_rimandare`, con l'utente che le ha scritte) e si rimandano alla prossima apertura dell'app, prima di leggere le leghe.
- Se nel frattempo un altro dispositivo ha salvato la tappa vale la sua, con l'avviso dei conflitti; con la rete ancora assente restano per la volta dopo.

**Le eliminazioni.** La DELETE di una tappa parte solo quando il suo salvataggio in volo è finito: «Esci» la aspetta, e se la pagina si chiude prima parte subito con `keepalive`. Un 404 della DELETE vuol dire che la tappa non c'è già più. Eliminando una lega i salvataggi in attesa delle sue tappe si fermano, e un nuovo tentativo partito mentre la DELETE della lega è in corso, che riceve 404, non è un errore.

#### Versioni e conflitti

Ogni tappa ha un numero di `versione`, che decide il server. La PUT manda quello dell'ultima risposta (GET della lega, POST o PUT) e, al 200, lo sostituisce con quello della risposta senza toccare le modifiche fatte nel frattempo.

**Il 409.** Se un altro dispositivo, o un'altra scheda, ha salvato la tappa nel frattempo, il server risponde 409:

- l'app rilegge la lega e mostra la tappa com'è sul server;
- scarta le modifiche non ancora salvate di quella tappa, perché rimandarle cancellerebbe il lavoro dell'altro;
- lo dice nella barra degli avvisi, in una riga a parte che nomina tutte le tappe coinvolte finché non si chiude (un errore arrivato dopo non la nasconde);
- una pubblicazione in corso non parte.

**Una tappa eliminata altrove.** Se la tappa sul server non c'è più, esce anche dallo store, con l'avviso. Di solito però una tappa eliminata altrove dà 404 alla PUT, non 409, perché il server controlla che la tappa esista prima della versione. Anche dopo un 404 l'app rilegge la lega: se la tappa non c'è più la toglie allo stesso modo, niente più errore a ogni modifica né pubblicazione bloccata; se c'è, il 404 resta un salvataggio rifiutato.

**Il conflitto con sé stessi.** Una tappa del server può essere uno dei salvataggi di questo dispositivo rimasti senza risposta: tempo scaduto mentre il server ripartiva, salvataggio alla chiusura della pagina. Se ne ricordano gli ultimi 20 per tappa, senza doppioni. In quel caso il conflitto è suo: prende la versione del server e rimanda le modifiche, senza avviso; un secondo 409 dopo quel nuovo invio fa valere la tappa del server.

- Lo stesso vale per il 409 della POST (tappa già creata): se la tappa del server è un corpo di questo dispositivo si passa alla PUT con la versione letta, altrimenti vale quella del server, con l'avviso.
- Il confronto normalizza i campi come il server (`src/utils/stessaTappa.ts`: spazi ai lati, campi assenti, blocchi di gioco come valori) e non guarda la versione.

**Gli altri casi.**

- Una pagina aperta prima dell'aggiornamento del server riceve 400 «Manca la versione»: rilegge la lega e rimanda una volta.
- Una tappa che un altro dispositivo salva mentre la si elimina (409 sulla DELETE) torna al suo posto, com'è sul server, con un avviso. Se il salvataggio arrivato insieme era uno di questo dispositivo rimasto senza risposta, la DELETE si rimanda una volta, senza avviso.
- La versione nota non scende mai, e una lettura della lega partita prima di un salvataggio o di un conflitto non riporta indietro i dati.

**Riaprire la lega già aperta.** Per una tappa con un salvataggio in attesa o in corso, o letta più vecchia della versione nota, vale la copia sullo schermo, che è sempre la più recente: la coda manda proprio quella, la risposta di un salvataggio ne cambia solo la versione e un conflitto la sostituisce con la tappa del server.

- Una tappa la cui ultima versione il server ha rifiutato, anche durante la lettura, torna com'è sul server; una tappa nuova rifiutata, che sul server non c'è, sparisce. È ciò che dice la riga dei rifiuti.
- Una tappa creata mentre la lettura era in corso resta anche se la lettura non la contiene. Una che il server aveva già e che manca dalla lettura l'ha eliminata un altro dispositivo, ed esce.
- Non torna una tappa eliminata qui mentre la lettura era in corso, né una che un salvataggio di qui ha trovato eliminata altrove nel frattempo.
- Tornando da un'altra lega valgono le versioni non ancora confermate e, se un conflitto si è risolto mentre la lega era chiusa, la tappa del server.

La versione non entra nel file della lega esportato e non riguarda l'Ospite.

#### La pubblicazione

La pubblicazione nell'archivio (alla conclusione di una tappa, dopo un video aggiunto a una tappa conclusa, dal Coach AI) manda al server solo l'id (`pubblica` dello store) e parte dopo che la coda si è svuotata: la copia pubblica la costruisce il server da ciò che ha salvato.

- Se la tappa non arriva al server (rete assente, dati rifiutati) non si pubblica, e l'errore dice perché.
- Una rinomina della lega in attesa parte prima, ma non si controlla: se la PATCH fallisce, la copia pubblica porta il nome che il server ha.
- L'eliminazione di una tappa o di una lega non ritira niente dal client: il server toglie da solo le pubblicazioni.

**Lo stato sulla pagina.** La pagina di una tappa conclusa dice «pubblicata» solo se lo è: all'apertura lo chiede all'archivio (`GET /api/archivio/{tappaId}`; il 404 vuol dire che non c'è). Se la pubblicazione non è riuscita lo dice, con il motivo, e indica «Riapri» e poi «Concludi».

- «Pubblicata» o «non pubblicata» solo se l'esito è certo. Con rete assente o tempo scaduto sulla PUT la pagina dice solo «Conclusa», con il motivo, perché il server potrebbe aver pubblicato. Un 502, 503 o 504 conta come esito ignoto: dietro un proxy il server può aver pubblicato lo stesso.
- «Riapri» toglie la tappa dall'archivio prima di riaprirla, anche nel dubbio, tollerando il 404. Se il server non ci riesce la tappa resta conclusa e la pagina lo dice.
- «Riapri» resta disattivato mentre è in corso una pubblicazione avviata dalla pagina (conclusione o video); quelle del Coach AI non lo disattivano.

#### L'Ospite

La lega resta nel `localStorage` del browser; anagrafe e archivio si consultano in sola lettura.

- **All'avvio** la lega aperta si controlla con gli stessi campi dell'import (`src/utils/legaFile.ts`), ma senza i limiti del server: un nome vuoto, un numero di gironi o una regola fuori limite si tengono e si correggono dall'app.
- Le tappe con la forma sbagliata (per esempio una tappa importata in passato senza l'elenco delle squadre) non si caricano, e una barra sotto l'intestazione dice quali e perché; il resto si usa. Spariscono dal browser al primo salvataggio della lega, e l'avviso lo dice. Una lega illeggibile non si apre e si elimina dall'elenco delle leghe.
- **Se il browser rifiuta una scrittura** (spazio esaurito) la modifica resta in memoria e la barra lo dice. Ricordare la lega aperta per la prossima visita è solo una comodità: se non si scrive, non si dice niente.
- La X chiude il testo ma non la protezione. Finché una scrittura della lega aperta non riesce, o la lega aperta non si elimina, aprire, creare o importare un'altra lega prova prima a salvarla, e «Esci» chiede la stessa conferma «Uscire senza salvare?» dei registrati.
- **Con l'app aperta in più schede** ognuna segue le scritture delle altre (evento `storage`): l'elenco delle leghe si rilegge, la lega aperta salvata in un'altra scheda si ricarica (vale l'ultima scrittura) e quella eliminata altrove si chiude con un avviso. Prima di riscrivere l'indice delle leghe lo si rilegge dal browser, così una lega creata in un'altra scheda non sparisce.

#### La sessione

Il percorso completo è in [Una sessione](#una-sessione). Qui i dettagli.

- **Il JWT di 30 minuti** è nel `localStorage`. `src/services/api.ts` lo rinnova da solo con il refresh token, che il server imposta in un cookie httpOnly (30 giorni, ruotato a ogni rinnovo).
- **Quando si rinnova:** in anticipo quando mancano meno di 2 minuti alla scadenza, anche a pagina ferma (un controllo ogni 60 secondi e al ritorno sulla scheda), oppure dopo un 401, ripetendo la richiesta una sola volta. Così anche dopo una pausa il salvataggio alla chiusura della pagina parte subito con un JWT valido.
- **L'ora del server.** A ogni token che arriva si legge lo scarto tra il suo `iat` e l'orologio del dispositivo: un orologio avanti non fa rinnovare un JWT valido a ogni controllo, uno indietro non fa credere valido un JWT scaduto.
- **I tempi massimi.** 15 secondi per ogni richiesta, 65 per la chat del Coach (che sul server aspetta il modello fino a 60), 90 per il rinnovo, nessuno per i salvataggi alla chiusura della pagina. Oltre, conta come rete assente.
- **Perché 90 secondi per il rinnovo.** Un rinnovo abbandonato mentre il server si avvia a freddo (Render, 30-60 secondi) il server lo esegue lo stesso: ruota il refresh token, e il cookie nuovo arriva in una risposta che nessuno legge. Al rinnovo dopo l'utente si troverebbe fuori.
- **All'avvio con una sessione salvata** l'app aspetta che `/actuator/health` risponda (un tentativo ogni 2 secondi, al massimo 90 secondi, con «Server in avvio») prima di verificare la sessione; intanto il rinnovo automatico resta fermo. Se il server non risponde non si tenta nessun rinnovo e compare l'avviso con «Riprova».
- **Più schede** dello stesso browser condividono la sessione e rinnovano una alla volta, con le Web Locks API.
- **Quando la sessione finisce** (refresh token scaduto o revocato, «Esci» o sessione finita in un'altra scheda, sessione scaduta all'avvio) si esce senza conferma, perché salvare non è più possibile. Si torna al modulo di accesso con «Sessione scaduta: accedi di nuovo» e il numero delle tappe con modifiche non salvate, se ce n'erano.
- **Il logout** cancella subito il JWT e revoca il refresh token sul server. Limite noto: chiude la sessione di questo browser; un JWT già emesso resta valido fino a 30 minuti, e gli altri dispositivi non vengono toccati. Il periodo di grazia per il token appena ruotato è nel `TODO.md`.

#### L'eliminazione dell'account

Dal profilo, con la password.

- **Sul server spariscono** l'account (email, nome, password), le sessioni, le sue leghe con le tappe e le pubblicazioni in archivio.
- **Restano**, senza autore e modificabili solo da un ADMIN, i campetti e le schede dell'anagrafe che ha inserito.
- **Nel browser non resta nulla**: token, sessione, cache dell'anagrafe e dei campetti, lega aperta. Le modifiche alle tappe ancora in coda vanno via con le tappe, e la finestra di conferma lo dice.

#### L'anagrafe

- Si scarica una volta sola e resta in cache nello store (`src/stores/useAnagrafeStore.ts`), non a ogni apertura di pagina. Ogni scrittura, dalle pagine o dal Coach AI, aggiorna server e cache. Le modifiche di altri utenti si vedono ricaricando la pagina.
- **La versione.** Ogni voce ha una `versione` decisa dal server, come le tappe. La PUT la rimanda (se il server non la manda ancora, non si invia).
  - Se un altro dispositivo ha salvato la voce nel frattempo, il server risponde 409: lo store rilegge la voce, la mette in cache, e la scheda esce dalla modifica mostrandola con l'avviso «modificata da un altro dispositivo».
  - Ciò che era scritto non si salva sopra e si riscrive con «Modifica».
- **La ricerca di una squadra per nome** (`trovaSquadra`) che non trova la lista del server rifiuta, invece di dire «non trovata»: altrimenti la pagina della tappa creerebbe un doppione.
- **Omonimi.** Due squadre con lo stesso nome restano permesse. Il collegamento di una squadra di tappa chiede quale delle due (`src/components/squadra/SceltaSquadraDialog.tsx`), e il Coach chiede quale tappa o squadra intende invece di prendere la prima: la regola del nome esatto, poi del dettaglio tra parentesi, poi della parte unica è in `src/utils/ricercaPerNome.ts`.
- **Gli errori di caricamento** si vedono, con «Riprova»: un'anagrafe, un archivio o una tappa pubblica che non si sono potuti caricare non si mostrano come vuoti o «non trovati». Una pagina che non si riesce a disegnare mostra un messaggio con «Ricarica» (`ErrorBoundary`), e il resto dell'app resta usabile.

#### Lo schema e le migrazioni

Lo schema del database lo crea Flyway nel backend all'avvio, con le migrazioni da V1 a V11 (`hoop3x3-backend/src/main/resources/db/migration`).

Con `SEED_DEMO=true` in `env.properties` il primo avvio carica i dati di prova del circuito Estathé 2025 (32 giocatori di fantasia, 8 squadre, una lega con 4 tappe concluse e l'archivio), intestandoli all'admin; gli avvii successivi non li duplicano. `SEED_CAMPETTI=true` carica solo i campetti di esempio.

### Campetti

La pagina `/campetti` legge i campi da streetball dal backend (`GET /api/campetti`, pubblico: funziona anche da Ospite) in due modi:

- **intorno a un punto**, entro un raggio (`?lat=&lng=&raggioKm=`): al massimo 200 campetti, ordinati per distanza;
- **per testo**, su tutta l'Italia (`?q=`, cercato nel nome e nella città): ordinati per città e nome, o per distanza se c'è anche la posizione.

All'apertura chiede i campetti intorno al centro di Roma (`41.9028, 12.4964`, 20 km); con «Usa la mia posizione» quelli intorno a chi guarda, con lo stesso raggio. La casella di ricerca manda il testo 300 ms dopo l'ultimo tasto, una richiesta per parola, e la risposta di una ricerca superata nel frattempo si scarta (`src/stores/useCampettiStore.ts`, con un'epoca come l'anagrafe). I filtri lavorano sui risultati, nel browser.

I dati sono di [OpenStreetMap](https://www.openstreetmap.org/copyright). I campetti di esempio del seed del backend (sei di Torino e tre di Roma) hanno coordinate prese dai centroidi delle aree verdi o dei campi pubblici con nome (© OpenStreetMap contributors, ODbL); l'attribuzione è in fondo alla pagina.

#### La ricerca di un luogo

Quando la ricerca per testo non trova campetti, la pagina chiede dove si trova il testo: `GET /api/luoghi?q=` passa dal backend, che chiama [Nominatim](https://nominatim.openstreetmap.org/), il geocoder di OpenStreetMap. La mappa va su quel luogo a zoom 12, con il messaggio «Nessun campetto a <luogo>: la mappa è su quella zona».

Per le stesse ragioni della mappa non c'è nessuna chiave nel browser e nessun dominio nuovo nella Content-Security-Policy: la chiamata va alla stessa origine del sito. Il backend manda al massimo una richiesta al secondo verso Nominatim, con una cache. Attribuzione «© OpenStreetMap contributors».

#### La mappa

È [Leaflet](https://leafletjs.com) (licenza BSD-2-Clause, installato come dipendenza npm) con le tessere di [OpenStreetMap](https://www.openstreetmap.org/copyright).

- Si trascina e si ingrandisce. Ogni campetto è un pulsante sulla mappa, raggiungibile con Tab e attivabile con Invio o Spazio; un clic sullo sfondo dà le coordinate del punto.
- Quando si aggiunge un campetto, il pin provvisorio si trascina per correggere la posizione.
- La vista si adatta ai campetti quando cambia l'elenco, e senza campetti torna su Roma.
- L'attribuzione «© OpenStreetMap contributors» è nel controllo della mappa, come chiede la licenza. La mappa non usa nessuna chiave.
- Il backend non usa più `MAPS_API_KEY` né l'endpoint `GET /api/mappa-campetti` (l'immagine statica di Google Maps): la variabile si può togliere dalla sua dashboard su Render.

#### Perché OpenStreetMap con Leaflet e non Google Maps

Nelle prime versioni della pagina Campetti (12 ottobre 2026) la mappa era un'immagine statica della Maps Static API di Google. Si è passati a Leaflet con le tessere di OpenStreetMap (Hoops-3x3#28) per questi motivi, e con un prezzo:

- **(a)** Nella prima versione (Hoops-3x3#20) la chiave era nel bundle, quindi pubblica a chiunque apra la pagina. Con Hoops-3x3#27 è passata al backend, ma restano (b), (c) e (d).
- **(b)** La mappa interattiva di Google richiede `'unsafe-inline'` nella CSP del sito (la guida di Google lo chiede). Lo spazio concesso agli attacchi XSS, cioè all'esecuzione di script iniettati, si allargherebbe per tutto il sito, non solo per la mappa.
- **(c)** L'immagine statica non si poteva trascinare, né ingrandire con il mouse: il pin provvisorio del modulo si trascina per correggere il punto, e la mappa va esplorata.
- **(d)** Leaflet e le tessere di OpenStreetMap non richiedono chiave né fatturazione: nessun costo che cresce con le visite. La CSP non cambia (il codice viene dal bundle, le tessere arrivano da `img-src https:`). L'attribuzione «© OpenStreetMap contributors» è obbligatoria ed è nel controllo della mappa, con il link alla licenza.
- **(e) Il prezzo:** l'aspetto è diverso da Google Maps (strade, nomi e colori sono quelli di OpenStreetMap), e le tessere sono di un servizio comunitario: vanno usate nel rispetto della [politica d'uso](https://operations.osmfoundation.org/policies/tiles/).

#### Privacy della posizione

- La posizione la chiede solo il pulsante «Usa la mia posizione», mai all'apertura della pagina (`src/hooks/usePosizione.ts`): niente richiesta di permesso a chi non l'ha voluta.
- Resta nel browser: non sceglie la vista della mappa (la vista dipende dai campetti; il segno dell'utente lo disegna l'app) e non si salva.
- Le tessere di OpenStreetMap ricevono i riquadri che si guardano, come ogni mappa web, non la posizione dell'utente.
- Al nostro server arriva solo come centro della ricerca per raggio (`lat` e `lng` della query string di `GET /api/campetti`). Il nostro codice non la registra (i log di piattaforma di Render possono tenere l'URL delle richieste), ed è ciò che serve per rispondere «i campetti intorno a te», niente altro.
- Con il permesso negato o la posizione non disponibile la pagina lo dice e resta usabile, con i campetti in ordine di città e nome.
- «Indicazioni» e «Apri in Google Maps» sono link a Google Maps con le coordinate del campetto, senza chiave né posizione dell'utente, in una nuova scheda.

#### Chi scrive

- Ogni utente registrato aggiunge un campetto (`POST /api/campetti`, 401 senza token). L'autore o un ADMIN lo modifica ed elimina (`PUT` e `DELETE /api/campetti/{id}`, 403 agli altri). L'Ospite legge soltanto, con «Aggiungi un campetto» disattivato e il titolo che lo dice.
- «Modifica» ed «Elimina» compaiono sulla card solo a chi può (`puoModificareCampetto` in `src/utils/permessi.ts`): come l'anagrafe, ma per un campetto con `autoreId` null, cioè il cui autore non esiste più, decide solo l'ADMIN.
- Senza token il server manda `autoreId` null a tutti i campetti, come i dati riservati dell'anagrafe. Per questo la cache (`src/stores/useCampettiStore.ts`) si svuota all'accesso e all'uscita, anche in un'altra scheda, e la pagina aperta riscarica.

**Il modulo** (`CampettoForm`, in una finestra) ha i campi di `CampettoRequestDTO` con i limiti del server (`maxLength` da `src/constants/rules.ts`). Prima dell'invio controlla il nome, i canestri (da 1 a 8) e **la posizione, data in uno di tre modi**:

- «Usa la mia posizione» (`usePosizione`, lo stesso hook della pagina);
- un clic sulla mappa dentro il modulo (`MappaCampetti.onClicMappa`): il pin provvisorio mostra il punto scelto e si trascina per correggerlo;
- latitudine e longitudine scritte a mano, anche con la virgola, dentro −90..90 e −180..180.

Se il server rifiuta, il motivo compare nel modulo e i dati restano. La modifica manda la `versione` del campetto: con un **409** (modificato da un altro dispositivo nel frattempo) lo store ricarica la ricerca corrente, la finestra si chiude e un avviso dice che le modifiche scritte non sono state salvate, come nell'anagrafe. La geocodifica dell'indirizzo con Google resta fuori: servirebbe una seconda chiave riservata al server.

Gli end-to-end con il backend vero (`tests/e2e-backend/campetti.spec.ts`) fissano il contratto: POST 201 con `versione` 0 e `tipo` «campetto», PUT 200 con la versione aumentata, DELETE 204.

**Se si aggiunge una risorsa esterna** (per esempio una mappa interattiva con lo script di Google, o le tessere di un altro fornitore) vale quanto detto in [Deploy su Render](#deploy-su-render) sulla Content-Security-Policy: la direttiva giusta va aggiornata in `render.yaml` e in `vite.config.ts`, e gli end-to-end su `vite preview` la provano prima della pubblicazione.
