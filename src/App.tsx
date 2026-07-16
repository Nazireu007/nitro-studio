import { ChangeEvent, DragEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  BadgeCheck,
  Brain,
  Check,
  ClipboardCheck,
  Copy,
  Coffee,
  Download,
  Eye,
  FileText,
  FileType,
  FlipHorizontal2,
  FlipVertical2,
  Grid3X3,
  Image,
  ImagePlus,
  Images,
  Layers,
  Maximize,
  Move,
  Palette,
  Plus,
  Printer,
  Redo2,
  RotateCw,
  RotateCcw,
  Save,
  Scissors,
  Sparkles,
  Target,
  Trash2,
  WandSparkles,
  Shirt,
  Upload
} from "lucide-react";
import { getImageInsights, loadImageFile, SourceImage } from "./lib/analysis";
import {
  DestinationPreset,
  destinationPresets,
  dpiOptions,
  fitModeLabels,
  FitMode,
  SheetId,
  sheetPresets
} from "./lib/printPresets";
import { createPrintPlan } from "./lib/printPlan";
import { downloadCanvasPng, renderPrintCanvas } from "./lib/renderPrint";
import { FontRecord } from "./fonts/FontCatalog";
import { FontManager } from "./fonts/FontManager";
import { hasLowTextContrast, improveContrast, strengthenOutline } from "./text/TextEffects";
import { fillTextWidth, fitTextInsideArea } from "./text/TextFitEngine";
import { applyLetteringPreset, letteringPresets, presetCategories, LetteringPresetCategory } from "./text/TextPresetRegistry";
import {
  addTextObject,
  deleteTextObject,
  duplicateTextObject,
  resizeTextObject,
  updateTextObject
} from "./text/TextController";
import { normalizeTextObject, TEXT_PLACEHOLDER, TextCurveMode, TextEffectPreset, TextObject } from "./text/TextModel";
import { clampTextToSheet, getPrintableText, hasWeakOutlineForPrint, isTextOutsideSheet } from "./text/TypographyService";

type Settings = {
  destinationId: DestinationPreset["id"];
  sheetId: SheetId;
  sheetRotationDeg: 0 | 90 | 180 | 270;
  fitMode: FitMode;
  dpi: number;
  bleedMm: number;
  marginMm: number;
  gapMm: number;
  copies: number;
  customWidthMm: number;
  customHeightMm: number;
  measureUnit: "mm" | "cm" | "in";
  lockMeasureRatio: boolean;
  cropTop: number;
  cropRight: number;
  cropBottom: number;
  cropLeft: number;
  imageScale: number;
  imageScaleX: number;
  imageScaleY: number;
  offsetXmm: number;
  offsetYmm: number;
  rotationDeg: number;
  flipVertical: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  showGuides: boolean;
  cutMarks: boolean;
  safeArea: boolean;
  technicalLabel: boolean;
  exportFormat: "png" | "pdf";
  mirror: boolean;
  printerConfigured: boolean;
  printerModel: string;
  printProduct: string;
  paperType: string;
  printQuality: string;
  borderless: boolean;
  driverScale: number;
  printOrientation: "auto" | "portrait" | "landscape";
};

const initialSettings: Settings = {
  destinationId: "mug-11oz",
  sheetId: "a4",
  sheetRotationDeg: 0,
  fitMode: "contain",
  dpi: 300,
  bleedMm: 2,
  marginMm: 6,
  gapMm: 4,
  copies: 1,
  customWidthMm: 100,
  customHeightMm: 100,
  measureUnit: "cm",
  lockMeasureRatio: true,
  cropTop: 0,
  cropRight: 0,
  cropBottom: 0,
  cropLeft: 0,
  imageScale: 1,
  imageScaleX: 1,
  imageScaleY: 1,
  offsetXmm: 0,
  offsetYmm: 0,
  rotationDeg: 0,
  flipVertical: false,
  brightness: 100,
  contrast: 108,
  saturation: 112,
  showGuides: true,
  cutMarks: true,
  safeArea: true,
  technicalLabel: true,
  exportFormat: "pdf",
  mirror: true,
  printerConfigured: false,
  printerModel: "",
  printProduct: "Camisa branca",
  paperType: "Papel sublimático",
  printQuality: "Alta / melhor foto",
  borderless: false,
  driverScale: 100,
  printOrientation: "auto"
};

const SETTINGS_STORAGE_KEY = "nitro-studio-settings";
const RECENT_PROJECTS_STORAGE_KEY = "nitro-studio-recent-projects";
const PRODUCT_USAGE_STORAGE_KEY = "nitro-studio-product-usage";
const FONT_PREFS_STORAGE_KEY = "nitro-studio-font-preferences";
const WORKSPACE_AUTOSAVE_STORAGE_KEY = "nitro-studio-workspace-autosave";

const normalizeSettings = (settings: Partial<Settings>): Settings => {
  const next = {
    ...initialSettings,
    ...settings
  };
  const validSheetRotations: Settings["sheetRotationDeg"][] = [0, 90, 180, 270];
  const validMeasureUnits: Settings["measureUnit"][] = ["mm", "cm", "in"];

  return {
    ...next,
    sheetRotationDeg: validSheetRotations.includes(next.sheetRotationDeg) ? next.sheetRotationDeg : 0,
    measureUnit: validMeasureUnits.includes(next.measureUnit) ? next.measureUnit : "cm",
    lockMeasureRatio: next.lockMeasureRatio !== false,
    printOrientation: ["auto", "portrait", "landscape"].includes(next.printOrientation) ? next.printOrientation : "auto",
    driverScale: Number.isFinite(next.driverScale) ? next.driverScale : 100,
    borderless: Boolean(next.borderless),
    printerConfigured: Boolean(next.printerConfigured && next.printerModel)
  };
};

const loadInitialSettings = (): Settings => {
  if (typeof window === "undefined") return initialSettings;

  try {
    const savedSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!savedSettings) return initialSettings;
    return normalizeSettings(JSON.parse(savedSettings) as Partial<Settings>);
  } catch {
    return initialSettings;
  }
};

