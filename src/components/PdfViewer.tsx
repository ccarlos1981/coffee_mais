"use client";

import React, { useEffect, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Download, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface PdfViewerProps {
  url: string;
  allowDownload: boolean;
  isEditor: boolean;
  onReadComplete?: () => void;
}

export default function PdfViewer({ url, allowDownload, isEditor, onReadComplete }: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<any>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.2);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [pdfjsLoaded, setPdfjsLoaded] = useState<boolean>(false);
  const [useIframeFallback, setUseIframeFallback] = useState<boolean>(false);
  const pagesRendered = useRef<Set<number>>(new Set());

  // Manter referência estável da callback onReadComplete para evitar re-execução dos useEffects
  const onReadCompleteRef = useRef(onReadComplete);
  useEffect(() => {
    onReadCompleteRef.current = onReadComplete;
  }, [onReadComplete]);

  // 1. Timeout de resiliência: se demorar mais de 6 segundos, usa fallback nativo
  useEffect(() => {
    if (!url) return;
    
    const timer = setTimeout(() => {
      if (loading && !pdf) {
        console.warn("PdfViewer: Carregamento do PDF demorou muito. Ativando fallback de iframe...");
        setUseIframeFallback(true);
        setLoading(false);
        if (onReadCompleteRef.current) {
          setTimeout(onReadCompleteRef.current, 2000);
        }
      }
    }, 6000);

    return () => clearTimeout(timer);
  }, [loading, pdf, url]);

  // 2. Carregar o script do PDF.js de forma estática e local (da pasta public/)
  useEffect(() => {
    console.log("PdfViewer: Inicializando script do PDF.js local...");
    if ((window as any).pdfjsLib) {
      console.log("PdfViewer: pdfjsLib já está carregado no objeto window.");
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      setPdfjsLoaded(true);
      return;
    }

    // Prevenir múltiplas tags script concorrentes no Next.js (Fast Refresh)
    const existingScript = document.querySelector('script[src*="pdf.min.js"]');
    if (existingScript) {
      console.log("PdfViewer: Script do PDF.js detectado no DOM. Iniciando polling...");
      const interval = setInterval(() => {
        if ((window as any).pdfjsLib) {
          console.log("PdfViewer: pdfjsLib resolvido via polling!");
          const pdfjsLib = (window as any).pdfjsLib;
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
          setPdfjsLoaded(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }

    console.log("PdfViewer: Inserindo script local /pdf.min.js no DOM...");
    const script = document.createElement("script");
    script.src = "/pdf.min.js";
    script.async = true;
    script.onload = () => {
      console.log("PdfViewer: Script local carregado e onload disparado.");
      const pdfjsLib = (window as any).pdfjsLib;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";
      setPdfjsLoaded(true);
    };
    script.onerror = (e) => {
      console.error("PdfViewer: Erro ao carregar script local do PDF.js", e);
      // Ativa fallback imediatamente
      setUseIframeFallback(true);
      setLoading(false);
      if (onReadCompleteRef.current) {
        setTimeout(onReadCompleteRef.current, 1000);
      }
    };
    document.body.appendChild(script);
  }, []);

  // 3. Carregar o documento PDF usando o pdfjs carregado no window
  useEffect(() => {
    if (useIframeFallback) return;
    
    console.log("PdfViewer: useEffect [PDF Loader] disparado. pdfjsLoaded =", pdfjsLoaded, "url =", url);
    if (!pdfjsLoaded) {
      console.log("PdfViewer: Aguardando carregamento do PDF.js...");
      return;
    }
    if (!url) {
      console.log("PdfViewer: URL vazia. Aguardando Signed URL...");
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError("");

    const loadPdf = async () => {
      console.log("PdfViewer: Inicializando getDocument para a URL local:", url);
      try {
        const pdfjsLib = (window as any).pdfjsLib;
        const loadingTask = pdfjsLib.getDocument(url);
        
        loadingTask.onProgress = (progress: any) => {
          if (progress.total > 0) {
            console.log(`PdfViewer: Download do PDF: ${Math.round((progress.loaded / progress.total) * 100)}%`);
          }
        };

        const pdfDoc = await loadingTask.promise;
        console.log("PdfViewer: PDF carregado com sucesso. Total de páginas:", pdfDoc.numPages);
        
        if (isMounted) {
          setPdf(pdfDoc);
          setNumPages(pdfDoc.numPages);
          setLoading(false);
        }
      } catch (err: any) {
        console.error("PdfViewer: Erro crítico ao carregar documento PDF:", err);
        if (isMounted) {
          console.warn("PdfViewer: Carregamento do PDF.js falhou. Ativando fallback...");
          setUseIframeFallback(true);
          setLoading(false);
          if (onReadCompleteRef.current) {
            setTimeout(onReadCompleteRef.current, 1000);
          }
        }
      }
    };

    loadPdf();

    return () => {
      isMounted = false;
    };
  }, [pdfjsLoaded, url, useIframeFallback]);

  // 4. Renderizar todas as páginas e escutar scroll para Compliance
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());

  useEffect(() => {
    if (!pdf || numPages === 0 || useIframeFallback) return;

    console.log("PdfViewer: Renderizando", numPages, "páginas...");
    pagesRendered.current.clear();
    
    const renderPages = async () => {
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
          const page = await pdf.getPage(pageNum);
          const canvas = canvasRefs.current.get(pageNum);
          if (!canvas) continue;

          const context = canvas.getContext("2d");
          if (!context) continue;

          const viewport = page.getViewport({ scale: zoom });
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext = {
            canvasContext: context,
            viewport: viewport,
          };
          await page.render(renderContext).promise;
          pagesRendered.current.add(pageNum);
        } catch (renderErr) {
          console.error(`PdfViewer: Erro ao renderizar página ${pageNum}:`, renderErr);
        }
      }
    };

    renderPages();
  }, [pdf, numPages, zoom, useIframeFallback]);

  // 5. Detector de Scroll para Compliance (Leitura 90% ou última página)
  const handleScroll = () => {
    if (!containerRef.current || numPages === 0 || useIframeFallback) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    
    // Método 1: Porcentagem de scroll (90%+)
    const scrollPercentage = (scrollTop / (scrollHeight - clientHeight)) * 100;
    
    // Método 2: Descobrir qual página está visível
    let visiblePage = 1;
    canvasRefs.current.forEach((canvas, pageNum) => {
      if (canvas && containerRef.current) {
        const rect = canvas.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        
        // Se a página estiver na metade superior do container
        if (rect.top < containerRect.top + containerRect.height / 2 && rect.bottom > containerRect.top) {
          visiblePage = pageNum;
        }
      }
    });

    setCurrentPage(visiblePage);

    // Se chegou na última página ou passou de 90% do scroll, dispara o onReadComplete
    if (visiblePage === numPages || scrollPercentage >= 90) {
      if (onReadCompleteRef.current) {
        onReadCompleteRef.current();
      }
    }
  };

  // 6. Download Seguro
  const handleDownload = async () => {
    if (!allowDownload) {
      toast.error("O download deste documento confidencial foi bloqueado pela governança.");
      return;
    }
    if (!isEditor) {
      toast.error("Apenas administradores, CEO e RH podem baixar este processo.");
      return;
    }

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `processo_coffee_mais_${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download iniciado com sucesso.");
    } catch (err) {
      toast.error("Falha ao efetuar download.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 rounded-xl overflow-hidden border border-neutral-900 shadow-2xl">
      {/* Custom PDF.js Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-850 select-none">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={useIframeFallback}
            onClick={() => setZoom(prev => Math.max(0.6, prev - 0.15))}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-neutral-400 font-bold px-1 w-12 text-center">
            {useIframeFallback ? "---" : `${Math.round(zoom * 100)}%`}
          </span>
          <button
            type="button"
            disabled={useIframeFallback}
            onClick={() => setZoom(prev => Math.min(2.5, prev + 0.15))}
            className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
        </div>

        {/* Page counter */}
        <div className="text-[10px] text-neutral-400 font-bold">
          {useIframeFallback ? (
            <span className="text-amber-500 font-black uppercase tracking-wider text-[9px] animate-pulse">Modo Resiliência Ativo</span>
          ) : (
            <>Página <span className="text-white">{currentPage}</span> de <span className="text-white">{numPages || "?"}</span></>
          )}
        </div>

        {/* Download Button */}
        <div>
          {isEditor && allowDownload ? (
            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 hover:bg-neutral-800 rounded-lg text-amber-500 hover:text-amber-400 transition flex items-center gap-1.5 text-[10px] font-black uppercase cursor-pointer"
              title="Download PDF"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Download</span>
            </button>
          ) : !allowDownload ? (
            <span className="text-[8px] bg-red-950/40 text-red-400 border border-red-900/30 px-2 py-1 rounded-full font-bold uppercase select-none cursor-not-allowed">
              🔒 Download Bloqueado
            </span>
          ) : null}
        </div>
      </div>

      {/* Canvas scroll container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 flex flex-col items-center gap-6 scrollbar-thin scrollbar-thumb-neutral-800"
        style={{ height: "680px" }}
      >
        {loading && (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-semibold">Carregando visualizador de alta definição...</span>
          </div>
        )}

        {error && !useIframeFallback && (
          <div className="flex flex-col items-center justify-center py-32 text-red-400 gap-3 max-w-sm text-center mx-auto">
            <AlertCircle className="w-10 h-10 text-red-500" />
            <h5 className="text-xs font-black uppercase tracking-wider">{error}</h5>
          </div>
        )}

        {useIframeFallback && url ? (
          <iframe
            src={url}
            className="w-full h-[650px] border border-neutral-800 rounded-xl bg-white shadow-2xl"
            title="PDF Fallback Viewer"
          />
        ) : useIframeFallback ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-500 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <span className="text-xs font-semibold">Carregando arquivo PDF...</span>
          </div>
        ) : null}

        {!loading && !error && !useIframeFallback && pdf && (
          Array.from({ length: numPages }).map((_, index) => {
            const pageNum = index + 1;
            return (
              <div key={pageNum} className="relative shadow-2xl bg-white rounded-lg overflow-hidden border border-neutral-880">
                <canvas
                  ref={el => {
                    if (el) {
                      canvasRefs.current.set(pageNum, el);
                    } else {
                      canvasRefs.current.delete(pageNum);
                    }
                  }}
                  className="max-w-full"
                />
                <div className="absolute bottom-2 right-2 bg-neutral-950/60 text-white text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-widest select-none">
                  Página {pageNum}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
