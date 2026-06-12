/**
 * SEED DATI DI PROVA — HOOP 3X3
 * Incolla questo script nella console del browser su http://localhost:5173
 * Poi ricarica la pagina.
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

  // Account demo (solo se non esiste già un account)
  const accountExists = !!localStorage.getItem(NS + "account");
  if (!accountExists) {
    const hash = await sha256("admin123");
    set("account", { name: "Admin", email: "admin@hoop3x3.it", hash });
  }

  const now = Date.now();

  // ─── GIOCATORI (anagrafe condivisa) ───────────────────────────────────────
  const giocatori = [
    // Aquile Roma
    { id:"p01", nome:"Marco",    cognome:"Rossi",       soprannome:"El Capitano", nascita:"1999-03-12", citta:"Roma",    nazionalita:"ITA", altezza:"185", peso:"82", ruolo:"Playmaker", numero:"1",  squadra:"Aquile Roma",     esperienza:"5 anni",  note:"", autore:"Admin", ts:now },
    { id:"p02", nome:"Luca",     cognome:"Ferrari",     soprannome:"Flash",       nascita:"1996-07-24", citta:"Roma",    nazionalita:"ITA", altezza:"188", peso:"85", ruolo:"Guardia",   numero:"7",  squadra:"Aquile Roma",     esperienza:"8 anni",  note:"", autore:"Admin", ts:now },
    { id:"p03", nome:"Andrea",   cognome:"Conti",       soprannome:"",            nascita:"2001-11-05", citta:"Roma",    nazionalita:"ITA", altezza:"192", peso:"88", ruolo:"Ala",       numero:"11", squadra:"Aquile Roma",     esperienza:"3 anni",  note:"", autore:"Admin", ts:now },
    { id:"p04", nome:"Matteo",   cognome:"Bianchi",     soprannome:"Il Muro",     nascita:"1994-01-30", citta:"Roma",    nazionalita:"ITA", altezza:"200", peso:"98", ruolo:"Centro",    numero:"23", squadra:"Aquile Roma",     esperienza:"10 anni", note:"", autore:"Admin", ts:now },
    // Lupi Milano
    { id:"p05", nome:"Davide",   cognome:"Esposito",    soprannome:"Davi",        nascita:"1998-05-14", citta:"Milano",  nazionalita:"ITA", altezza:"183", peso:"80", ruolo:"Playmaker", numero:"4",  squadra:"Lupi Milano",     esperienza:"6 anni",  note:"", autore:"Admin", ts:now },
    { id:"p06", nome:"Simone",   cognome:"Ricci",       soprannome:"",            nascita:"2000-09-22", citta:"Milano",  nazionalita:"ITA", altezza:"187", peso:"83", ruolo:"Guardia",   numero:"9",  squadra:"Lupi Milano",     esperienza:"4 anni",  note:"", autore:"Admin", ts:now },
    { id:"p07", nome:"Giorgio",  cognome:"Marino",      soprannome:"Gio",         nascita:"1995-12-08", citta:"Milano",  nazionalita:"ITA", altezza:"193", peso:"90", ruolo:"Ala",       numero:"14", squadra:"Lupi Milano",     esperienza:"9 anni",  note:"", autore:"Admin", ts:now },
    { id:"p08", nome:"Filippo",  cognome:"Romano",      soprannome:"Filo",        nascita:"1997-04-17", citta:"Milano",  nazionalita:"ITA", altezza:"198", peso:"95", ruolo:"Centro",    numero:"32", squadra:"Lupi Milano",     esperienza:"7 anni",  note:"", autore:"Admin", ts:now },
    // Squali Napoli
    { id:"p09", nome:"Antonio",  cognome:"De Luca",     soprannome:"Tonino",      nascita:"1999-08-03", citta:"Napoli",  nazionalita:"ITA", altezza:"182", peso:"79", ruolo:"Playmaker", numero:"3",  squadra:"Squali Napoli",   esperienza:"5 anni",  note:"", autore:"Admin", ts:now },
    { id:"p10", nome:"Carmine",  cognome:"Vitale",      soprannome:"",            nascita:"2001-02-19", citta:"Napoli",  nazionalita:"ITA", altezza:"186", peso:"82", ruolo:"Guardia",   numero:"10", squadra:"Squali Napoli",   esperienza:"3 anni",  note:"", autore:"Admin", ts:now },
    { id:"p11", nome:"Salvatore",cognome:"Russo",       soprannome:"Salvo",       nascita:"1996-06-25", citta:"Napoli",  nazionalita:"ITA", altezza:"191", peso:"87", ruolo:"Ala",       numero:"15", squadra:"Squali Napoli",   esperienza:"8 anni",  note:"", autore:"Admin", ts:now },
    { id:"p12", nome:"Ciro",     cognome:"Greco",       soprannome:"Il Toro",     nascita:"1993-10-11", citta:"Napoli",  nazionalita:"ITA", altezza:"201", peso:"100",ruolo:"Centro",    numero:"33", squadra:"Squali Napoli",   esperienza:"11 anni", note:"", autore:"Admin", ts:now },
    // Orsi Torino
    { id:"p13", nome:"Alessandro",cognome:"Gallo",      soprannome:"Alex",        nascita:"1997-12-28", citta:"Torino",  nazionalita:"ITA", altezza:"184", peso:"81", ruolo:"Playmaker", numero:"5",  squadra:"Orsi Torino",     esperienza:"7 anni",  note:"", autore:"Admin", ts:now },
    { id:"p14", nome:"Stefano",  cognome:"Lombardi",    soprannome:"",            nascita:"1999-04-16", citta:"Torino",  nazionalita:"ITA", altezza:"189", peso:"86", ruolo:"Guardia",   numero:"12", squadra:"Orsi Torino",     esperienza:"5 anni",  note:"", autore:"Admin", ts:now },
    { id:"p15", nome:"Roberto",  cognome:"Costa",       soprannome:"Roby",        nascita:"1995-07-09", citta:"Torino",  nazionalita:"ITA", altezza:"194", peso:"91", ruolo:"Ala",       numero:"21", squadra:"Orsi Torino",     esperienza:"9 anni",  note:"", autore:"Admin", ts:now },
    { id:"p16", nome:"Emanuele", cognome:"Serra",       soprannome:"Serra",       nascita:"1992-11-02", citta:"Torino",  nazionalita:"ITA", altezza:"203", peso:"102",ruolo:"Centro",    numero:"42", squadra:"Orsi Torino",     esperienza:"12 anni", note:"", autore:"Admin", ts:now },
    // Falchi Bologna
    { id:"p17", nome:"Nicola",   cognome:"Mancini",     soprannome:"Nick",        nascita:"1998-01-07", citta:"Bologna", nazionalita:"ITA", altezza:"183", peso:"80", ruolo:"Playmaker", numero:"6",  squadra:"Falchi Bologna",  esperienza:"6 anni",  note:"", autore:"Admin", ts:now },
    { id:"p18", nome:"Tommaso",  cognome:"Rizzo",       soprannome:"Tom",         nascita:"2000-06-13", citta:"Bologna", nazionalita:"ITA", altezza:"187", peso:"84", ruolo:"Guardia",   numero:"13", squadra:"Falchi Bologna",  esperienza:"4 anni",  note:"", autore:"Admin", ts:now },
    { id:"p19", nome:"Daniele",  cognome:"Barbieri",    soprannome:"",            nascita:"1996-09-20", citta:"Bologna", nazionalita:"ITA", altezza:"192", peso:"89", ruolo:"Ala",       numero:"24", squadra:"Falchi Bologna",  esperienza:"8 anni",  note:"", autore:"Admin", ts:now },
    { id:"p20", nome:"Vincenzo", cognome:"Ferrara",     soprannome:"Enzo",        nascita:"1994-03-15", citta:"Bologna", nazionalita:"ITA", altezza:"199", peso:"97", ruolo:"Centro",    numero:"34", squadra:"Falchi Bologna",  esperienza:"10 anni", note:"", autore:"Admin", ts:now },
    // Leoni Firenze
    { id:"p21", nome:"Francesco",cognome:"Bernardi",    soprannome:"Frank",       nascita:"1999-07-29", citta:"Firenze", nazionalita:"ITA", altezza:"184", peso:"81", ruolo:"Playmaker", numero:"2",  squadra:"Leoni Firenze",   esperienza:"5 anni",  note:"", autore:"Admin", ts:now },
    { id:"p22", nome:"Giacomo",  cognome:"De Santis",   soprannome:"Jaco",        nascita:"1997-10-04", citta:"Firenze", nazionalita:"ITA", altezza:"188", peso:"85", ruolo:"Guardia",   numero:"8",  squadra:"Leoni Firenze",   esperienza:"7 anni",  note:"", autore:"Admin", ts:now },
    { id:"p23", nome:"Edoardo",  cognome:"Marini",      soprannome:"",            nascita:"2001-01-18", citta:"Firenze", nazionalita:"ITA", altezza:"193", peso:"89", ruolo:"Ala",       numero:"16", squadra:"Leoni Firenze",   esperienza:"3 anni",  note:"", autore:"Admin", ts:now },
    { id:"p24", nome:"Leonardo", cognome:"Giuliani",    soprannome:"Leo",         nascita:"1993-05-22", citta:"Firenze", nazionalita:"ITA", altezza:"202", peso:"101",ruolo:"Centro",    numero:"44", squadra:"Leoni Firenze",   esperienza:"11 anni", note:"", autore:"Admin", ts:now },
    // Tori Genova
    { id:"p25", nome:"Paolo",    cognome:"Moretti",     soprannome:"",            nascita:"1998-11-11", citta:"Genova",  nazionalita:"ITA", altezza:"182", peso:"79", ruolo:"Playmaker", numero:"0",  squadra:"Tori Genova",     esperienza:"6 anni",  note:"", autore:"Admin", ts:now },
    { id:"p26", nome:"Claudio",  cognome:"Gentile",     soprannome:"Clau",        nascita:"1996-02-27", citta:"Genova",  nazionalita:"ITA", altezza:"186", peso:"83", ruolo:"Guardia",   numero:"11", squadra:"Tori Genova",     esperienza:"8 anni",  note:"", autore:"Admin", ts:now },
    { id:"p27", nome:"Mauro",    cognome:"Colombo",     soprannome:"",            nascita:"1994-08-14", citta:"Genova",  nazionalita:"ITA", altezza:"191", peso:"88", ruolo:"Ala",       numero:"20", squadra:"Tori Genova",     esperienza:"10 anni", note:"", autore:"Admin", ts:now },
    { id:"p28", nome:"Federico", cognome:"Caruso",      soprannome:"Fede",        nascita:"2000-04-01", citta:"Genova",  nazionalita:"ITA", altezza:"197", peso:"94", ruolo:"Centro",    numero:"30", squadra:"Tori Genova",     esperienza:"4 anni",  note:"", autore:"Admin", ts:now },
    // Pantere Palermo
    { id:"p29", nome:"Giuseppe", cognome:"Catalano",    soprannome:"Peppe",       nascita:"1997-06-06", citta:"Palermo", nazionalita:"ITA", altezza:"183", peso:"80", ruolo:"Playmaker", numero:"3",  squadra:"Pantere Palermo", esperienza:"7 anni",  note:"", autore:"Admin", ts:now },
    { id:"p30", nome:"Rosario",  cognome:"Amato",       soprannome:"",            nascita:"2000-09-15", citta:"Palermo", nazionalita:"ITA", altezza:"186", peso:"82", ruolo:"Guardia",   numero:"7",  squadra:"Pantere Palermo", esperienza:"4 anni",  note:"", autore:"Admin", ts:now },
    { id:"p31", nome:"Carmelo",  cognome:"Pappalardo",  soprannome:"Melo",        nascita:"1995-12-23", citta:"Palermo", nazionalita:"ITA", altezza:"190", peso:"87", ruolo:"Ala",       numero:"17", squadra:"Pantere Palermo", esperienza:"9 anni",  note:"", autore:"Admin", ts:now },
    { id:"p32", nome:"Benedetto",cognome:"Tornatore",   soprannome:"Benny",       nascita:"1992-03-08", citta:"Palermo", nazionalita:"ITA", altezza:"199", peso:"96", ruolo:"Centro",    numero:"41", squadra:"Pantere Palermo", esperienza:"12 anni", note:"", autore:"Admin", ts:now },
  ];
  giocatori.forEach((g) => set(`reg_g_${g.id}`, g, true));

  // ─── SQUADRE (anagrafe condivisa) ─────────────────────────────────────────
  const squadre = [
    { id:"s01", nome:"Aquile Roma",     citta:"Roma",    anno:"2019", rank:"120", referente:"Marco Rossi",       roster:["p01","p02","p03","p04"], note:"", autore:"Admin", ts:now },
    { id:"s02", nome:"Lupi Milano",     citta:"Milano",  anno:"2018", rank:"95",  referente:"Davide Esposito",   roster:["p05","p06","p07","p08"], note:"", autore:"Admin", ts:now },
    { id:"s03", nome:"Squali Napoli",   citta:"Napoli",  anno:"2020", rank:"80",  referente:"Antonio De Luca",   roster:["p09","p10","p11","p12"], note:"", autore:"Admin", ts:now },
    { id:"s04", nome:"Orsi Torino",     citta:"Torino",  anno:"2017", rank:"75",  referente:"Alessandro Gallo",  roster:["p13","p14","p15","p16"], note:"", autore:"Admin", ts:now },
    { id:"s05", nome:"Falchi Bologna",  citta:"Bologna", anno:"2019", rank:"70",  referente:"Nicola Mancini",    roster:["p17","p18","p19","p20"], note:"", autore:"Admin", ts:now },
    { id:"s06", nome:"Leoni Firenze",   citta:"Firenze", anno:"2020", rank:"60",  referente:"Francesco Bernardi",roster:["p21","p22","p23","p24"], note:"", autore:"Admin", ts:now },
    { id:"s07", nome:"Tori Genova",     citta:"Genova",  anno:"2021", rank:"55",  referente:"Paolo Moretti",     roster:["p25","p26","p27","p28"], note:"", autore:"Admin", ts:now },
    { id:"s08", nome:"Pantere Palermo", citta:"Palermo", anno:"2018", rank:"50",  referente:"Giuseppe Catalano", roster:["p29","p30","p31","p32"], note:"", autore:"Admin", ts:now },
  ];
  squadre.forEach((s) => set(`reg_s_${s.id}`, s, true));

  // ─── ROSTER COMPATTI (formato usato dentro le tappe) ──────────────────────
  const tm = {
    s01: { id:"s01", nome:"Aquile Roma",     rank:120, giocatori:[{id:"p01",nome:"Marco Rossi"},{id:"p02",nome:"Luca Ferrari"},{id:"p03",nome:"Andrea Conti"},{id:"p04",nome:"Matteo Bianchi"}] },
    s02: { id:"s02", nome:"Lupi Milano",     rank:95,  giocatori:[{id:"p05",nome:"Davide Esposito"},{id:"p06",nome:"Simone Ricci"},{id:"p07",nome:"Giorgio Marino"},{id:"p08",nome:"Filippo Romano"}] },
    s03: { id:"s03", nome:"Squali Napoli",   rank:80,  giocatori:[{id:"p09",nome:"Antonio De Luca"},{id:"p10",nome:"Carmine Vitale"},{id:"p11",nome:"Salvatore Russo"},{id:"p12",nome:"Ciro Greco"}] },
    s04: { id:"s04", nome:"Orsi Torino",     rank:75,  giocatori:[{id:"p13",nome:"Alessandro Gallo"},{id:"p14",nome:"Stefano Lombardi"},{id:"p15",nome:"Roberto Costa"},{id:"p16",nome:"Emanuele Serra"}] },
    s05: { id:"s05", nome:"Falchi Bologna",  rank:70,  giocatori:[{id:"p17",nome:"Nicola Mancini"},{id:"p18",nome:"Tommaso Rizzo"},{id:"p19",nome:"Daniele Barbieri"},{id:"p20",nome:"Vincenzo Ferrara"}] },
    s06: { id:"s06", nome:"Leoni Firenze",   rank:60,  giocatori:[{id:"p21",nome:"Francesco Bernardi"},{id:"p22",nome:"Giacomo De Santis"},{id:"p23",nome:"Edoardo Marini"},{id:"p24",nome:"Leonardo Giuliani"}] },
    s07: { id:"s07", nome:"Tori Genova",     rank:55,  giocatori:[{id:"p25",nome:"Paolo Moretti"},{id:"p26",nome:"Claudio Gentile"},{id:"p27",nome:"Mauro Colombo"},{id:"p28",nome:"Federico Caruso"}] },
    s08: { id:"s08", nome:"Pantere Palermo", rank:50,  giocatori:[{id:"p29",nome:"Giuseppe Catalano"},{id:"p30",nome:"Rosario Amato"},{id:"p31",nome:"Carmelo Pappalardo"},{id:"p32",nome:"Benedetto Tornatore"}] },
  };

  const RULES = { target:21, durata:10, ot:2, shot:12 };

  // ─── TAPPA 1 — Roma (conclusa) ────────────────────────────────────────────
  // Girone A: s01 s02 s03 s04 | Girone B: s05 s06 s07 s08
  // Classifica A: Orsi Torino 3V, Aquile Roma 2V, Lupi Milano 1V, Squali Napoli 0V
  // Classifica B: Falchi Bologna 3V, Leoni Firenze 2V, Tori Genova 1V, Pantere Palermo 0V
  const tappa1 = {
    id:"t01", nome:"1ª Tappa – Roma", luogo:"Roma", data:"2024-03-15",
    nGironi:2, regole:RULES, conclusa:true, video:[],
    squadre: ["s01","s02","s03","s04","s05","s06","s07","s08"].map((id) => tm[id]),
    gironi: [["s01","s02","s03","s04"],["s05","s06","s07","s08"]],
    partite: [
      // ── Girone A ──
      { id:"m01", g:0, a:"s01", b:"s02", sa:21, sb:16, done:true,
        pa:{ p01:{pt:8,rb:2,as:4,ru:1}, p02:{pt:7,rb:1,as:2,ru:1}, p03:{pt:4,rb:3,as:1}, p04:{pt:2,rb:5} },
        pb:{ p05:{pt:6,rb:1,as:3,ru:1}, p06:{pt:5,rb:2,as:1},      p07:{pt:3,rb:2,as:2}, p08:{pt:2,rb:4,st:1} } },
      { id:"m02", g:0, a:"s01", b:"s03", sa:21, sb:11, done:true,
        pa:{ p01:{pt:9,rb:1,as:3},      p02:{pt:6,rb:2},            p03:{pt:4,rb:1,as:2,ru:1}, p04:{pt:2,rb:6,st:1} },
        pb:{ p09:{pt:4,rb:1,as:2},      p10:{pt:3,rb:2},            p11:{pt:2,rb:3},       p12:{pt:2,rb:5} } },
      { id:"m03", g:0, a:"s01", b:"s04", sa:19, sb:21, done:true,
        pa:{ p01:{pt:8,rb:1,as:3,ru:1}, p02:{pt:5,rb:2,as:1},      p03:{pt:4,rb:2},       p04:{pt:2,rb:5} },
        pb:{ p13:{pt:9,rb:2,as:3},      p14:{pt:6,rb:1,as:2},       p15:{pt:4,rb:3,ru:1}, p16:{pt:2,rb:6,st:1} } },
      { id:"m04", g:0, a:"s02", b:"s03", sa:21, sb:14, done:true,
        pa:{ p05:{pt:8,rb:1,as:4},      p06:{pt:7,rb:2,as:1,ru:1}, p07:{pt:4,rb:3},       p08:{pt:2,rb:5,st:1} },
        pb:{ p09:{pt:6,rb:1,as:2},      p10:{pt:4,rb:2},            p11:{pt:2,rb:3,as:1}, p12:{pt:2,rb:6} } },
      { id:"m05", g:0, a:"s02", b:"s04", sa:18, sb:21, done:true,
        pa:{ p05:{pt:7,rb:1,as:3},      p06:{pt:5,rb:2,as:1},      p07:{pt:4,rb:2,ru:1}, p08:{pt:2,rb:5} },
        pb:{ p13:{pt:8,rb:2,as:3},      p14:{pt:7,rb:1,as:2},       p15:{pt:4,rb:3},      p16:{pt:2,rb:6,st:1} } },
      { id:"m06", g:0, a:"s03", b:"s04", sa:15, sb:21, done:true,
        pa:{ p09:{pt:6,rb:1,as:2},      p10:{pt:4,rb:2},            p11:{pt:3,rb:3},       p12:{pt:2,rb:5} },
        pb:{ p13:{pt:8,rb:2,as:3,ru:1}, p14:{pt:6,rb:1,as:2},       p15:{pt:5,rb:3},      p16:{pt:2,rb:7} } },
      // ── Girone B ──
      { id:"m07", g:1, a:"s05", b:"s06", sa:21, sb:19, done:true,
        pa:{ p17:{pt:8,rb:1,as:4},      p18:{pt:6,rb:2,as:1},      p19:{pt:5,rb:3},       p20:{pt:2,rb:5,st:1} },
        pb:{ p21:{pt:7,rb:1,as:3},      p22:{pt:6,rb:2,as:1},       p23:{pt:4,rb:3,ru:1}, p24:{pt:2,rb:6} } },
      { id:"m08", g:1, a:"s05", b:"s07", sa:21, sb:13, done:true,
        pa:{ p17:{pt:9,rb:1,as:3},      p18:{pt:6,rb:2,as:2},      p19:{pt:4,rb:3},       p20:{pt:2,rb:7} },
        pb:{ p25:{pt:5,rb:1,as:2},      p26:{pt:4,rb:2},            p27:{pt:2,rb:3},       p28:{pt:2,rb:5} } },
      { id:"m09", g:1, a:"s05", b:"s08", sa:21, sb:8,  done:true,
        pa:{ p17:{pt:10,rb:1,as:2},     p18:{pt:5,rb:2,as:3},      p19:{pt:4,rb:2},       p20:{pt:2,rb:8,st:1} },
        pb:{ p29:{pt:3,rb:1},           p30:{pt:2,rb:2},            p31:{pt:2,rb:3},       p32:{pt:1,rb:5} } },
      { id:"m10", g:1, a:"s06", b:"s07", sa:21, sb:17, done:true,
        pa:{ p21:{pt:8,rb:1,as:3},      p22:{pt:7,rb:2,as:1,ru:1}, p23:{pt:4,rb:3},       p24:{pt:2,rb:7} },
        pb:{ p25:{pt:7,rb:1,as:2},      p26:{pt:5,rb:2,as:1},       p27:{pt:3,rb:3},      p28:{pt:2,rb:5} } },
      { id:"m11", g:1, a:"s06", b:"s08", sa:21, sb:15, done:true,
        pa:{ p21:{pt:9,rb:1,as:2},      p22:{pt:6,rb:2,as:2,ru:1}, p23:{pt:4,rb:3},       p24:{pt:2,rb:6,st:1} },
        pb:{ p29:{pt:6,rb:1,as:2},      p30:{pt:4,rb:2},            p31:{pt:3,rb:3},       p32:{pt:2,rb:5} } },
      { id:"m12", g:1, a:"s07", b:"s08", sa:21, sb:12, done:true,
        pa:{ p25:{pt:8,rb:1,as:3,ru:1}, p26:{pt:6,rb:2,as:1},      p27:{pt:5,rb:3},       p28:{pt:2,rb:5} },
        pb:{ p29:{pt:5,rb:1,as:1},      p30:{pt:3,rb:2},            p31:{pt:2,rb:4},       p32:{pt:2,rb:5} } },
    ],
  };

  // ─── TAPPA 2 — Milano (in corso) ──────────────────────────────────────────
  // Girone A: s04 s05 s02 s06 | Girone B: s01 s03 s07 s08
  // Alcune partite già giocate, altre da disputare
  const tappa2 = {
    id:"t02", nome:"2ª Tappa – Milano", luogo:"Milano", data:"2024-04-20",
    nGironi:2, regole:RULES, conclusa:false, video:[],
    squadre: ["s04","s05","s02","s06","s01","s03","s07","s08"].map((id) => tm[id]),
    gironi: [["s04","s05","s02","s06"],["s01","s03","s07","s08"]],
    partite: [
      // ── Girone A ──
      { id:"m13", g:0, a:"s04", b:"s05", sa:21, sb:18, done:true,
        pa:{ p13:{pt:9,rb:2,as:3},      p14:{pt:6,rb:1,as:2},      p15:{pt:4,rb:3},       p16:{pt:2,rb:6,st:1} },
        pb:{ p17:{pt:7,rb:1,as:3},      p18:{pt:5,rb:2,as:2},       p19:{pt:4,rb:3},      p20:{pt:2,rb:6} } },
      { id:"m14", g:0, a:"s04", b:"s02", sa:21, sb:14, done:true,
        pa:{ p13:{pt:8,rb:2,as:4},      p14:{pt:7,rb:1},            p15:{pt:4,rb:3,ru:1}, p16:{pt:2,rb:6} },
        pb:{ p05:{pt:6,rb:1,as:2},      p06:{pt:4,rb:2,as:1},       p07:{pt:3,rb:3},      p08:{pt:1,rb:5} } },
      { id:"m15", g:0, a:"s04", b:"s06", sa:0,  sb:0,  done:false },
      { id:"m16", g:0, a:"s05", b:"s02", sa:21, sb:19, done:true,
        pa:{ p17:{pt:9,rb:1,as:3},      p18:{pt:6,rb:2,as:2},      p19:{pt:4,rb:3,ru:1}, p20:{pt:2,rb:6} },
        pb:{ p05:{pt:8,rb:1,as:3},      p06:{pt:6,rb:2,as:1},       p07:{pt:3,rb:3},      p08:{pt:2,rb:5} } },
      { id:"m17", g:0, a:"s05", b:"s06", sa:0,  sb:0,  done:false },
      { id:"m18", g:0, a:"s02", b:"s06", sa:0,  sb:0,  done:false },
      // ── Girone B ──
      { id:"m19", g:1, a:"s01", b:"s03", sa:21, sb:12, done:true,
        pa:{ p01:{pt:9,rb:1,as:4,ru:1}, p02:{pt:6,rb:2,as:1},      p03:{pt:4,rb:2},       p04:{pt:2,rb:6} },
        pb:{ p09:{pt:5,rb:1,as:1},      p10:{pt:4,rb:2},            p11:{pt:2,rb:3},       p12:{pt:1,rb:6} } },
      { id:"m20", g:1, a:"s01", b:"s07", sa:0,  sb:0,  done:false },
      { id:"m21", g:1, a:"s01", b:"s08", sa:0,  sb:0,  done:false },
      { id:"m22", g:1, a:"s03", b:"s07", sa:0,  sb:0,  done:false },
      { id:"m23", g:1, a:"s03", b:"s08", sa:0,  sb:0,  done:false },
      { id:"m24", g:1, a:"s07", b:"s08", sa:0,  sb:0,  done:false },
    ],
  };

  // ─── LEGA ─────────────────────────────────────────────────────────────────
  set("lega3x3", { nome:"Circuito 3x3 Italia 2024", tappe:[tappa1, tappa2] });

  // ─── ARCHIVIO (pubblicazione tappa conclusa) ───────────────────────────────
  set(`pub_t01`, { tappa:tappa1, lega:"Circuito 3x3 Italia 2024", autore:"Admin", ts:now }, true);

  // ─── REPORT ───────────────────────────────────────────────────────────────
  console.log("✅ Seed completato!");
  console.log("   32 giocatori • 8 squadre • 2 tappe (1 conclusa + 1 in corso)");
  if (!accountExists) {
    console.log("   Account creato → email: admin@hoop3x3.it  |  password: admin123");
  } else {
    console.log("   Account esistente mantenuto. Accedi con le tue credenziali.");
  }
  console.log("   Ricarica la pagina per vedere i dati.");
})();
