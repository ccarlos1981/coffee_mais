import crypto from "crypto";

/**
 * Utilitários de Backend para Processamento Seguro de Imagens (Server-Side Only)
 */

/**
 * Calcula o hash SHA-256 definitivo a partir do Buffer do arquivo no servidor.
 */
export function calculateBufferHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Extrai a largura e altura da imagem em pixels diretamente do Buffer no servidor.
 */
export function getImageDimensionsFromBuffer(
  buffer: Buffer,
  mimeType: string
): { width: number; height: number } {
  try {
    // PNG (Header IHDR at byte 16)
    if (mimeType === "image/png" && buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }

    // JPEG / JPG (Scan markers SOF0/SOF2)
    if ((mimeType === "image/jpeg" || mimeType === "image/jpg") && buffer.length > 2) {
      let offset = 2;
      while (offset < buffer.length - 8) {
        if (buffer[offset] !== 0xff) break;
        const marker = buffer[offset + 1];
        if (marker === 0xc0 || marker === 0xc2) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const length = buffer.readUInt16BE(offset + 2);
        offset += 2 + length;
      }
    }

    // WEBP (Lossy / Lossless chunks)
    if (mimeType === "image/webp" && buffer.length >= 30) {
      const vp8Chunk = buffer.toString("ascii", 12, 16);
      if (vp8Chunk === "VP8 " && buffer.length >= 30) {
        const width = buffer.readUInt16LE(26) & 0x3fff;
        const height = buffer.readUInt16LE(28) & 0x3fff;
        return { width, height };
      } else if (vp8Chunk === "VP8L" && buffer.length >= 25) {
        const b0 = buffer[21];
        const b1 = buffer[22];
        const b2 = buffer[23];
        const b3 = buffer[24];
        const width = 1 + (((b1 & 0x3f) << 8) | b0);
        const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
        return { width, height };
      }
    }

    // SVG
    if (mimeType === "image/svg+xml") {
      const str = buffer.toString("utf8", 0, Math.min(buffer.length, 2000));
      const widthMatch = str.match(/width=["'](\d+)(?:px)?["']/i);
      const heightMatch = str.match(/height=["'](\d+)(?:px)?["']/i);
      const width = widthMatch ? parseInt(widthMatch[1], 10) : 0;
      const height = heightMatch ? parseInt(heightMatch[1], 10) : 0;
      return { width, height };
    }
  } catch (err) {
    console.error("Erro ao extrair dimensões do buffer da imagem no server:", err);
  }

  return { width: 0, height: 0 };
}
