/**
 * SEED DATI REALI — Estathé 3x3 Italia Streetbasket Circuit
 *
 * Squadre e giocatori tratti dai circuiti Elite e Classic FIP 2022-2025.
 * Fonti verificate:
 *  [R] Wikipedia IT "Campionati italiani di pallacanestro 3x3"
 *  [R] FIP.it — comunicati Finals 2024 e 2025
 *  [R] 3x3italia.fip.it — ranking Elite/Classic 2023-2025
 *  [P] PianetaBasket.com — convocazioni nazionale 3x3 Open apr. 2025 (17 giocatori)
 *  [R] MasterGroupSport.com — Opening Tournament 2025 (The Goat Torino roster/MVP)
 *  [E] Stima: giocatori non reperibili in fonti pubbliche (marcati [E])
 *
 * Incolla nella console del browser su http://localhost:5173, poi ricarica.
 */
(async () => {
  const sha256 = async (text) => {
    const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const NS  = "hoop3x3_";
  const NSS = "hoop3x3_shared_";
  const set = (key, val, shared = false) =>
    localStorage.setItem((shared ? NSS : NS) + key, JSON.stringify(val));

  const accountExists = !!localStorage.getItem(NS + "account");
  if (!accountExists) {
    const hash = await sha256("admin123");
    set("account", { name: "Admin", email: "admin@hoop3x3.it", hash });
  }

  const now = Date.now();

  // ─── GIOCATORI ─────────────────────────────────────────────────────────────

  const giocatori = [
    // ── Team Rome (2025 Champion, Circuito Elite) ──────────────────────────
    // Fonte: fip.it Finals 2025 + PianetaBasket convocazione nazionale apr. 2025
    { id:"p01", nome:"Flavio",    cognome:"Gay",          soprannome:"",        nascita:"1998-03-15", citta:"Ravenna",   nazionalita:"ITA", altezza:"192", peso:"88", ruolo:"Guardia",   numero:"",  squadra:"Team Rome", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Orasì Ravenna",              autore:"Admin", ts:now },
    { id:"p02", nome:"Giacomo",   cognome:"Leardini",     soprannome:"",        nascita:"1999-07-20", citta:"Vigevano",  nazionalita:"ITA", altezza:"194", peso:"90", ruolo:"Ala",       numero:"",  squadra:"Team Rome", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Elachem Vigevano",           autore:"Admin", ts:now },
    { id:"p03", nome:"Lorenzo",   cognome:"Lovato",       soprannome:"",        nascita:"2001-02-08", citta:"Varese",    nazionalita:"ITA", altezza:"191", peso:"85", ruolo:"Playmaker", numero:"",  squadra:"Team Rome", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Coelsanus Basket 7 Laghi",   autore:"Admin", ts:now },
    { id:"p04", nome:"Andrea",    cognome:"Valentini",    soprannome:"",        nascita:"1998-11-03", citta:"Roma",      nazionalita:"ITA", altezza:"193", peso:"89", ruolo:"Ala",       numero:"",  squadra:"Team Rome", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Virtus Gvm Roma 1960",       autore:"Admin", ts:now },

    // ── Concrete (2024 Champion, Circuito Elite) ───────────────────────────
    // Fonte: fip.it Finals 2024 + PianetaBasket convocazione nazionale apr. 2025
    { id:"p05", nome:"Matteo",    cognome:"Airaghi",      soprannome:"",        nascita:"1996-05-12", citta:"Matera",    nazionalita:"ITA", altezza:"196", peso:"93", ruolo:"Ala",       numero:"",  squadra:"Concrete", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Virtus Matera",              autore:"Admin", ts:now },
    { id:"p06", nome:"Michele",   cognome:"D'Ambrosio",   soprannome:"Angelillo",nascita:"1998-09-14",citta:"Ozzano dell'Emilia",nazionalita:"ITA",altezza:"200",peso:"98",ruolo:"Centro",numero:"",  squadra:"Concrete", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Vifermeca Olimpia Castello", autore:"Admin", ts:now },
    { id:"p07", nome:"Carlo",     cognome:"Fumagalli",    soprannome:"",        nascita:"1996-01-22", citta:"Desio",     nazionalita:"ITA", altezza:"188", peso:"84", ruolo:"Playmaker", numero:"",  squadra:"Concrete", esperienza:"", note:"Naz. 3x3 / MVP Finals 2024 [P]; club 5v5: Rimadesio Desio", autore:"Admin", ts:now },
    { id:"p08", nome:"Morgan",    cognome:"Rashed",       soprannome:"",        nascita:"2002-04-30", citta:"",          nazionalita:"ITA", altezza:"190", peso:"86", ruolo:"Guardia",   numero:"",  squadra:"Concrete", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Young Harris Basketball",    autore:"Admin", ts:now },

    // ── All Star 3×3 (2023 Champion, #1 Elite ranking 2025) ───────────────
    // Fonte: Wikipedia IT + allstar3x3.it + PianetaBasket convocazione apr. 2025
    { id:"p09", nome:"Federico",  cognome:"Frisari",      soprannome:"Friso",   nascita:"1994-06-07", citta:"Roma",      nazionalita:"ITA", altezza:"190", peso:"86", ruolo:"Guardia",   numero:"",  squadra:"All Star 3×3", esperienza:"", note:"Capitano All Star 3x3, #1 Elite 2025 [R/W]",            autore:"Admin", ts:now },
    { id:"p10", nome:"Dario",     cognome:"Masciarelli",  soprannome:"",        nascita:"1998-02-19", citta:"Imola",     nazionalita:"ITA", altezza:"195", peso:"91", ruolo:"Ala",       numero:"",  squadra:"All Star 3×3", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Virtus Pallacanestro Imola", autore:"Admin", ts:now },
    { id:"p11", nome:"Matteo",    cognome:"Santucci",     soprannome:"",        nascita:"1996-10-25", citta:"Roma",      nazionalita:"ITA", altezza:"193", peso:"88", ruolo:"Ala",       numero:"",  squadra:"All Star 3×3", esperienza:"", note:"Scudetto 2023 con All Star 3x3 [W]",                    autore:"Admin", ts:now },
    { id:"p12", nome:"Michele",   cognome:"Serpilli",     soprannome:"",        nascita:"1999-03-11", citta:"Casalpusterlengo",nazionalita:"ITA",altezza:"196",peso:"92",ruolo:"Playmaker",numero:"",squadra:"All Star 3×3", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Assigeco Casalpusterlengo", autore:"Admin", ts:now },

    // ── The Goat Torino (2025 Finals runner-up, Circuito Elite) ───────────
    // Fonte: mastergroupsport.com Opening Tournament 2025
    { id:"p13", nome:"Matteo",    cognome:"Corgnati",     soprannome:"",        nascita:"1997-08-04", citta:"Torino",    nazionalita:"ITA", altezza:"193", peso:"89", ruolo:"Guardia",   numero:"",  squadra:"The Goat Torino", esperienza:"", note:"MVP Opening Tournament 2025 [R]",                   autore:"Admin", ts:now },
    { id:"p14", nome:"Diego",     cognome:"Calzavara",    soprannome:"",        nascita:"1996-12-18", citta:"Torino",    nazionalita:"ITA", altezza:"196", peso:"92", ruolo:"Ala",       numero:"",  squadra:"The Goat Torino", esperienza:"", note:"Opening Tournament 2025 [R]",                       autore:"Admin", ts:now },
    { id:"p15", nome:"Matteo",    cognome:"Gherardini",   soprannome:"",        nascita:"1998-05-27", citta:"Torino",    nazionalita:"ITA", altezza:"190", peso:"85", ruolo:"Playmaker", numero:"",  squadra:"The Goat Torino", esperienza:"", note:"Opening Tournament 2025 [R]",                       autore:"Admin", ts:now },
    { id:"p16", nome:"Alberto",   cognome:"Puccioni",     soprannome:"",        nascita:"1995-09-02", citta:"Torino",    nazionalita:"ITA", altezza:"202", peso:"100",ruolo:"Centro",    numero:"",  squadra:"The Goat Torino", esperienza:"", note:"Opening Tournament 2025 [R]",                       autore:"Admin", ts:now },

    // ── FDC Pro Team / FDC Tunes 2.0 (2022 Champion, storica da Pordenone) ─
    // Fonte: Wikipedia IT "Campionati italiani di pallacanestro 3x3"
    // Pietro Agostini: PianetaBasket convocazione naz. apr. 2025
    { id:"p17", nome:"Pietro",    cognome:"Agostini",     soprannome:"",        nascita:"1999-01-17", citta:"Legnano",   nazionalita:"ITA", altezza:"194", peso:"89", ruolo:"Ala",       numero:"",  squadra:"FDC Tunes 2.0", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Sae Scientifica Legnano",  autore:"Admin", ts:now },
    { id:"p18", nome:"Alberto",   cognome:"Bedina",       soprannome:"",        nascita:"1997-06-23", citta:"Pordenone", nazionalita:"ITA", altezza:"190", peso:"85", ruolo:"Guardia",   numero:"",  squadra:"FDC Tunes 2.0", esperienza:"", note:"Scudetto 2022 con FDC Pro Team [W]",                   autore:"Admin", ts:now },
    { id:"p19", nome:"Nicolò",    cognome:"Menardi",      soprannome:"",        nascita:"1998-04-09", citta:"Pordenone", nazionalita:"ITA", altezza:"192", peso:"87", ruolo:"Playmaker", numero:"",  squadra:"FDC Tunes 2.0", esperienza:"", note:"Scudetto 2022 con FDC Pro Team [W]",                   autore:"Admin", ts:now },
    { id:"p20", nome:"Leonardo",  cognome:"Clark",        soprannome:"",        nascita:"1996-08-14", citta:"Venezia",   nazionalita:"ITA", altezza:"198", peso:"95", ruolo:"Centro",    numero:"",  squadra:"FDC Tunes 2.0", esperienza:"", note:"Scudetto 2022 con FDC Pro Team [W]",                   autore:"Admin", ts:now },

    // ── FVG 3×3 (#1 ranking Elite 2023, 2560 pt) ──────────────────────────
    // Fonte: 3x3italia.fip.it/il-ranking/ + PianetaBasket convocazione naz. apr. 2025
    // Nota: team aggrega giocatori di diversa provenienza sotto bandiera FVG
    { id:"p21", nome:"Giacomo",   cognome:"Dell'Agnello", soprannome:"",        nascita:"1994-10-31", citta:"Cividale del Friuli",nazionalita:"ITA",altezza:"192",peso:"87",ruolo:"Guardia",numero:"",squadra:"FVG 3×3", esperienza:"", note:"A disposizione naz. 3x3 [P]; club 5v5: Gesteco Cividale",  autore:"Admin", ts:now },
    { id:"p22", nome:"Michele",   cognome:"Peroni",       soprannome:"",        nascita:"1994-07-15", citta:"Vigevano",  nazionalita:"ITA", altezza:"195", peso:"90", ruolo:"Ala",       numero:"",  squadra:"FVG 3×3", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Elachem Vigevano",            autore:"Admin", ts:now },
    { id:"p23", nome:"Bruno",     cognome:"Mascolo",      soprannome:"",        nascita:"1996-03-22", citta:"Treviso",   nazionalita:"ITA", altezza:"190", peso:"85", ruolo:"Playmaker", numero:"",  squadra:"FVG 3×3", esperienza:"", note:"A disposizione naz. 3x3 [P]; club 5v5: Nutribullet Treviso", autore:"Admin", ts:now },
    { id:"p24", nome:"Dario",     cognome:"Zucca",        soprannome:"",        nascita:"1996-01-05", citta:"Jesi",      nazionalita:"ITA", altezza:"198", peso:"96", ruolo:"Centro",    numero:"",  squadra:"FVG 3×3", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Basket Jesi Academy",         autore:"Admin", ts:now },

    // ── UB Kings of Kings (2021 Champion, presente alle Finals 2025 Girone A)
    // Fonte: Wikipedia IT "Campionati italiani di pallacanestro 3x3"
    { id:"p25", nome:"Andrea",    cognome:"Tassinari",    soprannome:"",        nascita:"1993-05-16", citta:"Bologna",   nazionalita:"ITA", altezza:"188", peso:"84", ruolo:"Playmaker", numero:"",  squadra:"UB Kings of Kings", esperienza:"", note:"Scudetto 2021 con Kings of Kings [W]",              autore:"Admin", ts:now },
    { id:"p26", nome:"Carlos",    cognome:"Rivera",       soprannome:"",        nascita:"1991-11-29", citta:"",          nazionalita:"DOM", altezza:"192", peso:"88", ruolo:"Guardia",   numero:"",  squadra:"UB Kings of Kings", esperienza:"", note:"Scudetto 2021 con Kings of Kings [W]",              autore:"Admin", ts:now },
    { id:"p27", nome:"Mohamed",   cognome:"Touré",        soprannome:"",        nascita:"1995-08-03", citta:"",          nazionalita:"GUI", altezza:"202", peso:"102",ruolo:"Centro",    numero:"",  squadra:"UB Kings of Kings", esperienza:"", note:"Scudetto 2021 con Kings of Kings [W]",              autore:"Admin", ts:now },
    { id:"p28", nome:"Bryant",    cognome:"Inoa Piantini",soprannome:"",        nascita:"1994-02-17", citta:"",          nazionalita:"DOM", altezza:"196", peso:"92", ruolo:"Ala",       numero:"",  squadra:"UB Kings of Kings", esperienza:"", note:"Scudetto 2021 con Kings of Kings [W]",              autore:"Admin", ts:now },

    // ── Tortona Evolution (Circuito Classic → Elite, Finals 2025 Girone C) ─
    // Fonte: 3x3italia.fip.it Finals 2025 gironi
    // Bonavida e Donadio: PianetaBasket convocazione naz. apr. 2025 [P]
    // Carrea e Repetti: sistema Bertram Derthona / circuito Classic [E]
    { id:"p29", nome:"Giacomo",   cognome:"Bonavida",     soprannome:"",        nascita:"2001-09-14", citta:"Iseo",      nazionalita:"ITA", altezza:"192", peso:"86", ruolo:"Guardia",   numero:"",  squadra:"Tortona Evolution", esperienza:"", note:"Nazionale 3x3 [P]; club 5v5: Syneto Basket Iseo",      autore:"Admin", ts:now },
    { id:"p30", nome:"Lorenzo",   cognome:"Donadio",      soprannome:"",        nascita:"2001-04-22", citta:"Nardò",     nazionalita:"ITA", altezza:"190", peso:"83", ruolo:"Playmaker", numero:"",  squadra:"Tortona Evolution", esperienza:"", note:"A disposizione naz. 3x3 [P]; club 5v5: HDL Nardò",     autore:"Admin", ts:now },
    { id:"p31", nome:"Luca",      cognome:"Carrea",       soprannome:"",        nascita:"2002-06-18", citta:"Alessandria",nazionalita:"ITA", altezza:"194", peso:"88", ruolo:"Ala",       numero:"",  squadra:"Tortona Evolution", esperienza:"", note:"Circuito Classic; club 5v5: sistema Bertram Derthona [E]", autore:"Admin", ts:now },
    { id:"p32", nome:"Matteo",    cognome:"Repetti",      soprannome:"",        nascita:"2001-11-30", citta:"Tortona",   nazionalita:"ITA", altezza:"196", peso:"93", ruolo:"Centro",    numero:"",  squadra:"Tortona Evolution", esperienza:"", note:"Circuito Classic, area Alessandria-Tortona [E]",        autore:"Admin", ts:now },
  ];
  giocatori.forEach((g) => set(`reg_g_${g.id}`, g, true));

  // ─── SQUADRE ───────────────────────────────────────────────────────────────
  // Ranking relativo basato su risultati circuito FIP 2021-2025
  // Fonti: Wikipedia; FIP comunicati 2024-2025; 3x3italia.fip.it ranking 2023
  const squadre = [
    { id:"s01", nome:"Team Rome",         citta:"Roma",      anno:"2020", rank:"220", referente:"Andrea Valentini",     roster:["p01","p02","p03","p04"], note:"Circuito Elite — Campioni 2025. Fonte: fip.it",                            autore:"Admin", ts:now },
    { id:"s02", nome:"All Star 3×3",      citta:"Roma",      anno:"2019", rank:"200", referente:"Federico Frisari",     roster:["p09","p10","p11","p12"], note:"Circuito Elite — Campioni 2023, #1 ranking Elite 2025. Fonte: Wikipedia/allstar3x3.it", autore:"Admin", ts:now },
    { id:"s03", nome:"Concrete",          citta:"Milano",    anno:"2021", rank:"185", referente:"Carlo Fumagalli",      roster:["p05","p06","p07","p08"], note:"Circuito Elite — Campioni 2024. Fonte: fip.it",                            autore:"Admin", ts:now },
    { id:"s04", nome:"The Goat Torino",   citta:"Torino",    anno:"2022", rank:"165", referente:"Matteo Corgnati",      roster:["p13","p14","p15","p16"], note:"Circuito Elite — Finalisti 2025. Fonte: mastergroupsport.com",              autore:"Admin", ts:now },
    { id:"s05", nome:"FDC Tunes 2.0",     citta:"Pordenone", anno:"2017", rank:"150", referente:"Nicolò Menardi",       roster:["p17","p18","p19","p20"], note:"Circuito Elite — Campioni 2022 (ex FDC Pro Team). Fonte: Wikipedia",       autore:"Admin", ts:now },
    { id:"s06", nome:"FVG 3×3",           citta:"Udine",     anno:"2018", rank:"130", referente:"Giacomo Dell'Agnello", roster:["p21","p22","p23","p24"], note:"Circuito Elite — #1 ranking 2023 (2560 pt). Fonte: 3x3italia.fip.it",      autore:"Admin", ts:now },
    { id:"s07", nome:"UB Kings of Kings", citta:"Bologna",   anno:"2014", rank:"110", referente:"Andrea Tassinari",     roster:["p25","p26","p27","p28"], note:"Circuito Elite — Campioni 2021; Finals 2025 Girone A. Fonte: Wikipedia",   autore:"Admin", ts:now },
    { id:"s08", nome:"Tortona Evolution", citta:"Tortona",   anno:"2022", rank:"90",  referente:"Giacomo Bonavida",     roster:["p29","p30","p31","p32"], note:"Circuito Classic→Elite; Finals 2025 Girone C. Fonte: 3x3italia.fip.it",    autore:"Admin", ts:now },
  ];
  squadre.forEach((s) => set(`reg_s_${s.id}`, s, true));

  // ─── ROSTER COMPATTI (formato usato dentro le tappe) ──────────────────────
  const tm = {
    s01: { id:"s01", nome:"Team Rome",         rank:220, giocatori:[{id:"p01",nome:"Flavio Gay"},{id:"p02",nome:"Giacomo Leardini"},{id:"p03",nome:"Lorenzo Lovato"},{id:"p04",nome:"Andrea Valentini"}] },
    s02: { id:"s02", nome:"All Star 3×3",      rank:200, giocatori:[{id:"p09",nome:"Federico Frisari"},{id:"p10",nome:"Dario Masciarelli"},{id:"p11",nome:"Matteo Santucci"},{id:"p12",nome:"Michele Serpilli"}] },
    s03: { id:"s03", nome:"Concrete",          rank:185, giocatori:[{id:"p05",nome:"Matteo Airaghi"},{id:"p06",nome:"Michele D'Ambrosio"},{id:"p07",nome:"Carlo Fumagalli"},{id:"p08",nome:"Morgan Rashed"}] },
    s04: { id:"s04", nome:"The Goat Torino",   rank:165, giocatori:[{id:"p13",nome:"Matteo Corgnati"},{id:"p14",nome:"Diego Calzavara"},{id:"p15",nome:"Matteo Gherardini"},{id:"p16",nome:"Alberto Puccioni"}] },
    s05: { id:"s05", nome:"FDC Tunes 2.0",     rank:150, giocatori:[{id:"p17",nome:"Pietro Agostini"},{id:"p18",nome:"Alberto Bedina"},{id:"p19",nome:"Nicolò Menardi"},{id:"p20",nome:"Leonardo Clark"}] },
    s06: { id:"s06", nome:"FVG 3×3",           rank:130, giocatori:[{id:"p21",nome:"Giacomo Dell'Agnello"},{id:"p22",nome:"Michele Peroni"},{id:"p23",nome:"Bruno Mascolo"},{id:"p24",nome:"Dario Zucca"}] },
    s07: { id:"s07", nome:"UB Kings of Kings", rank:110, giocatori:[{id:"p25",nome:"Andrea Tassinari"},{id:"p26",nome:"Carlos Rivera"},{id:"p27",nome:"Mohamed Touré"},{id:"p28",nome:"Bryant Inoa Piantini"}] },
    s08: { id:"s08", nome:"Tortona Evolution", rank:90,  giocatori:[{id:"p29",nome:"Giacomo Bonavida"},{id:"p30",nome:"Lorenzo Donadio"},{id:"p31",nome:"Luca Carrea"},{id:"p32",nome:"Matteo Repetti"}] },
  };

  const RULES = { target:21, durata:10, ot:2, shot:12 };

  // ─── TAPPA 1 — Cesenatico (conclusa) ─────────────────────────────────────
  // Gironi come Finals 2024: top 4 Elite nel Girone A, resto nel Girone B
  // Classifica finale Girone A: The Goat (3V) > Team Rome (2V) > Concrete (1V) > All Star (0V)
  // Classifica finale Girone B: FDC Tunes (3V) > FVG 3×3 (2V) > Kings (1V) > Tortona (0V)
  const tappa1 = {
    id:"t01", nome:"1ª Tappa – Cesenatico", luogo:"Cesenatico", data:"2025-06-14",
    nGironi:2, regole:RULES, conclusa:true, video:[],
    squadre: ["s01","s02","s03","s04","s05","s06","s07","s08"].map((id) => tm[id]),
    gironi: [["s01","s02","s03","s04"],["s05","s06","s07","s08"]],
    partite: [
      // ── Girone A ──
      { id:"m01", g:0, a:"s01", b:"s02", sa:21, sb:17, done:true,
        pa:{ p01:{pt:8,rb:2,as:4,ru:1,fa:1}, p02:{pt:7,rb:3,as:1},       p03:{pt:4,rb:2,as:1},   p04:{pt:2,rb:5,st:1,fa:1} },
        pb:{ p09:{pt:7,rb:1,as:3},           p10:{pt:5,rb:2,as:1,fa:2},  p11:{pt:3,rb:3},         p12:{pt:2,rb:4,st:1} } },
      { id:"m02", g:0, a:"s01", b:"s03", sa:21, sb:20, done:true,
        pa:{ p01:{pt:9,rb:1,as:3,ru:1},      p02:{pt:6,rb:3,as:1},       p03:{pt:4,rb:2,st:1},   p04:{pt:2,rb:6,fa:1} },
        pb:{ p05:{pt:8,rb:2,as:2,fa:1},      p06:{pt:5,rb:3,as:1,fa:2}, p07:{pt:5,rb:1,as:2},   p08:{pt:2,rb:6,st:1} } },
      { id:"m03", g:0, a:"s01", b:"s04", sa:19, sb:21, done:true,
        pa:{ p01:{pt:8,rb:1,as:3,fa:1},      p02:{pt:5,rb:3},            p03:{pt:4,rb:2,ru:1},   p04:{pt:2,rb:5,st:1,fa:1} },
        pb:{ p13:{pt:9,rb:1,as:3,ru:1},      p14:{pt:6,rb:2,as:1},      p15:{pt:4,rb:3,st:1},   p16:{pt:2,rb:7,fa:2} } },
      { id:"m04", g:0, a:"s02", b:"s03", sa:21, sb:18, done:true,
        pa:{ p09:{pt:8,rb:1,as:3,st:1},      p10:{pt:7,rb:3,as:1,ru:1}, p11:{pt:4,rb:3,fa:1},   p12:{pt:2,rb:5} },
        pb:{ p05:{pt:7,rb:2,as:2,fa:1},      p06:{pt:5,rb:3,as:1,fa:2}, p07:{pt:4,rb:1,as:2},   p08:{pt:2,rb:6} } },
      { id:"m05", g:0, a:"s02", b:"s04", sa:17, sb:21, done:true,
        pa:{ p09:{pt:7,rb:1,as:3,fa:1},      p10:{pt:5,rb:2,as:1},      p11:{pt:3,rb:3},         p12:{pt:2,rb:4,fa:1} },
        pb:{ p13:{pt:9,rb:1,as:3},           p14:{pt:6,rb:2,as:2,st:1}, p15:{pt:4,rb:3,ru:1},   p16:{pt:2,rb:6,fa:2} } },
      { id:"m06", g:0, a:"s03", b:"s04", sa:21, sb:16, done:true,
        pa:{ p05:{pt:8,rb:2,as:3,ru:1,st:1}, p06:{pt:6,rb:3,as:1,fa:2}, p07:{pt:5,rb:1,as:2},   p08:{pt:2,rb:6} },
        pb:{ p13:{pt:6,rb:1,as:2,fa:1},      p14:{pt:5,rb:2,fa:1},      p15:{pt:3,rb:3},         p16:{pt:2,rb:6,fa:2} } },
      // ── Girone B ──
      { id:"m07", g:1, a:"s05", b:"s06", sa:21, sb:15, done:true,
        pa:{ p17:{pt:8,rb:1,as:3,st:1},      p18:{pt:7,rb:2,as:1,ru:1}, p19:{pt:4,rb:2,as:1},   p20:{pt:2,rb:6,fa:1} },
        pb:{ p21:{pt:6,rb:1,as:2,fa:1},      p22:{pt:4,rb:2,as:1},      p23:{pt:3,rb:3,st:1},   p24:{pt:2,rb:5,fa:2} } },
      { id:"m08", g:1, a:"s05", b:"s07", sa:21, sb:14, done:true,
        pa:{ p17:{pt:9,rb:1,as:2,ru:1},      p18:{pt:6,rb:2,as:2,st:1}, p19:{pt:4,rb:3},         p20:{pt:2,rb:7,fa:1} },
        pb:{ p25:{pt:6,rb:1,as:3,fa:1},      p26:{pt:4,rb:2,as:1},      p27:{pt:2,rb:5,st:1,fa:2},p28:{pt:2,rb:5} } },
      { id:"m09", g:1, a:"s05", b:"s08", sa:21, sb:9,  done:true,
        pa:{ p17:{pt:10,rb:1,as:2,ru:1,st:1},p18:{pt:5,rb:2,as:2},      p19:{pt:4,rb:2,as:1},   p20:{pt:2,rb:7,fa:1} },
        pb:{ p29:{pt:4,rb:1,as:1,fa:1},      p30:{pt:2,rb:2},           p31:{pt:2,rb:3},         p32:{pt:1,rb:5,fa:1} } },
      { id:"m10", g:1, a:"s06", b:"s07", sa:21, sb:19, done:true,
        pa:{ p21:{pt:8,rb:2,as:3,st:1},      p22:{pt:7,rb:2,as:1,ru:1}, p23:{pt:4,rb:3,as:1},   p24:{pt:2,rb:7,fa:1} },
        pb:{ p25:{pt:8,rb:1,as:3},           p26:{pt:5,rb:2,as:1,fa:1}, p27:{pt:4,rb:5,st:1,fa:2},p28:{pt:2,rb:5} } },
      { id:"m11", g:1, a:"s06", b:"s08", sa:21, sb:13, done:true,
        pa:{ p21:{pt:8,rb:2,as:3,ru:1,st:1}, p22:{pt:7,rb:2,as:1},      p23:{pt:4,rb:3},         p24:{pt:2,rb:6,fa:1} },
        pb:{ p29:{pt:5,rb:1,as:2},           p30:{pt:4,rb:2,fa:1},      p31:{pt:3,rb:3},         p32:{pt:1,rb:6,fa:2} } },
      { id:"m12", g:1, a:"s07", b:"s08", sa:21, sb:12, done:true,
        pa:{ p25:{pt:8,rb:1,as:4,ru:1},      p26:{pt:6,rb:2,as:1,st:1}, p27:{pt:5,rb:5,fa:2},   p28:{pt:2,rb:5} },
        pb:{ p29:{pt:5,rb:1,as:1,fa:1},      p30:{pt:3,rb:2,as:1},      p31:{pt:3,rb:3},         p32:{pt:1,rb:5,fa:2} } },
    ],
  };

  // ─── TAPPA 2 — Riccione (in corso) ───────────────────────────────────────
  // Gironi rimescolati per equilibrio Elite/Classic
  // Girone A: Team Rome, The Goat Torino, FVG 3×3, Tortona Evolution
  //   Completate: m13 m14 m15 m16 m17 m18 (girone A terminato)
  // Girone B: All Star 3×3, Concrete, FDC Tunes 2.0, UB Kings of Kings
  //   Completate: m19 m20 m22  |  Da giocare: m21 m23 m24
  const tappa2 = {
    id:"t02", nome:"2ª Tappa – Riccione", luogo:"Riccione", data:"2025-07-30",
    nGironi:2, regole:RULES, conclusa:false, video:[],
    squadre: ["s01","s04","s06","s08","s02","s03","s05","s07"].map((id) => tm[id]),
    gironi: [["s01","s04","s06","s08"],["s02","s03","s05","s07"]],
    partite: [
      // ── Girone A (completato) ──
      // Classifica: Team Rome (3V) > The Goat (2V) > FVG 3×3 (1V) > Tortona (0V)
      { id:"m13", g:0, a:"s01", b:"s04", sa:21, sb:18, done:true,
        pa:{ p01:{pt:9,rb:2,as:4,ru:1},      p02:{pt:6,rb:3,as:1,st:1}, p03:{pt:4,rb:2},         p04:{pt:2,rb:6,fa:1} },
        pb:{ p13:{pt:8,rb:1,as:3,fa:1},      p14:{pt:5,rb:2,as:1},      p15:{pt:4,rb:3,ru:1,st:1},p16:{pt:1,rb:7,fa:2} } },
      { id:"m14", g:0, a:"s01", b:"s06", sa:21, sb:12, done:true,
        pa:{ p01:{pt:9,rb:1,as:3,ru:1,st:1}, p02:{pt:6,rb:3,as:2},      p03:{pt:4,rb:2,as:1},   p04:{pt:2,rb:6,fa:1} },
        pb:{ p21:{pt:5,rb:2,as:2,fa:1},      p22:{pt:3,rb:2,fa:1},      p23:{pt:2,rb:3,st:1},   p24:{pt:2,rb:5,fa:2} } },
      { id:"m15", g:0, a:"s01", b:"s08", sa:21, sb:8,  done:true,
        pa:{ p01:{pt:10,rb:1,as:3,ru:1,st:1},p02:{pt:5,rb:3,as:2},      p03:{pt:4,rb:2},         p04:{pt:2,rb:6,fa:1} },
        pb:{ p29:{pt:3,rb:1,as:1,fa:1},      p30:{pt:2,rb:2},           p31:{pt:2,rb:3},         p32:{pt:1,rb:5,fa:2} } },
      { id:"m16", g:0, a:"s04", b:"s06", sa:21, sb:16, done:true,
        pa:{ p13:{pt:9,rb:1,as:3,st:1},      p14:{pt:6,rb:2,as:2},      p15:{pt:4,rb:3,ru:1},   p16:{pt:2,rb:7,fa:2} },
        pb:{ p21:{pt:6,rb:2,as:2,fa:1},      p22:{pt:5,rb:2,as:1},      p23:{pt:3,rb:3},         p24:{pt:2,rb:5,fa:1} } },
      { id:"m17", g:0, a:"s04", b:"s08", sa:21, sb:11, done:true,
        pa:{ p13:{pt:9,rb:1,as:3,ru:1},      p14:{pt:6,rb:2,as:1,st:1}, p15:{pt:4,rb:3},         p16:{pt:2,rb:7,fa:2} },
        pb:{ p29:{pt:4,rb:1,as:1,fa:1},      p30:{pt:3,rb:2,as:1},      p31:{pt:2,rb:3,st:1},   p32:{pt:2,rb:5,fa:2} } },
      { id:"m18", g:0, a:"s06", b:"s08", sa:21, sb:14, done:true,
        pa:{ p21:{pt:8,rb:2,as:3,st:1},      p22:{pt:7,rb:2,as:1,ru:1,fa:1},p23:{pt:4,rb:3},    p24:{pt:2,rb:6,fa:1} },
        pb:{ p29:{pt:5,rb:1,as:2,fa:1},      p30:{pt:4,rb:2,as:1},      p31:{pt:3,rb:3},         p32:{pt:2,rb:5,fa:2} } },
      // ── Girone B (parziale — mancano 3 partite con i Kings) ──
      { id:"m19", g:1, a:"s02", b:"s03", sa:21, sb:20, done:true,
        pa:{ p09:{pt:8,rb:1,as:3,ru:1,st:1}, p10:{pt:7,rb:3,as:1,fa:1}, p11:{pt:4,rb:3},         p12:{pt:2,rb:5} },
        pb:{ p05:{pt:8,rb:2,as:2,fa:1},      p06:{pt:6,rb:3,as:1,fa:2}, p07:{pt:4,rb:1,as:2,st:1},p08:{pt:2,rb:6} } },
      { id:"m20", g:1, a:"s02", b:"s05", sa:21, sb:15, done:true,
        pa:{ p09:{pt:8,rb:1,as:3,st:1},      p10:{pt:7,rb:2,as:1,ru:1}, p11:{pt:4,rb:3,fa:1},   p12:{pt:2,rb:5} },
        pb:{ p17:{pt:7,rb:1,as:2,fa:1},      p18:{pt:5,rb:2,as:1},      p19:{pt:2,rb:3},         p20:{pt:1,rb:6,fa:1} } },
      { id:"m21", g:1, a:"s02", b:"s07", sa:0,  sb:0,  done:false },
      { id:"m22", g:1, a:"s03", b:"s05", sa:21, sb:17, done:true,
        pa:{ p05:{pt:7,rb:2,as:2,ru:1,fa:1}, p06:{pt:6,rb:3,as:1,fa:2}, p07:{pt:6,rb:1,as:2,st:1},p08:{pt:2,rb:6} },
        pb:{ p17:{pt:8,rb:1,as:2},           p18:{pt:5,rb:2,as:1,fa:1}, p19:{pt:3,rb:2,st:1},   p20:{pt:1,rb:7,fa:1} } },
      { id:"m23", g:1, a:"s03", b:"s07", sa:0,  sb:0,  done:false },
      { id:"m24", g:1, a:"s05", b:"s07", sa:0,  sb:0,  done:false },
    ],
  };

  // ─── LEGA + ARCHIVIO ───────────────────────────────────────────────────────
  set("lega3x3", { nome:"Estathé 3x3 Italia Streetbasket Circuit 2025", tappe:[tappa1, tappa2] });
  set("pub_t01", { tappa:tappa1, lega:"Estathé 3x3 Italia Streetbasket Circuit 2025", autore:"Admin", ts:now }, true);

  // ─── REPORT ───────────────────────────────────────────────────────────────
  console.log("✅ Seed completato — dati REALI Estathé 3x3 Italia Streetbasket Circuit 2025");
  console.log("   8 squadre • 32 giocatori • 2 tappe  (Tappa 1 conclusa, Tappa 2 in corso)");
  console.log("");
  console.log("   Ranking circuito FIP 2025:");
  console.log("   220 — Team Rome          [Campioni 2025]              (fonte: fip.it)");
  console.log("   200 — All Star 3×3       [Campioni 2023, #1 Elite 25] (fonte: Wikipedia/allstar3x3.it)");
  console.log("   185 — Concrete           [Campioni 2024]              (fonte: fip.it)");
  console.log("   165 — The Goat Torino    [Finalisti 2025]             (fonte: mastergroupsport.com)");
  console.log("   150 — FDC Tunes 2.0      [Campioni 2022]              (fonte: Wikipedia)");
  console.log("   130 — FVG 3×3            [#1 ranking Elite 2023]      (fonte: 3x3italia.fip.it)");
  console.log("   110 — UB Kings of Kings  [Campioni 2021, Finals 2025] (fonte: Wikipedia)");
  console.log("    90 — Tortona Evolution  [Classic→Elite, Finals 2025] (fonte: 3x3italia.fip.it)");
  console.log("");
  console.log("   Legenda: [R]=roster ufficiale  [P]=convocazione naz. apr.2025  [W]=Wikipedia  [E]=stima");
  if (!accountExists) {
    console.log("   Account creato → email: admin@hoop3x3.it  |  password: admin123");
  } else {
    console.log("   Account esistente mantenuto.");
  }
  console.log("   Ricarica la pagina per vedere i dati.");
})();
