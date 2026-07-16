import { TextObject } from "./TextModel";

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  };
};

const luminance = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0.5;
  const channels = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};

export const contrastRatio = (foreground: string, background: string) => {
  const light = Math.max(luminance(foreground), luminance(background));
  const dark = Math.min(luminance(foreground), luminance(background));
  return (light + 0.05) / (dark + 0.05);
};

export const hasLowTextContrast = (text: TextObject) => {
  const backgroundColor = text.background.enabled ? text.background.color : text.outline.enabled ? text.outline.color : "#ffffff";
  return contrastRatio(text.color, backgroundColor) < 2.8;
};

export const strengthenOutline = (text: TextObject, dpi: number): Partial<TextObject> => ({
  outline: {
    ...text.outline,
    enabled: true,
    color: text.outline.color || "#ffffff",
    width: Math.max(text.outline.width, dpi >= 250 ? 6 : 8)
  }
});

export const improveContrast = (text: TextObject): Partial<TextObject> => ({
  color: "#111827",
  outline: {
    ...text.outline,
    enabled: true,
    color: "#ffffff",
    width: Math.max(6, text.outline.width)
  }
});
