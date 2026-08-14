/**
 * URL pública estável para arquivos do bucket `venue-uploads`.
 *
 * Substitui URLs assinadas temporárias (que expiravam em 1h e mudavam a cada
 * revalidação, fazendo as imagens sumirem ou piscarem) por um caminho
 * determinístico servido por `/api/public/img/*` com cache imutável.
 */
export const PUBLIC_IMAGE_PREFIX = "/api/public/img/";

export function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/**
 * Fonte de imagem válida para renderização: URL http(s) absoluta ou caminho
 * interno servido pelo proxy `/api/public/img/*`.
 */
export function isImageSource(value: unknown): value is string {
  return typeof value === "string" && (isHttpUrl(value) || value.startsWith(PUBLIC_IMAGE_PREFIX));
}


export function publicImageUrl(path: string): string {
  if (!path) return path;
  if (isHttpUrl(path) || path.startsWith(PUBLIC_IMAGE_PREFIX) || path.startsWith("data:")) return path;
  const clean = path.replace(/^\/+/, "");
  return PUBLIC_IMAGE_PREFIX + clean.split("/").map(encodeURIComponent).join("/");
}
