'use client';

import PptxGenJS from 'pptxgenjs';
import { toPng } from 'html-to-image';
import { PresentationTelemetry } from '@/lib/presentation-framework/core';

/**
 * Remove acentos e caracteres especiais de uma string para nome de arquivo seguro.
 */
function sanitizeStringForFilename(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toUpperCase();
}

export interface SlideExportItem {
  key: string;
  label: string;
  originalIndex: number;
}

/**
 * Exporta os slides selecionados da RDM para um arquivo PowerPoint (.pptx).
 */
export async function exportRdmToPptx({
  slideContainer,
  slides,
  goToSlide,
  manager,
  monthName,
  year,
  onProgress,
  isAborted,
  includeComments = true,
}: {
  slideContainer: HTMLElement;
  slides: SlideExportItem[];
  goToSlide: (idx: number) => void;
  manager: string;
  monthName: string;
  year: number;
  onProgress?: (current: number, total: number, percent: number) => void;
  isAborted?: () => boolean;
  includeComments?: boolean;
}): Promise<boolean> {
  const startTime = Date.now();
  PresentationTelemetry.track('export_started', {
    metadata: { totalSlides: slides.length, manager, monthName, year },
  });
  const pptx = new PptxGenJS();

  // Configuração widescreen 16:9
  pptx.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
  pptx.layout = 'WIDE';

  // Metadados homologados
  pptx.title = 'RDM - Reunião de Desempenho Mensal';
  pptx.author = 'Coffee++';
  pptx.company = 'Coffee++';
  pptx.subject = 'RDM';
  (pptx as unknown as { comments?: string }).comments = 'Gerado automaticamente pelo módulo RDM.';

  const total = slides.length;

  const isCommentNode = (node: HTMLElement): boolean => {
    if (includeComments) return false;
    if (!node || !node.className) return false;
    const cls = String(node.className);
    return cls.includes('rdm-comment') || cls.includes('comment-wrap') || cls.includes('comment-box') || cls.includes('comment-input');
  };

  for (let i = 0; i < total; i++) {
    // Checar cancelamento
    if (isAborted?.()) {
      console.log('[RDM-PPTX] Exportação cancelada pelo usuário.');
      return false;
    }

    const percent = Math.round(((i + 1) / total) * 100);
    onProgress?.(i + 1, total, percent);

    const targetSlide = slides[i];

    // Navegar para o slide original (sem animação)
    goToSlide(targetSlide.originalIndex);

    // Aguardar renderização completa do slide em memória
    await new Promise(resolve => setTimeout(resolve, 500));

    if (isAborted?.()) return false;

    // Elemento interno do slide
    const slideEl = (slideContainer.querySelector('.rdm-slide-inner') as HTMLElement)
      ?? slideContainer;

    let dataUrl: string;
    try {
      dataUrl = await toPng(slideEl, {
        quality: 0.95,
        pixelRatio: 2.5, // Alta resolução (Full HD+)
        backgroundColor: '#ffffff',
        skipFonts: true,
        filter: (node: HTMLElement) => {
          if (!node || !node.classList) return true;
          if (node.classList.contains('rdm-nav-btn')) return false;
          if (node.classList.contains('rdm-slide-footer-nav')) return false;
          if (node.classList.contains('rdm-export-pptx-btn')) return false;
          if (isCommentNode(node)) return false;
          return true;
        },
      });
    } catch (err) {
      console.warn('[RDM-PPTX] Fallback 1 to container capture:', err);
      try {
        dataUrl = await toPng(slideContainer, {
          quality: 0.95,
          pixelRatio: 2.5,
          backgroundColor: '#ffffff',
          skipFonts: true,
          filter: (node: HTMLElement) => {
            if (!node || !node.classList) return true;
            if (node.classList.contains('rdm-nav-btn')) return false;
            if (node.classList.contains('rdm-slide-footer-nav')) return false;
            if (node.classList.contains('rdm-export-pptx-btn')) return false;
            if (isCommentNode(node)) return false;
            return true;
          },
        });
      } catch (err2) {
        console.error(`[RDM-PPTX] Fallback 2 (Canvas) used for slide ${i + 1}:`, err2);
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = targetSlide.key === 'capa' || targetSlide.key === 'obrigado' ? '#060606' : '#ffffff';
          ctx.fillRect(0, 0, 1920, 1080);
        }
        dataUrl = canvas.toDataURL('image/png');
      }
    }

    if (isAborted?.()) return false;

    // Criar slide no PPTX
    const pptSlide = pptx.addSlide();

    // Fundo preto para a capa e slide final
    if (targetSlide.key === 'capa' || targetSlide.key === 'obrigado') {
      pptSlide.background = { color: '060606' };
    }

    // Inserir a imagem capturada preenchendo todo o slide
    pptSlide.addImage({
      data: dataUrl,
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
    });

    // Rodapé discreto no último slide da apresentação
    if (i === total - 1) {
      const nowStr = new Date().toLocaleString('pt-BR');
      pptSlide.addText(`Gerado automaticamente pelo Coffee++  ·  ${nowStr}`, {
        x: 0.5,
        y: 5.25,
        w: 9.0,
        h: 0.3,
        fontSize: 8,
        color: '888888',
        align: 'right',
        fontFace: 'Arial',
      });
    }

    // Nota do slide
    pptSlide.addNotes(`Slide ${i + 1}: ${targetSlide.label}`);
  }

  if (isAborted?.()) return false;

  // Nome padronizado: RDM_<GERENTE>_<MES>_<ANO>.pptx
  const cleanManager = sanitizeStringForFilename(manager);
  const cleanMonth   = sanitizeStringForFilename(monthName);
  const fileName     = `RDM_${cleanManager}_${cleanMonth}_${year}.pptx`;

  await pptx.writeFile({ fileName });
  PresentationTelemetry.track('export_completed', {
    durationMs: Date.now() - startTime,
    metadata: { fileName, slideCount: total },
  });
  return true;
}
