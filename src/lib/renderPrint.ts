import { FitMode } from "./printPresets";
import { PrintPlan, Rect } from "./printPlan";

type RenderOptions = {
  sourceUrl: string;
  montageSources?: Array<{
    url: string;
    name: string;
  }>;
  fitMode: FitMode;
  mirror: boolean;
  transform: {
    scale: number;
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    rotation: number;
    flipVertical: boolean;
  };
  color: {
    brightness: number;
    contrast: number;
    saturation: number;
  };
  crop: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  production: {
    showGuides: boolean;
    cutMarks: boolean;
    safeArea: boolean;
    technicalLabel: boolean;
  };
  pageRotationDeg?: 0 | 180;
  previewScale?: number;
};

const loadImage = async (src: string) => {
  const image = new Image();
  image.src = src;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não consegui renderizar a imagem."));
  });
  return image;
};

const getSourceCrop = (image: HTMLImageElement, crop: RenderOptions["crop"]) => {
  const left = Math.min(46, Math.max(0, crop.left));
  const right = Math.min(46, Math.max(0, crop.right));
  const top = Math.min(46, Math.max(0, crop.top));
  const bottom = Math.min(46, Math.max(0, crop.bottom));
  const x = Math.round((left / 100) * image.naturalWidth);
  const y = Math.round((top / 100) * image.naturalHeight);
  const width = Math.max(1, Math.round(image.naturalWidth * (1 - (left + right) / 100)));
  const height = Math.max(1, Math.round(image.naturalHeight * (1 - (top + bottom) / 100)));

  return { x, y, width, height };
};

const drawImageCover = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  source: ReturnType<typeof getSourceCrop>,
  x: number,
  y: number,
  width: number,
  height: number
) => {
  const scale = Math.max(width / source.width, height / source.height);
  const drawWidth = source.width * scale;
  const drawHeight = source.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, width, height);
  ctx.clip();
  ctx.drawImage(image, source.x, source.y, source.width, source.height, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
};

const drawMontage = (
  ctx: CanvasRenderingContext2D,
  images: HTMLImageElement[],
  plan: PrintPlan,
  placement: Rect,
  crop: RenderOptions["crop"]
) => {
  const count = Math.min(images.length, 9);
  const columns = count <= 1 ? 1 : count === 2 ? 2 : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  const gap = Math.max(8, Math.round(plan.dpi * 0.025));
  const cellWidth = (placement.width - gap * (columns - 1)) / columns;
  const cellHeight = (placement.height - gap * (rows - 1)) / rows;
  const gridHeight = rows * cellHeight + (rows - 1) * gap;
  const startY = placement.y + (placement.height - gridHeight) / 2;

  images.slice(0, count).forEach((image, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const source = getSourceCrop(image, crop);
    const x = placement.x + column * (cellWidth + gap);
    const y = startY + row * (cellHeight + gap);
    drawImageCover(ctx, image, source, x, y, cellWidth, cellHeight);
  });
};

const getRelativeImageRect = (plan: PrintPlan, placement: Rect): Rect => ({
  x: placement.x + (plan.imagePx.x - plan.targetPx.x),
  y: placement.y + (plan.imagePx.y - plan.targetPx.y),
  width: plan.imagePx.width,
  height: plan.imagePx.height
});

const drawCutMarks = (ctx: CanvasRenderingContext2D, rect: Rect, bleedPx: number) => {
  const trim = {
    x: rect.x + bleedPx,
    y: rect.y + bleedPx,
    width: Math.max(1, rect.width - bleedPx * 2),
    height: Math.max(1, rect.height - bleedPx * 2)
  };
  const tick = Math.min(42, Math.max(18, Math.min(trim.width, trim.height) * 0.08));

  ctx.save();
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 1.4;
  [
    [trim.x, trim.y, -tick, 0, 0, -tick],
    [trim.x + trim.width, trim.y, tick, 0, 0, -tick],
    [trim.x, trim.y + trim.height, -tick, 0, 0, tick],
    [trim.x + trim.width, trim.y + trim.height, tick, 0, 0, tick]
  ].forEach(([x, y, dx1, dy1, dx2, dy2]) => {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx1, y + dy1);
    ctx.moveTo(x, y);
    ctx.lineTo(x + dx2, y + dy2);
    ctx.stroke();
  });
  ctx.restore();
};

const drawGuides = (
  ctx: CanvasRenderingContext2D,
  plan: PrintPlan,
  placement: Rect,
  production: RenderOptions["production"]
) => {
  if (!production.showGuides && !production.cutMarks && !production.safeArea) return;

  ctx.save();
  if (production.showGuides) {
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.setLineDash([18, 12]);
    ctx.strokeRect(placement.x, placement.y, placement.width, placement.height);
  }

  if (production.safeArea) {
    const safeInset = plan.bleedPx + Math.round(plan.dpi * 0.08);
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = "rgba(15, 118, 110, 0.72)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      placement.x + safeInset,
      placement.y + safeInset,
      Math.max(1, placement.width - safeInset * 2),
      Math.max(1, placement.height - safeInset * 2)
    );
  }

  if (production.cutMarks) {
    ctx.setLineDash([]);
    drawCutMarks(ctx, placement, plan.bleedPx);
  }
  ctx.restore();
};

