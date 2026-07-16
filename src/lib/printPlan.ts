import {
  DestinationPreset,
  FitMode,
  SheetPreset,
  mmToPx,
  pxToMm
} from "./printPresets";

export type PrintPlanInput = {
  imageWidth: number;
  imageHeight: number;
  destination: DestinationPreset;
  sheet: SheetPreset;
  fitMode: FitMode;
  dpi: number;
  bleedMm: number;
  marginMm: number;
  gapMm: number;
  copies: number;
  imageScale: number;
  imageScaleX?: number;
  imageScaleY?: number;
  mirror: boolean;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PrintPlan = {
  sheetPx: { width: number; height: number };
  targetPx: Rect;
  imagePx: Rect;
  placements: Rect[];
  bleedPx: number;
  marginPx: number;
  gapPx: number;
  dpi: number;
  copyCount: number;
  maxCopies: number;
  effectiveDpi: number;
  scaleFactor: number;
  wastePercent: number;
  readinessScore: number;
  status: "ready" | "attention" | "blocked";
  checklist: Array<{
    label: string;
    state: "ok" | "warn" | "fail";
    detail: string;
  }>;
  warnings: string[];
  recommendations: string[];
  summary: string;
  technicalLabel: string;
};

const centeredRect = (outerWidth: number, outerHeight: number, width: number, height: number): Rect => ({
  x: Math.round((outerWidth - width) / 2),
  y: Math.round((outerHeight - height) / 2),
  width: Math.round(width),
  height: Math.round(height)
});

export const createPrintPlan = ({
  imageWidth,
  imageHeight,
  destination,
  sheet,
  fitMode,
  dpi,
  bleedMm,
  marginMm,
  gapMm,
  copies,
  imageScale,
  imageScaleX = 1,
  imageScaleY = 1,
  mirror
}: PrintPlanInput): PrintPlan => {
  const sheetPx = {
    width: mmToPx(sheet.widthMm, dpi),
    height: mmToPx(sheet.heightMm, dpi)
  };

  const marginPx = mmToPx(marginMm, dpi);
  const gapPx = mmToPx(gapMm, dpi);
  const bleedPx = mmToPx(bleedMm, dpi);
  const targetWidthPx = mmToPx(destination.widthMm + bleedMm * 2, dpi);
  const targetHeightPx = mmToPx(destination.heightMm + bleedMm * 2, dpi);
  const usableWidth = sheetPx.width - marginPx * 2;
  const usableHeight = sheetPx.height - marginPx * 2;
  const scaleFactor = Math.min(1, usableWidth / targetWidthPx, usableHeight / targetHeightPx);
  const fittedWidth = targetWidthPx * scaleFactor;
  const fittedHeight = targetHeightPx * scaleFactor;
  const maxColumns = Math.max(1, Math.floor((usableWidth + gapPx) / (fittedWidth + gapPx)));
  const maxRows = Math.max(1, Math.floor((usableHeight + gapPx) / (fittedHeight + gapPx)));
  const maxCopies = Math.max(1, maxColumns * maxRows);
  const copyCount = Math.max(1, Math.min(Math.round(copies), maxCopies));
  const columns = Math.max(1, Math.min(maxColumns, Math.ceil(Math.sqrt(copyCount * (fittedHeight / fittedWidth)))));
  const rows = Math.max(1, Math.ceil(copyCount / columns));
  const gridWidth = columns * fittedWidth + (columns - 1) * gapPx;
  const gridHeight = rows * fittedHeight + (rows - 1) * gapPx;
  const gridOrigin = centeredRect(sheetPx.width, sheetPx.height, gridWidth, gridHeight);
  const placements = Array.from({ length: copyCount }, (_, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      x: Math.round(gridOrigin.x + column * (fittedWidth + gapPx)),
      y: Math.round(gridOrigin.y + row * (fittedHeight + gapPx)),
      width: Math.round(fittedWidth),
      height: Math.round(fittedHeight)
    };
  });

  const targetPx = placements[0] ?? centeredRect(
    sheetPx.width,
    sheetPx.height,
    fittedWidth,
    fittedHeight
  );

  const fitScale =
    fitMode === "cover"
      ? Math.max(targetPx.width / imageWidth, targetPx.height / imageHeight)
      : Math.min(targetPx.width / imageWidth, targetPx.height / imageHeight);

  const imagePx =
    fitMode === "repeat"
      ? {
          x: targetPx.x,
          y: targetPx.y,
          width: targetPx.width,
          height: targetPx.height
        }
      : centeredRect(
          targetPx.width,
          targetPx.height,
          imageWidth * fitScale,
          imageHeight * fitScale
        );

  if (fitMode !== "repeat") {
    imagePx.x += targetPx.x;
    imagePx.y += targetPx.y;
  }

  const printedWidthMm = pxToMm(targetPx.width, dpi);
  const printedHeightMm = pxToMm(targetPx.height, dpi);
  const effectiveScale = Math.max(0.1, imageScale * Math.max(imageScaleX, imageScaleY));
  const effectiveDpi = Math.min(
    imageWidth / (printedWidthMm / 25.4),
    imageHeight / (printedHeightMm / 25.4)
  ) / effectiveScale;

  const warnings: string[] = [];
  const recommendations: string[] = [];
  const checklist: PrintPlan["checklist"] = [];

  if (scaleFactor < 0.98) {
    warnings.push("O destino é maior que a folha com as margens atuais; reduzi proporcionalmente.");
    recommendations.push("Use uma folha maior ou diminua a margem para manter o tamanho real.");
  }

  if (effectiveDpi < 130) {
    warnings.push("A imagem pode sair com baixa definição no tamanho escolhido.");
    recommendations.push("Use uma imagem maior ou reduza o tamanho final da arte.");
    checklist.push({
      label: "Definição",
      state: "fail",
      detail: `${Math.round(effectiveDpi)} DPI efetivos`
    });
  } else if (effectiveDpi < 190) {
    warnings.push("A definição está aceitável, mas não ideal para detalhes finos.");
    recommendations.push("Para acabamento premium, tente trabalhar perto de 200 a 300 DPI efetivos.");
    checklist.push({
      label: "Definição",
      state: "warn",
      detail: `${Math.round(effectiveDpi)} DPI efetivos`
    });
  } else {
    recommendations.push("Resolução suficiente para uma impressão limpa nesse tamanho.");
    checklist.push({
      label: "Definição",
      state: "ok",
      detail: `${Math.round(effectiveDpi)} DPI efetivos`
    });
  }

  if (fitMode === "cover") {
    recommendations.push("Modo preencher pode cortar bordas; confira o preview antes de baixar.");
    checklist.push({
      label: "Corte de borda",
      state: "warn",
      detail: "Preenchimento pode ocultar partes da arte"
    });
  } else {
    checklist.push({
      label: "Corte de borda",
      state: "ok",
      detail: fitMode === "repeat" ? "Padrão repetido dentro da área" : "Arte preservada"
    });
  }

  if (mirror) {
    recommendations.push("Espelhamento ligado para transferência por sublimação.");
  }

  if (copies > maxCopies) {
    warnings.push(`Cabem ${maxCopies} cópia(s) nessa folha com as medidas atuais.`);
    recommendations.push("Reduza a quantidade, o espaçamento ou use uma folha maior.");
  }

  checklist.push({
    label: "Tamanho real",
    state: scaleFactor < 0.98 ? "warn" : "ok",
    detail: scaleFactor < 0.98 ? `${Math.round(scaleFactor * 100)}% do tamanho solicitado` : "Mantido na folha"
  });

  checklist.push({
    label: "Aproveitamento",
    state: copyCount > 1 ? "ok" : "warn",
    detail: `${copyCount} de ${maxCopies} possível(is)`
  });

  const usedArea = placements.reduce((total, placement) => total + placement.width * placement.height, 0);
  const usableArea = Math.max(1, usableWidth * usableHeight);
  const wastePercent = Math.max(0, Math.round((1 - Math.min(1, usedArea / usableArea)) * 100));
  const failCount = checklist.filter((item) => item.state === "fail").length;
  const warnCount = checklist.filter((item) => item.state === "warn").length + warnings.length;
  const readinessScore = Math.max(0, Math.min(100, 100 - failCount * 35 - warnCount * 10 - Math.max(0, wastePercent - 55) * 0.35));
  const status = failCount > 0 ? "blocked" : readinessScore >= 78 ? "ready" : "attention";

  return {
    sheetPx,
    targetPx,
    imagePx,
    placements,
    bleedPx,
    marginPx,
    gapPx,
    dpi,
    copyCount,
    maxCopies,
    effectiveDpi: Math.round(effectiveDpi),
    scaleFactor,
    wastePercent,
    readinessScore: Math.round(readinessScore),
    status,
    checklist,
    warnings,
    recommendations,
    summary: `${destination.label} em ${sheet.label}, ${dpi} DPI`,
    technicalLabel: `${destination.widthMm}x${destination.heightMm}mm · ${copyCount}x · sangria ${bleedMm}mm · margem ${marginMm}mm`
  };
};
