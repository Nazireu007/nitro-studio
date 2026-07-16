import { FontRecord } from "./FontCatalog";

const DB_NAME = "nitro-studio-fonts";
const STORE_NAME = "fonts";

export class FontRepository {
  private databasePromise: Promise<IDBDatabase | null> | null = null;
  private memoryStore = new Map<string, FontRecord>();

  private openDatabase() {
    if (typeof indexedDB === "undefined") return Promise.resolve(null);
    if (this.databasePromise) return this.databasePromise;

    this.databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error("Não consegui abrir o banco de fontes."));
    });

    return this.databasePromise;
  }

  async list() {
    const database = await this.openDatabase();
    if (!database) return [...this.memoryStore.values()];

    return new Promise<FontRecord[]>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).getAll();
      request.onsuccess = () => resolve(request.result as FontRecord[]);
      request.onerror = () => reject(request.error ?? new Error("Não consegui listar fontes."));
    });
  }

  async save(font: FontRecord) {
    const database = await this.openDatabase();
    if (!database) {
      this.memoryStore.set(font.id, font);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).put(font);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Não consegui salvar a fonte."));
    });
  }

  async delete(id: string) {
    const database = await this.openDatabase();
    if (!database) {
      this.memoryStore.delete(id);
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readwrite");
      const request = transaction.objectStore(STORE_NAME).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error("Não consegui excluir a fonte."));
    });
  }
}