const drawTechnicalLabel = (ctx: CanvasRenderingContext2D, plan: PrintPlan) => {
  ctx.save();
  ctx.fillStyle = "#111827";
  ctx.font = `${Math.max(18, Math.round(plan.dpi * 0.075))}px Inter, Arial, sans-serif`;
  ctx.textBaseline = "bottom";
  ctx.fillText(
    `Nitro Studio · ${plan.technicalLabel} · ${plan.readinessScore}%`,
    plan.marginPx,
    plan.sheetPx.height - Math.max(10, plan.marginPx * 0.42)
  );
  ctx.restore();
};

const renderPlacement = (
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  montageImages: HTMLImageElement[],
  plan: PrintPlan,
  placement: Rect,
  options: RenderOptions
) => {
  const imageRect = getRelativeImageRect(plan, placement);
  const sourceCrop = getSourceCrop(image, options.crop);
  const centerX = placement.x + placement.width / 2;
  const centerY = placement.y + placement.height / 2;
  const offsetX = (options.transform.offsetX / 25.4) * plan.dpi;
  const offsetY = (options.transform.offsetY / 25.4) * plan.dpi;
  const scale = options.transform.scale;
  const scaleX = options.transform.scaleX;
  const scaleY = options.transform.scaleY;
  const rotation = (options.transform.rotation * Math.PI) / 180;

  ctx.save();
  ctx.beginPath();
  ctx.rect(placement.x, placement.y, placement.width, placement.height);
  ctx.clip();
  ctx.filter = `brightness(${options.color.brightness}%) contrast(${options.color.contrast}%) saturate(${options.color.saturation}%)`;

  if (montageImages.length > 1) {
    drawMontage(ctx, montageImages, plan, placement, options.crop);
    ctx.restore();
    return;
  }

  ctx.translate(centerX + offsetX, centerY + offsetY);
  ctx.scale(options.mirror ? -1 : 1, options.transform.flipVertical ? -1 : 1);
  ctx.rotate(rotation);
  ctx.scale(scale * scaleX, scale * scaleY);

  if (options.fitMode === "repeat") {
    const imageRatio = sourceCrop.width / sourceCrop.height;
    const targetRows = imageRatio < 0.85 ? 3 : 4;
    const baseTileHeight = placement.height / targetRows;
    const baseTileWidth = baseTileHeight * imageRatio;
    const columns = Math.max(2, Math.ceil(placement.width / baseTileWidth));
    const tileWidth = placement.width / columns;
    const tileHeight = tileWidth / imageRatio;
    const rows = Math.max(targetRows, Math.ceil(placement.height / tileHeight));
    const gridWidth = columns * tileWidth;
    const gridHeight = rows * tileHeight;
    const startX = -gridWidth / 2;
    const startY = -gridHeight / 2;

    for (let y = startY; y < gridHeight / 2; y += tileHeight) {
      for (let x = startX; x < gridWidth / 2; x += tileWidth) {
        ctx.drawImage(
          image,
          sourceCrop.x,
          sourceCrop.y,
          sourceCrop.width,
          sourceCrop.height,
          x,
          y,
          tileWidth,
          tileHeight
        );
      }
    }
  } else {
    ctx.drawImage(
      image,
      sourceCrop.x,
      sourceCrop.y,
      sourceCrop.width,
      sourceCrop.height,
      imageRect.x - centerX,
      imageRect.y - centerY,
      imageRect.width,
      imageRect.height
    );
  }

  ctx.restore();
};

export const renderPrintCanvas = async (
  canvas: HTMLCanvasElement,
  plan: PrintPlan,
  options: RenderOptions
) => {
  const image = await loadImage(options.sourceUrl);
  const montageImages = options.montageSources?.length
    ? await Promise.all(options.montageSources.map((source) => loadImage(source.url)))
    : [];
  const scale = options.previewScale ?? 1;
  canvas.width = Math.max(1, Math.round(plan.sheetPx.width * scale));
  canvas.height = Math.max(1, Math.round(plan.sheetPx.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível neste navegador.");

  ctx.save();
  ctx.scale(scale, scale);

  if (options.pageRotationDeg === 180) {
    ctx.translate(plan.sheetPx.width, plan.sheetPx.height);
    ctx.rotate(Math.PI);
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, plan.sheetPx.width, plan.sheetPx.height);

  for (const placement of plan.placements) {
    renderPlacement(ctx, image, montageImages, plan, placement, options);
    drawGuides(ctx, plan, placement, options.production);
  }

  if (options.production.technicalLabel) {
    drawTechnicalLabel(ctx, plan);
  }

  ctx.restore();
};

export const downloadCanvasPng = (canvas: HTMLCanvasElement, filename: string) => {
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
};
