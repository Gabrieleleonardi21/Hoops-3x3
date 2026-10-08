import { describe, it, expect } from "vitest";
import { ytId } from "../../src/utils/ytId";

describe("ytId: l'id di un video YouTube dal link", () => {
  it.each([
    ["watch", "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["watch con altri parametri", "https://www.youtube.com/watch?t=10&v=dQw4w9WgXcQ&list=x", "dQw4w9WgXcQ"],
    ["youtu.be", "https://youtu.be/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["shorts", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["embed", "https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0", "dQw4w9WgXcQ"],
    ["id con trattino e underscore", "https://youtu.be/a-b_c-d_e-f", "a-b_c-d_e-f"],
  ])("%s", (_nome, url, atteso) => {
    expect(ytId(url)).toBe(atteso);
  });

  it.each([
    ["non è YouTube", "https://vimeo.com/123456789"],
    ["id troppo corto", "https://youtu.be/abc"],
    ["vuoto", ""],
    ["testo qualsiasi", "ciao"],
  ])("null se %s", (_nome, url) => {
    expect(ytId(url)).toBeNull();
  });
});
