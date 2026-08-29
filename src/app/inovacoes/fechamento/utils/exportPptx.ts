import PptxGenJS from 'pptxgenjs';
import { toPng } from 'html-to-image';

export interface SlideCaptureItem {
  id: string;
  title: string;
  element: HTMLElement;
}

export interface ExportPptxOptions {
  slides: SlideCaptureItem[];
  year: number;
  month: number;
  onProgress?: (current: number, total: number, percent: number) => void;
  isAborted?: () => boolean;
}

const MONTH_NAMES = [
  'JANEIRO', 'FEVEREIRO', 'MARCO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'
];

/**
 * Utilitário de Exportação Executiva em 1 Clique (PowerPoint Widescreen 16:9)
 * Reutiliza html-to-image e pptxgenjs com 100% de paridade visual em relação aos slides renderizados.
 */
export async function exportClosingToPptx(options: ExportPptxOptions): Promise<boolean> {
  const { slides, year, month, onProgress, isAborted } = options;
  if (!slides || slides.length === 0) return false;

  const pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'WIDE_16_9', width: 10, height: 5.625 });
  pptx.layout = 'WIDE_16_9';

  pptx.title = `Fechamento Executivo Coffee++ — ${month}/${year}`;
  pptx.author = 'Coffee++ Executive Closing Engine';
  pptx.company = 'Coffee++';

  const total = slides.length;

  for (let i = 0; i < total; i++) {
    if (isAborted?.()) return false;

    const currentSlideItem = slides[i];
    const percent = Math.round(((i + 1) / total) * 100);
    onProgress?.(i + 1, total, percent);

    // Capturar o elemento DOM como imagem PNG de alta resolução
    const dataUrl = await toPng(currentSlideItem.element, {
      quality: 0.95,
      pixelRatio: 2,
      cacheBust: true,
      skipAutoScale: true,
    });

    const pptxSlide = pptx.addSlide();
    pptxSlide.addImage({
      data: dataUrl,
      x: 0,
      y: 0,
      w: 10,
      h: 5.625,
    });
  }

  if (isAborted?.()) return false;

  const monthStr = MONTH_NAMES[month - 1] || String(month).padStart(2, '0');
  const filename = `FECHAMENTO_EXECUTIVO_COFFEE_MAIS_${monthStr}_${year}.pptx`;
  await pptx.writeFile({ fileName: filename });

  return true;
}
