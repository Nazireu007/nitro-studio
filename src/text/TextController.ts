import { createTextObject, TextObject } from "./TextModel";

export const addTextObject = (items: TextObject[], sheetWidth: number, sheetHeight: number) => [
  ...items,
  createTextObject(sheetWidth, sheetHeight)
];

export const updateTextObject = (items: TextObject[], id: string, patch: Partial<TextObject>) =>
  items.map((item) => (item.id === id ? { ...item, ...patch } : item));

export const deleteTextObject = (items: TextObject[], id: string) => items.filter((item) => item.id !== id);

export const duplicateTextObject = (items: TextObject[], id: string) => {
  const source = items.find((item) => item.id === id);
  if (!source) return items;
  return [
    ...items,
    {
      ...source,
      id: `text-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      x: source.x + 32,
      y: source.y + 32
    }
  ];
};

export const moveTextObject = (items: TextObject[], id: string, deltaX: number, deltaY: number) =>
  updateTextObject(items, id, {
    x: Math.round((items.find((item) => item.id === id)?.x ?? 0) + deltaX),
    y: Math.round((items.find((item) => item.id === id)?.y ?? 0) + deltaY)
  });

export const resizeTextObject = (items: TextObject[], id: string, nextWidth: number, nextFontSize: number) =>
  updateTextObject(items, id, {
    width: Math.max(40, Math.round(nextWidth)),
    fontSize: Math.max(8, Math.round(nextFontSize))
  });
