export type TextAlign = "left" | "center" | "right";

export type TextObject = {
  id: string;
  content: string;
  x: number;
  y: number;
  width: number;
  fontFamily: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  letterSpacing: number;
  rotation: number;
  opacity: number;
  outline: {
    enabled: boolean;
    color: string;
    width: number;
  };
  shadow: {
    enabled: boolean;
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
};

export const createTextObject = (sheetWidth: number, sheetHeight: number): TextObject => ({
  id: `text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  content: "Digite seu texto",
  x: Math.round(sheetWidth * 0.5),
  y: Math.round(sheetHeight * 0.42),
  width: Math.round(sheetWidth * 0.52),
  fontFamily: "Arial",
  fontSize: Math.max(48, Math.round(sheetWidth * 0.045)),
  color: "#111827",
  bold: true,
  italic: false,
  underline: false,
  align: "center",
  letterSpacing: 0,
  rotation: 0,
  opacity: 1,
  outline: {
    enabled: true,
    color: "#ffffff",
    width: 6
  },
  shadow: {
    enabled: true,
    color: "rgba(15, 23, 42, 0.34)",
    blur: 8,
    offsetX: 8,
    offsetY: 8
  }
});
