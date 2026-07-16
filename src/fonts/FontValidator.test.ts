import { describe, expect, it } from "vitest";
import { getFontFormat, validateFontFile } from "./FontValidator";

describe("FontValidator", () => {
  it("accepts TTF and OTF files", () => {
    const ttf = new File(["font"], "minha-fonte.ttf");
    const otf = new File(["font"], "minha-fonte.otf");

    expect(validateFontFile(ttf)).toBe("ttf");
    expect(validateFontFile(otf)).toBe("otf");
  });

  it("rejects invalid files", () => {
    const image = new File(["nope"], "arte.png");

    expect(getFontFormat("x.woff2")).toBe("woff2");
    expect(() => validateFontFile(image)).toThrow("Formato inválido");
  });
});
