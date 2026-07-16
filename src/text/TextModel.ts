export type TextAlign = "left" | "center" | "right";
export type TextCaseMode = "normal" | "upper" | "lower" | "capitalize";
export type TextCurveMode = "straight" | "arc-up" | "arc-down" | "circle" | "semicircle" | "wave";
export type TextEffectPreset =
  | "none"
  | "neon"
  | "sport"
  | "kids"
  | "luxury"
  | "retro"
  | "tech"
  | "party"
  | "outline-name"
  | "vibrant";

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
  caseMode: TextCaseMode;
  letterSpacing: number;
  lineHeight: number;
  rotation: number;
  mirror: boolean;
  opacity: number;
  effectPreset: TextEffectPreset;
  outline: {
    enabled: boolean;
    color: string;
    width: number;
  };
  doubleOutline: {
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
    long: boolean;
  };
  glow: {
    enabled: boolean;
    color: string;
    blur: number;
  };
  background: {
    enabled: boolean;
    color: string;
    padding: number;
    radius: number;
  };
  gradient: {
    enabled: boolean;
    from: string;
    to: string;
    angle: number;
  };
  curve: {
    mode: TextCurveMode;
    intensity: number;
    radius: number;
    spacing: number;
    invert: boolean;
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
  caseMode: "normal",
  letterSpacing: 0,
  lineHeight: 1.16,
  rotation: 0,
  mirror: false,
  opacity: 1,
  effectPreset: "none",
  outline: {
    enabled: false,
    color: "#ffffff",
    width: 0
  },
  doubleOutline: {
    enabled: false,
    color: "#0f766e",
    width: 0
  },
  shadow: {
    enabled: false,
    color: "rgba(15, 23, 42, 0.34)",
    blur: 0,
    offsetX: 0,
    offsetY: 0,
    long: false
  },
  glow: {
    enabled: false,
    color: "#22d3ee",
    blur: 0
  },
  background: {
    enabled: false,
    color: "rgba(255, 255, 255, 0.72)",
    padding: 10,
    radius: 8
  },
  gradient: {
    enabled: false,
    from: "#111827",
    to: "#0f766e",
    angle: 0
  },
  curve: {
    mode: "straight",
    intensity: 0,
    radius: Math.round(sheetWidth * 0.28),
    spacing: 0,
    invert: false
  }
});

export const normalizeTextObject = (text: Partial<TextObject>, sheetWidth = 1200, sheetHeight = 1600): TextObject => {
  const base = createTextObject(sheetWidth, sheetHeight);

  return {
    ...base,
    ...text,
    id: text.id ?? base.id,
    content: text.content ?? base.content,
    outline: { ...base.outline, ...text.outline },
    doubleOutline: { ...base.doubleOutline, ...text.doubleOutline },
    shadow: { ...base.shadow, ...text.shadow },
    glow: { ...base.glow, ...text.glow },
    background: { ...base.background, ...text.background },
    gradient: { ...base.gradient, ...text.gradient },
    curve: { ...base.curve, ...text.curve }
  };
};
