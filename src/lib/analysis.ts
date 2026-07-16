export type SourceImage = {
  name: string;
  width: number;
  height: number;
  size: number;
  url: string;
};

export type ImageInsight = {
  label: string;
  value: string;
  tone: "good" | "warn" | "neutral";
};

export const formatFileSize = (bytes: number) => {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const loadImageFile = async (file: File): Promise<SourceImage> => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Não consegui ler essa imagem."));
  });

  return {
    name: file.name,
    width: image.naturalWidth,
    height: image.naturalHeight,
    size: file.size,
    url
  };
};

export const getImageInsights = (image: SourceImage): ImageInsight[] => {
  const megapixels = (image.width * image.height) / 1_000_000;
  const ratio = image.width / image.height;

  return [
    {
      label: "Arquivo",
      value: `${image.width} x ${image.height}px · ${formatFileSize(image.size)}`,
      tone: megapixels >= 3 ? "good" : megapixels >= 1 ? "neutral" : "warn"
    },
    {
      label: "Proporção",
      value: ratio > 1.2 ? "Horizontal" : ratio < 0.82 ? "Vertical" : "Quase quadrada",
      tone: "neutral"
    },
    {
      label: "Detalhe",
      value: megapixels >= 6 ? "Excelente" : megapixels >= 3 ? "Bom" : "Atenção",
      tone: megapixels >= 3 ? "good" : "warn"
    }
  ];
};
