/** Tipo minimo usato nei roster di tappa: solo id e nome visibile in campo */
export interface GiocatoreRoster {
  id: string;
  nome: string;
  /** id del `RegGiocatore` dell'anagrafe, se il giocatore viene da lì o è stato riconosciuto; manca nei roster scritti a mano
   *  e nelle tappe di prima */
  regId?: string;
}
