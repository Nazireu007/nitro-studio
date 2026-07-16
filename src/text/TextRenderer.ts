import { Rect } from "../lib/printPlan";
import { TextObject } from "./TextModel";
import { getPrintableText } from "./TypographyService";

type TextRenderPlan = {
  sheetPx: {
    width: number;
    height: number;
  };
};

const getFont = (text: TextObject) => {
  const style = text.italic ? "italic" : "normal";
  const weight = text.bold ? "800" : "500";
  return `${style} ${weight} ${text.fontSize}px "${text.fontFamily}", Arial, sans-serif`;
};

const splitTextLines = (ctx: CanvasRenderingContext2D, text: TextObject) => {
  const explicitLines = getPrintableText(text).split(/\n/);
  const lines: string[] = [];

  explicitLines.forEach((line) => {
    const words = line.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      return;
    }

    let current = "";
    words.forEach((word) => {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width + Math.max(0, candidate.length - 1) * text.letterSpacing <= text.width || !current) {
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    });
    lines.push(current);
  });

  return lines;
};

const measureLineWidth = (ctx: CanvasRenderingContext2D, line: string, text: TextObject) =>
  [...line].reduce((total, char) => total + ctx.measureText(char).width, 0) + Math.max(0, line.length - 1) * (text.letterSpacing + text.curve.spacing);

const createFillStyle = (ctx: CanvasRenderingContext2D, text: TextObject) => {
  if (!text.gradient.enabled) return text.color;
  const gradient = ctx.createLinearGradient(-text.width / 2, 0, text.width / 2, 0);
  gradient.addColorStop(0, text.gradient.from);
  gradient.addColorStop(1, text.gradient.to);
  return gradient;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) => {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
};

const drawTextLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  text: TextObject,
  x: number,
  y: number,
  mode: "fill" | "stroke"
) => {
  if (!text.letterSpacing && !text.curve.spacing) {
    if (mode === "stroke") ctx.strokeText(line, x, y);
    else ctx.fillText(line, x, y);
    return;
  }

  const chars = [...line];
  const spacing = text.letterSpacing + text.curve.spacing;
  const width = chars.reduce((total, char) => total + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * spacing;
  let cursor = text.align === "center" ? x - width / 2 : text.align === "right" ? x - width : x;

  chars.forEach((char) => {
    if (mode === "stroke") ctx.strokeText(char, cursor, y);
    else ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  });
};

const drawCurvedLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  text: TextObject,
  y: number,
  mode: "fill" | "stroke"
) => {
  const chars = [...line];
  if (!chars.length) return;

  const width = measureLineWidth(ctx, line, text);
  let cursor = -width / 2;
  const intensity = Math.max(0, text.curve.intensity) * (text.curve.invert ? -1 : 1);

  chars.forEach((char, index) => {
    const charWidth = ctx.measureText(char).width;
    const center = cursor + charWidth / 2;
    const t = chars.length === 1 ? 0.5 : index / (chars.length - 1);
    let offsetY = 0;
    let rotation = 0;

    if (text.curve.mode === "arc-up" || text.curve.mode === "semicircle") {
      offsetY = -Math.sin(t * Math.PI) * intensity;
      rotation = ((t - 0.5) * intensity) / 85;
    } else if (text.curve.mode === "arc-down" || text.curve.mode === "circle") {
      offsetY = Math.sin(t * Math.PI) * intensity;
      rotation = -((t - 0.5) * intensity) / 85;
    } else if (text.curve.mode === "wave") {
      offsetY = Math.sin(t * Math.PI * 2) * intensity;
      rotation = Math.cos(t * Math.PI * 2) * (intensity / 140);
    }

    ctx.save();
    ctx.translate(center, y + offsetY);
    ctx.rotate(rotation);
    if (mode === "stroke") ctx.strokeText(char, -charWidth / 2, 0);
    else ctx.fillText(char, -charWidth / 2, 0);
    ctx.restore();
    cursor += charWidth + text.letterSpacing + text.curve.spacing;
  });
};

