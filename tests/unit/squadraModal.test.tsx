// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { SquadraModal } from "../../src/components/archivio/SquadraModal";
import type { SquadraTappa } from "../../src/types";

afterEach(cleanup);

const nulla = () => {};
const alfa: SquadraTappa = { id: "a", nome: "Alfa", rank: "", giocatori: [{ id: "a1", nome: "Anna" }] };

/** I contenitori della scheda senza niente dentro: spazio vuoto sullo schermo */
const vuoti = () => [...screen.getByRole("dialog").querySelectorAll("div")].filter((d) => d.childNodes.length === 0);

describe("SquadraModal: il logo della squadra nella scheda dell'archivio", () => {
  it("senza logo non resta un contenitore vuoto al suo posto", () => {
    render(<SquadraModal squadra={alfa} onClose={nulla} onSelectPlayer={nulla} hasStats />);
    expect(vuoti()).toEqual([]);
  });

  it("con il logo e il sito il logo porta al sito", () => {
    render(<SquadraModal squadra={{ ...alfa, logo: "/logos/alfa.svg", website: "https://alfa.it" }} onClose={nulla}
      onSelectPlayer={nulla} hasStats />);
    expect(screen.getByTitle("Vai al sito di Alfa").querySelector("img")).not.toBeNull();
  });
});
