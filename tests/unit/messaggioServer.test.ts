import { describe, it, expect } from "vitest";
import { ApiError } from "../../src/services/api";
import { messaggioDi } from "../../src/services/messaggioServer";

describe("messaggioDi", () => {
  it("restituisce il message della risposta com'è", () => {
    expect(messaggioDi({ message: "ok" }, "non valida")).toBe("ok");
  });

  it.each([{}, { message: "" }, { message: 3 }, [], null, "testo"])(
    "una risposta fuori forma (%j) è un ApiError 200 con il testo passato, mai un messaggio inventato",
    (risposta) => {
      expect(() => messaggioDi(risposta, "non valida")).toThrow(ApiError);
      expect(() => messaggioDi(risposta, "non valida")).toThrow("non valida");
      try {
        messaggioDi(risposta, "non valida");
      } catch (e) {
        expect(e).toMatchObject({ status: 200 });
      }
    },
  );
});
