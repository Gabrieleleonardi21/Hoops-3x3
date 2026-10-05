import { describe, it, expect, vi } from "vitest";
import { senzaDoppioni } from "../../src/services/senzaDoppioni";
import { ApiError } from "../../src/services/api";

/** Una voce con l'id assegnato dal server, come una lega o un giocatore dell'anagrafe */
interface Voce { id: string; nome: string }

/** Server finto con una POST che crea una voce a ogni richiesta. `giaNote` sono le voci che il client già conosce prima di
 *  creare; quelle create dopo il client le conosce solo se la risposta arriva. */
function conServer(giaNote: Voce[] = []) {
  const elenco: Voce[] = [...giaNote];
  const crea = vi.fn(async (nome: string): Promise<Voce> => {
    const voce = { id: `v${elenco.length + 1}`, nome };
    elenco.push(voce);
    return voce;
  });
  const elenca = vi.fn(async () => [...elenco]);
  const note = giaNote.map((v) => v.id);
  const creatore = senzaDoppioni<string, Voce>({ crea, elenca, corrisponde: (voce, nome) => voce.nome === nome, noti: () => note });
  return { elenco, crea, elenca, creatore };
}
type Server = ReturnType<typeof conServer>;

/** Il tentativo che il server esegue ma di cui la risposta non arriva: la voce c'è, il client riceve l'errore di rete */
function rispostaPersa({ elenco, crea }: Server, errore = new ApiError(0, "Il server non risponde: controlla la connessione e riprova.")) {
  crea.mockImplementationOnce(async (nome) => {
    elenco.push({ id: "persa", nome });
    throw errore;
  });
}

describe("senzaDoppioni: una POST che il server esegue a ogni richiesta, con l'id assegnato da lui", () => {
  it("di solito crea una volta e basta: l'elenco non si legge", async () => {
    const { crea, elenca, creatore } = conServer();
    expect(await creatore.crea("Estate")).toMatchObject({ nome: "Estate" });
    expect(crea).toHaveBeenCalledTimes(1);
    expect(elenca).not.toHaveBeenCalled();
  });

  it("senza risposta (tempo scaduto) il server può aver creato la voce: il nuovo tentativo la trova e non ne crea un'altra", async () => {
    const server = conServer();
    rispostaPersa(server);
    await expect(server.creatore.crea("Estate")).rejects.toMatchObject({ status: 0 });
    // Il primo tentativo fallisce subito, come prima: l'elenco si legge solo se si riprova
    expect(server.elenca).not.toHaveBeenCalled();
    expect((await server.creatore.crea("Estate")).id).toBe("persa");
    expect(server.crea).toHaveBeenCalledTimes(1);   // nessuna seconda POST
    expect(server.elenco).toHaveLength(1);
  });

  it("se il server la voce non l'ha creata, il nuovo tentativo la crea", async () => {
    const { elenco, crea, creatore } = conServer();
    crea.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));   // la richiesta non è arrivata
    await expect(creatore.crea("Estate")).rejects.toBeInstanceOf(ApiError);
    expect((await creatore.crea("Estate")).nome).toBe("Estate");
    expect(crea).toHaveBeenCalledTimes(2);
    expect(elenco).toHaveLength(1);
  });

  it("una voce con lo stesso nome già nota prima del tentativo non è quella cercata: si crea la nuova", async () => {
    // Il client conosceva già v0 con quel nome: al nuovo tentativo non va scambiata per la creazione andata a vuoto
    const { elenco, crea, creatore } = conServer([{ id: "v0", nome: "Estate" }]);
    crea.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    await expect(creatore.crea("Estate")).rejects.toBeInstanceOf(ApiError);
    expect((await creatore.crea("Estate")).id).not.toBe("v0");
    expect(elenco).toHaveLength(2);
  });

  it("se l'elenco non si legge il tentativo fallisce con quell'errore e non crea: meglio un altro «riprova» di un doppione", async () => {
    const server = conServer();
    rispostaPersa(server);
    await expect(server.creatore.crea("Estate")).rejects.toBeInstanceOf(ApiError);
    server.elenca.mockRejectedValueOnce(new ApiError(0, "Server non raggiungibile"));
    await expect(server.creatore.crea("Estate")).rejects.toMatchObject({ message: "Server non raggiungibile" });
    expect(server.crea).toHaveBeenCalledTimes(1);
    // La memoria resta: tornata la rete, il tentativo dopo trova la voce
    expect((await server.creatore.crea("Estate")).id).toBe("persa");
    expect(server.elenco).toHaveLength(1);
  });

  it("un rifiuto del server (400, 403, 500) non lascia memoria: il tentativo dopo crea senza leggere l'elenco", async () => {
    for (const status of [400, 403, 500]) {
      const { crea, elenca, creatore } = conServer();
      crea.mockRejectedValueOnce(new ApiError(status, "Rifiutato"));
      await expect(creatore.crea("Estate")).rejects.toMatchObject({ status });
      await creatore.crea("Estate");
      expect(elenca, String(status)).not.toHaveBeenCalled();
      expect(crea).toHaveBeenCalledTimes(2);
    }
  });

  it("502, 503 e 504 (il proxy non ha avuto risposta dal server) valgono come «senza risposta»", async () => {
    for (const status of [502, 503, 504]) {
      const server = conServer();
      rispostaPersa(server, new ApiError(status, "Gateway"));
      await expect(server.creatore.crea("Estate")).rejects.toMatchObject({ status });
      expect((await server.creatore.crea("Estate")).id, String(status)).toBe("persa");
      expect(server.crea).toHaveBeenCalledTimes(1);
    }
  });

  it("un errore che non è un ApiError non lascia memoria", async () => {
    const { crea, elenca, creatore } = conServer();
    crea.mockRejectedValueOnce(new TypeError("bug"));
    await expect(creatore.crea("Estate")).rejects.toBeInstanceOf(TypeError);
    await creatore.crea("Estate");
    expect(elenca).not.toHaveBeenCalled();
  });

  it("dati diversi non si confondono: la verifica riguarda solo i dati del tentativo andato a vuoto", async () => {
    const server = conServer();
    rispostaPersa(server);
    await expect(server.creatore.crea("Estate")).rejects.toBeInstanceOf(ApiError);
    expect((await server.creatore.crea("Inverno")).nome).toBe("Inverno");
    expect(server.elenca).not.toHaveBeenCalled();
    expect(server.elenco.map((v) => v.nome)).toEqual(["Estate", "Inverno"]);
  });

  it("trovata la voce, la memoria si cancella: una creazione successiva con gli stessi dati è una creazione vera", async () => {
    const server = conServer();
    rispostaPersa(server);
    await expect(server.creatore.crea("Estate")).rejects.toBeInstanceOf(ApiError);
    await server.creatore.crea("Estate");   // trova quella del tentativo andato a vuoto
    expect((await server.creatore.crea("Estate")).id).not.toBe("persa");
    expect(server.crea).toHaveBeenCalledTimes(2);
  });

  it("dimentica() cancella la memoria (all'uscita: i tentativi erano di chi se n'è andato)", async () => {
    const server = conServer();
    rispostaPersa(server);
    await expect(server.creatore.crea("Estate")).rejects.toBeInstanceOf(ApiError);
    server.creatore.dimentica();
    await server.creatore.crea("Estate");
    expect(server.elenca).not.toHaveBeenCalled();
    expect(server.crea).toHaveBeenCalledTimes(2);
  });
});
