import stylePackPalettes from "./stylePack/palettes.json";
import stylePackData from "./stylePack/lettering_styles.json";
import { TextCurveMode, TextDecorationName, TextEffectPreset, TextObject } from "./TextModel";

export type LetteringPresetCategory =
  | "Infantil"
  | "Festa"
  | "Esportivo"
  | "Elegante"
  | "Tecnologia"
  | "Neon"
  | "Retrô"
  | "Romântico"
  | "Sublimação"
  | "Impacto"
  | "Simples"
  | "Decorativa";

export type LetteringPreset = {
  id: TextEffectPreset;
  name: string;
  category: LetteringPresetCategory;
  description: string;
};

type StylePackPreset = {
  id: string;
  name: string;
  category: LetteringPresetCategory;
  fontFamily: string;
  fontWeight: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
  shadow?: {
    enabled?: boolean;
    color?: string;
    blur?: number;
    offsetX?: number;
    offsetY?: number;
  };
  gradient?: string[] | null;
  curve?: {
    type?: string;
    amount?: number;
  };
  letterSpacing?: number;
  decorations?: string[];
};

const stylePackPresets = (stylePackData as { presets: StylePackPreset[] }).presets;

const decorationNames = new Set<TextDecorationName>([
  "burst",
  "confetti",
  "crown",
  "fireworks",
  "hearts",
  "leaves",
  "sparkles",
  "stars"
]);

const normalizeDecoration = (name: string): TextDecorationName | null => {
  const normalized = name.replace(/\.svg$/i, "") as TextDecorationName;
  return decorationNames.has(normalized) ? normalized : null;
};

const mapStylePackCurve = (type?: string): TextCurveMode => {
  if (type === "arcUp") return "arc-up";
  if (type === "arcDown") return "arc-down";
  if (type === "wave") return "wave";
  if (type === "circle") return "circle";
  if (type === "semicircle") return "semicircle";
  return "straight";
};

export const stylePackPaletteColors = Array.from(
  new Set(Object.values(stylePackPalettes as Record<string, string[]>).flat())
);

const stylePackLetteringPresets: LetteringPreset[] = stylePackPresets.map((preset) => ({
  id: preset.id,
  name: preset.name,
  category: preset.category,
  description: `Style Pack ${preset.category}: ${preset.fontFamily}, contorno ${preset.strokeWidth}px e acabamento editável.`
}));

const builtInLetteringPresets: LetteringPreset[] = [
  { id: "neon", name: "Letreiro neon", category: "Neon", description: "Brilho forte para arte escura ou tecnológica." },
  { id: "sport", name: "Esportivo", category: "Esportivo", description: "Impacto, contorno duplo e sombra curta." },
  { id: "kids", name: "Infantil colorido", category: "Infantil", description: "Cores vivas, fundo leve e leitura fácil." },
  { id: "luxury", name: "Luxo dourado", category: "Elegante", description: "Degradê dourado com sombra discreta." },
  { id: "retro", name: "Retrô", category: "Retrô", description: "Contraste quente e curva suave." },
  { id: "tech", name: "Tecnologia", category: "Tecnologia", description: "Azul elétrico com brilho e espaçamento." },
  { id: "party", name: "Festa", category: "Festa", description: "Vibrante, alegre e com contorno visível." },
  { id: "outline-name", name: "Nome com contorno", category: "Sublimação", description: "Base segura para camisa, caneca e A4." },
  { id: "vibrant", name: "Sublimação vibrante", category: "Sublimação", description: "Cor forte e sombra limpa para impressão." },
  { id: "badge", name: "Crachá premium", category: "Sublimação", description: "Nome dentro de moldura arredondada para camisa e caneca." },
  { id: "ribbon", name: "Faixa dobrada", category: "Festa", description: "Letreiro em faixa com pontas para nome de evento." },
  { id: "stamp", name: "Carimbo artesanal", category: "Retrô", description: "Borda tracejada com visual de etiqueta e produto feito à mão." },
  { id: "plaque", name: "Placa vintage", category: "Elegante", description: "Moldura de placa com cantos marcados." },
  { id: "seal", name: "Selo circular", category: "Sublimação", description: "Nome em selo para chaveiro, brinde e etiqueta." },
  { id: "comic-pop", name: "Gibi explosivo", category: "Infantil", description: "Cores fortes, contorno grosso e cara divertida." },
  { id: "chrome", name: "Cromado tech", category: "Tecnologia", description: "Degradê frio e contorno escuro para logo moderno." },
  { id: "shadow-block", name: "Sombra bloco", category: "Esportivo", description: "Letra pesada com sombra deslocada para impacto." },
  { id: "script-love", name: "Nome romântico", category: "Romântico", description: "Curva delicada, moldura suave e brilho leve." }
];

export const letteringPresets: LetteringPreset[] = [...builtInLetteringPresets, ...stylePackLetteringPresets];

export const presetCategories = Array.from(new Set(letteringPresets.map((preset) => preset.category)));

