export type DestinationId =
  | "mug-11oz"
  | "shirt-kids"
  | "shirt-pp"
  | "shirt-a4"
  | "shirt-m"
  | "shirt-g"
  | "shirt-a3"
  | "keychain"
  | "tile-15"
  | "slipper-pair"
  | "mousepad"
  | "ecobag"
  | "custom";

export type SheetId = "a4" | "a3" | "sublimation-30x40";
export type FitMode = "contain" | "cover" | "repeat";

export type DestinationPreset = {
  id: DestinationId;
  label: string;
  category: string;
  widthMm: number;
  heightMm: number;
  intent: string;
  recommendedSheet: SheetId;
};

export type SheetPreset = {
  id: SheetId;
  label: string;
  widthMm: number;
  heightMm: number;
};

export const destinationPresets: DestinationPreset[] = [
  {
    id: "shirt-kids",
    label: "Camisa Infantil",
    category: "Tecido",
    widthMm: 180,
    heightMm: 240,
    intent: "Estampa menor para camisa infantil, com margem para ajuste na peça.",
    recommendedSheet: "a4"
  },
  {
    id: "shirt-pp",
    label: "Camisa PP",
    category: "Tecido",
    widthMm: 190,
    heightMm: 260,
    intent: "Estampa PP para frente de camisa com proporção vertical segura.",
    recommendedSheet: "a4"
  },
  {
    id: "shirt-a4",
    label: "Camisa P",
    category: "Tecido",
    widthMm: 200,
    heightMm: 287,
    intent: "Estampa frontal P em A4, boa para frente compacta.",
    recommendedSheet: "a4"
  },
  {
    id: "shirt-m",
    label: "Camisa M",
    category: "Tecido",
    widthMm: 240,
    heightMm: 330,
    intent: "Estampa média; use A3 quando quiser mais presença na frente.",
    recommendedSheet: "a3"
  },
  {
    id: "shirt-g",
    label: "Camisa G",
    category: "Tecido",
    widthMm: 270,
    heightMm: 380,
    intent: "Estampa grande para frente cheia, recomendada em folha A3.",
    recommendedSheet: "a3"
  },
  {
    id: "shirt-a3",
    label: "Camisa GG",
    category: "Tecido",
    widthMm: 287,
    heightMm: 410,
    intent: "Estampa GG para frente cheia ou costas, melhor em A3.",
    recommendedSheet: "a3"
  },
  {
    id: "mug-11oz",
    label: "Caneca 11 oz",
    category: "Sublimação",
    widthMm: 205,
    heightMm: 90,
    intent: "Arte panorâmica com respiro lateral e espelhamento recomendado.",
    recommendedSheet: "a4"
  },
  {
    id: "keychain",
    label: "Chaveiro",
    category: "Sublimação",
    widthMm: 50,
    heightMm: 50,
    intent: "Arte pequena para chaveiro; duplique na folha para produção em lote.",
    recommendedSheet: "a4"
  },
  {
    id: "tile-15",
    label: "Azulejo 15 x 15",
    category: "Cerâmica",
    widthMm: 150,
    heightMm: 150,
    intent: "Arte quadrada com sangria para bordas limpas.",
    recommendedSheet: "a4"
  },
  {
    id: "slipper-pair",
    label: "Chinelo - par",
    category: "Sublimação",
    widthMm: 260,
    heightMm: 100,
    intent: "Base editável para par de chinelos; confirme a medida do molde usado.",
    recommendedSheet: "a4"
  },
  {
    id: "mousepad",
    label: "Mousepad",
    category: "Sublimação",
    widthMm: 220,
    heightMm: 180,
    intent: "Base editável para mousepad; confirme a medida do produto real.",
    recommendedSheet: "a4"
  },
  {
    id: "ecobag",
    label: "Ecobag",
    category: "Tecido",
    widthMm: 280,
    heightMm: 330,
    intent: "Estampa ampla para ecobag; recomenda A3 e prova de posicionamento.",
    recommendedSheet: "a3"
  },
  {
    id: "custom",
    label: "Medida livre",
    category: "Livre",
    widthMm: 100,
    heightMm: 100,
    intent: "Tamanho manual para trabalhos fora dos presets.",
    recommendedSheet: "a4"
  }
];

export const sheetPresets: SheetPreset[] = [
  { id: "a4", label: "A4 - 210 x 297 mm", widthMm: 210, heightMm: 297 },
  { id: "a3", label: "A3 - 297 x 420 mm", widthMm: 297, heightMm: 420 },
  {
    id: "sublimation-30x40",
    label: "Sublimação - 300 x 400 mm",
    widthMm: 300,
    heightMm: 400
  }
];

export const fitModeLabels: Record<FitMode, string> = {
  contain: "Preservar tudo",
  cover: "Preencher área",
  repeat: "Repetir padrão"
};

export const dpiOptions = [150, 200, 300] as const;

export const mmToPx = (mm: number, dpi: number) => Math.round((mm / 25.4) * dpi);

export const pxToMm = (px: number, dpi: number) => (px / dpi) * 25.4;
