const allowedExtensions = ["ttf", "otf", "woff", "woff2"] as const;
export type FontFormat = (typeof allowedExtensions)[number];

export const getFontFormat = (fileName: string): FontFormat | null => {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return allowedExtensions.includes(extension as FontFormat) ? (extension as FontFormat) : null;
};

export const validateFontFile = (file: File, maxSizeMb = 12) => {
  const format = getFontFormat(file.name);
  if (!format) {
    throw new Error("Formato inválido. Use TTF, OTF, WOFF ou WOFF2.");
  }

  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`Fonte muito grande. O limite é ${maxSizeMb} MB.`);
  }

  return format;
};
