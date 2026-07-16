import { Rect } from "../lib/printPlan";
import { TextObject } from "./TextModel";

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
  const explicitLines = text.content.split(/\n/);
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

const drawTextLine = (
  ctx: CanvasRenderingContext2D,
  line: string,
  text: TextObject,
  x: number,
  y: number,
  mode: "fill" | "stroke"
) => {
  if (!text.letterSpacing) {
    if (mode === "stroke") ctx.strokeText(line, x, y);
    else ctx.fillText(line, x, y);
    return;
  }

  const chars = [...line];
  const width = chars.reduce((total, char) => total + ctx.measureText(char).width, 0) + Math.max(0, chars.length - 1) * text.letterSpacing;
  let cursor = text.align === "center" ? x - width / 2 : text.align === "right" ? x - width : x;

  chars.forEach((char) => {
    if (mode === "stroke") ctx.strokeText(char, cursor, y);
    else ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + text.letterSpacing;
  });
};

export const getTextBounds = (text: TextObject, ctx?: CanvasRenderingContext2D): Rect => {
  const lineHeight = Math.round(text.fontSize * 1.16);
  const estimatedLines = Math.max(1, text.content.split(/\n/).length);
  const height = estimatedLines * lineHeight;
  return {
    x: Math.round(text.x - text.width / 2),
    y: Math.round(text.y - height / 2),
    width: Math.round(text.width),
    height: Math.round(ctx ? splitTextLines(ctx, text).length * lineHeight : height)
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
    const lineHeight = Math.round(text.fontSize * 1.16);
    const blockHeight = lines.length * lineHeight;
    const startY = -blockHeight / 2 + lineHeight / 2;
    const anchorX = text.align === "center" ? 0 : text.align === "right" ? text.width / 2 : -text.width / 2;

    ctx.translate(text.x, text.y);
    ctx.rotate((text.rotation * Math.PI) / 180);

    if (text.shadow.enabled) {
      ctx.shadowColor = text.shadow.color;
      ctx.shadowBlur = text.shadow.blur;
      ctx.shadowOffsetX = text.shadow.offsetX;
      ctx.shadowOffsetY = text.shadow.offsetY;
    }

    if (text.outline.enabled && text.outline.width > 0) {
      ctx.strokeStyle = text.outline.color;
      ctx.lineWidth = text.outline.width;
      lines.forEach((line, index) => drawTextLine(ctx, line, text, anchorX, startY + index * lineHeight, "stroke"));
    }

    ctx.fillStyle = text.color;
    lines.forEach((line, index) => drawTextLine(ctx, line, text, anchorX, startY + index * lineHeight, "fill"));

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
