// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VideoCard } from "../../src/components/video/VideoCard";

afterEach(cleanup);

describe("VideoCard: l'embed di YouTube", () => {
  it("senza titolo l'iframe si chiama «Video» (un iframe senza titolo non è accessibile)", () => {
    const { container } = render(<VideoCard v={{ id: "v1", titolo: "", url: "https://youtu.be/abcdefghijk" }} />);
    expect(container.querySelector("iframe")?.getAttribute("title")).toBe("Video");
  });

  it("l'iframe è senza cookie, a schermo intero e con una sandbox fatta di soli valori validi", () => {
    const { container } = render(<VideoCard v={{ id: "v1", titolo: "Finale", url: "https://youtu.be/abcdefghijk" }} />);
    const f = container.querySelector("iframe");
    expect(f?.getAttribute("src")).toBe("https://www.youtube-nocookie.com/embed/abcdefghijk");
    expect(f?.hasAttribute("allowfullscreen")).toBe(true);
    // allow-fullscreen non è un valore di sandbox: il browser lo segnala in console. Il pieno schermo lo dà l'attributo allowfullscreen
    const sandbox = (f?.getAttribute("sandbox") ?? "").split(" ");
    expect(sandbox).toEqual(expect.arrayContaining(["allow-scripts", "allow-same-origin", "allow-presentation"]));
    expect(sandbox).not.toContain("allow-fullscreen");
  });

  it("un link che non è di YouTube non ha iframe, solo il link che si apre in un'altra scheda", () => {
    const { container } = render(<VideoCard v={{ id: "v2", titolo: "Highlights", url: "https://esempio.it/v" }} />);
    expect(container.querySelector("iframe")).toBeNull();
    const link = screen.getByRole("link", { name: "Apri il video ↗" });
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.getAttribute("target")).toBe("_blank");
  });
});
