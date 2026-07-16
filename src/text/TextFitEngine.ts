import { TextObject } from "./TextModel";
import { getPrintableText } from "./TypographyService";

type FitArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const estimateTextWidth = (text: TextObject, fontSize: number) => {
  const longestLine = getPrintableText(text)
    .split(/\n/)
    .reduce((longest, line) => (line.length > longest.length ? line : longest), "");
  const weightFactor = text.bold ? 0.62 : 0.56;
  return Math.max(1, longestLine.length * fontSize * weightFactor + Math.max(0, longestLine.length - 1) * text.letterSpacing);
};

export const fitTextInsideArea = (text: TextObject, area: FitArea): Partial<TextObject> => {
  const lines = Math.max(1, getPrintableText(text).split(/\n/).length);
  const byWidth = area.width / Math.max(1, estimateTextWidth(text, 1));
  const byHeight = area.height / Math.max(1, lines * text.lineHeight);
  const fontSize = Math.max(10, Math.floor(Math.min(byWidth, byHeight) * 0.86));

  return {
    x: Math.round(area.x + area.width / 2),
    y: Math.round(area.y + area.height / 2),
    width: Math.round(area.width * 0.92),
    fontSize
  };
};

export const fillTextWidth = (text: TextObject, width: number): Partial<TextObject> => {
  const printable = getPrintableText(text).replace(/\s+/g, "");
  const estimatedChars = Math.max(3, printable.length);
  const fontSize = Math.max(10, Math.round(width / (estimatedChars * (text.bold ? 0.62 : 0.56))));

  return {
    width: Math.round(width),
    fontSize,
    letterSpacing: Math.max(text.letterSpacing, Math.min(18, Math.round(fontSize * 0.04)))
  };
};