export const getTextBounds = (text: TextObject, ctx?: CanvasRenderingContext2D): Rect => {
  const lineHeight = Math.round(text.fontSize * text.lineHeight);
  const estimatedLines = Math.max(1, getPrintableText(text).split(/\n/).length);
  const curveExtra = text.curve.mode === "straight" ? 0 : Math.abs(text.curve.intensity) * 2;
  const height = estimatedLines * lineHeight + curveExtra;
  return {
    x: Math.round(text.x - text.width / 2),
    y: Math.round(text.y - height / 2),
    width: Math.round(text.width),
    height: Math.round(ctx ? splitTextLines(ctx, text).length * lineHeight + curveExtra : height)
  };
};

export const renderTextObjects = (
  ctx: CanvasRenderingContext2D,
  plan: TextRenderPlan,
  textObjects: TextObject[] = []
) => {
  textObjects.forEach((text) => {
    ctx.save();
    ctx.globalAlpha = text.opacity;
    ctx.font = getFont(text);
    ctx.textBaseline = "middle";
    ctx.textAlign = text.align;
    ctx.lineJoin = "round";
    const lines = splitTextLines(ctx, text);
    const lineHeight = Math.round(text.fontSize * text.lineHeight);
    const blockHeight = lines.length * lineHeight;
    const startY = -blockHeight / 2 + lineHeight / 2;
    const anchorX = text.align === "center" ? 0 : text.align === "right" ? text.width / 2 : -text.width / 2;

    ctx.translate(text.x, text.y);
    ctx.rotate((text.rotation * Math.PI) / 180);
    if (text.mirror) ctx.scale(-1, 1);

    if (text.background.enabled) {
      ctx.save();
      ctx.shadowColor = "transparent";
      ctx.fillStyle = text.background.color;
      const padding = text.background.padding;
      roundRect(ctx, -text.width / 2 - padding, -blockHeight / 2 - padding, text.width + padding * 2, blockHeight + padding * 2, text.background.radius);
      ctx.fill();
      ctx.restore();
    }

    if (text.shadow.enabled) {
      ctx.shadowColor = text.shadow.color;
      ctx.shadowBlur = text.shadow.blur;
      ctx.shadowOffsetX = text.shadow.offsetX;
      ctx.shadowOffsetY = text.shadow.offsetY;
    }

    if (text.glow.enabled) {
      ctx.shadowColor = text.glow.color;
      ctx.shadowBlur = Math.max(ctx.shadowBlur, text.glow.blur);
    }

    const drawLines = (mode: "fill" | "stroke") => {
      lines.forEach((line, index) => {
        const y = startY + index * lineHeight;
        if (text.curve.mode !== "straight" && lines.length === 1) drawCurvedLine(ctx, line, text, y, mode);
        else drawTextLine(ctx, line, text, anchorX, y, mode);
      });
    };

    if (text.doubleOutline.enabled && text.doubleOutline.width > 0) {
      ctx.strokeStyle = text.doubleOutline.color;
      ctx.lineWidth = text.doubleOutline.width;
      drawLines("stroke");
    }

    if (text.outline.enabled && text.outline.width > 0) {
      ctx.strokeStyle = text.outline.color;
      ctx.lineWidth = text.outline.width;
      drawLines("stroke");
    }

    ctx.fillStyle = createFillStyle(ctx, text);
    drawLines("fill");

    if (text.underline) {
      ctx.shadowColor = "transparent";
      ctx.strokeStyle = text.color;
      ctx.lineWidth = Math.max(2, text.fontSize * 0.06);
      const underlineY = startY + lines.length * lineHeight - lineHeight * 0.28;
      ctx.beginPath();
      ctx.moveTo(-text.width / 2, underlineY);
      ctx.lineTo(text.width / 2, underlineY);
      ctx.stroke();
    }

    ctx.restore();
  });

  if (!plan.sheetPx.width || !plan.sheetPx.height) return;
};
