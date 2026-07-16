import { describe, expect, it } from "vitest";
import { destinationPresets, sheetPresets } from "./printPresets";
import { createPrintPlan } from "./printPlan";

const destinationById = (id: string) => {
  const destination = destinationPresets.find((item) => item.id === id);
  if (!destination) throw new Error(`Missing destination preset: ${id}`);
  return destination;
};

describe("createPrintPlan", () => {
  it("fits a mug preset inside A4 at 300 DPI", () => {
    const plan = createPrintPlan({
      imageWidth: 3200,
      imageHeight: 1600,
      destination: destinationById("mug-11oz"),
      sheet: sheetPresets[0],
      fitMode: "contain",
      dpi: 300,
      bleedMm: 2,
      marginMm: 6,
      gapMm: 4,
      copies: 1,
      imageScale: 1,
      mirror: true
    });

    expect(plan.sheetPx.width).toBe(2480);
    expect(plan.targetPx.width).toBeLessThanOrEqual(plan.sheetPx.width);
    expect(plan.effectiveDpi).toBeGreaterThan(150);
    expect(plan.readinessScore).toBeGreaterThan(50);
  });

  it("warns when a large destination does not fit the sheet", () => {
    const plan = createPrintPlan({
      imageWidth: 1200,
      imageHeight: 1200,
      destination: destinationById("shirt-a3"),
      sheet: sheetPresets[0],
      fitMode: "cover",
      dpi: 300,
      bleedMm: 3,
      marginMm: 10,
      gapMm: 4,
      copies: 1,
      imageScale: 1,
      mirror: false
    });

    expect(plan.scaleFactor).toBeLessThan(1);
    expect(plan.warnings.length).toBeGreaterThan(0);
  });

  it("limits copies to what fits on the selected sheet", () => {
    const plan = createPrintPlan({
      imageWidth: 2400,
      imageHeight: 2400,
      destination: destinationById("tile-15"),
      sheet: sheetPresets[1],
      fitMode: "contain",
      dpi: 200,
      bleedMm: 2,
      marginMm: 6,
      gapMm: 4,
      copies: 20,
      imageScale: 1,
      mirror: false
    });

    expect(plan.copyCount).toBeLessThanOrEqual(plan.maxCopies);
    expect(plan.placements).toHaveLength(plan.copyCount);
  });
});