const applyStylePackPreset = (base: TextObject, shared: Partial<TextObject>, preset: StylePackPreset): TextObject => {
  const curveMode = mapStylePackCurve(preset.curve?.type);
  const gradientColors = preset.gradient?.filter(Boolean) ?? [];
  const decorations = (preset.decorations ?? [])
    .map(normalizeDecoration)
    .filter((item): item is TextDecorationName => Boolean(item));
  const shadowEnabled = Boolean(preset.shadow?.enabled);
  const hasOutline = preset.strokeWidth > 0;
  const hasGlow = shadowEnabled && (preset.shadow?.blur ?? 0) >= 12;

  return {
    ...base,
    ...shared,
    effectPreset: preset.id,
    fontFamily: preset.fontFamily,
    color: preset.fill,
    bold: preset.fontWeight >= 700,
    italic: false,
    caseMode: preset.category === "Esportivo" || preset.category === "Impacto" || preset.category === "Tecnologia" ? "upper" : base.caseMode,
    letterSpacing: preset.letterSpacing ?? 0,
    outline: {
      enabled: hasOutline,
      color: preset.stroke,
      width: preset.strokeWidth
    },
    doubleOutline: {
      enabled: preset.id === "contorno_duplo",
      color: preset.shadow?.color ?? preset.stroke,
      width: preset.id === "contorno_duplo" ? Math.max(10, preset.strokeWidth + 5) : 0
    },
    shadow: {
      enabled: shadowEnabled,
      color: preset.shadow?.color ?? "rgba(15, 23, 42, 0.26)",
      blur: preset.shadow?.blur ?? 0,
      offsetX: preset.shadow?.offsetX ?? 0,
      offsetY: preset.shadow?.offsetY ?? 0,
      long: (preset.shadow?.blur ?? 0) === 0 && Math.max(Math.abs(preset.shadow?.offsetX ?? 0), Math.abs(preset.shadow?.offsetY ?? 0)) >= 6
    },
    glow: {
      enabled: hasGlow,
      color: preset.shadow?.color ?? preset.fill,
      blur: preset.shadow?.blur ?? 0
    },
    gradient: {
      enabled: gradientColors.length >= 2,
      from: gradientColors[0] ?? preset.fill,
      to: gradientColors[gradientColors.length - 1] ?? preset.fill,
      angle: 0
    },
    decorations,
    curve: {
      ...base.curve,
      mode: curveMode,
      intensity: curveMode === "straight" ? 0 : Math.max(18, Math.round((preset.curve?.amount ?? 0) * 2)),
      radius: Math.max(base.width * 0.7, 180),
      spacing: preset.letterSpacing ?? 0,
      invert: false
    }
  };
};

