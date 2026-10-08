// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { VideoForm } from "../../src/components/video/VideoForm";

afterEach(cleanup);

const campo = () => screen.getByLabelText("Link video") as HTMLInputElement;

describe("VideoForm: il link si controlla con il criterio del server prima di aggiungerlo (B10)", () => {
  it("un link che non comincia con http(s):// resta nel campo con il motivo, e non si aggiunge", () => {
    const onAdd = vi.fn();
    render(<VideoForm onAdd={onAdd} />);
    fireEvent.change(campo(), { target: { value: "youtube.com/watch?v=abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi video" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/^Link non aggiunto: l'indirizzo deve cominciare con http:\/\/ o https:\/\//);
    expect(campo().value).toBe("youtube.com/watch?v=abc");
    // Correggendo il link il messaggio sparisce e il video si aggiunge
    fireEvent.change(campo(), { target: { value: "https://youtube.com/watch?v=abc" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi video" }));
    expect(onAdd).toHaveBeenCalledExactlyOnceWith("", "https://youtube.com/watch?v=abc");
    expect(campo().value).toBe("");
  });

  it("un link vuoto non fa niente, senza messaggi", () => {
    const onAdd = vi.fn();
    render(<VideoForm onAdd={onAdd} />);
    fireEvent.click(screen.getByRole("button", { name: "Aggiungi video" }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
