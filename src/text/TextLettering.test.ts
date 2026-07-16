import { describe, expect, it } from "vitest";
import { strengthenOutline } from "./TextEffects";
import { fillTextWidth, fitTextInsideArea } from "./TextFitEngine";
import { createTextObject } from "./TextModel";
import { applyLetteringPreset } from "./TextPresetRegistry";
import { applyTextCase, hasWeakOutlineForPrint } from "./TypographyService";

describe("lettering tools", () => {
  it("applies text case without destroying the original model", () => {
    expect(applyTextCase("nitro studio", "upper")).toBe("NITRO STUDIO");
    expect(applyTextCase("NITRO STUDIO", "lower")).toBe("nitro studio");
    expect(applyTextCase("nitro studio", "capitalize")).toBe("Nitro Studio");
  });

  it("fits and fills text with non destructive typography changes", () => {
    const text = { ...createTextObject(1200, 1600), content: "Camisa Nitro" };
    const fitted = fitTextInsideArea(text, { x: 100, y: 100, width: 800, height: 260 });
    const filled = fillTextWidth(text, 900);

    expect(fitted.x).toBe(500);
    expect(fitted.y).toBe(230);
    expect(fitted.fontSize).toBeGreaterThan(20);
    expect(filled.width).toBe(900);
    expect(filled.fontSize).toBeGreaterThan(text.fontSize);
  });

  it("applies editable lettering presets", () => {
    const text = createTextObject(1200, 1600);
    const neon = applyLetteringPreset(text, "neon");
    const sport = applyLetteringPreset(text, "sport");

    expect(neon.effectPreset).toBe("neon");
    expect(neon.glow.enabled).toBe(true);
    expect(sport.doubleOutline.enabled).toBe(true);
    expect(sport.caseMode).toBe("upper");
  });

  it("detects and strengthens weak print outlines", () => {
    const text = { ...createTextObject(1200, 1600), outline: { enabled: true, color: "#ffffff", width: 1 } };
    expect(hasWeakOutlineForPrint(text, 300)).toBe(true);
    expect(strengthenOutline(text, 300).outline?.width).toBeGreaterThanOrEqual(6);
  });
});
