/**
 * Helper para utilitários de Storage e metadados de imagens no ecossistema Coffee++
 */

/**
 * Retorna a URL pública gerada dinamicamente a partir do caminho (storage_path) ou URL legado.
 * Nunca persiste URLs no banco — a resolução é 100% dinâmica.
 */
export function getStoragePublicUrl(
  storagePath?: string | null,
  bucketName = "logos-redes"
): string {
  if (!storagePath) return "";

  // Se já for uma URL completa (ex: legado ou imagem externa antiga), retorna como está
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    return storagePath;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ncncazbhpoxjlyvcbvqa.supabase.co";

  // Se o caminho já incluir o nome do bucket no início
  let cleanPath = storagePath.startsWith("/") ? storagePath.slice(1) : storagePath;
  if (cleanPath.startsWith(`${bucketName}/`)) {
    cleanPath = cleanPath.substring(bucketName.length + 1);
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${cleanPath}`;
}

/**
 * Calcula o hash SHA-256 do arquivo no client-side para deduplicação e auditoria de integridade.
 */
export async function calculateFileHash(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  } catch (err) {
    console.error("Erro ao calcular hash SHA-256 do arquivo:", err);
    return `hash_${Date.now()}_${file.size}`;
  }
}

/**
 * Obtém largura e altura da imagem em pixels.
 */
export function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (file.type === "image/svg+xml") {
      resolve({ width: 0, height: 0 });
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      resolve({ width: 0, height: 0 });
      URL.revokeObjectURL(url);
    };

    img.src = url;
  });
}
