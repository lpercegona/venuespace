/**
 * Motor de otimização de imagens (client-side).
 * Redimensiona e reencoda para WebP antes do upload no storage.
 */

export type OptimizeOptions = {
  /** Maior lado permitido (px). */
  maxSide?: number;
  /** Qualidade WebP (0-1). */
  quality?: number;
};

const SKIP_TYPES = new Set(["image/svg+xml", "image/gif", "image/avif"]);

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/** Substitui a extensão do nome do arquivo por .webp. */
export function toWebpName(name: string) {
  return `${name.replace(/\.[^./\\]+$/, "")}.webp`;
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* cai no fallback */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Não foi possível ler a imagem"));
      img.src = url;
    });
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

async function encodeWebp(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  quality: number,
): Promise<Blob | null> {
  if (typeof OffscreenCanvas === "function") {
    try {
      const canvas = new OffscreenCanvas(width, height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
      return await canvas.convertToBlob({ type: "image/webp", quality });
    } catch {
      /* cai no fallback */
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  return await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality),
  );
}

/**
 * Otimiza uma imagem. Retorna o arquivo original quando:
 * não é imagem rasterizada suportada, o ambiente não suporta canvas,
 * ou o resultado não é ao menos 10% menor.
 */
export async function optimizeImage(file: File, opts: OptimizeOptions = {}): Promise<File> {
  const maxSide = opts.maxSide ?? 1920;
  const quality = opts.quality ?? 0.8;

  if (!isBrowser()) return file;
  if (!file.type.startsWith("image/")) return file;
  if (SKIP_TYPES.has(file.type)) return file;

  try {
    const source = await decode(file);
    const sw = "width" in source ? source.width : 0;
    const sh = "height" in source ? source.height : 0;
    if (!sw || !sh) return file;

    const ratio = Math.min(1, maxSide / Math.max(sw, sh));
    const width = Math.max(1, Math.round(sw * ratio));
    const height = Math.max(1, Math.round(sh * ratio));

    const blob = await encodeWebp(source, width, height, quality);
    if ("close" in source && typeof source.close === "function") source.close();
    if (!blob) return file;
    if (blob.size >= file.size * 0.9) return file;

    return new File([blob], toWebpName(file.name), {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

/** Otimiza vários arquivos em sequência. */
export async function optimizeImages(files: File[], opts?: OptimizeOptions): Promise<File[]> {
  const out: File[] = [];
  for (const f of files) out.push(await optimizeImage(f, opts));
  return out;
}
