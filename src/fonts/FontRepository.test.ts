import { describe, expect, it } from "vitest";
import { FontRecord } from "./FontCatalog";
import { FontRepository } from "./FontRepository";

const font: FontRecord = {
  id: "font-test",
  name: "Teste",
  family: "Teste",
  category: "Decorativa",
  styles: ["Regular"],
  license: "Teste local",
  origin: "Teste",
  source: "imported",
  dataUrl: "data:font/ttf;base64,AA==",
  format: "ttf"
};

describe("FontRepository", () => {
  it("persists and deletes imported fonts in the local fallback", async () => {
    const repository = new FontRepository();

    await repository.save(font);
    expect(await repository.list()).toContainEqual(font);

    await repository.delete(font.id);
    expect(await repository.list()).not.toContainEqual(font);
  });
});
