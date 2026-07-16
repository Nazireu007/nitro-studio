import { TextEffectPreset, TextObject } from "./TextModel";

export type LetteringPresetCategory =
  | "Infantil"
  | "Festa"
  | "Esportivo"
  | "Elegante"
  | "Tecnologia"
  | "Neon"
  | "Retrô"
  | "Romântico"
  | "Sublimação";

export type LetteringPreset = {
  id: TextEffectPreset;
  name: string;
  category: LetteringPresetCategory;
  description: string;
};

export const letteringPresets: LetteringPreset[] = [
  { id: "neon", name: "Letreiro neon", category: "Neon", description: "Brilho forte para arte escura ou tecnológica." },
  { id: "sport", name: "Esportivo", category: "Esportivo", description: "Impacto, contorno duplo e sombra curta." },
  { id: "kids", name: "Infantil colorido", category: "Infantil", description: "Cores vivas, fundo leve e leitura fácil." },
  { id: "luxury", name: "Luxo dourado", category: "Elegante", description: "Degradê dourado com sombra discreta." },
  { id: "retro", name: "Retrô", category: "Retrô", description: "Contraste quente e curva suave." },
  { id: "tech", name: "Tecnologia", category: "Tecnologia", description: "Azul elétrico com brilho e espaçamento." },
  { id: "party", name: "Festa", category: "Festa", description: "Vibrante, alegre e com contorno visível." },
  { id: "outline-name", name: "Nome com contorno", category: "Sublimação", description: "Base segura para camisa, caneca e A4." },
  { id: "vibrant", name: "Sublimação vibrante", category: "Sublimação", description: "Cor forte e sombra limpa para impressão." }
];

export const presetCategories = Array.from(new Set(letteringPresets.map((preset) => preset.category)));

export const applyLetteringPreset = (text: TextObject, presetId: TextEffectPreset): TextObject => {
  const base: TextObject = {
    ...text,
    effectPreset: presetId,
    opacity: 1
  };

  const shared = {
    background: { ...base.background, enabled: false },
    doubleOutline: { ...base.doubleOutline, enabled: false, width: 0 },
    glow: { ...base.glow, enabled: false, blur: 0 },
    gradient: { ...base.gradient, enabled: false },
    shadow: { ...base.shadow, enabled: true, long: false, blur: 8, offsetX: 7, offsetY: 7 }
  };

  if (presetId === "neon") {
    return {
      ...base,
      ...shared,
      fontFamily: "Trebuchet MS",
      color: "#67e8f9",
      bold: true,
      letterSpacing: 2,
      outline: { enabled: true, color: "#0f172a", width: 5 },
      glow: { enabled: true, color: "#06b6d4", blur: 18 },
      shadow: { enabled: true, color: "rgba(8, 47, 73, 0.48)", blur: 18, offsetX: 0, offsetY: 0, long: false }
    };
  }

  if (presetId === "sport") {
    return {
      ...base,
      ...shared,
      fontFamily: "Impact",
      color: "#facc15",
      bold: true,
      caseMode: "upper",
      outline: { enabled: true, color: "#111827", width: 8 },
      doubleOutline: { enabled: true, color: "#ef4444", width: 14 },
      shadow: { enabled: true, color: "rgba(15, 23, 42, 0.36)", blur: 2, offsetX: 9, offsetY: 9, long: true }
    };
  }

  if (presetId === "kids") {
    return {
      ...base,
      ...shared,
      fontFamily: "Comic Sans MS",
      color: "#ec4899",
      bold: true,
      outline: { enabled: true, color: "#ffffff", width: 8 },
      background: { enabled: true, color: "rgba(254, 249, 195, 0.86)", padding: 12, radius: 14 },
      gradient: { enabled: true, from: "#ec4899", to: "#22c55e", angle: 0 }
    };
  }

  if (presetId === "luxury") {
    return {
      ...base,
      ...shared,
      fontFamily: "Georgia",
      color: "#92400e",
      italic: true,
      outline: { enabled: true, color: "#fff7ed", width: 5 },
      gradient: { enabled: true, from: "#fef3c7", to: "#b45309", angle: 0 },
      shadow: { enabled: true, color: "rgba(120, 53, 15, 0.34)", blur: 10, offsetX: 6, offsetY: 8, long: false }
    };
  }

  if (presetId === "retro") {
    return {
      ...base,
      ...shared,
      fontFamily: "Georgia",
      color: "#7c2d12",
      bold: true,
      curve: { ...base.curve, mode: "arc-up", intensity: 22, radius: Math.max(base.width * 0.8, 160), spacing: 1, invert: false },
      outline: { enabled: true, color: "#fed7aa", width: 7 },
      doubleOutline: { enabled: true, color: "#0f766e", width: 12 }
    };
  }

  if (presetId === "tech") {
    return {
      ...base,
      ...shared,
      fontFamily: "Courier New",
      color: "#38bdf8",
      bold: true,
      caseMode: "upper",
      letterSpacing: 4,
      outline: { enabled: true, color: "#0f172a", width: 5 },
      glow: { enabled: true, color: "#2563eb", blur: 14 }
    };
  }

  if (presetId === "party") {
    return {
      ...base,
      ...shared,
      fontFamily: "Trebuchet MS",
      color: "#f97316",
      bold: true,
      outline: { enabled: true, color: "#ffffff", width: 8 },
      doubleOutline: { enabled: true, color: "#7c3aed", width: 13 },
      curve: { ...base.curve, mode: "wave", intensity: 14, radius: base.curve.radius, spacing: 1, invert: false }
    };
  }

  if (presetId === "vibrant") {
    return {
      ...base,
      ...shared,
      fontFamily: "Trebuchet MS",
      color: "#dc2626",
      bold: true,
      outline: { enabled: true, color: "#ffffff", width: 8 },
      shadow: { enabled: true, color: "rgba(15, 23, 42, 0.3)", blur: 6, offsetX: 6, offsetY: 6, long: false }
    };
  }

  return {
    ...base,
    ...shared,
    fontFamily: "Arial",
    color: "#111827",
    bold: true,
    outline: { enabled: true, color: "#ffffff", width: 7 },
    shadow: { enabled: false, color: "rgba(15, 23, 42, 0.24)", blur: 0, offsetX: 0, offsetY: 0, long: false }
  };
};
