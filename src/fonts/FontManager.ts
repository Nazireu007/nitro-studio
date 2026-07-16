import { FontRecord, nitroFontCatalog } from "./FontCatalog";
import { FontRepository } from "./FontRepository";
import { validateFontFile } from "./FontValidator";

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Não consegui ler a fonte."));
    reader.readAsDataURL(file);
  });

const safeFamilyFromName = (name: string) =>
  name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9 _-]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");

export class FontManager {
  constructor(private repository = new FontRepository()) {}

  async listFonts() {
    const imported = await this.repository.list();
    return [...nitroFontCatalog, ...imported];
  }

  async loadFont(font: FontRecord) {
    if (!font.dataUrl || typeof FontFace === "undefined") return true;

    try {
      const fontFace = new FontFace(font.family, `url(${font.dataUrl})`);
      const loaded = await fontFace.load();
      document.fonts.add(loaded);
      await document.fonts.ready;
      return true;
    } catch {
      return false;
    }
  }

  async loadImportedFonts() {
    const fonts = await this.repository.list();
    await Promise.all(fonts.map((font) => this.loadFont(font)));
    return fonts;
  }

  async importFont(file: File, existingFonts: FontRecord[] = []) {
    const format = validateFontFile(file);
    const dataUrl = await fileToDataUrl(file);
    const baseFamily = safeFamilyFromName(file.name) || "Fonte importada";
    const duplicateCount = existingFonts.filter((font) => font.family.toLowerCase().startsWith(baseFamily.toLowerCase())).length;
    const family = duplicateCount ? `${baseFamily} ${duplicateCount + 1}` : baseFamily;
    const font: FontRecord = {
      id: `font-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: family,
      family,
      category: "Decorativa",
      styles: ["Regular"],
      license: "Fonte importada pelo usuário. Use somente fontes com autorização.",
      origin: "Importada localmente pelo usuário",
      fileName: file.name,
      format,
      dataUrl,
      source: "imported",
      lastUsedAt: Date.now()
    };

    const loaded = await this.loadFont(font);
    if (!loaded) throw new Error("A fonte foi lida, mas o navegador não conseguiu carregá-la.");
    await this.repository.save(font);
    return font;
  }

  async saveFont(font: FontRecord) {
    if (font.source !== "imported") return;
    await this.repository.save(font);
  }

  async deleteImportedFont(font: FontRecord) {
    if (font.source !== "imported") return;
    await this.repository.delete(font.id);
  }
}