export const applyLetteringPreset = (text: TextObject, presetId: TextEffectPreset): TextObject => {
  const base: TextObject = {
    ...text,
    effectPreset: presetId,
    opacity: 1
  };

  const shared = {
    background: { ...base.background, enabled: false },
    doubleOutline: { ...base.doubleOutline, enabled: false, width: 0 },
    frame: { ...base.frame, enabled: false, style: "none" as const },
    glow: { ...base.glow, enabled: false, blur: 0 },
    gradient: { ...base.gradient, enabled: false },
    decorations: [],
    shadow: { ...base.shadow, enabled: true, long: false, blur: 8, offsetX: 7, offsetY: 7 }
  };

  const stylePackPreset = stylePackPresets.find((preset) => preset.id === presetId);
  if (stylePackPreset) return applyStylePackPreset(base, shared, stylePackPreset);

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
      frame: { enabled: true, style: "badge", color: "#f59e0b", accentColor: "#ec4899", width: 5, padding: 18, radius: 22 },
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

  if (presetId === "badge") {
    return {
      ...base,
      ...shared,
      fontFamily: "Arial",
      color: "#064e3b",
      bold: true,
      caseMode: "upper",
      letterSpacing: 1,
      background: { enabled: true, color: "rgba(236, 253, 245, 0.92)", padding: 18, radius: 18 },
      frame: { enabled: true, style: "badge", color: "#0f766e", accentColor: "#14b8a6", width: 6, padding: 22, radius: 24 },
      outline: { enabled: true, color: "#ffffff", width: 5 },
      shadow: { enabled: true, color: "rgba(15, 118, 110, 0.22)", blur: 10, offsetX: 4, offsetY: 6, long: false }
    };
  }

  if (presetId === "ribbon") {
    return {
      ...base,
      ...shared,
      fontFamily: "Georgia",
      color: "#ffffff",
      bold: true,
      caseMode: "upper",
      letterSpacing: 1,
      background: { enabled: true, color: "rgba(190, 18, 60, 0.94)", padding: 18, radius: 8 },
      frame: { enabled: true, style: "ribbon", color: "#be123c", accentColor: "#fda4af", width: 6, padding: 24, radius: 10 },
      outline: { enabled: true, color: "#881337", width: 5 },
      shadow: { enabled: true, color: "rgba(76, 5, 25, 0.35)", blur: 4, offsetX: 8, offsetY: 8, long: false }
    };
  }

  if (presetId === "stamp") {
    return {
      ...base,
      ...shared,
      fontFamily: "Courier New",
      color: "#7c2d12",
      bold: true,
      caseMode: "upper",
      letterSpacing: 3,
      background: { enabled: true, color: "rgba(255, 247, 237, 0.72)", padding: 16, radius: 10 },
      frame: { enabled: true, style: "stamp", color: "#9a3412", accentColor: "#fed7aa", width: 5, padding: 22, radius: 14 },
      outline: { enabled: false, color: "#ffffff", width: 0 },
      shadow: { enabled: false, color: "rgba(15, 23, 42, 0.2)", blur: 0, offsetX: 0, offsetY: 0, long: false }
    };
  }

  if (presetId === "plaque") {
    return {
      ...base,
      ...shared,
      fontFamily: "Georgia",
      color: "#fef3c7",
      bold: true,
      background: { enabled: true, color: "rgba(120, 53, 15, 0.95)", padding: 20, radius: 14 },
      frame: { enabled: true, style: "plaque", color: "#f59e0b", accentColor: "#fff7ed", width: 7, padding: 26, radius: 18 },
      gradient: { enabled: true, from: "#fff7ed", to: "#f59e0b", angle: 0 },
      outline: { enabled: true, color: "#451a03", width: 5 },
      shadow: { enabled: true, color: "rgba(69, 26, 3, 0.38)", blur: 10, offsetX: 7, offsetY: 9, long: false }
    };
  }

  if (presetId === "seal") {
    return {
      ...base,
      ...shared,
      fontFamily: "Trebuchet MS",
      color: "#0f172a",
      bold: true,
      caseMode: "upper",
      curve: { ...base.curve, mode: "arc-up", intensity: 16, radius: Math.max(base.width * 0.6, 180), spacing: 2, invert: false },
      background: { enabled: true, color: "rgba(255, 255, 255, 0.76)", padding: 18, radius: 999 },
      frame: { enabled: true, style: "seal", color: "#0f766e", accentColor: "#e11d48", width: 7, padding: 26, radius: 999 },
      outline: { enabled: true, color: "#ffffff", width: 5 },
      shadow: { enabled: true, color: "rgba(15, 23, 42, 0.18)", blur: 8, offsetX: 3, offsetY: 5, long: false }
    };
  }

  if (presetId === "comic-pop") {
    return {
      ...base,
      ...shared,
      fontFamily: "Comic Sans MS",
      color: "#facc15",
      bold: true,
      caseMode: "upper",
      letterSpacing: 1,
      outline: { enabled: true, color: "#111827", width: 9 },
      doubleOutline: { enabled: true, color: "#ef4444", width: 16 },
      frame: { enabled: true, style: "label", color: "#2563eb", accentColor: "#facc15", width: 6, padding: 18, radius: 16 },
      shadow: { enabled: true, color: "rgba(37, 99, 235, 0.42)", blur: 2, offsetX: 10, offsetY: 10, long: true }
    };
  }

  if (presetId === "chrome") {
    return {
      ...base,
      ...shared,
      fontFamily: "Arial",
      color: "#e5e7eb",
      bold: true,
      caseMode: "upper",
      letterSpacing: 2,
      gradient: { enabled: true, from: "#f8fafc", to: "#64748b", angle: 0 },
      outline: { enabled: true, color: "#020617", width: 7 },
      doubleOutline: { enabled: true, color: "#38bdf8", width: 12 },
      glow: { enabled: true, color: "#38bdf8", blur: 12 },
      shadow: { enabled: true, color: "rgba(2, 6, 23, 0.44)", blur: 8, offsetX: 7, offsetY: 8, long: false }
    };
  }

  if (presetId === "shadow-block") {
    return {
      ...base,
      ...shared,
      fontFamily: "Impact",
      color: "#ffffff",
      bold: true,
      caseMode: "upper",
      outline: { enabled: true, color: "#0f172a", width: 8 },
      doubleOutline: { enabled: true, color: "#f97316", width: 13 },
      shadow: { enabled: true, color: "#0f766e", blur: 0, offsetX: 16, offsetY: 16, long: true }
    };
  }

  if (presetId === "script-love") {
    return {
      ...base,
      ...shared,
      fontFamily: "Georgia",
      color: "#be123c",
      italic: true,
      curve: { ...base.curve, mode: "arc-down", intensity: 12, radius: Math.max(base.width * 0.7, 180), spacing: 1, invert: false },
      background: { enabled: true, color: "rgba(255, 241, 242, 0.82)", padding: 18, radius: 999 },
      frame: { enabled: true, style: "seal", color: "#fb7185", accentColor: "#be123c", width: 5, padding: 24, radius: 999 },
      outline: { enabled: true, color: "#ffffff", width: 6 },
      glow: { enabled: true, color: "#fb7185", blur: 8 },
      shadow: { enabled: true, color: "rgba(190, 18, 60, 0.2)", blur: 8, offsetX: 4, offsetY: 6, long: false }
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
