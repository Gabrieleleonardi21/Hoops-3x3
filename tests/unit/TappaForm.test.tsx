// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TappaForm } from "../../src/components/tappa/TappaForm";
import { useAppStore } from "../../src/stores/useAppStore";
import { DEFAULT_RULES } from "../../src/constants/rules";
import { AVVISO_TAPPA_OMONIMA } from "../../src/utils/testi";
import type { Tappa } from "../../src/types";
import type { NuovaTappaInput } from "../../src/hooks/useLega";

const roma: Tappa = {
  id: "t1", nome: "Roma Open", luogo: "Roma", data: "2026-06-01", nGironi: 1, regole: { ...DEFAULT_RULES },
  squadre: [], gironi: null, partite: [], video: [],
};

afterEach(() => {
  cleanup(); // senza le globali di Vitest, Testing Library non smonta da sola
  useAppStore.getState().reset();
});

const scrivi = (testo: string) => fireEvent.change(screen.getByLabelText("Nome tappa"), { target: { value: testo } });

describe("TappaForm: avviso per un nome che c'è già nella lega", () => {
  it("con maiuscole diverse l'avviso compare, e Crea crea lo stesso la tappa", () => {
    useAppStore.setState({ tappe: [roma] });
    const onCreate = vi.fn((_input: NuovaTappaInput) => null);
    render(<TappaForm onCreate={onCreate} />);
    scrivi("roma open");
    expect(screen.getByRole("status").textContent).toBe(AVVISO_TAPPA_OMONIMA(roma));
    fireEvent.click(screen.getByRole("button", { name: "Crea la tappa" }));
    expect(onCreate).toHaveBeenCalledTimes(1);
    expect(onCreate.mock.calls[0][0].nome).toBe("roma open");
  });

  it("un nome nuovo, o nessun nome, non avvisa", () => {
    useAppStore.setState({ tappe: [roma] });
    render(<TappaForm onCreate={() => null} />);
    scrivi("Finale");
    expect(screen.queryByRole("status")).toBeNull();
    scrivi("");
    expect(screen.queryByRole("status")).toBeNull();
  });
});
