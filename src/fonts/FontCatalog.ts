export type FontCategory =
  | "Elegante"
  | "Manuscrita"
  | "Infantil"
  | "Moderna"
  | "Impacto"
  | "Esportiva"
  | "Retrô"
  | "Tecnológica"
  | "Decorativa"
  | "Simples"
  | "Condensada"
  | "Serifada";

export type FontSource = "nitro" | "system" | "imported";

export type FontRecord = {
  id: string;
  name: string;
  family: string;
  category: FontCategory;
  styles: string[];
  license: string;
  origin: string;
  fileName?: string;
  format?: "ttf" | "otf" | "woff" | "woff2";
  dataUrl?: string;
  source: FontSource;
  favorite?: boolean;
  lastUsedAt?: number;
};

export const nitroFontCatalog: FontRecord[] = [
  {
    id: "system-arial",
    name: "Arial",
    family: "Arial",
    category: "Simples",
    styles: ["Regular", "Bold", "Italic"],
    license: "Fonte do sistema do usuário; não empacotada pelo Nitro Studio.",
    origin: "Sistema operacional/navegador",
    source: "system"
  },
  {
    id: "system-georgia",
    name: "Georgia",
    family: "Georgia",
    category: "Serifada",
    styles: ["Regular", "Bold", "Italic"],
    license: "Fonte do sistema do usuário; não empacotada pelo Nitro Studio.",
    origin: "Sistema operacional/navegador",
    source: "system"
  },
  {
    id: "system-trebuchet",
    name: "Trebuchet MS",
    family: "Trebuchet MS",
    category: "Moderna",
    styles: ["Regular", "Bold", "Italic"],
    license: "Fonte do sistema do usuário; não empacotada pelo Nitro Studio.",
    origin: "Sistema operacional/navegador",
    source: "system"
  },
  {
    id: "system-impact",
    name: "Impact",
    family: "Impact",
    category: "Impacto",
    styles: ["Regular"],
    license: "Fonte do sistema do usuário; não empacotada pelo Nitro Studio.",
    origin: "Sistema operacional/navegador",
    source: "system"
  },
  {
    id: "system-courier",
    name: "Courier New",
    family: "Courier New",
    category: "Tecnológica",
    styles: ["Regular", "Bold", "Italic"],
    license: "Fonte do sistema do usuário; não empacotada pelo Nitro Studio.",
    origin: "Sistema operacional/navegador",
    source: "system"
  },
  {
    id: "system-comic",
    name: "Comic Sans MS",
    family: "Comic Sans MS",
    category: "Infantil",
    styles: ["Regular", "Bold"],
    license: "Fonte do sistema do usuário; não empacotada pelo Nitro Studio.",
    origin: "Sistema operacional/navegador",
    source: "system"
  }
];
