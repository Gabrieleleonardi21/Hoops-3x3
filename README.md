# HOOP 3X3

App web per la gestione di un circuito italiano di basket 3x3: tornei, gironi, statistiche e classifiche.

## Funzionalità

- **Leghe** — un utente registrato ha più leghe, ognuna con le sue tappe (al massimo 100, il tetto del server; il nome fino a 120 caratteri): si creano, si rinominano, si aprono dall'elenco e si eliminano (con conferma, che per un registrato ricorda che le tappe pubblicate escono dall'archivio). Se l'elenco non arriva dal server la pagina lo dice, con «Riprova», invece di mostrarlo vuoto; se non si legge solo l'ultima lega aperta, l'elenco resta. Una lega si esporta in un file JSON e si importa da file (l'import crea sempre una lega nuova); la classifica del circuito ordina le squadre con punti ranking (le segnaposto «Squadra N» e quelle senza punti restano fuori) per il punteggio più alto ottenuto nelle tappe, con il numero di tappe giocate
- **Tappe** — nome, luogo, data, da 2 a 64 squadre con roster di 3-4 giocatori (almeno 3 per sorteggiare), un numero di gironi da 1 a metà delle squadre (al massimo 32) e regole di gara per tappa; sorteggio dei gironi casuale o a serpentina per ranking, calendario all'italiana, fase finale a eliminazione diretta, conclusione e riapertura
- **Gironi e fase finale** — classifica del girone con vittorie, scontri diretti, media dei punti fatti per gara e, a parità, ordine delle teste di serie (art. 13 del regolamento FIBA 3x3); tabellone a turni (ottavi, quarti, semifinali, finale), con le migliori teste di serie che passano il primo turno senza giocare quando le qualificate non riempiono i posti (serve più di un girone)
- **Punteggi** — risultato di ogni gara (niente pareggi), tabellino per giocatore (punti, rimbalzi, assist, palle rubate, stoppate, palle perse, falli) e log eventi di gara (fallo, sostituzione, timeout, infortunio, altro). Ai registrati i punti dei giocatori sono richiesti e devono sommare al totale; l'Ospite fa prove libere
- **Timer di gara** — finestra per il tavolo con countdown, shot clock, punteggio +1/+2, fine partita rilevata da sola e supplementare
- **Statistiche** — leader della tappa per categoria (punti, rimbalzi, assist, palle rubate, stoppate) e statistiche di stagione per giocatore, sommate su tutte le tappe della lega, nella scheda «Statistiche stagione» dell'Anagrafe
- **Anagrafe** — archivio condiviso di giocatori e squadre (con logo e sito web cliccabile; roster di una squadra fino a 6 giocatori, `MAX_ROSTER_ANAGRAFE`, un concetto diverso dai 4 di una squadra di tappa, `MAX_ROSTER`) che le tappe riutilizzano. Logo, sito, Instagram e link dei video sono vuoti oppure indirizzi `http(s)://` (o percorsi del sito come `/logos/nome.svg`) fino a 2048 caratteri, come vuole il server: i form lo controllano prima dell'invio (`erroreUrl` in `src/utils/safeUrl.ts`)
  - scrivendo il nome di una squadra di tappa, questa si collega alla voce dell'anagrafe (nome, logo, ranking e sito; il roster non si copia) o ne crea una, solo se all'arrivo della risposta la squadra ha ancora quel nome; «Scollega» toglie il collegamento e rende di nuovo modificabile il nome (serve a cambiarlo: con lo stesso nome, alla prossima apertura della tappa la squadra si ricollega per nome)
  - modifica ed eliminazione solo per l'autore o un ADMIN
  - i dati personali (del giocatore: data di nascita, città, nazionalità, altezza, peso, esperienza, note e autore; della squadra: referente e autore) li vede solo chi ha un account
- **Archivio** — le tappe concluse e pubblicate (la pubblicazione è dei registrati), consultabili senza account in `/archivio` e `/tappa/:id`
  - squadre e roster, risultati, classifiche dei gironi, tabellone, leader e video, con «Stampa / PDF»
  - il link pubblico di una tappa conclusa si copia dalla sua pagina
