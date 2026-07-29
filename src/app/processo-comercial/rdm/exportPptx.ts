'use client';

import PptxGenJS from 'pptxgenjs';
import { toPng } from 'html-to-image';

/**
 * Exporta todos os slides da RDM para um arquivo PowerPoint (.pptx).
 *
 * Estratégia: captura cada slide como imagem PNG (WYSIWYG) e insere
 * em um slide do PowerPoint em formato widescreen 16:9.
 *
 * @param slideContainer - O elemento DOM que contém o slide renderizado (.rdm-slide-container)
 * @param slides - Array de definição dos slides [{ key, label }]
 * @param goToSlide - Função que navega para o slide no índice informado (sem animação)
 * @param manager - Nome do gerente selecionado
 * @param monthName - Nome do mês
 * @param year - Ano
 * @param onProgress - Callback de progresso (slideAtual, total)
 */
export async function exportRdmToPptx({
  slideContainer,
  slides,
  goToSlide,
  manager,
  monthName,
  year,
  onProgress,
}: {
  slideContainer: HTMLElement;
  slides: { key: string; label: string }[];
  goToSlide: (idx: number) => void;
  manager: string;
  monthName: string;
  year: number;
  onProgress?: (current: number, total: number) => void;
}): Promise<void> {
  const pptx = new PptxGenJS();

  // Configuração widescreen 16:9
  pptx.defineLayout({ name: 'WIDE', width: 10, height: 5.625 });
  pptx.layout = 'WIDE';

  // Metadados
  pptx.author = 'Coffee++';
  pptx.company = 'Coffee Mais';
  pptx.subject = `RDM — ${manager} — ${monthName} ${year}`;
  pptx.title = `RDM — ${manager} — ${monthName} ${year}`;

  const total = slides.length;

  for (let i = 0; i < total; i++) {
    onProgress?.(i + 1, total);

    // Navegar para o slide
    goToSlide(i);

    // Aguardar renderização completa
    await new Promise(resolve => setTimeout(resolve, 600));

    // Capturar o slide como PNG
    const slideEl = slideContainer.querySelector('.rdm-slide-inner') as HTMLElement
      ?? slideContainer;

    let dataUrl: string;
    try {
      dataUrl = await toPng(slideEl, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        // Ignorar elementos que podem causar problemas na captura
        filter: (node: HTMLElement) => {
          if (node.classList?.contains('rdm-nav-btn')) return false;
          if (node.classList?.contains('rdm-slide-footer-nav')) return false;
          return true;
        },
      });
    } catch {
      // Fallback: tentar capturar o container inteiro
      dataUrl = await toPng(slideContainer, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });
    }

    // Criar slide no PPTX
    const pptSlide = pptx.addSlide();

    // Fundo preto para a capa e slide final
    if (slides[i].key === 'capa' || slides[i].key === 'obrigado') {
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

    // Nota do slide com o título
    pptSlide.addNotes(`Slide ${i + 1}: ${slides[i].label}`);
  }

  // Gerar e salvar o arquivo
  const fileName = `RDM_${manager.replace(/\s+/g, '_')}_${monthName}_${year}.pptx`;
  await pptx.writeFile({ fileName });
}
