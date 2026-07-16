import { TextCaseMode, TextObject } from "./TextModel";

export const applyTextCase = (content: string, mode: TextCaseMode = "normal") => {
  if (mode === "upper") return content.toLocaleUpperCase("pt-BR");
  if (mode === "lower") return content.toLocaleLowerCase("pt-BR");
  if (mode === "capitalize") {
    return content
      .toLocaleLowerCase("pt-BR")
      .replace(/(^|\s|[-/])(\p{L})/gu, (_match, prefix: string, letter: string) => `${prefix}${letter.toLocaleUpperCase("pt-BR")}`);
  }
  return content;
};

export const getPrintableText = (text: TextObject) => applyTextCase(text.content, text.caseMode);

export const clampTextToSheet = (text: TextObject, sheetWidth: number, sheetHeight: number): Partial<TextObject> => {
  const halfWidth = Math.max(20, text.width / 2);
  const estimatedHeight = Math.max(24, text.fontSize * text.lineHeight * Math.max(1, text.content.split(/\n/).length));

  return {
    x: Math.round(Math.min(Math.max(text.x, halfWidth), sheetWidth - halfWidth)),
    y: Math.round(Math.min(Math.max(text.y, estimatedHeight / 2), sheetHeight - estimatedHeight / 2))
  };
};

export const isTextOutsideSheet = (text: TextObject, sheetWidth: number, sheetHeight: number) => {
  const halfWidth = Math.max(20, text.width / 2);
  const estimatedHeight = Math.max(24, text.fontSize * text.lineHeight * Math.max(1, text.content.split(/\n/).length));
  return (
    text.x - halfWidth < 0 ||
    text.x + halfWidth > sheetWidth ||
    text.y - estimatedHeight / 2 < 0 ||
    text.y + estimatedHeight / 2 > sheetHeight
  );
};

export const hasWeakOutlineForPrint = (text: TextObject, dpi: number) => {
  if (!text.outline.enabled) return true;
  const minWidth = dpi >= 250 ? 5 : 7;
  return text.outline.width < minWidth;
};