const loadRecentProjects = (): RecentProject[] => {
  if (typeof window === "undefined") return [];

  try {
    const savedProjects = window.localStorage.getItem(RECENT_PROJECTS_STORAGE_KEY);
    if (!savedProjects) return [];
    const parsed = JSON.parse(savedProjects) as RecentProject[];
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
};

const loadProductUsage = (): ProductUsage => {
  if (typeof window === "undefined") return {};

  try {
    const savedUsage = window.localStorage.getItem(PRODUCT_USAGE_STORAGE_KEY);
    if (!savedUsage) return {};
    const parsed = JSON.parse(savedUsage) as ProductUsage;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const isUneditedPlaceholderText = (text: TextObject) => {
  const content = text.content.replace(/\s+/g, " ").trim();
  return content === TEXT_PLACEHOLDER;
};

const cleanupPlaceholderTexts = (items: TextObject[], keepId?: string | null) => {
  const placeholders = items.filter(isUneditedPlaceholderText);
  if (!placeholders.length) return items;

  const realTexts = items.filter((item) => !isUneditedPlaceholderText(item));
  const explicitPlaceholder = keepId ? placeholders.find((item) => item.id === keepId) : null;
  if (realTexts.length) {
    return explicitPlaceholder ? [...realTexts, explicitPlaceholder] : realTexts;
  }

  if (placeholders.length <= 1) return items;

  const keepPlaceholder =
    explicitPlaceholder ??
    placeholders[placeholders.length - 1];

  return items.filter((item) => !isUneditedPlaceholderText(item) || item.id === keepPlaceholder.id);
};

const loadAutosavedTextObjects = (): TextObject[] => {
  if (typeof window === "undefined") return [];

  try {
    const savedWorkspace = window.localStorage.getItem(WORKSPACE_AUTOSAVE_STORAGE_KEY);
    if (!savedWorkspace) return [];
    const parsed = JSON.parse(savedWorkspace) as { textObjects?: TextObject[] };
    return Array.isArray(parsed.textObjects)
      ? cleanupPlaceholderTexts(parsed.textObjects.map((text) => normalizeTextObject(text)))
      : [];
  } catch {
    return [];
  }
};

const destinationIcons: Record<DestinationPreset["id"], string> = {
  "mug-11oz": "11oz",
  "shirt-kids": "INF",
  "shirt-pp": "PP",
  "shirt-a4": "P",
  "shirt-m": "M",
  "shirt-g": "G",
  "shirt-a3": "GG",
  keychain: "CHV",
  "tile-15": "15",
  "slipper-pair": "CH",
  mousepad: "MP",
  ecobag: "ECO",
  custom: "mm"
};

const fitIcons: Record<FitMode, typeof Maximize> = {
  contain: Maximize,
  cover: Eye,
  repeat: Grid3X3
};

type ProjectImage = SourceImage & {
  id: string;
  addedAt: number;
};

type CropArea = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

type ResizeHandle = "top" | "right" | "bottom" | "left" | "top-left" | "top-right" | "bottom-right" | "bottom-left";
type ResizeFrameGeometry = {
  frameLeft: number;
  frameTop: number;
  frameWidth: number;
  frameHeight: number;
  displayLeft: number;
  displayTop: number;
  displayScale: number;
  pageFlipped: boolean;
};

type SmartProfile = {
  id: string;
  label: string;
  product: string;
  destinationId: DestinationPreset["id"];
  fitMode: FitMode;
  bleedMm: number;
  marginMm: number;
  copies: number;
  mirror: boolean;
  note: string;
};

type MissionId = "shirt" | "mug" | "a4" | "edit";
type HomeView = "dashboard" | "mission";

type MissionOption = {
  id: MissionId;
  title: string;
  subtitle: string;
  detail: string;
  icon: typeof Shirt;
};

type RecentProject = {
  id: string;
  name: string;
  destinationId: DestinationPreset["id"];
  destinationLabel: string;
  sheetLabel: string;
  imageCount: number;
  updatedAt: number;
  missionTitle: string;
};

type ProductUsage = Partial<Record<DestinationPreset["id"], number>>;

const smartProfiles: SmartProfile[] = [
  {
    id: "profile-shirt-kids",
    label: "Camisa Infantil",
    product: "Tecido infantil",
    destinationId: "shirt-kids",
    fitMode: "contain",
    bleedMm: 0,
    marginMm: 6,
    copies: 1,
    mirror: true,
    note: "Tamanho menor para peça infantil, com ajuste fino antes de imprimir."
  },
  {
    id: "profile-shirt-pp",
    label: "Camisa PP",
    product: "Tecido",
    destinationId: "shirt-pp",
    fitMode: "contain",
    bleedMm: 0,
    marginMm: 6,
    copies: 1,
    mirror: true,
    note: "Frente compacta com proporção segura para camisa PP."
  },
  {
    id: "profile-shirt-p",
    label: "Camisa P",
    product: "Tecido",
    destinationId: "shirt-a4",
    fitMode: "contain",
    bleedMm: 0,
    marginMm: 6,
    copies: 1,
    mirror: true,
    note: "Preserva a arte e evita corte acidental em estampa frontal P."
  },
  {
    id: "profile-shirt-m",
    label: "Camisa M",
    product: "Tecido",
    destinationId: "shirt-m",
    fitMode: "contain",
    bleedMm: 0,
    marginMm: 7,
    copies: 1,
    mirror: true,
    note: "Área maior para frente de camisa, recomendada em folha A3."
  },
  {
    id: "profile-shirt-g",
    label: "Camisa G",
    product: "Tecido",
    destinationId: "shirt-g",
    fitMode: "contain",
    bleedMm: 0,
    marginMm: 7,
    copies: 1,
    mirror: true,
    note: "Estampa grande com margem de segurança para prensa."
  },
  {
    id: "profile-shirt-gg",
    label: "Camisa GG",
    product: "Tecido",
    destinationId: "shirt-a3",
    fitMode: "contain",
    bleedMm: 0,
    marginMm: 8,
    copies: 1,
    mirror: true,
    note: "Frente cheia ou costas; melhor revisar no simulador antes de imprimir."
  },
  {
    id: "profile-mug",
    label: "Caneca",
    product: "Sublimação",
    destinationId: "mug-11oz",
    fitMode: "cover",
    bleedMm: 2,
    marginMm: 5,
    copies: 1,
    mirror: true,
    note: "Prepara arte panorâmica com espelhamento para transferência."
  },
  {
    id: "profile-keychain",
    label: "Chaveiro",
    product: "Sublimação",
    destinationId: "keychain",
    fitMode: "cover",
    bleedMm: 2,
    marginMm: 5,
    copies: 8,
    mirror: true,
    note: "Monta várias unidades na folha e usa sangria para corte limpo."
  },
  {
    id: "profile-slipper",
    label: "Chinelo",
    product: "Molde",
    destinationId: "slipper-pair",
    fitMode: "contain",
    bleedMm: 2,
    marginMm: 6,
    copies: 1,
    mirror: true,
    note: "Base editável para molde; confirme a medida do chinelo usado."
  },
  {
    id: "profile-mousepad",
    label: "Mousepad",
    product: "Sublimação",
    destinationId: "mousepad",
    fitMode: "cover",
    bleedMm: 3,
    marginMm: 6,
    copies: 1,
    mirror: true,
    note: "Usa preenchimento com sangria para borda limpa."
  },
  {
    id: "profile-tile",
    label: "Azulejo",
    product: "Cerâmica",
    destinationId: "tile-15",
    fitMode: "cover",
    bleedMm: 2,
    marginMm: 6,
    copies: 1,
    mirror: true,
    note: "Quadrado com sangria para acabamento de borda."
  },
  {
    id: "profile-ecobag",
    label: "Ecobag",
    product: "Tecido",
    destinationId: "ecobag",
    fitMode: "contain",
    bleedMm: 0,
    marginMm: 8,
    copies: 1,
    mirror: true,
    note: "Estampa ampla para bolsa; confira centralização na simulação."
  }
];

const missionOptions: MissionOption[] = [
  {
    id: "shirt",
    title: "Preparar uma camisa",
    subtitle: "Perfil de tecido com espelhamento",
    detail: "O Nitro seleciona camisa P em A4, preserva a arte e prepara o assistente para sublimação.",
    icon: Shirt
  },
  {
    id: "mug",
    title: "Preparar uma caneca",
    subtitle: "Arte panorâmica para 11 oz",
    detail: "A folha, a sangria e o preenchimento entram prontos para transferência em caneca.",
    icon: Coffee
  },
  {
    id: "a4",
    title: "Preparar uma folha A4",
    subtitle: "Controle direto da página",
    detail: "Começa em A4, sem espelhamento, para montar, posicionar e imprimir a folha inteira.",
    icon: FileText
  },
  {
    id: "edit",
    title: "Editar uma arte existente",
    subtitle: "Modo livre com ajustes manuais",
    detail: "Abre o Nitro como editor de arte, mantendo corte, tamanho, cor e exportação à mão.",
    icon: Image
  }
];

const createImageId = () => `img-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));
const clampScale = (value: number) => Math.max(0.2, Math.min(4, value));
const clampNumber = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const measureUnitLabels: Record<Settings["measureUnit"], string> = {
  mm: "mm",
  cm: "cm",
  in: "pol"
};
const measureToMm = (value: number, unit: Settings["measureUnit"]) =>
  unit === "cm" ? value * 10 : unit === "in" ? value * 25.4 : value;
const mmToMeasure = (value: number, unit: Settings["measureUnit"]) =>
  unit === "cm" ? value / 10 : unit === "in" ? value / 25.4 : value;
const formatMeasure = (value: number, unit: Settings["measureUnit"]) =>
  Number(mmToMeasure(value, unit).toFixed(unit === "mm" ? 0 : 2));
const formatDashboardDate = (timestamp: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(timestamp);
const sheetRotationLabels: Record<Settings["sheetRotationDeg"], string> = {
  0: "Retrato",
  90: "Paisagem",
  180: "Retrato invertido",
  270: "Paisagem invertida"
};
const textColorPalette = [
  "#111827",
  "#ffffff",
  "#dc2626",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#0f766e",
  "#38bdf8",
  "#2563eb",
  "#7c3aed",
  "#ec4899",
  "#92400e"
];

type TextStyleDraft = {
  fontFamily: string;
  color: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  curveMode: TextCurveMode;
  effectPreset: TextEffectPreset;
};

type TextStyleDirty = Partial<Record<keyof TextStyleDraft, boolean>>;

export const App = () => {
  const [images, setImages] = useState<ProjectImage[]>([]);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [checkedImageIds, setCheckedImageIds] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(loadInitialSettings);
  const [homeView, setHomeView] = useState<HomeView>("dashboard");
  const [activeMission, setActiveMission] = useState<MissionId | null>(null);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(loadRecentProjects);
  const [checkedRecentProjectIds, setCheckedRecentProjectIds] = useState<string[]>([]);
  const [productUsage, setProductUsage] = useState<ProductUsage>(loadProductUsage);
  const [history, setHistory] = useState<Settings[]>([]);
  const [redoHistory, setRedoHistory] = useState<Settings[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [cropDrag, setCropDrag] = useState<{ startX: number; startY: number } | null>(null);
  const [positionDrag, setPositionDrag] = useState<{
    startX: number;
    startY: number;
    originXmm: number;
    originYmm: number;
  } | null>(null);
  const [resizeDrag, setResizeDrag] = useState<{
    handle: ResizeHandle;
    startX: number;
    startY: number;
    originScaleX: number;
    originScaleY: number;
    originOffsetXmm: number;
    originOffsetYmm: number;
    originFrameWidthPx: number;
    originFrameHeightPx: number;
    displayScale: number;
    pageFlipped: boolean;
  } | null>(null);
  const [textObjects, setTextObjects] = useState<TextObject[]>(loadAutosavedTextObjects);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [isTextToolsOpen, setIsTextToolsOpen] = useState(false);
  const [textStyleDraft, setTextStyleDraft] = useState<TextStyleDraft | null>(null);
  const [textStyleDirty, setTextStyleDirty] = useState<TextStyleDirty>({});
  const [textHistory, setTextHistory] = useState<TextObject[][]>([]);
  const [textRedoHistory, setTextRedoHistory] = useState<TextObject[][]>([]);
  const [textDrag, setTextDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [textResizeDrag, setTextResizeDrag] = useState<{
    id: string;
    startX: number;
    originWidth: number;
    originFontSize: number;
  } | null>(null);
  const [fonts, setFonts] = useState<FontRecord[]>([]);
  const [fontSearch, setFontSearch] = useState("");
  const [fontCategory, setFontCategory] = useState<string>("Todas");
  const [letteringDraft, setLetteringDraft] = useState("Meu letreiro");
  const [letteringCategory, setLetteringCategory] = useState<LetteringPresetCategory>("Sublimação");
  const [lastAutosaveAt, setLastAutosaveAt] = useState<number | null>(null);
  const [pendingCrop, setPendingCrop] = useState<CropArea | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const printPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const quickFileInputRef = useRef<HTMLInputElement | null>(null);
  const fontFileInputRef = useRef<HTMLInputElement | null>(null);
  const fontManagerRef = useRef(new FontManager());
  const imagesRef = useRef<ProjectImage[]>([]);
  const settingsRef = useRef(settings);
  const textObjectsRef = useRef(textObjects);
  const selectedTextIdRef = useRef(selectedTextId);
  const [previewBounds, setPreviewBounds] = useState({ width: 920, height: 680 });
  const [currentPreviewScale, setCurrentPreviewScale] = useState(1);
  const [paperZoomPercent, setPaperZoomPercent] = useState(100);
  const sourceImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) ?? images[0] ?? null,
    [images, selectedImageId]
  );
  const checkedImages = useMemo(
    () => checkedImageIds.map((id) => images.find((image) => image.id === id)).filter((image): image is ProjectImage => Boolean(image)),
    [checkedImageIds, images]
  );
  const montageImages = checkedImages.length > 1 ? checkedImages : [];
  const selectedText = useMemo(
    () => textObjects.find((item) => item.id === selectedTextId) ?? null,
    [selectedTextId, textObjects]
  );
  const hasPendingTextStyle = Object.values(textStyleDirty).some(Boolean);
  const activeTextStyle = textStyleDraft ?? (selectedText
    ? {
        fontFamily: selectedText.fontFamily,
        color: selectedText.color,
        fontSize: selectedText.fontSize,
        bold: selectedText.bold,
        italic: selectedText.italic,
        curveMode: selectedText.curve.mode,
        effectPreset: selectedText.effectPreset
      }
    : null);

  const syncTextStyleDraft = (text: TextObject | null) => {
    setTextStyleDraft(text
      ? {
          fontFamily: text.fontFamily,
          color: text.color,
          fontSize: text.fontSize,
          bold: text.bold,
          italic: text.italic,
          curveMode: text.curve.mode,
          effectPreset: text.effectPreset
        }
      : null
    );
    setTextStyleDirty({});
  };

  const updateTextStyleDraft = <Key extends keyof TextStyleDraft>(key: Key, value: TextStyleDraft[Key]) => {
    setTextStyleDraft((current) => current ? { ...current, [key]: value } : current);
    setTextStyleDirty((current) => ({ ...current, [key]: true }));
  };

  useEffect(() => {
    if (selectedTextId && !selectedText) {
      setSelectedTextId(null);
      setEditingTextId(null);
      setIsTextToolsOpen(false);
    }
  }, [selectedText, selectedTextId]);

  useEffect(() => {
    syncTextStyleDraft(selectedText);
  }, [selectedText?.id]);

  useEffect(() => {
    setCheckedImageIds((current) => {
      const validIds = new Set(images.map((image) => image.id));
      const next = current.filter((id) => validIds.has(id));
      return next.length === current.length ? current : next;
    });
    if (selectedImageId && !images.some((image) => image.id === selectedImageId)) {
      setSelectedImageId(images[0]?.id ?? null);
    }
  }, [images, selectedImageId]);

  const fontCategories = useMemo(() => ["Todas", "Favoritas", "Recentes", "Minhas fontes", ...Array.from(new Set(fonts.map((font) => font.category)))], [fonts]);
  const filteredFonts = useMemo(() => {
    const search = fontSearch.trim().toLowerCase();
    return fonts
      .filter((font) => {
        if (fontCategory === "Favoritas" && !font.favorite) return false;
        if (fontCategory === "Recentes" && !font.lastUsedAt) return false;
        if (fontCategory === "Minhas fontes" && font.source !== "imported") return false;
        if (!["Todas", "Favoritas", "Recentes", "Minhas fontes"].includes(fontCategory) && font.category !== fontCategory) return false;
        return !search || font.name.toLowerCase().includes(search) || font.family.toLowerCase().includes(search);
      })
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0) || a.name.localeCompare(b.name));
  }, [fontCategory, fontSearch, fonts]);
  const visibleLetteringPresets = useMemo(
    () => letteringPresets.filter((preset) => preset.category === letteringCategory),
    [letteringCategory]
  );
  const currentMission = useMemo(
    () => missionOptions.find((mission) => mission.id === activeMission) ?? null,
    [activeMission]
  );
  const mostUsedProducts = useMemo(() => {
    const rankedProducts = destinationPresets
      .filter((item) => item.id !== "custom")
      .map((item) => ({ item, count: productUsage[item.id] ?? 0 }))
      .sort((a, b) => b.count - a.count);
    return rankedProducts.filter((entry) => entry.count > 0).slice(0, 3);
  }, [productUsage]);
  const favoriteProduct = mostUsedProducts[0]?.item ?? destinationPresets.find((item) => item.id === settings.destinationId) ?? destinationPresets[0];
  const autosaveLabel = lastAutosaveAt
    ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(lastAutosaveAt)
    : "Ativo";
  const visibleCrop = pendingCrop ?? {
    top: settings.cropTop,
    right: settings.cropRight,
    bottom: settings.cropBottom,
    left: settings.cropLeft
  };

  const croppedImageSize = useMemo(() => {
    if (!sourceImage) return null;
    const cropWidthPercent = Math.min(92, settings.cropLeft + settings.cropRight);
    const cropHeightPercent = Math.min(92, settings.cropTop + settings.cropBottom);
    return {
      width: Math.max(1, Math.round(sourceImage.width * (1 - cropWidthPercent / 100))),
      height: Math.max(1, Math.round(sourceImage.height * (1 - cropHeightPercent / 100)))
    };
  }, [settings.cropBottom, settings.cropLeft, settings.cropRight, settings.cropTop, sourceImage]);

  const destination = useMemo(
    () => {
      const selected = destinationPresets.find((item) => item.id === settings.destinationId) ?? destinationPresets[0];
      if (selected.id !== "custom") return selected;

      return {
        ...selected,
        widthMm: settings.customWidthMm,
        heightMm: settings.customHeightMm
      };
    },
    [settings.customHeightMm, settings.customWidthMm, settings.destinationId]
  );

  const sheet = useMemo(
    () => {
      const selectedSheet = sheetPresets.find((item) => item.id === settings.sheetId) ?? sheetPresets[0];
      const isLandscapeTurn = settings.sheetRotationDeg === 90 || settings.sheetRotationDeg === 270;

      if (!isLandscapeTurn) return selectedSheet;

      return {
        ...selectedSheet,
        label: `${selectedSheet.label} · paisagem`,
        widthMm: selectedSheet.heightMm,
        heightMm: selectedSheet.widthMm
      };
    },
    [settings.sheetId, settings.sheetRotationDeg]
  );

  const plan = useMemo(() => {
    if (!sourceImage && !textObjects.length) return null;
    const fallbackSize = Math.max(600, Math.round(settings.dpi * 4));
    return createPrintPlan({
      imageWidth: croppedImageSize?.width ?? fallbackSize,
      imageHeight: croppedImageSize?.height ?? fallbackSize,
      destination,
      sheet,
      fitMode: settings.fitMode,
      dpi: settings.dpi,
      bleedMm: settings.bleedMm,
      marginMm: settings.marginMm,
      gapMm: settings.gapMm,
      copies: settings.copies,
      imageScale: settings.imageScale,
      imageScaleX: settings.imageScaleX,
      imageScaleY: settings.imageScaleY,
      mirror: settings.mirror
    });
  }, [croppedImageSize, destination, settings, sheet, sourceImage, textObjects.length]);

  const resizeFrameGeometry = useMemo<ResizeFrameGeometry | null>(() => {
    if (!plan || montageImages.length > 1) return null;

    const displayScale = currentPreviewScale || 1;
    const placement = plan.placements[0] ?? plan.targetPx;
    const imageRect = settings.fitMode === "repeat"
      ? placement
      : {
          x: placement.x + (plan.imagePx.x - plan.targetPx.x),
          y: placement.y + (plan.imagePx.y - plan.targetPx.y),
          width: plan.imagePx.width,
          height: plan.imagePx.height
        };
    const centerX = placement.x + placement.width / 2 + (settings.offsetXmm / 25.4) * plan.dpi;
    const centerY = placement.y + placement.height / 2 + (settings.offsetYmm / 25.4) * plan.dpi;
    const scaleX = settings.imageScale * settings.imageScaleX;
    const scaleY = settings.imageScale * settings.imageScaleY;
    const width = imageRect.width * Math.abs(scaleX);
    const height = imageRect.height * Math.abs(scaleY);
    const rawLeft = centerX + (imageRect.x - (placement.x + placement.width / 2)) * scaleX;
    const rawTop = centerY + (imageRect.y - (placement.y + placement.height / 2)) * scaleY;
    const clipLeft = placement.x;
    const clipTop = placement.y;
    const clipRight = placement.x + placement.width;
    const clipBottom = placement.y + placement.height;
    const visibleLeft = clampNumber(rawLeft, clipLeft, clipRight);
    const visibleTop = clampNumber(rawTop, clipTop, clipBottom);
    const visibleRight = clampNumber(rawLeft + width, clipLeft, clipRight);
    const visibleBottom = clampNumber(rawTop + height, clipTop, clipBottom);
    const frameLeft = visibleRight > visibleLeft ? visibleLeft : clipLeft;
    const frameTop = visibleBottom > visibleTop ? visibleTop : clipTop;
    const frameWidth = Math.max(18 / displayScale, visibleRight - visibleLeft || placement.width);
    const frameHeight = Math.max(18 / displayScale, visibleBottom - visibleTop || placement.height);
    const pageFlipped = settings.sheetRotationDeg === 180 || settings.sheetRotationDeg === 270;

    return {
      frameLeft,
      frameTop,
      frameWidth,
      frameHeight,
      displayLeft: pageFlipped ? plan.sheetPx.width - frameLeft - frameWidth : frameLeft,
      displayTop: pageFlipped ? plan.sheetPx.height - frameTop - frameHeight : frameTop,
      displayScale,
      pageFlipped
    };
  }, [
    currentPreviewScale,
    montageImages.length,
    plan,
    settings.fitMode,
    settings.imageScale,
    settings.imageScaleX,
    settings.imageScaleY,
    settings.offsetXmm,
    settings.offsetYmm,
    settings.sheetRotationDeg
  ]);

  const updateSettings = (next: Partial<Settings>) => {
    setSettings((current) => {
      const updated = { ...current, ...next };
      const changed = (Object.keys(next) as Array<keyof Settings>).some((key) => !Object.is(current[key], updated[key]));
      if (!changed) return current;
      setHistory((items) => [current, ...items].slice(0, 10));
      setRedoHistory([]);
      return updated;
    });
  };

  const updateTextObjects = (
    next: TextObject[] | ((current: TextObject[]) => TextObject[]),
    options: { trackHistory?: boolean } = {}
  ) => {
    setTextObjects((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (resolved === current) return current;
      if (options.trackHistory !== false) {
        setTextHistory((items) => [current, ...items].slice(0, 20));
        setTextRedoHistory([]);
      }
      return resolved;
    });
  };

  const persistWorkspace = (
    nextSettings = settingsRef.current,
    nextTextObjects = textObjectsRef.current,
    nextSelectedTextId = selectedTextIdRef.current
  ) => {
    const savedAt = Date.now();
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(nextSettings));
    window.localStorage.setItem(
      WORKSPACE_AUTOSAVE_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        savedAt,
        settings: nextSettings,
        textObjects: cleanupPlaceholderTexts(nextTextObjects, nextSelectedTextId)
      })
    );
    setLastAutosaveAt(savedAt);
  };

  const saveWorkspaceNow = (showMessage = true) => {
    try {
      persistWorkspace(settings, textObjects, selectedTextId);
      if (showMessage) setMessage("Workspace salvo automaticamente neste navegador.");
    } catch {
      if (showMessage) setMessage("Não consegui salvar no navegador. Verifique espaço ou permissões.");
    }
  };

  const undo = () => {
    const [previousTexts, ...textRest] = textHistory;
    if (previousTexts) {
      setTextObjects((current) => {
        setTextRedoHistory((items) => [current, ...items].slice(0, 20));
        setTextHistory(textRest);
        return previousTexts;
      });
      return;
    }

    const [previous, ...rest] = history;
    if (!previous) return;
    setSettings((current) => {
      setRedoHistory((items) => [current, ...items].slice(0, 10));
      setHistory(rest);
      return previous;
    });
  };

  const redo = () => {
    const [nextTexts, ...textRest] = textRedoHistory;
    if (nextTexts) {
      setTextObjects((current) => {
        setTextHistory((items) => [current, ...items].slice(0, 20));
        setTextRedoHistory(textRest);
        return nextTexts;
      });
      return;
    }

    const [next, ...rest] = redoHistory;
    if (!next) return;
    setSettings((current) => {
      setHistory((items) => [current, ...items].slice(0, 10));
      setRedoHistory(rest);
      return next;
    });
  };

  const updateSheetRotation = (sheetRotationDeg: Settings["sheetRotationDeg"]) => {
    const printOrientation =
      sheetRotationDeg === 90 || sheetRotationDeg === 270
        ? "landscape"
        : "portrait";

    updateSettings({
      sheetRotationDeg,
      printOrientation
    });
    setMessage(`Papel em ${sheetRotationLabels[sheetRotationDeg]}.`);
  };

  const getRenderOptions = (previewScale?: number, includeText = true) => ({
    sourceUrl: sourceImage?.url ?? "",
    montageSources: montageImages.map((image) => ({
      url: image.url,
      name: image.name
    })),
    fitMode: settings.fitMode,
    mirror: settings.mirror,
    transform: {
      scale: settings.imageScale,
      scaleX: settings.imageScaleX,
      scaleY: settings.imageScaleY,
      offsetX: settings.offsetXmm,
      offsetY: settings.offsetYmm,
      rotation: settings.rotationDeg,
      flipVertical: settings.flipVertical
    },
    color: {
      brightness: settings.brightness,
      contrast: settings.contrast,
      saturation: settings.saturation
    },
    crop: {
      top: settings.cropTop,
      right: settings.cropRight,
      bottom: settings.cropBottom,
      left: settings.cropLeft
    },
    production: {
      showGuides: settings.showGuides,
      cutMarks: settings.cutMarks,
      safeArea: settings.safeArea,
      technicalLabel: settings.technicalLabel
    },
    pageRotationDeg: (settings.sheetRotationDeg === 180 || settings.sheetRotationDeg === 270 ? 180 : 0) as 0 | 180,
    previewScale,
    textObjects: includeText ? textObjects : []
  });

  const resetCrop = () => {
    setPendingCrop(null);
    updateSettings({
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      cropLeft: 0
    });
  };

  const getCropPoint = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
      y: clampPercent(((event.clientY - rect.top) / rect.height) * 100)
    };
  };

  const buildCropArea = (startX: number, startY: number, endX: number, endY: number): CropArea => {
    const minSize = 6;
    let left = Math.min(startX, endX);
    let rightEdge = Math.max(startX, endX);
    let top = Math.min(startY, endY);
    let bottomEdge = Math.max(startY, endY);

    if (rightEdge - left < minSize) {
      rightEdge = Math.min(100, left + minSize);
      left = Math.max(0, rightEdge - minSize);
    }

    if (bottomEdge - top < minSize) {
      bottomEdge = Math.min(100, top + minSize);
      top = Math.max(0, bottomEdge - minSize);
    }

    return {
      top: Math.round(top),
      right: Math.round(100 - rightEdge),
      bottom: Math.round(100 - bottomEdge),
      left: Math.round(left)
    };
  };

  const setCropArea = (startX: number, startY: number, endX: number, endY: number) => {
    setPendingCrop(buildCropArea(startX, startY, endX, endY));
  };

  const applySelectedCrop = () => {
    if (!pendingCrop) return;
    updateSettings({
      cropTop: pendingCrop.top,
      cropRight: pendingCrop.right,
      cropBottom: pendingCrop.bottom,
      cropLeft: pendingCrop.left
    });
    setPendingCrop(null);
    setMessage("Corte aplicado à arte.");
  };

  const handleCropPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!sourceImage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCropPoint(event);
    setHistory((items) => [settings, ...items].slice(0, 10));
    setCropDrag({ startX: point.x, startY: point.y });
    setCropArea(point.x, point.y, point.x, point.y);
  };

  const handleCropPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!cropDrag) return;
    const point = getCropPoint(event);
    setCropArea(cropDrag.startX, cropDrag.startY, point.x, point.y);
  };

  const handleCropPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!cropDrag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setCropDrag(null);
    setMessage("Área de interesse aplicada ao corte.");
  };

  const applySmartCrop = () => {
    if (!sourceImage) return;
    const imageRatio = sourceImage.width / sourceImage.height;
    const targetRatio = destination.widthMm / destination.heightMm;

    if (Math.abs(imageRatio - targetRatio) < 0.02) {
      resetCrop();
      setMessage("A arte já está próxima da proporção do destino.");
      return;
    }

    if (imageRatio > targetRatio) {
      const newWidth = sourceImage.height * targetRatio;
      const cropTotal = Math.min(60, Math.max(0, (1 - newWidth / sourceImage.width) * 100));
      updateSettings({
        cropLeft: Math.round(cropTotal / 2),
        cropRight: Math.round(cropTotal / 2),
        cropTop: 0,
        cropBottom: 0
      });
    } else {
      const newHeight = sourceImage.width / targetRatio;
      const cropTotal = Math.min(60, Math.max(0, (1 - newHeight / sourceImage.height) * 100));
      updateSettings({
        cropTop: Math.round(cropTotal / 2),
        cropBottom: Math.round(cropTotal / 2),
        cropLeft: 0,
        cropRight: 0
      });
    }

    setMessage("Corte inteligente aplicado à proporção do destino.");
    setPendingCrop(null);
  };

  const applyNitroPlan = () => {
    if (!sourceImage && !textObjects.length) {
      setMessage("Importe uma arte ou adicione um texto para o Nitro preparar o plano.");
      quickFileInputRef.current?.click();
      return;
    }

    const imageRatio = croppedImageSize ? croppedImageSize.width / croppedImageSize.height : destination.widthMm / destination.heightMm;
    const targetRatio = destination.widthMm / destination.heightMm;
    const ratioDelta = Math.abs(imageRatio - targetRatio) / targetRatio;
    const nextFitMode: FitMode = ratioDelta < 0.18 ? "cover" : "contain";

    updateSettings({
      sheetId: destination.recommendedSheet,
      fitMode: nextFitMode,
      dpi: sourceImage && sourceImage.width * sourceImage.height < 1_800_000 ? 200 : settings.dpi,
      bleedMm: destination.category === "Tecido" ? 0 : 2,
      marginMm: destination.id === "shirt-a3" ? 8 : 6,
      gapMm: destination.id === "mug-11oz" ? 6 : 4,
      copies: plan?.maxCopies ? Math.min(plan.maxCopies, destination.id === "custom" || destination.id === "tile-15" ? plan.maxCopies : 1) : 1,
      imageScale: 1,
      imageScaleX: 1,
      imageScaleY: 1,
      offsetXmm: 0,
      offsetYmm: 0,
      rotationDeg: 0,
      flipVertical: false,
      mirror: destination.category !== "Livre",
      showGuides: true,
      cutMarks: true,
      safeArea: true,
      technicalLabel: true
    });
    setMessage("Plano Nitro aplicado.");
  };

  const handleFiles = async (files: FileList | null) => {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setMessage("Escolha um arquivo de imagem.");
      return;
    }

    try {
      setMessage(null);
      const loadedImages = await Promise.all(
        imageFiles.map(async (file) => ({
          ...(await loadImageFile(file)),
          id: createImageId(),
          addedAt: Date.now()
        }))
      );
      setImages((current) => [...current, ...loadedImages]);
      setSelectedImageId(loadedImages[0]?.id ?? null);
      setCheckedImageIds((current) => [...new Set([...current, ...loadedImages.map((image) => image.id)])]);
      resetCrop();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui abrir o arquivo.");
    }
  };

  const handleFileInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    void handleFiles(event.target.files);
    event.target.value = "";
  };

  const deleteSelectedImage = () => {
    const idsToDelete = checkedImageIds.length ? checkedImageIds : sourceImage ? [sourceImage.id] : [];
    if (!idsToDelete.length) return;
    setImages((current) => {
      const deleted = current.filter((image) => idsToDelete.includes(image.id));
      const next = current.filter((image) => !idsToDelete.includes(image.id));
      deleted.forEach((image) => URL.revokeObjectURL(image.url));
      setSelectedImageId(next[0]?.id ?? null);
      return next;
    });
    setCheckedImageIds([]);
    resetCrop();
    setMessage(idsToDelete.length > 1 ? "Imagens selecionadas removidas." : "Imagem removida do projeto.");
  };

  const clearImages = () => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.url));
      return [];
    });
    setSelectedImageId(null);
    setCheckedImageIds([]);
    resetCrop();
  };

  const selectImage = (imageId: string) => {
    setSelectedImageId(imageId);
    resetCrop();
  };

  const toggleCheckedImage = (imageId: string) => {
    setCheckedImageIds((current) =>
      current.includes(imageId) ? current.filter((id) => id !== imageId) : [...current, imageId]
    );
  };

  const selectAllImages = () => {
    setCheckedImageIds(images.map((image) => image.id));
  };

  const duplicateSelectedImage = async () => {
    if (!sourceImage) return;

    try {
      const blob = await fetch(sourceImage.url).then((response) => response.blob());
      const duplicatedImage: ProjectImage = {
        ...sourceImage,
        id: createImageId(),
        name: `${sourceImage.name.replace(/\.[^.]+$/, "")}-copia.${sourceImage.name.split(".").pop() ?? "png"}`,
        url: URL.createObjectURL(blob),
        addedAt: Date.now()
      };

      setImages((current) => [...current, duplicatedImage]);
      setSelectedImageId(duplicatedImage.id);
      setCheckedImageIds([duplicatedImage.id]);
      setMessage("Imagem duplicada no projeto.");
    } catch {
      setMessage("Não consegui duplicar essa imagem.");
    }
  };

  const centerArtwork = () => {
    updateSettings({
      offsetXmm: 0,
      offsetYmm: 0,
      rotationDeg: 0
    });
    setMessage("Arte centralizada no destino.");
  };

  const stretchArtworkToArea = () => {
    if (!plan) {
      setMessage("Importe uma arte para esticar a área de impressão.");
      quickFileInputRef.current?.click();
      return;
    }
    updateSettings({
      fitMode: "contain",
      imageScaleX: Number(clampScale(plan.targetPx.width / Math.max(1, plan.imagePx.width * settings.imageScale)).toFixed(3)),
      imageScaleY: Number(clampScale(plan.targetPx.height / Math.max(1, plan.imagePx.height * settings.imageScale)).toFixed(3)),
      offsetXmm: 0,
      offsetYmm: 0
    });
    setMessage("Arte esticada para preencher a área de impressão.");
  };

  const stretchArtworkToWholeSheet = () => {
    if (!sourceImage || !croppedImageSize) {
      setMessage("Importe uma arte antes de preencher a folha inteira.");
      quickFileInputRef.current?.click();
      return;
    }

    const sheetWidthPx = Math.max(1, (sheet.widthMm / 25.4) * settings.dpi);
    const sheetHeightPx = Math.max(1, (sheet.heightMm / 25.4) * settings.dpi);
    const fitScale = Math.min(sheetWidthPx / croppedImageSize.width, sheetHeightPx / croppedImageSize.height);
    const fittedWidth = Math.max(1, croppedImageSize.width * fitScale);
    const fittedHeight = Math.max(1, croppedImageSize.height * fitScale);

    updateSettings({
      destinationId: "custom",
      customWidthMm: sheet.widthMm,
      customHeightMm: sheet.heightMm,
      fitMode: "contain",
      bleedMm: 0,
      marginMm: 0,
      gapMm: 0,
      copies: 1,
      imageScale: 1,
      imageScaleX: Number(clampScale(sheetWidthPx / fittedWidth).toFixed(3)),
      imageScaleY: Number(clampScale(sheetHeightPx / fittedHeight).toFixed(3)),
      offsetXmm: 0,
      offsetYmm: 0
    });
    setMessage("Folha inteira preparada. Agora puxe as bordas para ajustar de ponta a ponta.");
  };

  const updateMeasuredArtworkSize = (axis: "width" | "height", rawValue: number) => {
    if (!Number.isFinite(rawValue) || rawValue <= 0) return;

    const currentRatio = destination.widthMm / Math.max(1, destination.heightMm);
    const nextValueMm = clampNumber(measureToMm(rawValue, settings.measureUnit), 1, 1200);
    let nextWidthMm = destination.widthMm;
    let nextHeightMm = destination.heightMm;

    if (axis === "width") {
      nextWidthMm = nextValueMm;
      if (settings.lockMeasureRatio) {
        nextHeightMm = nextWidthMm / Math.max(0.01, currentRatio);
      }
    } else {
      nextHeightMm = nextValueMm;
      if (settings.lockMeasureRatio) {
        nextWidthMm = nextHeightMm * currentRatio;
      }
    }

    updateSettings({
      destinationId: "custom",
      customWidthMm: Number(clampNumber(nextWidthMm, 1, 1200).toFixed(1)),
      customHeightMm: Number(clampNumber(nextHeightMm, 1, 1200).toFixed(1)),
      fitMode: "contain",
      imageScale: 1,
      imageScaleX: 1,
      imageScaleY: 1,
      offsetXmm: 0,
      offsetYmm: 0
    });
    setMessage(`Medida real ajustada para ${formatMeasure(nextWidthMm, settings.measureUnit)} x ${formatMeasure(nextHeightMm, settings.measureUnit)} ${measureUnitLabels[settings.measureUnit]}.`);
  };

  const fitHandlesIntoArea = () => {
    if (!plan) {
      setMessage("Importe uma arte para ajustar as alças.");
      quickFileInputRef.current?.click();
      return;
    }

    updateSettings({
      fitMode: "contain",
      imageScale: 1,
      imageScaleX: 1,
      imageScaleY: 1,
      offsetXmm: 0,
      offsetYmm: 0,
      rotationDeg: 0
    });
    setMessage("Alças reenquadradas dentro da área útil.");
  };

  const handlePreviewPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!plan || montageImages.length > 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setHistory((items) => [settings, ...items].slice(0, 10));
    setRedoHistory([]);
    setPositionDrag({
      startX: event.clientX,
      startY: event.clientY,
      originXmm: settings.offsetXmm,
      originYmm: settings.offsetYmm
    });
  };

  const handlePreviewPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!positionDrag || !plan || !previewCanvasRef.current) return;
    const displayScale = previewCanvasRef.current.clientWidth / plan.sheetPx.width;
    if (!displayScale) return;

    const deltaXmm = ((event.clientX - positionDrag.startX) / displayScale / plan.dpi) * 25.4;
    const deltaYmm = ((event.clientY - positionDrag.startY) / displayScale / plan.dpi) * 25.4;

    setSettings((current) => ({
      ...current,
      offsetXmm: Number((positionDrag.originXmm + deltaXmm).toFixed(1)),
      offsetYmm: Number((positionDrag.originYmm + deltaYmm).toFixed(1))
    }));
  };

  const handlePreviewPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!positionDrag) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setPositionDrag(null);
    setMessage("Posição da arte ajustada no papel.");
  };

  const addTextToSheet = () => {
    const sheetWidth = plan?.sheetPx.width ?? Math.round((sheet.widthMm / 25.4) * settings.dpi);
    const sheetHeight = plan?.sheetPx.height ?? Math.round((sheet.heightMm / 25.4) * settings.dpi);
    const existingPlaceholder = [...textObjects].reverse().find(isUneditedPlaceholderText);

    if (existingPlaceholder) {
      updateTextObjects((current) => cleanupPlaceholderTexts(current, existingPlaceholder.id));
      setSelectedTextId(existingPlaceholder.id);
      setEditingTextId(null);
      setIsTextToolsOpen(true);
      setMessage("Texto em branco selecionado. Edite pela barra sem criar cópias na folha.");
      return;
    }

    const nextTexts = addTextObject(textObjects, sheetWidth, sheetHeight);
    const created = nextTexts[nextTexts.length - 1];
    updateTextObjects(nextTexts);
    setSelectedTextId(created.id);
    setEditingTextId(null);
    setIsTextToolsOpen(true);
    setMessage("Texto adicionado. Edite pela barra ou dê dois cliques na folha para editar direto.");
  };

  const toggleTextTools = () => {
    if (isTextToolsOpen && selectedText) {
      setIsTextToolsOpen(false);
      setMessage("Ferramentas de texto recolhidas.");
      return;
    }

    const textToSelect = selectedText ?? textObjects[textObjects.length - 1] ?? null;
    if (textToSelect) {
      setSelectedTextId(textToSelect.id);
      setEditingTextId(null);
      setIsTextToolsOpen(true);
      setMessage("Ferramentas de texto abertas.");
      return;
    }

    addTextToSheet();
  };

  const createLetteringFromPreset = (presetId: TextEffectPreset, content = letteringDraft) => {
    const sheetWidth = plan?.sheetPx.width ?? Math.round((sheet.widthMm / 25.4) * settings.dpi);
    const sheetHeight = plan?.sheetPx.height ?? Math.round((sheet.heightMm / 25.4) * settings.dpi);
    const typedContent = content.trim() || "Meu letreiro";
    const base = normalizeTextObject({
      ...addTextObject([], sheetWidth, sheetHeight)[0],
      content: typedContent,
      width: Math.round(sheetWidth * 0.62),
      fontSize: Math.max(44, Math.round(sheetWidth * 0.055))
    }, sheetWidth, sheetHeight);
    const created = applyLetteringPreset(base, presetId);
    updateTextObjects((current) => [...current, created]);
    setSelectedTextId(created.id);
    setEditingTextId(null);
    setMessage("Letreiro criado com preset real e totalmente editável.");
  };

  const createLetteringFromWizard = () => {
    const preset = visibleLetteringPresets[0] ?? letteringPresets[0];
    createLetteringFromPreset(preset.id);
  };

  const updateSelectedText = (patch: Partial<TextObject>) => {
    if (!selectedText) return;
    updateTextObjects((current) => updateTextObject(current, selectedText.id, patch));
  };

  const updateSelectedTextContent = (content: string) => {
    if (!selectedText) return;
    setEditingTextId(null);
    const nextTexts = cleanupPlaceholderTexts(updateTextObject(textObjects, selectedText.id, { content }), selectedText.id);
    updateTextObjects(nextTexts, { trackHistory: false });
    try {
      persistWorkspace(settings, nextTexts, selectedText.id);
    } catch {
      // Autosave will retry on the next scheduled pass.
    }
  };

  const deleteSelectedText = () => {
    if (!selectedText) return;
    const nextTexts = deleteTextObject(textObjects, selectedText.id);
    updateTextObjects(nextTexts);
    try {
      persistWorkspace(settings, nextTexts, null);
    } catch {
      setMessage("Texto excluído, mas não consegui atualizar o autosave local.");
    }
    setSelectedTextId(null);
    setEditingTextId(null);
    setIsTextToolsOpen(false);
    syncTextStyleDraft(null);
    setMessage("Texto excluído.");
  };

  const duplicateSelectedText = () => {
    if (!selectedText) return;
    const nextTexts = duplicateTextObject(textObjects, selectedText.id);
    updateTextObjects(nextTexts);
    setSelectedTextId(nextTexts[nextTexts.length - 1]?.id ?? selectedText.id);
    setMessage("Texto duplicado.");
  };

  const fitSelectedTextToArea = () => {
    if (!selectedText || !plan) return;
    updateTextObjects((current) => updateTextObject(current, selectedText.id, fitTextInsideArea(selectedText, plan.targetPx)));
    setMessage("Texto encaixado visualmente na área útil.");
  };

  const fillSelectedTextWidth = () => {
    if (!selectedText || !plan) return;
    const width = Math.round(plan.targetPx.width * 0.9);
    updateSelectedText(fillTextWidth(selectedText, width));
    setMessage("Texto preparado para preencher a largura sem distorcer letras.");
  };

  const applyPresetToSelectedText = (presetId: TextEffectPreset) => {
    if (!selectedText) return;
    updateTextObjects((current) => current.map((item) => (item.id === selectedText.id ? applyLetteringPreset(item, presetId) : item)));
    setMessage("Efeito aplicado como propriedades editáveis do texto.");
  };

  const applyTextStyleDraft = () => {
    if (!selectedText || !textStyleDraft) return;

    const nextText = textStyleDirty.effectPreset
      ? applyLetteringPreset(selectedText, textStyleDraft.effectPreset)
      : selectedText;
    const patch: Partial<TextObject> = {};

    if (textStyleDirty.fontFamily) patch.fontFamily = textStyleDraft.fontFamily;
    if (textStyleDirty.color) patch.color = textStyleDraft.color;
    if (textStyleDirty.fontSize) patch.fontSize = textStyleDraft.fontSize;
    if (textStyleDirty.bold) patch.bold = textStyleDraft.bold;
    if (textStyleDirty.italic) patch.italic = textStyleDraft.italic;
    if (textStyleDirty.curveMode) {
      patch.curve = {
        ...nextText.curve,
        mode: textStyleDraft.curveMode,
        intensity: textStyleDraft.curveMode === "straight" ? 0 : Math.max(nextText.curve.intensity, 18)
      };
    }

    const styledText = { ...nextText, ...patch };
    updateTextObjects((current) => current.map((item) => (item.id === selectedText.id ? styledText : item)));
    syncTextStyleDraft(styledText);
    setMessage("Estilo aplicado ao texto selecionado.");
  };

  const selectFontForText = (font: FontRecord) => {
    if (!selectedText) return;
    updateTextStyleDraft("fontFamily", font.family);
    setFonts((current) => current.map((item) => (item.id === font.id ? { ...item, lastUsedAt: Date.now() } : item)));
    setMessage("Fonte escolhida. Clique em Aplicar estilo para usar no texto.");
  };

  const toggleFontFavorite = (font: FontRecord) => {
    setFonts((current) => current.map((item) => (item.id === font.id ? { ...item, favorite: !item.favorite } : item)));
    if (font.source === "imported") {
      void fontManagerRef.current.saveFont({ ...font, favorite: !font.favorite });
    }
  };

  const handleFontImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const font = await fontManagerRef.current.importFont(file, fonts);
      setFonts((current) => [...current, font]);
      if (selectedText) updateSelectedText({ fontFamily: font.family });
      setMessage(`Fonte ${font.name} importada localmente. Use somente fontes autorizadas.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui importar a fonte.");
    }
  };

  const deleteImportedFont = async (font: FontRecord) => {
    if (font.source !== "imported") return;
    await fontManagerRef.current.deleteImportedFont(font);
    setFonts((current) => current.filter((item) => item.id !== font.id));
    updateTextObjects((current) =>
      current.map((text) => (text.fontFamily === font.family ? { ...text, fontFamily: "Arial" } : text))
    );
    setMessage("Fonte importada excluída deste navegador. Textos que usavam essa fonte foram substituídos por Arial.");
  };

  const handleTextPointerDown = (text: TextObject, event: PointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTextId(text.id);
    setTextHistory((items) => [textObjects, ...items].slice(0, 20));
    setTextRedoHistory([]);
    event.currentTarget.setPointerCapture(event.pointerId);
    setTextDrag({
      id: text.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: text.x,
      originY: text.y
    });
  };

  const handleTextPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!textDrag || !plan) return;
    event.preventDefault();
    event.stopPropagation();
    const deltaX = (event.clientX - textDrag.startX) / currentPreviewScale;
    const deltaY = (event.clientY - textDrag.startY) / currentPreviewScale;
    setTextObjects((current) =>
      updateTextObject(current, textDrag.id, {
        x: Math.round(textDrag.originX + deltaX),
        y: Math.round(textDrag.originY + deltaY)
      })
    );
  };

  const handleTextPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!textDrag) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setTextDrag(null);
  };

  const handleTextResizePointerDown = (text: TextObject, event: PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTextId(text.id);
    setTextHistory((items) => [textObjects, ...items].slice(0, 20));
    setTextRedoHistory([]);
    event.currentTarget.setPointerCapture(event.pointerId);
    setTextResizeDrag({
      id: text.id,
      startX: event.clientX,
      originWidth: text.width,
      originFontSize: text.fontSize
    });
  };

  const handleTextResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!textResizeDrag) return;
    event.preventDefault();
    event.stopPropagation();
    const delta = (event.clientX - textResizeDrag.startX) / currentPreviewScale;
    const widthRatio = Math.max(0.25, (textResizeDrag.originWidth + delta) / textResizeDrag.originWidth);
    setTextObjects((current) =>
      resizeTextObject(current, textResizeDrag.id, textResizeDrag.originWidth * widthRatio, textResizeDrag.originFontSize * widthRatio)
    );
  };

  const handleTextResizePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!textResizeDrag) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setTextResizeDrag(null);
  };

  const handleResizePointerDown = (handle: ResizeHandle, event: PointerEvent<HTMLButtonElement>) => {
    if (!plan || montageImages.length > 1 || !previewCanvasRef.current || !resizeFrameGeometry) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const displayScale = resizeFrameGeometry.displayScale || previewCanvasRef.current.clientWidth / plan.sheetPx.width;
    if (!displayScale) return;

    setHistory((items) => [settings, ...items].slice(0, 10));
    setRedoHistory([]);
    setResizeDrag({
      handle,
      startX: event.clientX,
      startY: event.clientY,
      originScaleX: settings.imageScaleX,
      originScaleY: settings.imageScaleY,
      originOffsetXmm: settings.offsetXmm,
      originOffsetYmm: settings.offsetYmm,
      originFrameWidthPx: Math.max(1, resizeFrameGeometry.frameWidth),
      originFrameHeightPx: Math.max(1, resizeFrameGeometry.frameHeight),
      displayScale,
      pageFlipped: resizeFrameGeometry.pageFlipped
    });
  };

  const handleResizePointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeDrag || !plan) return;
    event.preventDefault();
    event.stopPropagation();

    const rawDeltaXpx = (event.clientX - resizeDrag.startX) / resizeDrag.displayScale;
    const rawDeltaYpx = (event.clientY - resizeDrag.startY) / resizeDrag.displayScale;
    const deltaXpx = resizeDrag.pageFlipped ? -rawDeltaXpx : rawDeltaXpx;
    const deltaYpx = resizeDrag.pageFlipped ? -rawDeltaYpx : rawDeltaYpx;
    const pullsRight = resizeDrag.handle.includes("right");
    const pullsLeft = resizeDrag.handle.includes("left");
    const pullsBottom = resizeDrag.handle.includes("bottom");
    const pullsTop = resizeDrag.handle.includes("top");
    const rawWidth = resizeDrag.originFrameWidthPx + (pullsRight ? deltaXpx : 0) - (pullsLeft ? deltaXpx : 0);
    const rawHeight = resizeDrag.originFrameHeightPx + (pullsBottom ? deltaYpx : 0) - (pullsTop ? deltaYpx : 0);
    const minFrameSizePx = 18 / resizeDrag.displayScale;
    const nextWidth = clampNumber(rawWidth, minFrameSizePx, resizeDrag.originFrameWidthPx * 6);
    const nextHeight = clampNumber(rawHeight, minFrameSizePx, resizeDrag.originFrameHeightPx * 6);
    const nextScaleX = Number(
      clampScale(resizeDrag.originScaleX * (nextWidth / resizeDrag.originFrameWidthPx)).toFixed(3)
    );
    const nextScaleY = Number(
      clampScale(resizeDrag.originScaleY * (nextHeight / resizeDrag.originFrameHeightPx)).toFixed(3)
    );
    const effectiveWidthDelta = resizeDrag.originFrameWidthPx * (nextScaleX / Math.max(0.001, resizeDrag.originScaleX)) - resizeDrag.originFrameWidthPx;
    const effectiveHeightDelta = resizeDrag.originFrameHeightPx * (nextScaleY / Math.max(0.001, resizeDrag.originScaleY)) - resizeDrag.originFrameHeightPx;
    const centerDeltaX = pullsRight ? effectiveWidthDelta / 2 : pullsLeft ? -effectiveWidthDelta / 2 : 0;
    const centerDeltaY = pullsBottom ? effectiveHeightDelta / 2 : pullsTop ? -effectiveHeightDelta / 2 : 0;

    setSettings((current) => ({
      ...current,
      imageScaleX: nextScaleX,
      imageScaleY: nextScaleY,
      offsetXmm: Number((resizeDrag.originOffsetXmm + (centerDeltaX / plan.dpi) * 25.4).toFixed(1)),
      offsetYmm: Number((resizeDrag.originOffsetYmm + (centerDeltaY / plan.dpi) * 25.4).toFixed(1))
    }));
  };

  const handleResizePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (!resizeDrag) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setResizeDrag(null);
    setMessage("Tamanho da arte ajustado pelas bordas.");
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void handleFiles(event.dataTransfer.files);
  };

  const recordProductUsage = (destinationId: DestinationPreset["id"]) => {
    if (destinationId === "custom") return;
    setProductUsage((current) => ({
      ...current,
      [destinationId]: (current[destinationId] ?? 0) + 1
    }));
  };

  const getRecentProjectKey = (project: RecentProject) => `${project.id}-${project.updatedAt}`;

  const persistRecentProjects = (projects: RecentProject[]) => {
    setRecentProjects(projects);
    try {
      window.localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(projects));
    } catch {
      setMessage("Não consegui atualizar os trabalhos recentes no navegador.");
    }
  };

  const toggleRecentProject = (projectKey: string) => {
    setCheckedRecentProjectIds((current) =>
      current.includes(projectKey) ? current.filter((id) => id !== projectKey) : [...current, projectKey]
    );
  };

  const selectAllRecentProjects = () => {
    setCheckedRecentProjectIds(recentProjects.map(getRecentProjectKey));
  };

  const deleteSelectedRecentProjects = () => {
    if (!checkedRecentProjectIds.length) return;
    const nextProjects = recentProjects.filter((project) => !checkedRecentProjectIds.includes(getRecentProjectKey(project)));
    persistRecentProjects(nextProjects);
    setCheckedRecentProjectIds([]);
    setMessage(`${recentProjects.length - nextProjects.length} trabalho(s) recente(s) removido(s).`);
  };

  const startMission = (missionId: MissionId) => {
    const missionSettings: Record<MissionId, Partial<Settings>> = {
      shirt: {
        destinationId: "shirt-a4",
        sheetId: "a4",
        sheetRotationDeg: 0,
        fitMode: "contain",
        bleedMm: 0,
        marginMm: 6,
        gapMm: 4,
        copies: 1,
        mirror: true,
        printProduct: "Camisa branca",
        paperType: "Papel sublimático",
        printQuality: "Alta / melhor foto",
        printOrientation: "auto",
        borderless: false,
        driverScale: 100
      },
      mug: {
        destinationId: "mug-11oz",
        sheetId: "a4",
        sheetRotationDeg: 0,
        fitMode: "cover",
        bleedMm: 2,
        marginMm: 5,
        gapMm: 4,
        copies: 1,
        mirror: true,
        printProduct: "Caneca branca 11 oz",
        paperType: "Papel sublimático",
        printQuality: "Alta / melhor foto",
        printOrientation: "landscape",
        borderless: false,
        driverScale: 100
      },
      a4: {
        destinationId: "custom",
        sheetId: "a4",
        sheetRotationDeg: 0,
        fitMode: "contain",
        bleedMm: 0,
        marginMm: 0,
        gapMm: 4,
        copies: 1,
        customWidthMm: 210,
        customHeightMm: 297,
        mirror: false,
        printProduct: "Folha A4",
        paperType: "Papel comum ou fotográfico",
        printQuality: "Alta / melhor foto",
        printOrientation: "portrait",
        borderless: true,
        driverScale: 100
      },
      edit: {
        destinationId: "custom",
        sheetId: "a4",
        sheetRotationDeg: 0,
        fitMode: "contain",
        bleedMm: 0,
        marginMm: 6,
        gapMm: 4,
        copies: 1,
        customWidthMm: 100,
        customHeightMm: 100,
        mirror: false,
        printProduct: "Arte personalizada",
        paperType: "Conforme o produto",
        printQuality: "Alta / melhor foto",
        printOrientation: "auto",
        borderless: false,
        driverScale: 100
      }
    };
    const mission = missionOptions.find((item) => item.id === missionId);
    setActiveMission(missionId);
    setHomeView("mission");
    const destinationId = missionSettings[missionId].destinationId;
    if (destinationId) recordProductUsage(destinationId);
    updateSettings({
      ...missionSettings[missionId],
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      cropLeft: 0,
      imageScale: 1,
      imageScaleX: 1,
      imageScaleY: 1,
      offsetXmm: 0,
      offsetYmm: 0,
      rotationDeg: 0,
      flipVertical: false
    });
    setMessage(`${mission?.title ?? "Missão"} ativada. Importe a arte e o Nitro guia o restante.`);
  };

  const handleDestination = (item: DestinationPreset) => {
    recordProductUsage(item.id);
    updateSettings({
      destinationId: item.id,
      sheetId: item.recommendedSheet,
      mirror: item.category === "Sublimação" || item.category === "Cerâmica"
    });
  };

  const applySmartProfile = (profile: SmartProfile) => {
    const profileDestination = destinationPresets.find((item) => item.id === profile.destinationId) ?? destinationPresets[0];
    recordProductUsage(profile.destinationId);
    updateSettings({
      destinationId: profile.destinationId,
      sheetId: profileDestination.recommendedSheet,
      fitMode: profile.fitMode,
      bleedMm: profile.bleedMm,
      marginMm: profile.marginMm,
      copies: profile.copies,
      mirror: profile.mirror,
      cutMarks: true,
      safeArea: true,
      technicalLabel: true
    });
    setMessage(`Perfil ${profile.label} aplicado. ${profile.note}`);
  };

  const handleExport = async () => {
    if ((!sourceImage && !textObjects.length) || !plan) return;
    setIsPreparing(true);
    setMessage(null);
    try {
      const canvas = document.createElement("canvas");
      await renderPrintCanvas(canvas, plan, getRenderOptions());
      const baseName = sourceImage?.name ?? selectedText?.content ?? "letreiro";
      const safeName = baseName.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "-");
      const filename = `nitro-${safeName}-${destination.id}-${settings.dpi}dpi`;

      if (settings.exportFormat === "pdf") {
        const { jsPDF } = await import("jspdf");
        const orientation = sheet.widthMm > sheet.heightMm ? "landscape" : "portrait";
        const pdf = new jsPDF({
          orientation,
          unit: "mm",
          format: [sheet.widthMm, sheet.heightMm],
          compress: true
        });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, sheet.widthMm, sheet.heightMm);
        pdf.save(`${filename}.pdf`);
      } else {
        downloadCanvasPng(canvas, `${filename}.png`);
      }

      setMessage("Arquivo final gerado com tamanho físico da folha.");
      setIsPrintPreviewOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui exportar a arte.");
    } finally {
      setIsPreparing(false);
    }
  };

  const handlePrintNow = async () => {
    if ((!sourceImage && !textObjects.length) || !plan) return;
    const printWindow = window.open("", "nitro-print", "width=980,height=720");

    if (!printWindow) {
      setMessage("O navegador bloqueou a janela de impressão. Permita pop-ups para imprimir direto.");
      return;
    }

    printWindow.document.write("<!doctype html><title>Nitro Studio - Preparando impressão</title><body>Preparando impressão...</body>");
    printWindow.document.close();
    setIsPreparing(true);
    setMessage(null);
    try {
      const canvas = document.createElement("canvas");
      await renderPrintCanvas(canvas, plan, getRenderOptions());
      const imageUrl = canvas.toDataURL("image/png");
      const orientation = settings.printOrientation === "auto"
        ? sheet.widthMm > sheet.heightMm ? "landscape" : "portrait"
        : settings.printOrientation;

      printWindow.document.open();
      printWindow.document.write(`<!doctype html>
<html>
  <head>
    <title>Nitro Studio - Impressão</title>
    <style>
      @page {
        size: ${sheet.widthMm}mm ${sheet.heightMm}mm;
        margin: ${settings.borderless ? 0 : settings.marginMm}mm;
      }
      * { box-sizing: border-box; }
      html, body {
        width: ${sheet.widthMm}mm;
        min-height: ${sheet.heightMm}mm;
        margin: 0;
        background: #ffffff;
        font-family: Arial, sans-serif;
      }
      body {
        display: grid;
        place-items: center;
      }
      img {
        display: block;
        width: ${settings.driverScale}%;
        max-width: 100%;
        height: auto;
        page-break-inside: avoid;
      }
      .note {
        position: fixed;
        left: 10mm;
        bottom: 6mm;
        color: #111827;
        font-size: 9px;
      }
      @media print {
        .note { display: none; }
      }
    </style>
  </head>
  <body>
    <img src="${imageUrl}" alt="Arte preparada pelo Nitro Studio" />
    <div class="note">Nitro Studio · ${settings.printerConfigured ? settings.printerModel : "Impressora não selecionada"} · ${settings.printQuality} · ${orientation} · ${sheetRotationLabels[settings.sheetRotationDeg]}</div>
    <script>
      window.addEventListener("load", () => {
        window.focus();
        setTimeout(() => window.print(), 250);
      });
    </script>
  </body>
</html>`);
      printWindow.document.close();
      setMessage("Tela de impressão aberta com a folha preparada pelo Nitro.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não consegui abrir a impressão.");
    } finally {
      setIsPreparing(false);
    }
  };

  const openPrintSimulation = () => {
    if (!sourceImage && !textObjects.length) {
      setMessage("Importe uma arte ou adicione um texto antes de imprimir.");
      quickFileInputRef.current?.click();
      return;
    }

    if (!plan) {
      setMessage("Prepare a arte para gerar a simulação de impressão.");
      return;
    }

    setIsPrintPreviewOpen(true);
    setMessage(null);
  };

  const chooseLargerSheet = () => {
    const nextSheetId: SheetId = settings.sheetId === "a4" ? "a3" : "sublimation-30x40";
    updateSettings({ sheetId: nextSheetId });
    setMessage("Folha maior selecionada para preservar o tamanho.");
  };

  const fillSheetWithCopies = () => {
    if (!plan) return;
    updateSettings({ copies: plan.maxCopies });
    setMessage("Quantidade ajustada para aproveitar melhor a folha.");
  };

  const reduceArtworkScale = () => {
    updateSettings({ imageScale: Math.max(0.72, Number((settings.imageScale * 0.86).toFixed(2))) });
    setMessage("Zoom reduzido para melhorar a definição efetiva.");
  };

  const enableProductionGuides = () => {
    updateSettings({
      cutMarks: true,
      safeArea: true,
      showGuides: true,
      technicalLabel: true
    });
    setMessage("Guias de produção ativadas.");
  };

  const arrangeArtwork = () => {
    if (!sourceImage && !textObjects.length) {
      setMessage("Importe uma arte ou adicione um texto para o Nitro arrumar.");
      quickFileInputRef.current?.click();
      return;
    }

    if (pendingCrop) {
      applySelectedCrop();
      return;
    }

    const imageRatio = croppedImageSize ? croppedImageSize.width / croppedImageSize.height : destination.widthMm / destination.heightMm;
    const targetRatio = destination.widthMm / destination.heightMm;
    const ratioDelta = Math.abs(imageRatio - targetRatio) / Math.max(0.01, targetRatio);
    const lowDefinition = Boolean(plan && plan.effectiveDpi < 180);
    const shouldFillArea = Boolean(sourceImage && !lowDefinition && ratioDelta < 0.16 && settings.fitMode !== "repeat");
    const next: Partial<Settings> = {
      sheetId: plan?.scaleFactor && plan.scaleFactor < 0.98
        ? settings.sheetId === "a4" ? "a3" : "sublimation-30x40"
        : destination.recommendedSheet,
      fitMode: shouldFillArea ? "cover" : "contain",
      dpi: sourceImage && sourceImage.width * sourceImage.height < 1_800_000 ? 200 : settings.dpi,
      bleedMm: destination.category === "Tecido" ? 0 : Math.max(settings.bleedMm, 2),
      marginMm: destination.id === "shirt-a3" || destination.id === "ecobag" ? Math.max(settings.marginMm, 8) : Math.max(settings.marginMm, 5),
      gapMm: destination.id === "mug-11oz" ? 6 : Math.max(settings.gapMm, 4),
      imageScale: lowDefinition ? Math.max(0.74, Number((settings.imageScale * 0.86).toFixed(2))) : 1,
      imageScaleX: 1,
      imageScaleY: 1,
      offsetXmm: 0,
      offsetYmm: 0,
      rotationDeg: 0,
      flipVertical: false,
      brightness: sourceImage ? Math.max(96, settings.brightness) : settings.brightness,
      contrast: sourceImage ? Math.max(108, settings.contrast) : settings.contrast,
      saturation: sourceImage ? Math.max(112, settings.saturation) : settings.saturation,
      mirror: destination.category !== "Livre",
      cutMarks: true,
      safeArea: true,
      showGuides: true,
      technicalLabel: true
    };

    if (plan && plan.wastePercent > 60 && plan.maxCopies > 1) {
      next.copies = destination.id === "custom" || destination.id === "tile-15" || destination.id === "keychain"
        ? plan.maxCopies
        : Math.min(settings.copies, plan.maxCopies);
    }

    updateSettings(next);
    if (textObjects.length && plan) {
      updateTextObjects((current) =>
        current.map((text) => ({
          ...text,
          x: Math.min(Math.max(text.x, plan.marginPx), plan.sheetPx.width - plan.marginPx),
          y: Math.min(Math.max(text.y, plan.marginPx), plan.sheetPx.height - plan.marginPx),
          width: Math.min(text.width, Math.round(plan.sheetPx.width - plan.marginPx * 2))
        }))
      );
    }
    setMessage("Arrumar Minha Arte aplicou encaixe, folha, DPI, guias, cores, espelhamento e aproveitamento.");
  };

  const acceptRecommendation = () => {
    if (!sourceImage && !textObjects.length) {
      setMessage("Importe uma arte ou adicione um texto para o Nitro recomendar o plano correto.");
      quickFileInputRef.current?.click();
      return;
    }

    const imageRatio = croppedImageSize ? croppedImageSize.width / croppedImageSize.height : destination.widthMm / destination.heightMm;
    const targetRatio = destination.widthMm / destination.heightMm;
    const ratioDelta = Math.abs(imageRatio - targetRatio) / targetRatio;
    const lowDefinition = Boolean(plan && plan.effectiveDpi < 190);
    const suggestedFitMode: FitMode = lowDefinition ? "contain" : ratioDelta < 0.18 ? "cover" : "contain";
    const largerSheet: SheetId = settings.sheetId === "a4" ? "a3" : "sublimation-30x40";
    const suggestedSheet = plan?.scaleFactor && plan.scaleFactor < 0.98 ? largerSheet : destination.recommendedSheet;
    const canFillCopies = Boolean(
      plan && plan.wastePercent > 70 && plan.maxCopies > 1 && (destination.id === "tile-15" || destination.id === "custom")
    );
    const suggestedCopies = canFillCopies && plan ? plan.maxCopies : Math.max(1, Math.min(settings.copies, plan?.maxCopies ?? settings.copies));

    const next: Partial<Settings> = {
      sheetId: suggestedSheet,
      fitMode: suggestedFitMode,
      dpi: sourceImage && sourceImage.width * sourceImage.height < 1_800_000 ? 200 : settings.dpi,
      bleedMm: destination.category === "Tecido" ? 0 : Math.max(settings.bleedMm, 2),
      marginMm: destination.id === "shirt-a3" ? Math.max(settings.marginMm, 8) : Math.max(settings.marginMm, 6),
      gapMm: destination.id === "mug-11oz" ? 6 : Math.max(settings.gapMm, 4),
      copies: suggestedCopies,
      imageScale: lowDefinition ? Math.max(0.78, Number((settings.imageScale * 0.88).toFixed(2))) : 1,
      imageScaleX: 1,
      imageScaleY: 1,
      offsetXmm: 0,
      offsetYmm: 0,
      rotationDeg: 0,
      flipVertical: false,
      mirror: destination.category !== "Livre",
      showGuides: true,
      cutMarks: true,
      safeArea: true,
      technicalLabel: true
    };

    if (pendingCrop) {
      next.cropTop = pendingCrop.top;
      next.cropRight = pendingCrop.right;
      next.cropBottom = pendingCrop.bottom;
      next.cropLeft = pendingCrop.left;
      setPendingCrop(null);
    }

    updateSettings(next);
    setMessage("Recomendação aceita: encaixe, folha, DPI, guias e espelhamento preparados para impressão.");
  };

  const assistantItems = useMemo(() => {
    const items: Array<{
      problem: string;
      cause: string;
      recommendation: string;
      actionLabel: string;
      resolve: () => void;
    }> = [];

    if (!sourceImage && !textObjects.length) {
      items.push({
        problem: "Nenhuma arte carregada",
        cause: "O Nitro precisa de uma imagem ou texto para preparar a folha.",
        recommendation: "Adicione uma arte ou crie um letreiro com Adicionar texto.",
        actionLabel: "Adicionar texto",
        resolve: addTextToSheet
      });
      return items;
    }

    if (pendingCrop) {
      items.push({
        problem: "Corte selecionado, mas não aplicado",
        cause: "A área foi marcada no editor visual e ainda não entrou no arquivo final.",
        recommendation: "Clique em Cortar para aplicar a área de interesse.",
        actionLabel: "Cortar",
        resolve: applySelectedCrop
      });
    }

    if (selectedText && plan && isTextOutsideSheet(selectedText, plan.sheetPx.width, plan.sheetPx.height)) {
      items.push({
        problem: "Texto fora da folha",
        cause: "Parte do letreiro está passando da área imprimível.",
        recommendation: "Reposicione o texto inteiro dentro da página sem alterar o conteúdo.",
        actionLabel: "Trazer para a folha",
        resolve: () =>
          updateTextObjects((current) =>
            updateTextObject(current, selectedText.id, clampTextToSheet(selectedText, plan.sheetPx.width, plan.sheetPx.height))
          )
      });
    }

    if (selectedText && hasWeakOutlineForPrint(selectedText, settings.dpi)) {
      items.push({
        problem: "Contorno fino para impressão",
        cause: "O contorno pode desaparecer depois da sublimação ou em imagem espelhada.",
        recommendation: "Aumente o contorno de forma não destrutiva.",
        actionLabel: "Reforçar contorno",
        resolve: () => updateTextObjects((current) => updateTextObject(current, selectedText.id, strengthenOutline(selectedText, settings.dpi)))
      });
    }

    if (selectedText && hasLowTextContrast(selectedText)) {
      items.push({
        problem: "Contraste fraco no letreiro",
        cause: "A cor do texto pode se misturar com contorno ou fundo.",
        recommendation: "Aplicar contraste seguro para leitura em impressão.",
        actionLabel: "Melhorar contraste",
        resolve: () => updateTextObjects((current) => updateTextObject(current, selectedText.id, improveContrast(selectedText)))
      });
    }

    if (selectedText && selectedText.fontSize < 22) {
      items.push({
        problem: "Texto pequeno demais",
        cause: "Letras muito pequenas perdem detalhe em tecidos e canecas.",
        recommendation: "Aumente o tamanho preservando a largura atual.",
        actionLabel: "Aumentar texto",
        resolve: () => updateSelectedText({ fontSize: 36 })
      });
    }

    if (plan?.scaleFactor && plan.scaleFactor < 0.98) {
      items.push({
        problem: "Destino maior que a folha",
        cause: "O tamanho escolhido não cabe com a margem atual.",
        recommendation: "Use uma folha maior ou reduza a margem para manter o tamanho real.",
        actionLabel: "Usar folha maior",
        resolve: chooseLargerSheet
      });
    }

    if (plan && plan.effectiveDpi < 190) {
      items.push({
        problem: "Definição abaixo do ideal",
        cause: `A arte está com ${plan.effectiveDpi} DPI efetivos no tamanho atual.`,
        recommendation: "Reduza o zoom, preserve a arte inteira ou use uma imagem maior.",
        actionLabel: "Melhorar definição",
        resolve: reduceArtworkScale
      });
    }

    if (settings.fitMode === "cover") {
      items.push({
        problem: "Risco de cortar bordas",
        cause: "O modo Preencher área pode ocultar partes importantes da imagem.",
        recommendation: "Use Preservar tudo quando não quiser perder nenhum detalhe.",
        actionLabel: "Preservar tudo",
        resolve: () => updateSettings({ fitMode: "contain" })
      });
    }

    if (plan && plan.wastePercent > 60 && plan.maxCopies > 1) {
      items.push({
        problem: "Baixo aproveitamento da folha",
        cause: `${plan.wastePercent}% da área útil pode sobrar.`,
        recommendation: "Aumente as cópias para reduzir desperdício.",
        actionLabel: "Preencher folha",
        resolve: fillSheetWithCopies
      });
    }

    if (!settings.cutMarks || !settings.safeArea || !settings.technicalLabel) {
      items.push({
        problem: "Saída sem todos os guias",
        cause: "Marcas, área segura ou etiqueta técnica estão desligadas.",
        recommendation: "Ative os guias para uma produção mais confiável.",
        actionLabel: "Ativar guias",
        resolve: enableProductionGuides
      });
    }

    if (!items.length) {
      items.push({
        problem: "Arte pronta para seguir",
        cause: "O Nitro não encontrou bloqueios importantes no plano atual.",
        recommendation: "Confira o preview e baixe o arquivo final.",
        actionLabel: "Manter plano",
        resolve: () => setMessage("Plano atual mantido.")
      });
    }

    return items.slice(0, 4);
  }, [pendingCrop, plan, selectedText, settings, sourceImage, textObjects.length]);

  const simulationItems = useMemo(() => {
    if (!plan) return [];
    const usedAreaPercent = Math.max(0, Math.min(100, 100 - plan.wastePercent));
    const hasManualCrop = settings.cropTop + settings.cropRight + settings.cropBottom + settings.cropLeft > 0;
    const hasEdgeRisk = settings.fitMode === "cover" || settings.imageScaleX !== 1 || settings.imageScaleY !== 1;
    const quality =
      plan.effectiveDpi >= 220
        ? "Alta"
        : plan.effectiveDpi >= 170
          ? "Boa com atenção"
          : "Baixa para detalhes finos";

    return [
      {
        label: "Área utilizada",
        value: `${usedAreaPercent}% da folha útil`,
        detail: `${plan.copyCount} cópia(s) posicionada(s) no papel.`
      },
      {
        label: "Área perdida",
        value: `${plan.wastePercent}% de sobra`,
        detail: plan.wastePercent > 55 ? "Considere mais cópias, folha menor ou ajuste de tamanho." : "Aproveitamento adequado para o plano atual."
      },
      {
        label: "Corte",
        value: hasManualCrop ? "Corte manual ativo" : hasEdgeRisk ? "Pode cortar bordas" : "Sem corte previsto",
        detail: hasManualCrop
          ? `${settings.cropTop}% topo, ${settings.cropRight}% direita, ${settings.cropBottom}% base, ${settings.cropLeft}% esquerda.`
          : settings.fitMode === "cover"
            ? "Modo preencher pode ocultar partes da arte."
            : "A arte está preservada no enquadramento atual."
      },
      {
        label: "Área segura",
        value: settings.safeArea ? "Ativa" : "Desligada",
        detail: settings.safeArea ? "A prévia mostra margem de segurança para acabamento." : "Ative área segura para reduzir risco de corte."
      },
      {
        label: "Qualidade prevista",
        value: `${quality} · ${plan.effectiveDpi} DPI`,
        detail: plan.effectiveDpi < 170 ? "Use imagem maior ou reduza o tamanho impresso." : "Compatível com o plano atual."
      },
      {
        label: "Folha final",
        value: `${sheet.widthMm} x ${sheet.heightMm} mm`,
        detail: `${sheetRotationLabels[settings.sheetRotationDeg]}. ${plan.scaleFactor < 0.98 ? "O tamanho foi reduzido para caber na folha." : "Tamanho físico mantido."}`
      },
      {
        label: "Espelhamento",
        value: settings.mirror ? "Ligado" : "Desligado",
        detail: settings.mirror ? "Indicado para transferência por sublimação." : "Use assim apenas se o processo não exigir espelho."
      }
    ];
  }, [
    plan,
    settings.cropBottom,
    settings.cropLeft,
    settings.cropRight,
    settings.cropTop,
    settings.fitMode,
    settings.imageScaleX,
    settings.imageScaleY,
    settings.mirror,
    settings.safeArea,
    settings.sheetRotationDeg,
    sheet.heightMm,
    sheet.widthMm
  ]);

  const printInstructionItems = useMemo(() => {
    if (!plan) return [];
    const orientation =
      settings.printOrientation === "auto"
        ? sheet.widthMm > sheet.heightMm ? "Paisagem" : "Retrato"
        : settings.printOrientation === "landscape" ? "Paisagem" : "Retrato";
    const borderless = settings.borderless ? "Ativar sem bordas" : "Usar margem do arquivo";
    const scale = `${settings.driverScale}% no driver`;

    return [
      { label: "Impressora", value: settings.printerConfigured ? settings.printerModel : "Não selecionada" },
      { label: "Produto", value: settings.printProduct },
      { label: "Sem bordas", value: borderless },
      { label: "Qualidade", value: settings.printQuality },
      { label: "Escala", value: scale },
      { label: "Orientação", value: orientation },
      { label: "Giro do papel", value: sheetRotationLabels[settings.sheetRotationDeg] },
      { label: "Tipo de papel", value: settings.paperType },
      { label: "Espelhamento", value: settings.mirror ? "Ligado no Nitro" : "Desligado no Nitro" }
    ];
  }, [
    plan,
    settings.borderless,
    settings.driverScale,
    settings.mirror,
    settings.paperType,
    settings.printProduct,
    settings.printQuality,
    settings.printOrientation,
    settings.printerConfigured,
    settings.printerModel,
    settings.sheetRotationDeg,
    sheet.heightMm,
    sheet.widthMm
  ]);

  const guidedSteps = useMemo(() => {
    const hasBlockingAssistantItem = assistantItems.some(
      (item) => item.problem !== "Arte pronta para seguir" && item.problem !== "Baixo aproveitamento da folha"
    );

    return [
      {
        label: "Adicionar arte",
        done: Boolean(sourceImage),
        detail: sourceImage ? "Arte carregada e analisada." : "Importe PNG, JPG ou WebP."
      },
      {
        label: "Escolher perfil",
        done: settings.destinationId !== "custom" || destination.widthMm !== 100 || destination.heightMm !== 100,
        detail: `${destination.label} selecionado.`
      },
      {
        label: "Corrigir alertas",
        done: Boolean(plan) && !hasBlockingAssistantItem,
        detail: hasBlockingAssistantItem ? "Veja o Assistente Nitro." : "Nenhum bloqueio importante."
      },
      {
        label: "Conferir simulação",
        done: Boolean(plan),
        detail: plan ? `${plan.copyCount} cópia(s), ${plan.wastePercent}% de sobra estimada.` : "Aguardando plano."
      },
      {
        label: "Baixar arquivo",
        done: false,
        detail: `Saída atual: ${settings.exportFormat.toUpperCase()}.`
      }
    ];
  }, [assistantItems, destination.heightMm, destination.label, destination.widthMm, plan, settings.destinationId, settings.exportFormat, sourceImage]);

  useEffect(() => {
    if ((!sourceImage && !textObjects.length) || !plan || !previewCanvasRef.current) return;
    const autoScale = Math.min(
      1,
      Math.max(0.08, (previewBounds.width - 42) / plan.sheetPx.width),
      Math.max(0.08, (previewBounds.height - 42) / plan.sheetPx.height)
    );
    const scale = Number(clampNumber(autoScale * (paperZoomPercent / 100), 0.04, 2.5).toFixed(4));
    setCurrentPreviewScale(scale);
    void renderPrintCanvas(previewCanvasRef.current, plan, getRenderOptions(scale, false)).catch((error) =>
      setMessage(error instanceof Error ? error.message : "Erro no preview.")
    );
  }, [montageImages, paperZoomPercent, plan, previewBounds, settings, sourceImage, textObjects]);

  useEffect(() => {
    if (!isPrintPreviewOpen || (!sourceImage && !textObjects.length) || !plan || !printPreviewCanvasRef.current) return;
    const scale = Math.min(0.34, Math.max(0.08, 520 / plan.sheetPx.width), Math.max(0.08, 620 / plan.sheetPx.height));
    void renderPrintCanvas(printPreviewCanvasRef.current, plan, getRenderOptions(scale)).catch((error) =>
      setMessage(error instanceof Error ? error.message : "Erro na simulação de impressão.")
    );
  }, [isPrintPreviewOpen, montageImages, plan, settings, sourceImage, textObjects]);

  useEffect(() => {
    if (!canvasWrapRef.current) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const target = entry.target as HTMLElement;
      setPreviewBounds({
        width: Math.max(260, Math.round(target.clientWidth || entry.contentRect.width)),
        height: Math.max(260, Math.round(target.clientHeight || entry.contentRect.height))
      });
    });
    observer.observe(canvasWrapRef.current);
    return () => observer.disconnect();
  }, [activeMission, homeView]);

  useEffect(() => {
    const loadFonts = async () => {
      const loadedFonts = await fontManagerRef.current.listFonts();
      await fontManagerRef.current.loadImportedFonts();
      try {
        const preferences = JSON.parse(window.localStorage.getItem(FONT_PREFS_STORAGE_KEY) ?? "{}") as Record<string, Pick<FontRecord, "favorite" | "lastUsedAt">>;
        setFonts(loadedFonts.map((font) => ({ ...font, ...preferences[font.id] })));
      } catch {
        setFonts(loadedFonts);
      }
    };
    void loadFonts();
  }, []);

  useEffect(() => {
    try {
      const preferences = fonts.reduce<Record<string, Pick<FontRecord, "favorite" | "lastUsedAt">>>((result, font) => {
        if (font.favorite || font.lastUsedAt) {
          result[font.id] = {
            favorite: font.favorite,
            lastUsedAt: font.lastUsedAt
          };
        }
        return result;
      }, {});
      window.localStorage.setItem(FONT_PREFS_STORAGE_KEY, JSON.stringify(preferences));
    } catch {
      // Font preferences are convenience metadata.
    }
  }, [fonts]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      try {
        persistWorkspace(settings, textObjects, selectedTextId);
      } catch {
        // Autosave is a convenience layer; failure should never block production.
      }
    }, 420);

    return () => window.clearTimeout(timeoutId);
  }, [selectedTextId, settings, textObjects]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PRODUCT_USAGE_STORAGE_KEY, JSON.stringify(productUsage));
    } catch {
      // Dashboard metrics should never block the editor.
    }
  }, [productUsage]);

  useEffect(() => {
    if (!sourceImage) return;
    const nextProject: RecentProject = {
      id: sourceImage.id,
      name: sourceImage.name,
      destinationId: destination.id,
      destinationLabel: destination.label,
      sheetLabel: sheet.label,
      imageCount: images.length,
      updatedAt: Date.now(),
      missionTitle: currentMission?.title ?? "Trabalho livre"
    };

    setRecentProjects((current) => {
      const nextProjects = [nextProject, ...current.filter((project) => project.id !== nextProject.id)].slice(0, 5);
      try {
        window.localStorage.setItem(RECENT_PROJECTS_STORAGE_KEY, JSON.stringify(nextProjects));
      } catch {
        // Recent projects are helpful context, not required data.
      }
      setCheckedRecentProjectIds((checked) => checked.filter((id) => nextProjects.some((project) => getRecentProjectKey(project) === id)));
      return nextProjects;
    });
  }, [currentMission?.title, destination.id, destination.label, images.length, sheet.label, sourceImage]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    textObjectsRef.current = textObjects;
  }, [textObjects]);

  useEffect(() => {
    selectedTextIdRef.current = selectedTextId;
  }, [selectedTextId]);

  useEffect(() => {
    const saveBeforeUnload = () => {
      try {
        persistWorkspace();
      } catch {
        // Browser shutdown should not be blocked by local persistence.
      }
    };
    window.addEventListener("beforeunload", saveBeforeUnload);
    return () => window.removeEventListener("beforeunload", saveBeforeUnload);
  }, []);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, []);

  const canvasInteractionStyle = useMemo(() => {
    if (!plan) return undefined;
    return {
      width: `${plan.sheetPx.width * currentPreviewScale}px`,
      height: `${plan.sheetPx.height * currentPreviewScale}px`
    };
  }, [currentPreviewScale, plan]);

  const imageFrameStyle = useMemo(() => {
    if (!resizeFrameGeometry) return null;
    const displayScale = resizeFrameGeometry.displayScale;

    return {
      left: `${resizeFrameGeometry.displayLeft * displayScale}px`,
      top: `${resizeFrameGeometry.displayTop * displayScale}px`,
      width: `${resizeFrameGeometry.frameWidth * displayScale}px`,
      height: `${resizeFrameGeometry.frameHeight * displayScale}px`,
      transform: `rotate(${settings.rotationDeg + (resizeFrameGeometry.pageFlipped ? 180 : 0)}deg)`
    };
  }, [resizeFrameGeometry, settings.rotationDeg]);

  const insights = sourceImage ? getImageInsights(sourceImage) : [];
  const canExport = Boolean((sourceImage || textObjects.length) && plan);
  const hasPrintableContent = Boolean((sourceImage || textObjects.length) && plan);

  if (!activeMission && homeView === "dashboard") {
    return (
      <main className="dashboard-shell">
        <section className="dashboard-panel" aria-labelledby="dashboard-title">
          <header className="dashboard-header">
            <div className="mission-brand">
              <div className="brand-mark">N</div>
              <div>
                <span>Nitro Studio</span>
                <strong>Painel do Dia</strong>
              </div>
            </div>
            <button className="dashboard-start-button" type="button" onClick={() => setHomeView("mission")}>
              <Plus size={22} />
              Começar novo trabalho
            </button>
          </header>

          <div className="dashboard-hero">
            <div>
              <span>Bom trabalho por aqui</span>
              <h1 id="dashboard-title">Seu estúdio pronto para produzir.</h1>
              <p>Veja o que está mais usado, confira a impressora atual e comece uma nova preparação em poucos cliques.</p>
            </div>
            <div className="dashboard-printer-card">
              <Printer size={24} />
              <span>{settings.printerConfigured ? "Impressora selecionada" : "Impressora"}</span>
              <strong>{settings.printerConfigured ? settings.printerModel : "Não selecionada"}</strong>
              <small>{settings.printerConfigured ? `${settings.printQuality} · ${settings.paperType}` : "Configure no Assistente de Impressão antes de imprimir."}</small>
            </div>
          </div>

          <div className="dashboard-grid">
            <section className="dashboard-card dashboard-card-wide">
              <div className="dashboard-card-heading">
                <span>
                  <Images size={18} />
                  <h2>Últimos projetos</h2>
                </span>
                {recentProjects.length > 0 && (
                  <div className="dashboard-card-actions">
                    <button className="mini-button" onClick={selectAllRecentProjects}>Selecionar</button>
                    <button className="mini-button" onClick={() => setCheckedRecentProjectIds([])} disabled={!checkedRecentProjectIds.length}>Limpar</button>
                    <button className="mini-button danger-mini" onClick={deleteSelectedRecentProjects} disabled={!checkedRecentProjectIds.length}>
                      Excluir {checkedRecentProjectIds.length || ""}
                    </button>
                  </div>
                )}
              </div>
              {recentProjects.length ? (
                <div className="recent-list">
                  {recentProjects.map((project) => {
                    const projectKey = getRecentProjectKey(project);
                    return (
                      <article className={checkedRecentProjectIds.includes(projectKey) ? "recent-project is-checked" : "recent-project"} key={projectKey}>
                        <label className="recent-check">
                          <input
                            type="checkbox"
                            checked={checkedRecentProjectIds.includes(projectKey)}
                            onChange={() => toggleRecentProject(projectKey)}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setHomeView("mission");
                            setMessage(`Use ${project.destinationLabel} como referência e importe a arte novamente.`);
                          }}
                        >
                          <strong>{project.name}</strong>
                          <span>{project.destinationLabel} · {project.sheetLabel}</span>
                          <small>{project.imageCount} arte(s) · {formatDashboardDate(project.updatedAt)}</small>
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="dashboard-empty">
                  <ImagePlus size={24} />
                  <strong>Nenhum projeto recente ainda</strong>
                  <span>Quando você importar uma arte, o Nitro registra este resumo aqui.</span>
                </div>
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-card-heading">
                <Target size={18} />
                <h2>Produtos mais usados</h2>
              </div>
              {mostUsedProducts.length ? (
                <div className="product-usage-list">
                  {mostUsedProducts.map(({ item, count }) => (
                    <div className="usage-row" key={item.id}>
                      <span>{destinationIcons[item.id]}</span>
                      <strong>{item.label}</strong>
                      <small>{count} uso(s)</small>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty compact">
                  <span>Escolha uma missão para o Nitro aprender seus produtos mais usados.</span>
                </div>
              )}
            </section>

            <section className="dashboard-card">
              <div className="dashboard-card-heading">
                <BadgeCheck size={18} />
                <h2>Perfil favorito</h2>
              </div>
              <div className="favorite-profile">
                <span>{destinationIcons[favoriteProduct.id]}</span>
                <strong>{favoriteProduct.label}</strong>
                <small>{favoriteProduct.intent}</small>
              </div>
            </section>
          </div>
        </section>
      </main>
    );
  }

  if (!activeMission) {
    return (
      <main className="mission-shell">
        <section className="mission-panel" aria-labelledby="mission-title">
          <div className="mission-brand">
            <div className="brand-mark">N</div>
            <div>
              <span>Nitro Studio</span>
              <strong>Missão do Dia</strong>
            </div>
          </div>
          <div className="mission-copy">
            <span>Bem-vindo ao Nitro Studio</span>
            <h1 id="mission-title">O que você quer fazer hoje?</h1>
            <p>Escolha um objetivo e o Nitro já ajusta folha, perfil, encaixe, impressão e assistente para esse trabalho.</p>
          </div>
          <div className="mission-grid">
            {missionOptions.map((mission) => {
              const MissionIcon = mission.icon;
              return (
                <button className="mission-card" key={mission.id} type="button" onClick={() => startMission(mission.id)}>
                  <span className="mission-icon">
                    <MissionIcon size={28} />
                  </span>
                  <strong>{mission.title}</strong>
                  <span>{mission.subtitle}</span>
                  <small>{mission.detail}</small>
                </button>
              );
            })}
          </div>
          <footer className="mission-footer">
            <BadgeCheck size={17} />
            Comece simples. Depois você pode trocar perfil, cortar, esticar, simular e imprimir com controle fino.
          </footer>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">N</div>
          <div>
            <span>Nitro Studio</span>
            <strong>Preparação inteligente para impressão</strong>
          </div>
        </div>
        <div className="top-actions">
          <button className="secondary-button mission-switch" onClick={() => setActiveMission(null)}>
            <Target size={18} />
            {currentMission?.title ?? "Missão do Dia"}
          </button>
          <button className="autosave-pill" type="button" onClick={() => saveWorkspaceNow(true)} title="Salvar workspace local agora">
            <Save size={15} />
            <span>Autosave</span>
            <small>{autosaveLabel}</small>
          </button>
          <button className="secondary-button" onClick={arrangeArtwork}>
            <Sparkles size={18} />
            Arrumar Minha Arte
          </button>
          <button className="secondary-button" onClick={applyNitroPlan}>
            <WandSparkles size={18} />
            Preparar com Nitro
          </button>
          <button className="icon-button" onClick={undo} disabled={!history.length && !textHistory.length} title="Desfazer ajuste">
            <RotateCcw size={18} />
          </button>
          <button className="icon-button" onClick={redo} disabled={!redoHistory.length && !textRedoHistory.length} title="Refazer ajuste">
            <Redo2 size={18} />
          </button>
        </div>
      </header>

      <section className="quick-flow" aria-label="Regra dos 3 cliques">
        <input
          ref={quickFileInputRef}
          className="quick-import-input"
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileInputChange}
        />
        <div className="quick-flow-copy">
          <span>Regra dos 3 cliques</span>
          <strong>{currentMission ? currentMission.title : "Importar arte, aceitar recomendação e simular impressão"}</strong>
          <small>{currentMission ? currentMission.subtitle : "O Nitro orienta, previne erro e deixa o ajuste fino nas suas mãos."}</small>
        </div>
        <button className={sourceImage ? "quick-step is-done" : "quick-step"} onClick={() => quickFileInputRef.current?.click()}>
          <span>1</span>
          <strong>Importar arte</strong>
          <small>{sourceImage ? sourceImage.name : "PNG, JPG ou WebP"}</small>
          <Upload size={18} />
        </button>
        <button className={plan ? "quick-step is-done" : "quick-step"} onClick={acceptRecommendation}>
          <span>2</span>
          <strong>Aceitar recomendação</strong>
          <small>{plan ? `${plan.effectiveDpi} DPI efetivos` : "Nitro analisa e corrige"}</small>
          <WandSparkles size={18} />
        </button>
        <button className={canExport ? "quick-step is-ready" : "quick-step"} onClick={openPrintSimulation} disabled={!canExport || isPreparing}>
          <span>3</span>
          <strong>{isPreparing ? "Preparando" : "Simular impressão"}</strong>
          <small>{canExport ? "Prévia antes de baixar" : "Aguardando plano"}</small>
          <Printer size={18} />
        </button>
      </section>

      <section className="flow-strip" aria-label="Fluxo Nitro">
        {["Imagem", "Destino", "Encaixe", "Exportar"].map((step, index) => {
          const done =
            (index === 0 && sourceImage) ||
            (index === 1 && sourceImage) ||
            (index === 2 && plan) ||
            (index === 3 && canExport);
          return (
            <div className={done ? "flow-step is-done" : "flow-step"} key={step}>
              <span>{done ? <Check size={14} /> : index + 1}</span>
              {step}
            </div>
          );
        })}
      </section>

      <section className="workspace">
        <aside className="control-rail">
          <section className="panel upload-panel">
            <div className="panel-heading">
              <Images size={18} />
              <h2>Artes do projeto</h2>
            </div>
            <label
              className={isDragging ? "dropzone is-dragging" : "dropzone"}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                multiple
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileInputChange}
              />
              {sourceImage ? (
                <img src={sourceImage.url} alt="" />
              ) : (
                <span className="upload-symbol">
                  <ImagePlus size={28} />
                </span>
              )}
              <strong>{sourceImage ? sourceImage.name : "Adicionar artes"}</strong>
              {sourceImage ? (
                <small>
                  {sourceImage.width} x {sourceImage.height}px · {images.length} no projeto
                  {montageImages.length > 1 ? ` · montagem com ${montageImages.length}` : ""}
                </small>
              ) : (
                <small>PNG, JPG ou WebP</small>
              )}
            </label>
            <div className="image-actions">
              <label className="secondary-button file-action">
                <Plus size={16} />
                Adicionar
                <input
                  type="file"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileInputChange}
                />
              </label>
              <button className="danger-button" onClick={deleteSelectedImage} disabled={!sourceImage}>
                <Trash2 size={16} />
                {checkedImageIds.length > 1 ? `Excluir ${checkedImageIds.length}` : "Excluir"}
              </button>
            </div>
            {sourceImage && (
              <button className="text-button" onClick={duplicateSelectedImage}>
                <Copy size={15} />
                Duplicar arte ativa
              </button>
            )}
            {images.length > 1 && (
              <div className="library-toolbar">
                <button className="mini-button" onClick={selectAllImages}>
                  Selecionar todas
                </button>
                <button className="mini-button" onClick={() => setCheckedImageIds([])} disabled={!checkedImageIds.length}>
                  Limpar seleção
                </button>
              </div>
            )}
            {images.length > 1 && (
              <div className="asset-list">
                {images.map((image) => (
                  <button
                    className={image.id === sourceImage?.id ? "asset-item is-selected" : "asset-item"}
                    key={image.id}
                    onClick={() => selectImage(image.id)}
                    title={image.name}
                  >
                    <label className="asset-check" onClick={(event) => event.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedImageIds.includes(image.id)}
                        onChange={() => toggleCheckedImage(image.id)}
                      />
                    </label>
                    <img src={image.url} alt="" />
                    <span>
                      <strong>{image.name}</strong>
                      <small>{image.width} x {image.height}px</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {montageImages.length > 1 && (
              <div className="montage-note">
                <Layers size={15} />
                Montagem automática ativa com {montageImages.length} artes marcadas.
              </div>
            )}
            {images.length > 1 && (
              <button className="text-button" onClick={clearImages}>
                Limpar biblioteca
              </button>
            )}
            {message && <p className="inline-message">{message}</p>}
          </section>

          <section className="panel compact-panel">
            <div className="panel-heading">
              <Sparkles size={18} />
              <h2>Perfis inteligentes</h2>
            </div>
            <div className="profile-grid">
              {smartProfiles.map((profile) => (
                <button
                  className={settings.destinationId === profile.destinationId ? "profile-card is-selected" : "profile-card"}
                  key={profile.id}
                  onClick={() => applySmartProfile(profile)}
                >
                  <strong>{profile.label}</strong>
                  <span>{profile.product}</span>
                  <small>{profile.note}</small>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <ClipboardCheck size={18} />
              <h2>Destino</h2>
            </div>
            <div className="preset-grid">
              {destinationPresets.map((item) => (
                <button
                  className={item.id === destination.id ? "preset-card is-selected" : "preset-card"}
                  key={item.id}
                  onClick={() => handleDestination(item)}
                >
                  <span>{destinationIcons[item.id]}</span>
                  <strong>{item.label}</strong>
                  <small>{item.widthMm} x {item.heightMm} mm</small>
                </button>
              ))}
            </div>
            {settings.destinationId === "custom" && (
              <div className="numeric-grid">
                <label className="field">
                  <span>Largura mm</span>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={settings.customWidthMm}
                    onChange={(event) => updateSettings({ customWidthMm: Number(event.target.value) })}
                  />
                </label>
                <label className="field">
                  <span>Altura mm</span>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    value={settings.customHeightMm}
                    onChange={(event) => updateSettings({ customHeightMm: Number(event.target.value) })}
                  />
                </label>
              </div>
            )}
          </section>

          <section className="panel compact-panel text-panel">
            <div className="panel-heading">
              <span>
                <FileText size={18} />
                <h2>Texto</h2>
              </span>
            </div>
            <input
              ref={fontFileInputRef}
              className="hidden-input"
              type="file"
              accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
              onChange={handleFontImport}
            />
            <div className="lettering-wizard">
              <div>
                <strong>Criar meu letreiro</strong>
                <small>Gere variações por regras reais, sem converter em imagem.</small>
              </div>
              <label className="field">
                <span>Texto</span>
                <input value={letteringDraft} onChange={(event) => setLetteringDraft(event.target.value)} placeholder="Nome, frase ou marca" />
              </label>
              <div className="text-row">
                <label className="field">
                  <span>Categoria</span>
                  <select value={letteringCategory} onChange={(event) => setLetteringCategory(event.target.value as LetteringPresetCategory)}>
                    {presetCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                  </select>
                </label>
                <button className="text-button" onClick={createLetteringFromWizard}>
                  <WandSparkles size={15} />
                  Criar
                </button>
              </div>
              <div className="preset-strip">
                {visibleLetteringPresets.map((preset) => (
                  <button key={preset.id} type="button" onClick={() => createLetteringFromPreset(preset.id)}>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
            {selectedText ? (
              <div className="text-controls">
                <label className="field">
                  <span>Editar texto</span>
                  <textarea value={selectedText.content} rows={3} onChange={(event) => updateSelectedTextContent(event.target.value)} />
                </label>
                <div className="text-row">
                  <label className="field">
                    <span>Fonte</span>
                    <select value={selectedText.fontFamily} onChange={(event) => updateSelectedText({ fontFamily: event.target.value })}>
                      {fonts.map((font) => <option key={font.id} value={font.family}>{font.name}</option>)}
                    </select>
                  </label>
                  <label className="field">
                    <span>Tamanho</span>
                    <input type="number" min="8" max="420" value={selectedText.fontSize} onChange={(event) => updateSelectedText({ fontSize: Number(event.target.value) })} />
                  </label>
                </div>
                <div className="text-row">
                  <label className="field">
                    <span>Cor</span>
                    <input type="color" value={selectedText.color} onChange={(event) => updateSelectedText({ color: event.target.value })} />
                  </label>
                  <label className="field">
                    <span>Alinhamento</span>
                    <select value={selectedText.align} onChange={(event) => updateSelectedText({ align: event.target.value as TextObject["align"] })}>
                      <option value="left">Esquerda</option>
                      <option value="center">Centro</option>
                      <option value="right">Direita</option>
                    </select>
                  </label>
                </div>
                <div className="tool-grid compact">
                  <button className={selectedText.bold ? "tool-button is-active" : "tool-button"} onClick={() => updateSelectedText({ bold: !selectedText.bold })}>B</button>
                  <button className={selectedText.italic ? "tool-button is-active" : "tool-button"} onClick={() => updateSelectedText({ italic: !selectedText.italic })}>I</button>
                  <button className={selectedText.underline ? "tool-button is-active" : "tool-button"} onClick={() => updateSelectedText({ underline: !selectedText.underline })}>U</button>
                  <button className={selectedText.mirror ? "tool-button is-active" : "tool-button"} onClick={() => updateSelectedText({ mirror: !selectedText.mirror })}>Espelhar texto</button>
                  <button className="tool-button" onClick={fitSelectedTextToArea}>Encaixar</button>
                  <button className="tool-button" onClick={fillSelectedTextWidth}>Largura</button>
                  <button className="tool-button" onClick={duplicateSelectedText}>Duplicar</button>
                </div>
                <div className="text-row">
                  <label className="field">
                    <span>Curvar</span>
                    <select value={selectedText.curve.mode} onChange={(event) => updateSelectedText({ curve: { ...selectedText.curve, mode: event.target.value as TextCurveMode, intensity: event.target.value === "straight" ? 0 : Math.max(selectedText.curve.intensity, 18) } })}>
                      <option value="straight">Reto</option>
                      <option value="arc-up">Arco para cima</option>
                      <option value="arc-down">Arco para baixo</option>
                      <option value="circle">Círculo</option>
                      <option value="semicircle">Semicírculo</option>
                      <option value="wave">Onda leve</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Efeitos</span>
                    <select value={selectedText.effectPreset} onChange={(event) => applyPresetToSelectedText(event.target.value as TextEffectPreset)}>
                      {letteringPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                    </select>
                  </label>
                </div>
                <details className="more-adjustments">
                  <summary>Mais ajustes</summary>
                  <div className="text-row">
                    <label className="field">
                      <span>Caixa</span>
                      <select value={selectedText.caseMode} onChange={(event) => updateSelectedText({ caseMode: event.target.value as TextObject["caseMode"] })}>
                        <option value="normal">Normal</option>
                        <option value="upper">Caixa alta</option>
                        <option value="lower">Caixa baixa</option>
                        <option value="capitalize">Capitalizar</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Linha</span>
                      <input type="number" min="0.8" max="2.4" step="0.05" value={selectedText.lineHeight} onChange={(event) => updateSelectedText({ lineHeight: Number(event.target.value) })} />
                    </label>
                  </div>
                  <label className="range-field">
                    <span>Espaçamento <strong>{selectedText.letterSpacing}px</strong></span>
                    <input type="range" min="-4" max="28" value={selectedText.letterSpacing} onChange={(event) => updateSelectedText({ letterSpacing: Number(event.target.value) })} />
                  </label>
                  <label className="range-field">
                    <span>Intensidade da curva <strong>{selectedText.curve.intensity}px</strong></span>
                    <input type="range" min="0" max="120" value={selectedText.curve.intensity} onChange={(event) => updateSelectedText({ curve: { ...selectedText.curve, intensity: Number(event.target.value) } })} />
                  </label>
                  <label className="range-field">
                    <span>Rotação <strong>{selectedText.rotation}°</strong></span>
                    <input type="range" min="-180" max="180" value={selectedText.rotation} onChange={(event) => updateSelectedText({ rotation: Number(event.target.value) })} />
                  </label>
                  <label className="range-field">
                    <span>Opacidade <strong>{Math.round(selectedText.opacity * 100)}%</strong></span>
                    <input type="range" min="0.1" max="1" step="0.05" value={selectedText.opacity} onChange={(event) => updateSelectedText({ opacity: Number(event.target.value) })} />
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={selectedText.outline.enabled} onChange={(event) => updateSelectedText({ outline: { ...selectedText.outline, enabled: event.target.checked } })} />
                    Contorno
                  </label>
                  <div className="text-row">
                    <label className="field">
                      <span>Cor contorno</span>
                      <input type="color" value={selectedText.outline.color} onChange={(event) => updateSelectedText({ outline: { ...selectedText.outline, color: event.target.value } })} />
                    </label>
                    <label className="field">
                      <span>Espessura</span>
                      <input type="number" min="0" max="40" value={selectedText.outline.width} onChange={(event) => updateSelectedText({ outline: { ...selectedText.outline, width: Number(event.target.value) } })} />
                    </label>
                  </div>
                  <label className="toggle">
                    <input type="checkbox" checked={selectedText.shadow.enabled} onChange={(event) => updateSelectedText({ shadow: { ...selectedText.shadow, enabled: event.target.checked } })} />
                    Sombra
                  </label>
                  <label className="toggle">
                    <input type="checkbox" checked={selectedText.doubleOutline.enabled} onChange={(event) => updateSelectedText({ doubleOutline: { ...selectedText.doubleOutline, enabled: event.target.checked, width: event.target.checked ? Math.max(10, selectedText.doubleOutline.width) : selectedText.doubleOutline.width } })} />
                    Contorno duplo
                  </label>
                  {selectedText.doubleOutline.enabled && (
                    <div className="text-row">
                      <label className="field">
                        <span>Cor 2º contorno</span>
                        <input type="color" value={selectedText.doubleOutline.color} onChange={(event) => updateSelectedText({ doubleOutline: { ...selectedText.doubleOutline, color: event.target.value } })} />
                      </label>
                      <label className="field">
                        <span>Espessura 2</span>
                        <input type="number" min="0" max="80" value={selectedText.doubleOutline.width} onChange={(event) => updateSelectedText({ doubleOutline: { ...selectedText.doubleOutline, width: Number(event.target.value) } })} />
                      </label>
                    </div>
                  )}
                  <label className="toggle">
                    <input type="checkbox" checked={selectedText.gradient.enabled} onChange={(event) => updateSelectedText({ gradient: { ...selectedText.gradient, enabled: event.target.checked } })} />
                    Degradê
                  </label>
                  {selectedText.gradient.enabled && (
                    <div className="text-row">
                      <label className="field">
                        <span>Cor inicial</span>
                        <input type="color" value={selectedText.gradient.from} onChange={(event) => updateSelectedText({ gradient: { ...selectedText.gradient, from: event.target.value } })} />
                      </label>
                      <label className="field">
                        <span>Cor final</span>
                        <input type="color" value={selectedText.gradient.to} onChange={(event) => updateSelectedText({ gradient: { ...selectedText.gradient, to: event.target.value } })} />
                      </label>
                    </div>
                  )}
                </details>
                <div className="font-manager">
                  <div className="text-row">
                    <input className="font-search" placeholder="Buscar fonte" value={fontSearch} onChange={(event) => setFontSearch(event.target.value)} />
                    <select value={fontCategory} onChange={(event) => setFontCategory(event.target.value)}>
                      {fontCategories.map((category) => <option key={category} value={category}>{category}</option>)}
                    </select>
                  </div>
                  <button className="text-button full" onClick={() => fontFileInputRef.current?.click()}>Adicionar minhas fontes</button>
                  <small>Use somente fontes que você possui autorização para utilizar.</small>
                  <div className="font-list">
                    {filteredFonts.slice(0, 10).map((font) => (
                      <div
                        className={selectedText.fontFamily === font.family ? "font-option is-selected" : "font-option"}
                        key={font.id}
                        role="button"
                        tabIndex={0}
                        style={{ fontFamily: font.family }}
                        onClick={() => selectFontForText(font)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") selectFontForText(font);
                        }}
                      >
                        <span>Nitro Studio</span>
                        <small>{font.name}</small>
                        <button type="button" className={font.favorite ? "font-star is-active" : "font-star"} onClick={(event) => { event.stopPropagation(); toggleFontFavorite(font); }}>★</button>
                        {font.source === "imported" && (
                          <button
                            type="button"
                            className="font-remove"
                            onClick={(event) => {
                              event.stopPropagation();
                              void deleteImportedFont(font);
                            }}
                            aria-label={`Excluir fonte ${font.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <button className="danger-button full" onClick={deleteSelectedText}>
                  <Trash2 size={16} />
                  Excluir texto
                </button>
              </div>
            ) : (
              <div className="quiet-state">Adicione ou selecione um texto para editar letreiros.</div>
            )}
          </section>

          <section className="panel compact-panel">
            <div className="panel-heading">
              <ArrowDownToLine size={18} />
              <h2>Saída</h2>
            </div>
            <label className="field">
              <span>Folha</span>
              <select value={settings.sheetId} onChange={(event) => updateSettings({ sheetId: event.target.value as SheetId })}>
                {sheetPresets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="sheet-rotation">
              <span>Girar papel</span>
              <div className="rotation-grid">
                {([
                  { value: 0, label: "Retrato", detail: "0°" },
                  { value: 90, label: "Paisagem", detail: "90°" },
                  { value: 180, label: "Invertido", detail: "180°" },
                  { value: 270, label: "Paisagem inv.", detail: "270°" }
                ] as const).map((item) => (
                  <button
                    className={settings.sheetRotationDeg === item.value ? "is-selected" : ""}
                    key={item.value}
                    onClick={() => updateSheetRotation(item.value)}
                    title={`${item.label} · ${item.detail}`}
                  >
                    <RotateCw size={15} />
                    <strong>{item.label}</strong>
                    <small>{item.detail}</small>
                  </button>
                ))}
              </div>
            </div>
            <div className="segmented">
              {dpiOptions.map((dpi) => (
                <button
                  className={settings.dpi === dpi ? "is-selected" : ""}
                  key={dpi}
                  onClick={() => updateSettings({ dpi })}
                >
                  {dpi}
                </button>
              ))}
            </div>
            <div className={`dpi-indicator ${plan?.effectiveDpi && plan.effectiveDpi >= 190 ? "good" : plan?.effectiveDpi && plan.effectiveDpi >= 130 ? "warn" : "fail"}`}>
              <span>DPI indicado</span>
              <strong>{plan ? `${plan.effectiveDpi} efetivos` : `${settings.dpi} configurado`}</strong>
              <small>
                {plan
                  ? plan.effectiveDpi >= 190
                    ? "Adequado para o tamanho atual."
                    : "Aumente a imagem, reduza o tamanho ou use melhor arquivo."
                  : "Importe uma arte para calcular o DPI real."}
              </small>
            </div>
            <div className="segmented two">
              {(["pdf", "png"] as const).map((format) => (
                <button
                  className={settings.exportFormat === format ? "is-selected" : ""}
                  key={format}
                  onClick={() => updateSettings({ exportFormat: format })}
                >
                  <FileType size={15} />
                  {format.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="numeric-grid">
              <label className="field">
                <span>Cópias</span>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={settings.copies}
                  onChange={(event) => updateSettings({ copies: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Espaço mm</span>
                <input
                  type="number"
                  min="0"
                  max="30"
                  value={settings.gapMm}
                  onChange={(event) => updateSettings({ gapMm: Number(event.target.value) })}
                />
              </label>
            </div>
            <label className="range-field">
              <span>Sangria <strong>{settings.bleedMm} mm</strong></span>
              <input
                type="range"
                min="0"
                max="8"
                value={settings.bleedMm}
                onChange={(event) => updateSettings({ bleedMm: Number(event.target.value) })}
              />
            </label>
            <label className="range-field">
              <span>Margem <strong>{settings.marginMm} mm</strong></span>
              <input
                type="range"
                min="0"
                max="18"
                value={settings.marginMm}
                onChange={(event) => updateSettings({ marginMm: Number(event.target.value) })}
              />
            </label>
          </section>

          <section className="panel compact-panel">
            <div className="panel-heading with-action">
              <span>
                <Scissors size={18} />
                <h2>Corte</h2>
              </span>
              <button className="mini-button" onClick={resetCrop} disabled={!sourceImage}>
                Zerar
              </button>
            </div>
            {sourceImage ? (
              <div
                className={cropDrag ? "crop-editor is-dragging" : "crop-editor"}
                style={{ aspectRatio: `${sourceImage.width} / ${sourceImage.height}` }}
                onPointerDown={handleCropPointerDown}
                onPointerMove={handleCropPointerMove}
                onPointerUp={handleCropPointerUp}
                onPointerCancel={() => setCropDrag(null)}
              >
                <img src={sourceImage.url} alt="" draggable={false} />
                <div className="crop-dim top" style={{ height: `${visibleCrop.top}%` }} />
                <div className="crop-dim bottom" style={{ height: `${visibleCrop.bottom}%` }} />
                <div
                  className="crop-dim left"
                  style={{
                    top: `${visibleCrop.top}%`,
                    width: `${visibleCrop.left}%`,
                    height: `${100 - visibleCrop.top - visibleCrop.bottom}%`
                  }}
                />
                <div
                  className="crop-dim right"
                  style={{
                    top: `${visibleCrop.top}%`,
                    width: `${visibleCrop.right}%`,
                    height: `${100 - visibleCrop.top - visibleCrop.bottom}%`
                  }}
                />
                <div
                  className={pendingCrop ? "crop-box is-pending" : "crop-box"}
                  style={{
                    left: `${visibleCrop.left}%`,
                    top: `${visibleCrop.top}%`,
                    width: `${100 - visibleCrop.left - visibleCrop.right}%`,
                    height: `${100 - visibleCrop.top - visibleCrop.bottom}%`
                  }}
                >
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : (
              <div className="quiet-state">Adicione uma arte para recortar.</div>
            )}
            <p className="microcopy">
              {pendingCrop ? "Área selecionada. Clique em Cortar para aplicar." : "Arraste sobre a imagem para selecionar uma parte específica."}
            </p>
            <div className="crop-actions">
              <button className="assist-button" onClick={applySelectedCrop} disabled={!pendingCrop}>
                <Scissors size={16} />
                Cortar
              </button>
              <button className="assist-button" onClick={applySmartCrop} disabled={!sourceImage}>
                <WandSparkles size={16} />
                Inteligente
              </button>
            </div>
            <div className="crop-grid">
              <label className="range-field">
                <span>Topo <strong>{settings.cropTop}%</strong></span>
                <input
                  type="range"
                  min="0"
                  max="45"
                  value={settings.cropTop}
                  onChange={(event) => updateSettings({ cropTop: Number(event.target.value) })}
                />
              </label>
              <label className="range-field">
                <span>Direita <strong>{settings.cropRight}%</strong></span>
                <input
                  type="range"
                  min="0"
                  max="45"
                  value={settings.cropRight}
                  onChange={(event) => updateSettings({ cropRight: Number(event.target.value) })}
                />
              </label>
              <label className="range-field">
                <span>Base <strong>{settings.cropBottom}%</strong></span>
                <input
                  type="range"
                  min="0"
                  max="45"
                  value={settings.cropBottom}
                  onChange={(event) => updateSettings({ cropBottom: Number(event.target.value) })}
                />
              </label>
              <label className="range-field">
                <span>Esquerda <strong>{settings.cropLeft}%</strong></span>
                <input
                  type="range"
                  min="0"
                  max="45"
                  value={settings.cropLeft}
                  onChange={(event) => updateSettings({ cropLeft: Number(event.target.value) })}
                />
              </label>
            </div>
          </section>

          <section className="panel compact-panel">
            <div className="panel-heading">
              <Move size={18} />
              <h2>Ajuste da arte</h2>
            </div>
            <div className="tool-grid">
              <button
                className={settings.mirror ? "tool-button is-active" : "tool-button"}
                onClick={() => updateSettings({ mirror: !settings.mirror })}
              >
                <FlipHorizontal2 size={16} />
                Horizontal
              </button>
              <button
                className={settings.flipVertical ? "tool-button is-active" : "tool-button"}
                onClick={() => updateSettings({ flipVertical: !settings.flipVertical })}
              >
                <FlipVertical2 size={16} />
                Vertical
              </button>
              <button className="tool-button" onClick={() => updateSettings({ rotationDeg: settings.rotationDeg - 5 })}>
                <RotateCcw size={16} />
                Inclinar
              </button>
              <button className="tool-button" onClick={() => updateSettings({ rotationDeg: settings.rotationDeg + 5 })}>
                <RotateCw size={16} />
                Declinar
              </button>
              <button className="tool-button" onClick={() => updateSettings({ rotationDeg: settings.rotationDeg - 90 })}>
                <RotateCcw size={16} />
                -90°
              </button>
              <button className="tool-button" onClick={() => updateSettings({ rotationDeg: settings.rotationDeg + 90 })}>
                <RotateCw size={16} />
                +90°
              </button>
              <button className="tool-button" onClick={centerArtwork}>
                <Maximize size={16} />
                Centralizar
              </button>
              <button className="tool-button" onClick={stretchArtworkToArea}>
                <Maximize size={16} />
                Esticar área
              </button>
              <button className="tool-button" onClick={stretchArtworkToWholeSheet}>
                <Printer size={16} />
                Folha inteira
              </button>
              <button className="tool-button" onClick={fitHandlesIntoArea}>
                <Move size={16} />
                Ajustar alças
              </button>
            </div>
            <div className="measure-tool">
              <div className="measure-heading">
                <strong>Redimensionar por medida</strong>
                <select
                  value={settings.measureUnit}
                  onChange={(event) => updateSettings({ measureUnit: event.target.value as Settings["measureUnit"] })}
                >
                  <option value="cm">cm</option>
                  <option value="mm">mm</option>
                  <option value="in">pol</option>
                </select>
              </div>
              <div className="numeric-grid">
                <label className="field">
                  <span>Largura {measureUnitLabels[settings.measureUnit]}</span>
                  <input
                    type="number"
                    min="0.1"
                    step={settings.measureUnit === "mm" ? 1 : 0.1}
                    value={formatMeasure(destination.widthMm, settings.measureUnit)}
                    onChange={(event) => updateMeasuredArtworkSize("width", Number(event.target.value))}
                  />
                </label>
                <label className="field">
                  <span>Altura {measureUnitLabels[settings.measureUnit]}</span>
                  <input
                    type="number"
                    min="0.1"
                    step={settings.measureUnit === "mm" ? 1 : 0.1}
                    value={formatMeasure(destination.heightMm, settings.measureUnit)}
                    onChange={(event) => updateMeasuredArtworkSize("height", Number(event.target.value))}
                  />
                </label>
              </div>
              <label className="toggle measure-lock">
                <input
                  type="checkbox"
                  checked={settings.lockMeasureRatio}
                  onChange={(event) => updateSettings({ lockMeasureRatio: event.target.checked })}
                />
                Travar proporção
              </label>
              <small>Define o tamanho físico final da arte impressa.</small>
            </div>
            <label className="range-field">
              <span>Zoom <strong>{Math.round(settings.imageScale * 100)}%</strong></span>
              <input
                type="range"
                min="60"
                max="180"
                value={Math.round(settings.imageScale * 100)}
                onChange={(event) => updateSettings({ imageScale: Number(event.target.value) / 100 })}
              />
            </label>
            <label className="range-field">
              <span>Largura <strong>{Math.round(settings.imageScaleX * 100)}%</strong></span>
              <input
                type="range"
                min="20"
                max="400"
                value={Math.round(settings.imageScaleX * 100)}
                onChange={(event) => updateSettings({ imageScaleX: Number(event.target.value) / 100 })}
              />
            </label>
            <label className="range-field">
              <span>Altura <strong>{Math.round(settings.imageScaleY * 100)}%</strong></span>
              <input
                type="range"
                min="20"
                max="400"
                value={Math.round(settings.imageScaleY * 100)}
                onChange={(event) => updateSettings({ imageScaleY: Number(event.target.value) / 100 })}
              />
            </label>
            <div className="numeric-grid">
              <label className="field">
                <span>X mm</span>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={settings.offsetXmm}
                  onChange={(event) => updateSettings({ offsetXmm: Number(event.target.value) })}
                />
              </label>
              <label className="field">
                <span>Y mm</span>
                <input
                  type="number"
                  min="-100"
                  max="100"
                  value={settings.offsetYmm}
                  onChange={(event) => updateSettings({ offsetYmm: Number(event.target.value) })}
                />
              </label>
            </div>
            <label className="range-field">
              <span>Rotação <strong>{settings.rotationDeg}°</strong></span>
              <input
                type="range"
                min="-180"
                max="180"
                value={settings.rotationDeg}
                onChange={(event) => updateSettings({ rotationDeg: Number(event.target.value) })}
              />
            </label>
          </section>

          <section className="panel compact-panel">
            <div className="panel-heading">
              <Palette size={18} />
              <h2>Acabamento</h2>
            </div>
            <label className="range-field">
              <span>Brilho <strong>{settings.brightness}%</strong></span>
              <input
                type="range"
                min="70"
                max="130"
                value={settings.brightness}
                onChange={(event) => updateSettings({ brightness: Number(event.target.value) })}
              />
            </label>
            <label className="range-field">
              <span>Contraste <strong>{settings.contrast}%</strong></span>
              <input
                type="range"
                min="70"
                max="150"
                value={settings.contrast}
                onChange={(event) => updateSettings({ contrast: Number(event.target.value) })}
              />
            </label>
            <label className="range-field">
              <span>Saturação <strong>{settings.saturation}%</strong></span>
              <input
                type="range"
                min="60"
                max="170"
                value={settings.saturation}
                onChange={(event) => updateSettings({ saturation: Number(event.target.value) })}
              />
            </label>
          </section>

          <section className="panel compact-panel">
            <div className="panel-heading">
              <Printer size={18} />
              <h2>Produção</h2>
            </div>
            <div className="toggle-stack">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.cutMarks}
                  onChange={(event) => updateSettings({ cutMarks: event.target.checked })}
                />
                Marcas de corte
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.safeArea}
                  onChange={(event) => updateSettings({ safeArea: event.target.checked })}
                />
                Área segura
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.showGuides}
                  onChange={(event) => updateSettings({ showGuides: event.target.checked })}
                />
                Guia da arte
              </label>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.technicalLabel}
                  onChange={(event) => updateSettings({ technicalLabel: event.target.checked })}
                />
                Etiqueta técnica
              </label>
            </div>
          </section>
        </aside>

        <section className="preview-stage">
          <div className="stage-toolbar">
            <div className="fit-tabs">
              {(Object.keys(fitModeLabels) as FitMode[]).map((mode) => {
                const Icon = fitIcons[mode];
                return (
                  <button
                    className={settings.fitMode === mode ? "is-selected" : ""}
                    key={mode}
                    onClick={() => updateSettings({ fitMode: mode })}
                    title={fitModeLabels[mode]}
                  >
                    <Icon size={17} />
                    {fitModeLabels[mode]}
                  </button>
                );
              })}
            </div>
            <div className="stage-rotation" aria-label="Girar papel no preview">
              {([
                { value: 0, label: "Retrato" },
                { value: 90, label: "Paisagem" },
                { value: 180, label: "Inv." },
                { value: 270, label: "Pais. inv." }
              ] as const).map((item) => (
                <button
                  className={settings.sheetRotationDeg === item.value ? "is-selected" : ""}
                  key={item.value}
                  onClick={() => updateSheetRotation(item.value)}
                  title={sheetRotationLabels[item.value]}
                >
                  <RotateCw size={15} />
                  {item.label}
                </button>
              ))}
            </div>
            <div className="stage-actions">
              <button
                className={isTextToolsOpen && selectedText ? "secondary-button stage-text-button is-active" : "secondary-button stage-text-button"}
                onClick={toggleTextTools}
              >
                <FileText size={17} />
                {isTextToolsOpen && selectedText ? "Ocultar texto" : "Ferramentas de texto"}
              </button>
              <label className="paper-zoom-control" title="Zoom visual do papel na tela">
                <span>Zoom {paperZoomPercent}%</span>
                <input
                  type="range"
                  min="25"
                  max="250"
                  step="5"
                  value={paperZoomPercent}
                  onChange={(event) => setPaperZoomPercent(Number(event.target.value))}
                  aria-label="Zoom do papel na tela"
                />
              </label>
              {montageImages.length > 1 && (
                <div className="stage-status montage">
                  <strong>{montageImages.length}</strong>
                  <span>artes</span>
                </div>
              )}
              {plan && (
                <div className={`stage-status ${plan.status}`}>
                  <strong>{plan.readinessScore}%</strong>
                  <span>{plan.copyCount}x na folha</span>
                </div>
              )}
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={settings.mirror}
                  onChange={(event) => updateSettings({ mirror: event.target.checked })}
                />
                <FlipHorizontal2 size={17} />
                Espelhar
              </label>
            </div>
          </div>
          {hasPrintableContent && montageImages.length <= 1 && (
            <div className="stage-hint">
              <Move size={15} />
              Arraste a arte, selecione textos ou puxe as alças para ajustar.
            </div>
          )}
          {isTextToolsOpen && selectedText && activeTextStyle && (
            <div className="stage-text-toolbar" aria-label="Barra simples do texto">
              <input
                value={selectedText.content}
                onChange={(event) => updateSelectedTextContent(event.target.value)}
                aria-label="Editar texto"
              />
              <select value={activeTextStyle.fontFamily} onChange={(event) => updateTextStyleDraft("fontFamily", event.target.value)} aria-label="Fonte">
                {fonts.map((font) => <option key={font.id} value={font.family}>{font.name}</option>)}
              </select>
              <input
                className="text-size-input"
                type="number"
                min="8"
                max="420"
                value={activeTextStyle.fontSize}
                onChange={(event) => updateTextStyleDraft("fontSize", Number(event.target.value))}
                aria-label="Tamanho"
              />
              <input type="color" value={activeTextStyle.color} onChange={(event) => updateTextStyleDraft("color", event.target.value)} aria-label="Cor" />
              <button className={activeTextStyle.bold ? "is-active" : ""} onClick={() => updateTextStyleDraft("bold", !activeTextStyle.bold)}>B</button>
              <button className={activeTextStyle.italic ? "is-active" : ""} onClick={() => updateTextStyleDraft("italic", !activeTextStyle.italic)}>I</button>
              <select value={activeTextStyle.curveMode} onChange={(event) => updateTextStyleDraft("curveMode", event.target.value as TextCurveMode)} aria-label="Curvar">
                <option value="straight">Reto</option>
                <option value="arc-up">Arco ↑</option>
                <option value="arc-down">Arco ↓</option>
                <option value="wave">Onda</option>
                <option value="circle">Círculo</option>
              </select>
              <select value={activeTextStyle.effectPreset} onChange={(event) => updateTextStyleDraft("effectPreset", event.target.value as TextEffectPreset)} aria-label="Efeitos">
                {letteringPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
              </select>
              <div className="text-color-palette" aria-label="Tabela de cores para letras">
                {textColorPalette.map((color) => (
                  <button
                    className={activeTextStyle.color.toLowerCase() === color ? "is-selected" : ""}
                    key={color}
                    onClick={() => updateTextStyleDraft("color", color)}
                    style={{ backgroundColor: color }}
                    title={color}
                    type="button"
                  />
                ))}
              </div>
              <button className={hasPendingTextStyle ? "apply-style-button is-ready" : "apply-style-button"} onClick={applyTextStyleDraft} disabled={!hasPendingTextStyle}>
                Aplicar estilo
              </button>
              <button onClick={addTextToSheet}>Novo texto</button>
              <button onClick={fitSelectedTextToArea}>Encaixar</button>
              <button onClick={duplicateSelectedText}>Duplicar</button>
              <button className="danger-inline" onClick={deleteSelectedText}>Excluir</button>
            </div>
          )}

          <div className="canvas-wrap" ref={canvasWrapRef}>
            {hasPrintableContent && plan ? (
              <div className={resizeDrag ? "canvas-interaction is-resizing" : "canvas-interaction"} style={canvasInteractionStyle}>
                <canvas
                  className={positionDrag ? "is-positioning" : ""}
                  ref={previewCanvasRef}
                  aria-label="Preview de impressão"
                  onPointerDown={sourceImage ? handlePreviewPointerDown : undefined}
                  onPointerMove={sourceImage ? handlePreviewPointerMove : undefined}
                  onPointerUp={sourceImage ? handlePreviewPointerUp : undefined}
                  onPointerCancel={() => setPositionDrag(null)}
                />
                {imageFrameStyle && montageImages.length <= 1 && sourceImage && (
                  <div className="resize-frame" style={imageFrameStyle} aria-hidden="true">
                    {(["top-left", "top", "top-right", "right", "bottom-right", "bottom", "bottom-left", "left"] as const).map((handle) => (
                      <button
                        className={`resize-handle ${handle}`}
                        key={handle}
                        type="button"
                        tabIndex={-1}
                        onPointerDown={(event) => handleResizePointerDown(handle, event)}
                        onPointerMove={handleResizePointerMove}
                        onPointerUp={handleResizePointerUp}
                        onPointerCancel={handleResizePointerUp}
                      />
                    ))}
                  </div>
                )}
                <div className="text-layer" aria-label="Textos da arte">
                  {textObjects.map((text) => {
                    const pageFlipped = settings.sheetRotationDeg === 180 || settings.sheetRotationDeg === 270;
                    const displayX = pageFlipped ? plan.sheetPx.width - text.x : text.x;
                    const displayY = pageFlipped ? plan.sheetPx.height - text.y : text.y;
                    const editorFontSize = text.fontSize * currentPreviewScale;
                    const canShowEditorEffects = editorFontSize >= 18;
                    const editorStrokeWidth = canShowEditorEffects && text.outline.enabled
                      ? Math.min(2.4, Math.max(0.75, text.outline.width * currentPreviewScale))
                      : 0;
                    const editorShadow = canShowEditorEffects && text.shadow.enabled
                      ? `${Math.min(2, text.shadow.offsetX * currentPreviewScale)}px ${Math.min(2, text.shadow.offsetY * currentPreviewScale)}px ${Math.min(3, text.shadow.blur * currentPreviewScale)}px ${text.shadow.color}`
                      : "none";
                    const editorFrameWidth = text.frame.enabled ? Math.max(1, text.frame.width * currentPreviewScale) : 0;
                    const editorPadding = text.frame.enabled
                      ? Math.max(4, text.frame.padding * currentPreviewScale)
                      : text.background.enabled
                        ? text.background.padding * currentPreviewScale
                        : 3;
                    const editorBoxShadows = [
                      canShowEditorEffects && text.doubleOutline.enabled
                        ? `0 0 0 ${Math.min(3, Math.max(1, text.doubleOutline.width * currentPreviewScale * 0.28))}px ${text.doubleOutline.color}`
                        : "",
                      text.frame.enabled && (text.frame.style === "badge" || text.frame.style === "plaque" || text.frame.style === "stamp")
                        ? `inset 0 0 0 ${Math.max(1, editorFrameWidth * 1.8)}px ${text.frame.accentColor}`
                        : ""
                    ].filter(Boolean).join(", ") || undefined;
                    return (
                      <div
                        className={selectedTextId === text.id ? "text-object is-selected" : "text-object"}
                        key={text.id}
                        style={{
                          left: `${displayX * currentPreviewScale}px`,
                          top: `${displayY * currentPreviewScale}px`,
                          width: `${text.width * currentPreviewScale}px`,
                          color: text.color,
                          fontFamily: text.fontFamily,
                          fontSize: `${editorFontSize}px`,
                          fontWeight: text.bold ? 800 : 500,
                          fontStyle: text.italic ? "italic" : "normal",
                          textDecoration: text.underline ? "underline" : "none",
                          textAlign: text.align,
                          lineHeight: text.lineHeight,
                          letterSpacing: `${text.letterSpacing * currentPreviewScale}px`,
                          opacity: text.opacity,
                          transform: `translate(-50%, -50%) rotate(${text.rotation + (pageFlipped ? 180 : 0)}deg) scaleX(${text.mirror ? -1 : 1})`,
                          background: text.background.enabled ? text.background.color : text.frame.enabled ? "rgba(255, 255, 255, 0.72)" : text.gradient.enabled ? `linear-gradient(90deg, ${text.gradient.from}, ${text.gradient.to})` : "transparent",
                          border: text.frame.enabled ? `${editorFrameWidth}px ${text.frame.style === "stamp" ? "dashed" : "solid"} ${text.frame.color}` : undefined,
                          borderRadius: text.frame.enabled ? text.frame.style === "seal" ? "999px" : `${text.frame.radius * currentPreviewScale}px` : text.background.enabled ? `${text.background.radius * currentPreviewScale}px` : undefined,
                          clipPath: text.frame.enabled && text.frame.style === "label" ? "polygon(8% 0, 92% 0, 100% 50%, 92% 100%, 8% 100%, 0 50%)" : text.frame.enabled && text.frame.style === "ribbon" ? "polygon(0 0, 100% 0, 94% 50%, 100% 100%, 0 100%, 6% 50%)" : undefined,
                          padding: `${editorPadding}px`,
                          backgroundClip: text.gradient.enabled && !text.background.enabled ? "text" : undefined,
                          WebkitBackgroundClip: text.gradient.enabled && !text.background.enabled ? "text" : undefined,
                          WebkitTextFillColor: text.gradient.enabled && !text.background.enabled ? "transparent" : undefined,
                          textShadow: editorShadow,
                          WebkitTextStroke: editorStrokeWidth ? `${editorStrokeWidth}px ${text.outline.color}` : "0 transparent",
                          filter: canShowEditorEffects && text.glow.enabled ? `drop-shadow(0 0 ${Math.min(4, Math.max(1, text.glow.blur * currentPreviewScale))}px ${text.glow.color})` : undefined,
                          boxShadow: editorBoxShadows
                        }}
                        onPointerDown={(event) => editingTextId === text.id ? undefined : handleTextPointerDown(text, event)}
                        onPointerMove={handleTextPointerMove}
                        onPointerUp={handleTextPointerUp}
                        onPointerCancel={() => setTextDrag(null)}
                        onDoubleClick={(event) => {
                          event.stopPropagation();
                          setSelectedTextId(text.id);
                          setEditingTextId(text.id);
                        }}
                      >
                        <span
                          className="text-object-content"
                          contentEditable={editingTextId === text.id}
                          suppressContentEditableWarning
                          onBlur={(event) => {
                            const nextTexts = cleanupPlaceholderTexts(updateTextObject(textObjects, text.id, { content: event.currentTarget.textContent ?? "" }), text.id);
                            updateTextObjects(nextTexts);
                            try {
                              persistWorkspace(settings, nextTexts, text.id);
                            } catch {
                              // Autosave will retry on the next scheduled pass.
                            }
                            setEditingTextId(null);
                          }}
                        >
                          {editingTextId === text.id ? text.content : getPrintableText(text)}
                        </span>
                        {selectedTextId === text.id && editingTextId !== text.id && (
                          <button
                            className="text-resize-handle"
                            type="button"
                            onPointerDown={(event) => handleTextResizePointerDown(text, event)}
                            onPointerMove={handleTextResizePointerMove}
                            onPointerUp={handleTextResizePointerUp}
                            onPointerCancel={handleTextResizePointerUp}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="empty-preview">
                <div className="empty-sheet">
                  <Upload size={30} />
                  <span>Nitro</span>
                </div>
              </div>
            )}
          </div>
        </section>

        <aside className="intelligence-rail">
          <section className="panel assistant-panel">
            <div className="panel-heading">
              <Sparkles size={18} />
              <h2>Assistente Nitro</h2>
            </div>
            <div className="assistant-list">
              {assistantItems.map((item) => (
                <article className="assistant-card" key={`${item.problem}-${item.actionLabel}`}>
                  <strong>{item.problem}</strong>
                  <p><span>Causa:</span> {item.cause}</p>
                  <p><span>Recomendação:</span> {item.recommendation}</p>
                  <button onClick={item.resolve}>{item.actionLabel}</button>
                </article>
              ))}
            </div>
          </section>

          <section className="brain-panel">
            <div className="panel-heading">
              <Brain size={18} />
              <h2>Cérebros Nitro</h2>
            </div>
            <div className="brain-list">
              <BrainRow title="Entender" active={Boolean(sourceImage)} detail={sourceImage ? "Arte analisada" : "Aguardando arte"} />
              <BrainRow title="Decidir" active={Boolean(plan)} detail={plan ? plan.summary : destination.intent} />
              <BrainRow
                title="Executar"
                active={canExport}
                detail={canExport ? `${settings.exportFormat.toUpperCase()} pronto para gerar` : "Preview pendente"}
              />
            </div>
          </section>

          <section className="panel readiness-panel">
            <div className="panel-heading">
              <BadgeCheck size={18} />
              <h2>Prontidão</h2>
            </div>
            {plan ? (
              <>
                <div className={`score-ring ${plan.status}`}>
                  <strong>{plan.readinessScore}%</strong>
                  <span>
                    {plan.status === "ready"
                      ? "Pronto"
                      : plan.status === "attention"
                        ? "Revisar"
                        : "Corrigir"}
                  </span>
                </div>
                <div className="checklist">
                  {plan.checklist.map((item) => (
                    <div className={`check-item ${item.state}`} key={item.label}>
                      <span>{item.state === "ok" ? <Check size={13} /> : "!"}</span>
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="quiet-state">Carregue uma arte para calcular prontidão.</div>
            )}
          </section>

          <section className="panel simulation-panel">
            <div className="panel-heading">
              <Printer size={18} />
              <h2>Simulação real</h2>
            </div>
            {plan ? (
              <div className="simulation-list">
                {simulationItems.map((item) => (
                  <div className="simulation-item" key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small>{item.detail}</small>
                  </div>
                ))}
                <p className="simulation-note">
                  A simulação usa o plano atual. Cor real depende de impressora, tinta, papel e perfil físico configurado.
                </p>
              </div>
            ) : (
              <div className="quiet-state">Carregue uma arte para simular a impressão.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <Printer size={18} />
              <h2>Assistente de Impressão</h2>
            </div>
            {plan ? (
              <div className="instruction-grid">
                {printInstructionItems.map((item) => (
                  <div key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <div className="quiet-state">Prepare a arte para receber instruções de impressora e produto.</div>
            )}
          </section>

          <section className="panel guide-panel">
            <div className="panel-heading">
              <ClipboardCheck size={18} />
              <h2>Produção guiada</h2>
            </div>
            <div className="guide-list">
              {guidedSteps.map((step, index) => (
                <div className={step.done ? "guide-step is-done" : "guide-step"} key={step.label}>
                  <span>{step.done ? <Check size={13} /> : index + 1}</span>
                  <div>
                    <strong>{step.label}</strong>
                    <small>{step.detail}</small>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <Sparkles size={18} />
              <h2>Diagnóstico</h2>
            </div>
            {sourceImage ? (
              <div className="insight-list">
                {insights.map((item) => (
                  <div className={`insight ${item.tone}`} key={item.label}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
                {plan && (
                  <div className={`insight ${plan.effectiveDpi >= 190 ? "good" : "warn"}`}>
                    <span>DPI efetivo</span>
                    <strong>{plan.effectiveDpi}</strong>
                  </div>
                )}
                {croppedImageSize && (
                  <div
                    className={
                      settings.cropTop + settings.cropRight + settings.cropBottom + settings.cropLeft > 0
                        ? "insight good"
                        : "insight neutral"
                    }
                  >
                    <span>Área usada</span>
                    <strong>{croppedImageSize.width} x {croppedImageSize.height}px</strong>
                  </div>
                )}
                {plan && (
                  <>
                    <div className="insight good">
                      <span>Cópias</span>
                      <strong>{plan.copyCount} de {plan.maxCopies} por folha</strong>
                    </div>
                    <div className={plan.wastePercent > 60 ? "insight warn" : "insight good"}>
                      <span>Sobra estimada</span>
                      <strong>{plan.wastePercent}% da área útil</strong>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="quiet-state">Nenhuma arte carregada.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <Target size={18} />
              <h2>Ficha técnica</h2>
            </div>
            {plan ? (
              <div className="spec-grid">
                <div>
                  <span>Destino</span>
                  <strong>
                    {formatMeasure(destination.widthMm, settings.measureUnit)} x {formatMeasure(destination.heightMm, settings.measureUnit)} {measureUnitLabels[settings.measureUnit]}
                  </strong>
                </div>
                <div>
                  <span>Folha</span>
                  <strong>{sheet.widthMm} x {sheet.heightMm} mm</strong>
                </div>
                <div>
                  <span>Arquivo</span>
                  <strong>{settings.exportFormat.toUpperCase()} · {settings.dpi} DPI</strong>
                </div>
                <div>
                  <span>Layout</span>
                  <strong>{plan.copyCount} cópia(s)</strong>
                </div>
              </div>
            ) : (
              <div className="quiet-state">{destination.intent}</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-heading">
              <Layers size={18} />
              <h2>Plano</h2>
            </div>
            {plan ? (
              <div className="plan-list">
                {[...plan.warnings, ...plan.recommendations].map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </div>
            ) : (
              <div className="quiet-state">{destination.intent}</div>
            )}
          </section>
        </aside>
      </section>

      {isPrintPreviewOpen && plan && (
        <div className="print-modal" role="dialog" aria-modal="true" aria-label="Simulação de impressão">
          <div className="print-modal-card">
            <div className="print-modal-header">
              <div>
                <span>Simulação real de impressão</span>
                <strong>Confira antes de baixar o arquivo final</strong>
              </div>
              <button className="icon-button" onClick={() => setIsPrintPreviewOpen(false)} title="Fechar simulação">
                X
              </button>
            </div>
            <div className="print-modal-body">
              <div className="print-preview-sheet">
                <canvas ref={printPreviewCanvasRef} aria-label="Simulação final de impressão" />
              </div>
              <div className="print-preview-report">
                <div className={`score-ring ${plan.status}`}>
                  <strong>{plan.readinessScore}%</strong>
                  <span>{plan.status === "ready" ? "pronto" : plan.status === "blocked" ? "corrigir" : "revisar"}</span>
                </div>
                <section className="print-setup">
                  <div className="panel-heading">
                    <Printer size={18} />
                    <h2>Assistente de Impressão</h2>
                  </div>
                  <label className="field">
                    <span>Impressora</span>
                    <select
                      value={settings.printerConfigured ? settings.printerModel : ""}
                      onChange={(event) => updateSettings({ printerModel: event.target.value, printerConfigured: Boolean(event.target.value) })}
                    >
                      <option value="">Selecionar impressora</option>
                      <option value="Epson L3250">Epson L3250</option>
                      <option value="Epson L4260">Epson L4260</option>
                      <option value="Epson L8050">Epson L8050</option>
                      <option value="Impressora personalizada">Impressora personalizada</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Produto</span>
                    <select value={settings.printProduct} onChange={(event) => updateSettings({ printProduct: event.target.value })}>
                      <option value="Camisa branca">Camisa branca</option>
                      <option value="Camisa colorida">Camisa colorida</option>
                      <option value="Caneca branca">Caneca branca</option>
                      <option value="Azulejo">Azulejo</option>
                      <option value="Mousepad">Mousepad</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Tipo de papel</span>
                    <select value={settings.paperType} onChange={(event) => updateSettings({ paperType: event.target.value })}>
                      <option value="Papel sublimático">Papel sublimático</option>
                      <option value="Papel transfer">Papel transfer</option>
                      <option value="Papel fotográfico fosco">Papel fotográfico fosco</option>
                      <option value="Papel comum">Papel comum</option>
                    </select>
                  </label>
                  <label className="field">
                    <span>Qualidade real</span>
                    <select value={settings.printQuality} onChange={(event) => updateSettings({ printQuality: event.target.value })}>
                      <option value="Alta / melhor foto">Alta / melhor foto</option>
                      <option value="Foto">Foto</option>
                      <option value="Texto e imagem">Texto e imagem</option>
                      <option value="Rascunho">Rascunho</option>
                    </select>
                  </label>
                  <div className="numeric-grid">
                    <label className="field">
                      <span>Escala driver %</span>
                      <input
                        type="number"
                        min="10"
                        max="200"
                        value={settings.driverScale}
                        onChange={(event) => updateSettings({ driverScale: Number(event.target.value) })}
                      />
                    </label>
                    <label className="field">
                      <span>Orientação</span>
                      <select
                        value={settings.printOrientation}
                        onChange={(event) => updateSettings({ printOrientation: event.target.value as Settings["printOrientation"] })}
                      >
                        <option value="auto">Automática</option>
                        <option value="portrait">Retrato</option>
                        <option value="landscape">Paisagem</option>
                      </select>
                    </label>
                  </div>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={settings.borderless}
                      onChange={(event) => updateSettings({ borderless: event.target.checked })}
                    />
                    Impressão sem bordas
                  </label>
                </section>
                <div className="simulation-list">
                  {simulationItems.map((item) => (
                    <div className="simulation-item" key={item.label}>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <small>{item.detail}</small>
                    </div>
                  ))}
                </div>
                <section className="print-instructions">
                  <strong>Configuração recomendada no driver</strong>
                  <div className="instruction-grid">
                    {printInstructionItems.map((item) => (
                      <div key={item.label}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    ))}
                  </div>
                </section>
                <div className="print-modal-actions">
                  <button className="secondary-button" onClick={() => setIsPrintPreviewOpen(false)}>
                    Voltar e ajustar
                  </button>
                  <button className="secondary-button" onClick={handleExport} disabled={!canExport || isPreparing}>
                    {isPreparing ? <Sparkles size={18} /> : <Download size={18} />}
                    {isPreparing ? "Gerando" : `Baixar ${settings.exportFormat.toUpperCase()}`}
                  </button>
                  <button className="primary-button" onClick={handlePrintNow} disabled={!canExport || isPreparing}>
                    {isPreparing ? <Sparkles size={18} /> : <Printer size={18} />}
                    {isPreparing ? "Preparando" : "Imprimir agora"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

const BrainRow = ({ title, active, detail }: { title: string; active: boolean; detail: string }) => (
  <div className={active ? "brain-row is-active" : "brain-row"}>
    <span>{active ? <Check size={14} /> : null}</span>
    <div>
      <strong>{title}</strong>
      <small>{detail}</small>
    </div>
  </div>
);
