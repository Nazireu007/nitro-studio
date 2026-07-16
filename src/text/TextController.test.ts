import { describe, expect, it } from "vitest";
import {
  addTextObject,
  deleteTextObject,
  duplicateTextObject,
  moveTextObject,
  resizeTextObject,
  updateTextObject
} from "./TextController";

describe("TextController", () => {
  it("adds and edits a text object", () => {
    const [text] = addTextObject([], 1200, 1600);
    const [edited] = updateTextObject([text], text.id, { content: "Nitro Letreiro", color: "#0f766e" });

    expect(edited.content).toBe("Nitro Letreiro");
    expect(edited.color).toBe("#0f766e");
  });

  it("moves, resizes, duplicates and deletes text", () => {
    const [text] = addTextObject([], 1000, 1000);
    const [moved] = moveTextObject([text], text.id, 30, -20);
    const [resized] = resizeTextObject([moved], text.id, 420, 96);
    const duplicated = duplicateTextObject([resized], text.id);
    const deleted = deleteTextObject(duplicated, text.id);

    expect(moved.x).toBe(text.x + 30);
    expect(moved.y).toBe(text.y - 20);
    expect(resized.width).toBe(420);
    expect(resized.fontSize).toBe(96);
    expect(duplicated).toHaveLength(2);
    expect(deleted).toHaveLength(1);
  });
});
