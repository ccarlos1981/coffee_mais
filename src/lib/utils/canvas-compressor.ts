/**
 * Redimensiona e comprime uma imagem (File) no lado do cliente
 * usando a API HTML5 Canvas para garantir que o tamanho final seja menor que 250 KB.
 */
export async function compressImage(
  file: File,
  maxDimension: number = 1280,
  targetSizeKB: number = 250
): Promise<File> {
  return new Promise((resolve, reject) => {
    // Se o arquivo original já for menor que a meta e for jpeg, podemos ignorar a compressão pesada
    if (file.size <= targetSizeKB * 1024 && file.type === "image/jpeg") {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        // 1. Calcular novas dimensões mantendo a proporção
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        // 2. Renderizar no Canvas
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Não foi possível obter o contexto 2D do Canvas."));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // 3. Compressão recursiva até atingir a meta de tamanho (< 250 KB)
        let quality = 0.8;
        const targetBytes = targetSizeKB * 1024;

        const attemptCompression = (currentQuality: number) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Erro ao gerar o Blob da imagem comprimida."));
                return;
              }

              if (blob.size <= targetBytes || currentQuality <= 0.1) {
                // Sucesso ou atingiu a qualidade mínima tolerável
                const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                  type: "image/jpeg",
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                // Reduz qualidade recursivamente
                attemptCompression(currentQuality - 0.15);
              }
            },
            "image/jpeg",
            currentQuality
          );
        };

        attemptCompression(quality);
      };

      img.onerror = (err) => {
        reject(err);
      };
    };

    reader.onerror = (err) => {
      reject(err);
    };
  });
}
