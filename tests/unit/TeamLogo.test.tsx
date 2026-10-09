// @vitest-environment jsdom
import { describe, expect, it, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TeamLogo } from "../../src/components/ui/TeamLogo";

afterEach(cleanup);

describe("TeamLogo: il logo di una squadra, che sparisce se non si carica", () => {
  it("mostra l'immagine con il testo alternativo", () => {
    render(<TeamLogo src="https://esempio.it/logo.png" alt="Logo Alfa" className="h-5 w-5" />);
    const img = screen.getByAltText("Logo Alfa");
    expect(img.getAttribute("src")).toBe("https://esempio.it/logo.png");
    expect(img.className).toContain("object-contain");
    expect(img.className).toContain("h-5 w-5");
    // Host qualsiasi: niente Referer verso chi ospita il logo
    expect(img.getAttribute("referrerpolicy")).toBe("no-referrer");
  });

  it("senza logo non mostra niente, oppure il ripiego", () => {
    const { container } = render(<TeamLogo src={undefined} alt="Logo Alfa" className="h-5 w-5" />);
    expect(container.childElementCount).toBe(0);
    render(<TeamLogo src="" alt="Logo Beta" className="h-5 w-5" ripiego={<span>3×3</span>} />);
    expect(screen.getByText("3×3")).toBeTruthy();
  });

  it("un logo che non si carica sparisce e lascia il posto al ripiego", () => {
    render(<TeamLogo src="https://esempio.it/rotto.png" alt="Logo Alfa" className="h-5 w-5" ripiego={<span>3×3</span>} />);
    fireEvent.error(screen.getByAltText("Logo Alfa"));
    expect(screen.queryByAltText("Logo Alfa")).toBeNull();
    expect(screen.getByText("3×3")).toBeTruthy();
  });

  it("se il logo cambia dopo un errore, il nuovo si prova a mostrare", () => {
    const { rerender } = render(<TeamLogo src="https://esempio.it/rotto.png" alt="Logo Alfa" className="h-5 w-5" />);
    fireEvent.error(screen.getByAltText("Logo Alfa"));
    rerender(<TeamLogo src="https://esempio.it/nuovo.png" alt="Logo Alfa" className="h-5 w-5" />);
    expect(screen.getByAltText("Logo Alfa").getAttribute("src")).toBe("https://esempio.it/nuovo.png");
  });
});