- **Video** — link video per tappa, che si aggiungono e si tolgono anche a tappa conclusa (ogni cambio ripubblica la copia nell'archivio): quelli di YouTube si incorporano nella pagina (embed `youtube-nocookie.com`), gli altri si aprono in una nuova scheda
- **Coach AI** — assistente virtuale che conosce le regole FIBA 3x3 e i dati della lega corrente
  - agisce nell'app con 10 strumenti: crea lega e tappa, sorteggia, registra e annulla risultati, genera le fasi dirette, conclude la tappa, scrive nell'anagrafe
  - chiede conferma prima di sorteggiare su una tappa con risultati, annullare un risultato e concludere una tappa
  - solo per i registrati, via backend (vedi «Coach AI» e `docs/coach-ai-tool-calling.md`)
- **Conferme** — ciò che fa perdere dati (eliminare una tappa, una lega, il tabellone, una voce dell'anagrafe o un campetto; rifare il sorteggio o cambiare squadre e gironi con dei risultati; rimuovere una squadra con dati o un giocatore con statistiche; riaprire una tappa pubblicata) apre una finestra che dice che cosa si perde
- **Home dashboard** — tappa in corso, classifica live, ultimo risultato registrato, prossime partite e leader
- **Profilo giocatore** — pagina `/giocatore/:id` con statistiche aggregate, andamento punti, storico tappe e ultime partite
- **Campetti** — i campi da streetball del circuito, dal server (lettura pubblica): all'apertura quelli intorno a Roma, con «Usa la mia posizione» quelli intorno a chi guarda, con le distanze e in ordine di distanza; la casella di ricerca cerca per nome o città su tutta l'Italia; filtri (illuminato, coperto, 4 canestri, gratuito, retine, fontanella, stato del campo) sui risultati; mappa della Maps Static API con i pin disegnati dall'app (senza chiave, o se l'immagine non carica, una mappa schematica), «Indicazioni» e «Apri in Google Maps» per ogni campo; ogni registrato aggiunge un campetto (posizione da «Usa la mia posizione», da un clic sulla mappa o scritta a mano), l'autore o un ADMIN lo modifica ed elimina, l'Ospite legge soltanto (vedi «Campetti»)
- **Ospite** — accesso senza account per provare l'app: la lega sta nel `localStorage` del browser, anagrafe e archivio sono in sola lettura, la pubblicazione e il Coach AI non sono disponibili
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
- `localStorage` — lega dell'Ospite, JWT di accesso e utente di sessione (dati che restano nel browser); `sessionStorage` — cronologia del Coach AI (si azzera alla chiusura della scheda)
- [Vitest](https://vitest.dev/) + Testing Library (test unitari) e [Playwright](https://playwright.dev/) (test end-to-end)

## Requisiti

| Per | Serve |
|---|---|
| Il frontend | [Node](https://nodejs.org/) `^20.19.0`, `^22.13.0` o `>=24` (il vincolo più stretto è quello di jsdom 29, usato dai test; Vite 6 e React Router 7 ne chiedono meno) e npm. `package.json` non dichiara `engines` e non c'è un `.nvmrc`: la CI e Render usano la 22 |
| Le funzioni da registrato | Il backend [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend) in ascolto su `localhost:3001`: JDK 25 e PostgreSQL su `localhost:5432` (Maven lo scarica il wrapper `./mvnw`) |

Il backend serve per registrazione e accesso, leghe e tappe sul server, anagrafe, archivio e Coach AI. Senza, l'app parte lo stesso e l'Ospite può creare e giocare una tappa nel browser; le pagine che leggono dal server mostrano l'errore con «Riprova». I test unitari e quelli end-to-end di `tests/e2e/` non hanno bisogno del backend; quelli di `tests/e2e-backend/` lo avviano da soli (vedi «Test end-to-end con il backend vero»).

**Variabili d'ambiente.** Il frontend ne ha due, tutte e due facoltative (tipizzate in `src/vite-env.d.ts`; modello in `.env.example`, da copiare in `.env`, che git ignora):

| Variabile | A che cosa serve |
|---|---|
| `VITE_API_URL` | Origine del backend, letta in `src/services/api.ts`. Vuota va bene in sviluppo, dove il proxy di Vite (`vite.config.ts`) inoltra `/api` e `/actuator/health` a `http://localhost:3001`, e dietro un reverse proxy sulla stessa origine; va impostata solo se il backend ha un'origine propria (vedi sotto) |
| `MAPS_API_KEY` | Chiave della Maps Static API per la mappa dei Campetti (`src/components/campetti/MappaCampetti.tsx`). Senza, la pagina mostra la mappa schematica. Tiene il nome che ha nella shell e su Render: `vite.config.ts` la espone al browser con `envPrefix` (vedi «Campetti», anche per le restrizioni da impostare in Google Cloud) |

La chiave del Coach AI non è qui ma nell'`env.properties` del backend.

## Avvio rapido

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
3. Compila i valori richiesti: `ADMIN_EMAIL` e `ADMIN_PASSWORD` (almeno 8 caratteri, diversa da `admin123`, altrimenti l'admin non viene creato) e, facoltative, `GROQ_API_KEY` per il Coach AI (backend) e `MAPS_API_KEY` per la mappa dei Campetti (frontend: senza, la mappa schematica; vedi «Campetti»). `JWT_SECRET` lo genera Render, i dati del database arrivano da soli.
4. Al primo avvio il backend crea le tabelle con le migrazioni di Flyway (V1-V4: nessuno script da eseguire e nessuna variabile da impostare) e l'admin.
5. Render considera il backend pronto quando `/actuator/health/liveness` risponde 200 (`healthCheckPath` in `render.yaml`): è la sonda che dice se il processo è vivo, e con quella Render riavvia un servizio che non risponde. Non si usa `/actuator/health` intero, che comprende il database: un database in pausa o lento farebbe riavviare a vuoto un backend sano. L'app, per svegliare il backend all'apertura, continua a chiamare `/actuator/health` (la rewrite del Blueprint).

**Content-Security-Policy.** Il sito statico manda a ogni pagina una Content-Security-Policy (`headers` in `render.yaml`) che ammette solo ciò che l'app usa davvero: script e stili della build (`'self'`; gli stili inline di React passano dal CSSOM, che la policy non blocca), i font di Google Fonts (`style-src` e `font-src`), i loghi delle squadre da qualsiasi host `https:` (`img-src`), le chiamate al backend sulla stessa origine (`connect-src 'self'`: passano dalla rewrite di `/api`), i video di YouTube nell'embed senza cookie (`frame-src https://www.youtube-nocookie.com`); `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` e `form-action 'self'` chiudono il resto. La stessa policy è in `vite.config.ts` (`CSP`, applicata da `vite preview`), su cui girano i test end-to-end: `tests/e2e/csp.spec.ts` apre una pagina con logo esterno e video e controlla che non ci siano violazioni, e un test unitario (`tests/unit/csp.test.ts`) verifica che le due copie siano identiche. **Se si aggiunge una risorsa esterna** (un'altra CDN di font, un'API su un'altra origine con `VITE_API_URL`, un embed diverso da YouTube) va aggiunta alla direttiva giusta in tutti e due i posti, altrimenti in produzione il browser la blocca in silenzio; il test unitario fallisce se se ne aggiorna una sola.

**Dopo il deploy**

- Controlla gli URL assegnati. Oggi sono `https://hoop3x3.onrender.com` (frontend) e `https://hoop3x3-api-06m1.onrender.com` (backend: `hoop3x3-api.onrender.com` era già di un altro account e Render ha aggiunto il suffisso). Se cambiano, o con un nuovo Blueprint, aggiorna i punti segnati con «URL» in `render.yaml` (le rewrite di `/api/*` e `/actuator/health` e `CORS_ORIGINS`) oppure gli stessi valori nella dashboard. Con un dominio personalizzato vale lo stesso per `CORS_ORIGINS`.
- Un 503 con la pagina «Service Suspended» su login o registrazione vuol dire che la rewrite di `/api/*` punta a un servizio che non è il tuo: confronta l'indirizzo in `render.yaml` con quello mostrato nella dashboard del backend.
- Prova login, ricarica della pagina e un salvataggio: un 403 «Invalid CORS request» sulle POST vuol dire che `CORS_ORIGINS` non coincide con l'origine del frontend.
- Per i dati di prova imposta `SEED_DEMO=true` sul backend e riavvialo.
- Il Blueprint imposta sul backend `SERVER_FORWARD_HEADERS_STRATEGY=native` e `LIMITE_AUTH_AL_MINUTO=60`: dietro la rewrite il limite di login, registrazione e rinnovo potrebbe contare un solo indirizzo per tutto il sito, e 60 è il valore provvisorio finché non si verifica quale indirizzo arriva. Come verificarlo e quando riabbassare il limite: «Limiti di frequenza» nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend). Un servizio creato prima della fase 2 può avere ancora `DB_INIT_MODE` nella dashboard: non ha più effetto e si può togliere.

**Piani free** — il backend si spegne dopo 15 minuti senza richieste e la prima richiesta dopo la pausa aspetta il riavvio della JVM (anche più di un minuto, oltre i 15 secondi di attesa del client: la prima chiamata può fallire con «Il server non risponde»). Il database free scade dopo 30 giorni. Per ridurre l'attesa l'app chiama `/actuator/health` appena si apre (`svegliaServer` in `src/services/api.ts`): il backend riparte mentre l'utente guarda la home, e di solito al login è già pronto. Per una demo dal vivo conviene comunque il piano starter del backend, oppure aprire l'app qualche minuto prima.

Ogni push su `main` di uno dei due repository ripubblica il servizio corrispondente.

**Ordine di pubblicazione** — frontend e backend non vanno online nello stesso istante, quindi l'ordine conta: prima questo frontend, subito dopo il backend, in un momento senza tornei in corso (nessuno sta salvando una tappa), poi si ricaricano le schede aperte. Il backend nuovo rifiuta con 400 il salvataggio di una tappa senza `versione`: una scheda di questo frontend rimasta aperta dal backend precedente rilegge la lega e rimanda da sola (vedi «Versioni e conflitti» qui sotto), una scheda del frontend precedente continua a ricevere il 400 finché non si ricarica la pagina. Il perché dell'ordine, visto dal backend, è nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend): sezioni «Sessioni e refresh token» («Ordine di pubblicazione») e «Tappe e modifiche da più dispositivi» («Compatibilità»).

## Script disponibili

| Comando | Descrizione |
|---|---|
| `npm run dev` | Dev server con hot reload su `http://localhost:5173` (le chiamate a `/api` passano dal proxy verso il backend) |
| `npm run build` | Controllo dei tipi (`tsc -b`) e build di produzione in `dist/` |
| `npm run preview` | Serve `dist/` su `http://localhost:4173` (dopo `npm run build`); è tra le origini che il backend ammette di base |
| `npm run lint` | ESLint su tutto il progetto, senza avvisi ammessi (`--max-warnings 0`) |
| `npm run typecheck` | Controllo dei tipi (`tsc -b`) |
| `npm test` | Test unitari (Vitest, `tests/unit/`) |
| `npm run check` | `lint` + `typecheck` + `test`: il controllo da fare prima di ogni commit (non comprende copertura, build ed end-to-end) |
| `npm run test:e2e` | Test end-to-end (Playwright, `tests/e2e/`): fanno da soli la build e la servono con `vite preview` sulla porta 5199, con la Content-Security-Policy di produzione |
| `npm run test:e2e:backend` | Test end-to-end con il backend vero (`tests/e2e-backend/`): avviano il jar del backend sulla porta 3199 e il dev server sulla 5299; servono `E2E_BACKEND_JAR` e un database di prova (vedi sotto) |

Prima volta con i test end-to-end: `npx playwright install chromium` (sono provati solo con Chromium). Per `tests/e2e/` non serve il backend: i percorsi da registrato rispondono alle chiamate a `/api` con risposte finte (`tests/e2e/helpers.ts`) e gli altri lavorano da Ospite. Girano sulla build servita da `vite preview`, non sul dev server: così provano anche la Content-Security-Policy (vedi «Deploy su Render»); senza proxy, una chiamata a `/api` senza risposta finta riceve dal preview la pagina dell'app, non un errore di rete.

**Test end-to-end con il backend vero.** `tests/e2e-backend/` (configurazione in `playwright.backend.config.ts`) prova senza risposte finte ciò che il server finto può solo imitare: registrazione, uscita e accesso con le credenziali controllate dal server, lega e tappa salvate sul server e rilette dopo una ricarica, e il rinnovo del JWT con il cookie di refresh vero, due volte di seguito (il server ruota il refresh token a ogni rinnovo). Fissano anche il contratto che il server finto di `tests/e2e/` imita: le creazioni rispondono 201, la prima versione di una tappa è 0 e ogni PUT la aumenta di uno. Servono Java 25, il jar del backend (`./mvnw -B package -DskipTests` nel repository `hoop3x3-backend`) e un database PostgreSQL di prova, vuoto o già usato da questi test (le tabelle le crea Flyway all'avvio; i test non svuotano niente, ogni test registra un utente nuovo e lavora sui suoi dati). Poi:

```bash
createdb hoop3x3_e2e   # una volta
E2E_BACKEND_JAR=../hoop3x3-backend/target/hoop-3x3-backend-1.0.0.jar npm run test:e2e:backend
```

Il database si sceglie con `E2E_DB_NAME`, `E2E_DB_USERNAME` e `E2E_DB_PASSWORD` (di base `hoop3x3_e2e`, `postgres`, vuota). Il backend parte con un `JWT_SECRET` fisso di prova, `CORS_ORIGINS` sull'origine del dev server e il limite di login alzato (`LIMITE_AUTH_AL_MINUTO`), tutto in `playwright.backend.config.ts`: non legge `env.properties`, che sta nella cartella del backend.

**Copertura.** `npm test -- --coverage` misura la copertura di `src/` e **fallisce** se un file di queste cartelle scende sotto l'80% di righe, funzioni, rami o istruzioni, ogni file per conto suo (`perFile`): `src/domain`, `src/utils`, `src/stores`, `src/services` (soglie in `vite.config.ts`; i componenti si provano più dal browser e non hanno soglia). Con la media per cartella un file piccolo senza test restava nascosto dietro quelli grandi ben provati. Il report è in `coverage/`.

**Integrazione continua.** `.github/workflows/ci.yml` gira a ogni push su `main` e a ogni pull request, con Node 22, in due job: `frontend` fa `npm ci`, lint, controllo dei tipi, `npm test -- --coverage` (con le soglie di sopra), build, installazione di Chromium e `npm run test:e2e` (sul preview della build, con la CSP); `e2e-backend` scarica il ramo `main` di `hoop3x3-backend`, ne compila il jar con Java 25, avvia un PostgreSQL 18 di servizio e fa `npm run test:e2e:backend`. Un solo passo che fallisce ferma la CI. Una PR del frontend che dipende da una modifica del backend passa `e2e-backend` solo dopo che quella è unita in `main` del backend. Il workflow ha solo il permesso di lettura del repository (`permissions: contents: read`), un push nuovo sullo stesso ramo ferma il giro in corso (`concurrency`), e Chromium viene dalla cache quando la versione di Playwright non cambia (`~/.cache/ms-playwright`). `.github/dependabot.yml` propone ogni settimana gli aggiornamenti di npm (minori e patch raggruppati, al massimo 5 PR aperte) e delle action (al massimo 3).

## Coach AI (opzionale)

Il Coach AI usa [Groq](https://console.groq.com/) (tier gratuito) attraverso il backend (`POST /api/coach/chat`), così la chiave non arriva mai al browser. Il modello lo sceglie il backend (`GROQ_MODEL`, di base `openai/gpt-oss-120b`). Impostala nell'`env.properties` del backend:

```properties
GROQ_API_KEY=gsk_...
```

Senza chiave il Coach risponde "non configurato" e il resto dell'app funziona normalmente. Il Coach è riservato agli utenti registrati: un ospite riceve in chat l'invito a creare un account e non parte nessuna chiamata. Strumenti, conferme, chiamate al backend e limiti del ciclo sono in [`docs/coach-ai-tool-calling.md`](docs/coach-ai-tool-calling.md).

## Campetti

La pagina `/campetti` legge i campi da streetball dal backend (`GET /api/campetti`, pubblico: funziona anche da Ospite) in due modi: intorno a un punto entro un raggio (`?lat=&lng=&raggioKm=`, al massimo 200 campetti, ordinati per distanza) e per testo su tutta l'Italia (`?q=`, cercato nel nome e nella città, ordinati per città e nome, o per distanza se c'è anche la posizione). All'apertura chiede i campetti intorno al centro di Roma (`41.9028, 12.4964`, 20 km); con «Usa la mia posizione» quelli intorno a chi guarda, con lo stesso raggio; la casella di ricerca manda il testo 300 ms dopo l'ultimo tasto, una richiesta per parola, e la risposta di una ricerca superata nel frattempo si scarta (`useCampettiStore`, con un'epoca come l'anagrafe). I filtri lavorano sui risultati, nel browser. I dati vengono da [Pick-Roll](https://pick-roll.com), con il permesso del proprietario (l'attribuzione è in fondo alla pagina); le coordinate dei sei campetti di esempio del seed sono i centroidi delle aree verdi di OpenStreetMap (© OpenStreetMap contributors, ODbL).

**La mappa.** È un'immagine della [Maps Static API](https://developers.google.com/maps/documentation/maps-static) inquadrata sui soli campetti mostrati (`inquadra` in `src/utils/geo.ts`), con i pin disegnati dall'app sopra l'immagine (proiezione Web Mercator, `proietta`): nessuno script di Google nella pagina, quindi la Content-Security-Policy non cambia (`img-src https:` ammette già l'immagine). La chiave sta in `MAPS_API_KEY` (nella shell per `npm run dev`, tra le variabili del sito statico su Render) ed entra nella build, quindi nella pagina: è il modo in cui funziona ogni chiave di Google Maps usata dal browser, e la proteggono le restrizioni da impostare in [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/credentials), non il segreto. Da impostare sulla chiave: **restrizione per referrer** (i soli siti ammessi: `https://hoop3x3.onrender.com/*` e, per lo sviluppo, `http://localhost:5173/*`), **restrizione per API** (solo «Maps Static API») e una **quota giornaliera** (la Static API ne regala 10.000 al mese). Per questo l'immagine non ha `referrerPolicy="no-referrer"`: la restrizione per referrer legge proprio il Referer, e la Referrer-Policy del sito (`strict-origin-when-cross-origin`) manda l'origine, che basta. Per verificare che la restrizione sia attiva: `curl` senza `Referer` all'URL dell'immagine risponde 403. **Senza chiave**, o se l'immagine non carica (rete, quota esaurita, restrizioni), la pagina mostra la mappa schematica di prima con gli stessi pin: tutto il resto funziona uguale. I test unitari e gli end-to-end girano senza chiave, e la chiave non va mai in un test, in un log o in un rapporto.

**Privacy della posizione.** La posizione la chiede solo il pulsante «Usa la mia posizione», mai all'apertura della pagina (`usePosizione`: niente richiesta di permesso a chi non l'ha voluta), e resta nel browser: non entra nell'URL dell'immagine di Google (centro e zoom dipendono dai campetti; il segno dell'utente lo disegna l'app) e non si salva. Al nostro server arriva solo come centro della ricerca per raggio (`lat` e `lng` della query string di `GET /api/campetti`): il nostro codice non la registra (i log di piattaforma di Render possono tenere l'URL delle richieste), ed è ciò che serve per rispondere «i campetti intorno a te», e niente altro. Con il permesso negato o la posizione non disponibile la pagina lo dice e resta usabile, con i campetti in ordine di città e nome. «Indicazioni» e «Apri in Google Maps» sono link a Google Maps con le coordinate del campetto (senza chiave né posizione dell'utente), in una nuova scheda.

**Chi scrive (D3).** Ogni utente registrato aggiunge un campetto (`POST /api/campetti`, 401 senza token); l'autore o un ADMIN lo modifica ed elimina (`PUT`/`DELETE /api/campetti/{id}`, 403 agli altri); l'Ospite legge soltanto, con «Aggiungi un campetto» disattivato e il titolo che lo dice. «Modifica» ed «Elimina» compaiono sulla card solo a chi può (`puoModificareCampetto` in `src/utils/permessi.ts`: come l'anagrafe, ma con `autoreId` null, cioè un campetto il cui autore non esiste più, decide solo l'ADMIN). Senza token il server manda `autoreId` null a tutti i campetti, come i dati riservati dell'anagrafe: per questo la cache (`useCampettiStore`) si svuota all'accesso e all'uscita, anche in un'altra scheda, e la pagina aperta riscarica. Il form (`CampettoForm`, in una finestra) ha i campi di `CampettoRequestDTO` con i limiti del server (`maxLength` da `src/constants/rules.ts`) e controlla prima dell'invio nome, canestri (da 1 a 8) e **la posizione, in uno di tre modi**: «Usa la mia posizione» (`usePosizione`, lo stesso hook della pagina), un clic sulla mappa dentro il form (`MappaCampetti.onClicMappa`, la proiezione inversa `coordinateDa`; il pin provvisorio mostra il punto scelto) oppure latitudine e longitudine scritte a mano, anche con la virgola, dentro −90..90 e −180..180. Se il server rifiuta, il motivo compare nel form e i dati restano. La modifica manda la `versione` del campetto: con un **409** (modificato da un altro dispositivo nel frattempo) lo store ricarica la ricerca corrente, la finestra si chiude e un avviso dice che le modifiche scritte non sono state salvate, come nell'anagrafe; la geocodifica dell'indirizzo con Google resta fuori (servirebbe una seconda chiave riservata al server). Gli end-to-end con il backend vero (`tests/e2e-backend/campetti.spec.ts`) fissano il contratto: POST 201 con `versione` 0 e `tipo` «campetto», PUT 200 con la versione aumentata, DELETE 204.

**Se si aggiunge una risorsa esterna** (per esempio una mappa interattiva con lo script di Google, o le tile di un altro fornitore) vale quanto detto in «Deploy su Render» sulla Content-Security-Policy: la direttiva giusta va aggiornata in `render.yaml` e in `vite.config.ts`, e gli end-to-end su `vite preview` la provano prima del deploy.

## API REST

Il contratto del backend (endpoint per endpoint, chi può chiamarlo, codici di stato) sta nella sezione «Endpoint» del README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend), che la ricava dai test di accesso; i limiti (dimensioni, lunghezze, frequenza delle richieste) nelle sezioni «Limiti dell'API» e «Limiti di frequenza». Qui non si ripetono, per non farli divergere. Il frontend chiama il backend solo da `src/services/`, e ogni servizio ha il suo gruppo di endpoint:

| Servizio | Gruppo di endpoint |
|---|---|
| `api.ts` (client HTTP: JWT, rinnovo, tempo massimo) | `POST /api/auth/refresh` (il rinnovo della sessione) e `GET /actuator/health` (appena si apre l'app, per svegliare il backend dei piani free: `svegliaServer`). Se l'utente esce mentre un rinnovo è in corso, chiama anche `POST /api/auth/logout` per chiudere la sessione appena rinnovata; se il rinnovo è respinto (401) toglie solo il token e avvisa l'app che la sessione è finita |
| `authService.ts` | `/api/auth/*`: registrazione, accesso, uscita e verifica della sessione (`/api/auth/me`) |
| `legheApi.ts` | `/api/leghe` (indice, nuova lega, import con le tappe), `/api/leghe/{id}` (dettaglio, rinomina, eliminazione), `/api/leghe/{id}/tappe` (nuova tappa), `/api/tappe/{id}` (salvataggio ed eliminazione di una tappa) |
| `anagrafeApi.ts` | `/api/anagrafe/giocatori` e `/api/anagrafe/squadre` (lettura, creazione, modifica, eliminazione) |
| `archivioApi.ts` | `/api/archivio` (elenco) e `/api/archivio/{tappaId}` (dettaglio, pubblicazione, ritiro) |
| `campettiApi.ts` | `/api/campetti` (lettura pubblica per raggio o per testo, creazione) e `/api/campetti/{id}` (modifica, eliminazione) |
| `aiService.ts` | `POST /api/coach/chat` (il Coach AI) |

Non usa `GET /api/utenti` (solo ADMIN) né `GET /api/coach/status`: la chiave Groq mancante la scopre dal 503 della chat. Negli store e nelle pagine il client mostra all'utente il campo `message` delle risposte d'errore del backend (`testoErrore`), o «Errore <status>» se il corpo manca; la chat del Coach ha testi suoi (`errorMsg` in `useCoachAI.ts`) e riporta il `message` del backend solo per il 400.

Un utente `ADMIN` iniziale viene creato al primo avvio dalle proprietà `ADMIN_EMAIL` / `ADMIN_PASSWORD` di `env.properties`.

## Struttura del progetto

```
tests/
├── unit/             # Test unitari e di componenti (Vitest; jsdom dove serve il DOM)
├── e2e/              # Test end-to-end con il server finto (Playwright, playwright.config.ts)
└── e2e-backend/      # Test end-to-end con il backend vero (playwright.backend.config.ts)
docs/                 # Coach AI, design system e mockup di riferimento
.github/workflows/    # CI (ci.yml)
render.yaml           # Blueprint di Render
src/
├── components/       # Componenti UI suddivisi per dominio
│   ├── anagrafe/     # Giocatori e squadre
│   ├── archivio/     # Storico tappe
│   ├── auth/         # Login, registrazione e rotta riservata (RequireAuth)
│   ├── campetti/     # Mappa (MappaCampetti), posizione dell'utente, card, form (CampettoForm) e finestra di un campetto (CampettoModal)
│   ├── coach/        # Pannello Coach AI
│   ├── gironi/       # Gestione gironi e classifiche
│   ├── layout/       # Header (con navigazione), Hero e barra degli avvisi (SyncBanner)
│   ├── profile/      # Sparkline del profilo giocatore
│   ├── leaderboard/  # Leader della tappa per categoria statistica e classifica a righe (StandingsTable)
│   ├── partita/      # Live scoring e statistiche
│   ├── squadra/      # Roster editor
│   ├── tappa/        # Gestione tappa
│   ├── ui/           # Componenti base (Button, Input, Card, Badge, StatTile, Section, Modal, ConfirmDialog, Icon…)
│   └── video/        # Video della tappa
├── coach/            # Coach AI: definizioni dei tool (toolDefs) ed esecutori (toolHandlers)
├── constants/        # Regole, ruoli, tipi di evento, limiti del server
├── domain/           # Operazioni di tappa come funzioni pure (sorteggio, risultati, fasi dirette, conclusione)
├── hooks/            # Custom hooks
├── pages/            # Pagine dell'app
├── services/         # Client HTTP (api.ts), servizi REST (leghe, anagrafe, archivio, campetti, auth) e AI
├── stores/           # Store Zustand: stato globale (useAppStore, con memoriaBrowser e versioniTappe), cache dell'anagrafe (useAnagrafeStore) e dei campetti (useCampettiStore)
├── types/            # Definizioni TypeScript
└── utils/            # Funzioni di utilità (gironi, classifica, geometria dei campetti in geo.ts, ecc.)
```

## Design system

Tema unico dark "Asphalt": palette, font (Barlow Condensed + IBM Plex Sans), scala e regole di
accessibilità sono in [`docs/design-system.md`](docs/design-system.md). I mockup di riferimento
(Stitch) sono in `docs/design/stitch-screens/`; la foto della hero è `public/hero-court.jpg`.

## Dati e persistenza

- **Utente registrato**: leghe e tappe sono sul server (`leghe`, `tappe`), l'anagrafe e l'archivio sono condivisi tra tutti gli utenti. Lo store aggiorna subito lo stato in memoria e salva in background.
  - **Coda dei salvataggi.** Creazione e modifiche delle tappe passano da una coda dei salvataggi (`src/stores/saveQueue.ts`): la tappa intera parte 400 ms dopo l'ultima modifica (POST per una tappa nuova, poi PUT), con una sola richiesta alla volta per tappa e sempre l'ultima versione. Se la rete manca, il server non risponde entro il tempo massimo, ha un guasto (5xx) o respinge il JWT senza che il rinnovo riesca (401), la coda riprova da sola dopo 2, 5 e 15 secondi, poi alla modifica successiva. Intanto una barra sotto l'intestazione dice quante tappe hanno modifiche non salvate e perché, con «Riprova ora», e resta finché tutto è salvato; i dati rifiutati dal server (gli altri errori 4xx) non si ritentano e compaiono in una riga a parte della barra, una frase per tappa, che un errore arrivato dopo non copre e che non si chiude: resta finché è vera, cioè finché la versione rifiutata è l'ultima della tappa (sparisce quando la tappa si salva, si modifica di nuovo, si elimina o la lega si riapre; un rifiuto arrivato quando in coda c'è già una versione più nuova non si registra, decide il salvataggio di quella). La frase dice che cosa fare: correggere la tappa, oppure riaprire la lega per tornare alla versione salvata sul server; per una tappa nuova, la cui creazione è stata rifiutata, dice che sul server non c'è e che va corretta, perché riaprendo la lega sparirebbe. Se la tappa è di un'altra lega la nomina, e dice che la versione rifiutata non è più in memoria (aprendo l'altra lega lo store l'ha sostituita): riaprendo si trova quella salvata sul server, e una tappa nuova è andata persa. «Esci» salva prima ciò che è in attesa (anche la rinomina della lega) e, se qualche tappa non arriva al server o ha nella lega aperta un salvataggio rifiutato, chiede conferma prima di uscire; un rifiuto di un'altra lega non conta, perché uscire non perde niente che sia ancora qui. Quando la scheda viene nascosta (cambio di scheda o di app, spesso l'ultimo momento prima della chiusura su mobile) ciò che è in attesa parte subito, con una richiesta normale. Alla chiusura della pagina le versioni non ancora confermate dal server partono con keepalive, compresa quella di un salvataggio in corso (il browser lo interrompe), senza tempo massimo e senza aspettare un rinnovo del JWT. **Limite di keepalive:** la specifica Fetch non accetta una richiesta keepalive se, con quelle già in volo, i corpi superano 64 KiB, e una tappa con i tabellini pesa 34-46 KiB con 16 squadre, 61 KiB con 24 e 64-89 KiB con 32 (oltre 120 KiB con 32 squadre in gironi da 8 o con 64). Le tappe che porterebbero il totale oltre 60 KiB quindi non partono: restano nel browser (`hoop3x3_da_rimandare`, con l'utente che le ha scritte) e si rimandano alla prossima apertura dell'app, prima di leggere le leghe; se nel frattempo un altro dispositivo ha salvato la tappa vale la sua, con l'avviso dei conflitti, e con la rete ancora assente restano per la volta dopo. Se si chiude con versioni non ancora confermate il browser chiede conferma prima di uscire. La DELETE di una tappa parte solo quando il suo salvataggio in volo è finito («Esci» la aspetta, e se la pagina si chiude prima parte subito con keepalive; un 404 della DELETE vuol dire che la tappa non c'è già più). Eliminando una lega i salvataggi in attesa delle sue tappe si fermano, e un nuovo tentativo partito mentre la DELETE della lega è in corso, che riceve 404, non è un errore.
  - **Versioni e conflitti.** Ogni tappa ha un numero di `versione`, che decide il server: la PUT manda quello dell'ultima risposta (GET della lega, POST o PUT) e, al 200, lo sostituisce con quello della risposta senza toccare le modifiche fatte nel frattempo. Se un altro dispositivo, o un'altra scheda, ha salvato la tappa nel frattempo, il server risponde 409: l'app rilegge la lega, mostra la tappa com'è sul server, scarta le modifiche non ancora salvate di quella tappa (rimandarle cancellerebbe il lavoro dell'altro) e lo dice nella barra degli avvisi, in una riga a parte che nomina tutte le tappe coinvolte finché non si chiude (un errore arrivato dopo non la nasconde); una pubblicazione in corso non parte. Se la tappa sul server non c'è più, l'ha eliminata un altro dispositivo: esce anche dallo store, con l'avviso. Di solito però una tappa eliminata altrove dà 404 alla PUT, non 409, perché il server controlla che la tappa esista prima della versione: anche dopo un 404 l'app rilegge la lega e, se la tappa non c'è più, la toglie allo stesso modo (niente più errore a ogni modifica né pubblicazione bloccata); se c'è, il 404 resta un salvataggio rifiutato. Se invece la tappa del server è uno dei salvataggi di questo dispositivo rimasti senza risposta (tempo scaduto mentre il server ripartiva, salvataggio alla chiusura della pagina; se ne ricordano gli ultimi 20 per tappa, senza doppioni), il conflitto è suo: prende la versione del server e rimanda le modifiche, senza avviso; un secondo 409 dopo quel nuovo invio fa valere la tappa del server. Lo stesso vale per il 409 della POST (tappa già creata): se la tappa del server è un corpo di questo dispositivo si passa alla PUT con la versione letta, altrimenti vale quella del server, con l'avviso. Il confronto normalizza i campi come il server (`src/utils/stessaTappa.ts`: spazi ai lati, campi assenti, blocchi di gioco come valori) e non guarda la versione. Una pagina aperta prima dell'aggiornamento del server riceve 400 «Manca la versione»: rilegge la lega e rimanda una volta. Una tappa che un altro dispositivo salva mentre la si elimina (409 sulla DELETE) torna al suo posto, com'è sul server, con un avviso; se invece il salvataggio arrivato insieme era uno di questo dispositivo rimasto senza risposta, la DELETE si rimanda una volta, senza avviso. La versione nota non scende mai, e una lettura della lega partita prima di un salvataggio o di un conflitto non riporta indietro i dati. Riaprendo la lega già aperta, per una tappa con un salvataggio in attesa o ancora in corso, o letta più vecchia della versione nota, vale la copia sullo schermo, che è sempre la più recente: la coda manda proprio quella, la risposta di un salvataggio ne cambia solo la versione e un conflitto la sostituisce con la tappa del server. Una tappa la cui ultima versione il server ha rifiutato, anche durante la lettura, torna invece com'è sul server, e una tappa nuova rifiutata, che sul server non c'è, sparisce: è ciò che dice la riga dei rifiuti. Una tappa creata mentre la lettura era in corso resta anche se la lettura non la contiene; una che il server aveva già e che manca dalla lettura l'ha eliminata un altro dispositivo, ed esce. Non torna una tappa eliminata qui mentre la lettura era in corso, né una che un salvataggio di qui ha trovato eliminata altrove nel frattempo. Tornando da un'altra lega valgono le versioni non ancora confermate e, se un conflitto si è risolto mentre la lega era chiusa, la tappa del server. La versione non entra nel file della lega esportato e non riguarda l'ospite.
  - **Pubblicazione.** La pubblicazione nell'Archivio (alla conclusione di una tappa, dopo un video aggiunto a una tappa conclusa, dal Coach AI) manda al server solo l'id (`pubblica` dello store) e parte dopo che la coda si è svuotata: la copia pubblica la costruisce il server da ciò che ha salvato. Se la tappa non arriva al server (rete assente, dati rifiutati) non si pubblica e l'errore dice perché. Una rinomina della lega in attesa parte prima, ma non si controlla: se la PATCH fallisce la copia pubblica porta il nome che il server ha. La pagina di una tappa conclusa dice «pubblicata» solo se lo è: all'apertura lo chiede all'archivio (`GET /api/archivio/{tappaId}`, il 404 vuol dire che non c'è) e, se la pubblicazione non è riuscita, lo dice col motivo e indica «Riapri» e poi «Concludi». «Pubblicata» o «non pubblicata» solo se l'esito è certo: con rete assente o tempo scaduto sulla PUT la pagina dice solo «Conclusa» con il motivo, perché il server potrebbe aver pubblicato. «Riapri» toglie la tappa dall'archivio prima di riaprirla (anche nel dubbio, tollerando il 404): se il server non ci riesce la tappa resta conclusa e la pagina lo dice, e resta disattivato mentre è in corso una pubblicazione avviata dalla pagina (conclusione o video): quelle del Coach AI non lo disattivano. Un 502, 503 o 504 sulla PUT conta come esito ignoto, come la rete assente: dietro un proxy il server può aver pubblicato lo stesso. L'eliminazione di una tappa o di una lega non ritira niente dal client: il server toglie da solo le pubblicazioni.
- **Ospite**: la lega resta nel `localStorage` del browser; anagrafe e archivio sono consultabili in sola lettura. All'avvio la lega aperta si controlla con gli stessi campi dell'import (`src/utils/legaFile.ts`) ma senza i limiti del server (un nome vuoto, un numero di gironi o una regola fuori limite si tengono e si correggono dall'app): le tappe con la forma sbagliata (per esempio una tappa importata in passato senza l'elenco delle squadre) non si caricano e una barra sotto l'intestazione dice quali e perché, mentre il resto si usa; spariscono dal browser al primo salvataggio della lega, e l'avviso lo dice. Una lega illeggibile non si apre e si elimina dall'elenco delle leghe. Se il browser rifiuta una scrittura dei dati (spazio esaurito) la modifica resta in memoria e la barra lo dice (ricordare la lega aperta per la prossima visita è solo una comodità: se non si scrive non si dice niente); la X chiude il testo ma non la protezione: finché una scrittura della lega aperta non riesce (o la lega aperta non si elimina), aprire, creare o importare un'altra lega prova prima a salvarla, e «Esci» chiede la stessa conferma «Uscire senza salvare?» dei registrati. Con l'app aperta in più schede ognuna segue le scritture delle altre (evento `storage`): l'elenco delle leghe si rilegge, la lega aperta salvata in un'altra scheda si ricarica (vale l'ultima scrittura) e quella eliminata altrove si chiude con un avviso; prima di riscrivere l'indice delle leghe lo si rilegge dal browser, così una lega creata in un'altra scheda non sparisce.
- **Sessione**: il JWT di 30 minuti è in `localStorage`. `api.ts` lo rinnova da solo con il refresh token, che il server imposta e il browser conserva in un cookie httpOnly (30 giorni, ruotato a ogni rinnovo): in anticipo quando mancano meno di 2 minuti alla scadenza, anche a pagina ferma (un controllo ogni 60 secondi e al ritorno sulla scheda), oppure dopo un 401 ripetendo la richiesta una sola volta. La scadenza si giudica nell'ora del server: a ogni token che arriva si legge lo scarto tra il suo `iat` e l'orologio del dispositivo, così un orologio avanti non fa rinnovare un JWT valido a ogni controllo e uno indietro non fa credere valido un JWT scaduto. Così anche dopo una pausa il salvataggio alla chiusura della pagina parte subito con un JWT valido. Ogni richiesta ha un tempo massimo di 15 secondi (65 per la chat del Coach, che sul server aspetta il modello fino a 60; 90 per il rinnovo del JWT; nessuno per i salvataggi alla chiusura della pagina): oltre, conta come rete assente. Il rinnovo ha un tempo lungo perché un rinnovo abbandonato mentre il server si avvia a freddo (Render, 30-60 secondi) il server lo esegue lo stesso: ruota il refresh token e il cookie nuovo arriva in una risposta che nessuno legge, e al rinnovo dopo l'utente si troverebbe fuori. Per lo stesso motivo, all'avvio con una sessione salvata l'app aspetta che `/actuator/health` risponda (un tentativo ogni 2 secondi, al massimo 90 secondi, con «Server in avvio») prima di verificare la sessione, e intanto il rinnovo automatico resta fermo; se il server non risponde non si tenta nessun rinnovo e compare l'avviso con «Riprova». Il periodo di grazia sul server per il token appena ruotato è nel TODO. Le schede dello stesso browser condividono la sessione e rinnovano una alla volta (con le Web Locks API). Quando la sessione finisce (refresh token scaduto o revocato, «Esci» o sessione finita in un'altra scheda, sessione scaduta all'avvio) si esce senza conferma, perché salvare non è più possibile, e si torna al form di accesso con «Sessione scaduta: accedi di nuovo» e il numero delle tappe con modifiche non salvate, se ce n'erano. Il logout cancella subito il JWT e revoca il refresh token sul server. Limite noto: il logout chiude la sessione di questo browser (un JWT già emesso resta valido fino a 30 minuti, gli altri dispositivi non vengono toccati).
- **Anagrafe**: viene scaricata una sola volta e tenuta in cache nello store (`useAnagrafeStore`), non a ogni apertura di pagina; ogni scrittura (dalle pagine o dal Coach AI) aggiorna server e cache. Le modifiche di altri utenti si vedono ricaricando la pagina. Ogni voce ha una `versione` decisa dal server, come le tappe: la PUT la rimanda (se il server non la manda ancora non si invia) e, se un altro dispositivo ha salvato la voce nel frattempo, risponde 409: lo store rilegge la voce, la mette in cache e la scheda esce dalla modifica mostrandola, con l'avviso «modificata da un altro dispositivo»; ciò che era scritto non si salva sopra e si riscrive con «Modifica». La ricerca per nome di una squadra (`trovaSquadra`) che non trova la lista del server rifiuta la promessa invece di dire «non trovata»: altrimenti la pagina della tappa ne creerebbe un doppione. Se il caricamento fallisce la pagina lo dice, con «Riprova» (un'anagrafe, un archivio o una tappa pubblica che non si sono potuti caricare non si mostrano come vuoti o «non trovati»); una pagina che non si riesce a disegnare mostra un messaggio con «Ricarica» (`ErrorBoundary`) e il resto dell'app resta usabile.

Lo schema del database lo crea Flyway nel backend all'avvio, con le migrazioni V1-V4 (`src/main/resources/db/migration` del repo backend). Con `SEED_DEMO=true` in `env.properties` il primo avvio carica i dati di prova del circuito Estathé 2025 (32 giocatori, 8 squadre, lega con 4 tappe concluse e archivio) intestandoli all'admin; gli avvii successivi non li duplicano.

I dati di gioco della tappa (squadre iscritte, gironi, partite con statistiche ed eventi, bracket, video) sono colonne `JSONB` della tabella `tappe`: il motore torneo li legge e li scrive sempre come blocco unico. Regole, nome, luogo, data e stato sono colonne normali.

La struttura dei package Java (controllers, dto, entities, security, services…) è descritta nel README di [hoop3x3-backend](https://github.com/Gabrieleleonardi21/hoop3x3-backend).
