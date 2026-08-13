import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Configure pdfMake virtual file system font bundle
if (typeof window !== "undefined") {
  (pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfMake as any).vfs;
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  module: string;
  version?: string;
  baseline?: string;
  status?: string;
  author?: string;
  date?: string;
  filename?: string;
  mode?: "download" | "print" | "blob";
}

/**
 * Converte diagramas Mermaid para Data URL PNG (em ambiente de navegação client-side)
 */
async function renderMermaidDiagrams(markdownContent: string): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};

  const mermaidRegex = /```mermaid([\s\S]*?)```/g;
  const matches = Array.from(markdownContent.matchAll(mermaidRegex));
  const diagramImages: Record<string, string> = {};

  if (matches.length === 0) return diagramImages;

  try {
    const mermaidModule = await import("mermaid");
    const mermaid = mermaidModule.default;

    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        primaryColor: "#4A2C11",
        primaryTextColor: "#FFFFFF",
        primaryBorderColor: "#D4A373",
        lineColor: "#D4A373",
        secondaryColor: "#1A1A1A",
        tertiaryColor: "#262626",
        fontFamily: "Helvetica, Arial, sans-serif",
      },
    });

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const rawCode = match[1].trim();
      const diagramId = `mermaid_pdf_${i}_${Date.now()}`;

      try {
        const container = document.createElement("div");
        container.style.position = "absolute";
        container.style.left = "-9999px";
        container.style.top = "-9999px";
        document.body.appendChild(container);

        const { svg } = await mermaid.render(diagramId, rawCode);
        container.innerHTML = svg;

        const svgElement = container.querySelector("svg");
        if (svgElement) {
          let svgData = new XMLSerializer().serializeToString(svgElement);

          // Limpeza do SVG para evitar contaminação do canvas (Tainted Canvas SecurityError):
          // 1. Remover regras @import (ex: Google Fonts ou CSS remoto)
          svgData = svgData.replace(/@import\s+url\([^)]+\);?/gi, "");
          // 2. Remover fontes externas ou links remotos http/https
          svgData = svgData.replace(/url\(['"]?https?:\/\/[^'"]+['"]?\)/gi, "none");
          // 3. Garantir o namespace xmlns oficial
          if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
            svgData = svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          }

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          const img = new Image();
          img.crossOrigin = "anonymous";

          // Codificação segura em Data URL Base64
          const encodedSvg = btoa(unescape(encodeURIComponent(svgData)));
          const dataUrlSrc = `data:image/svg+xml;base64,${encodedSvg}`;

          const pngDataUrl = await new Promise<string>((resolve) => {
            let settled = false;

            const cleanup = () => {
              if (container.parentNode) {
                container.parentNode.removeChild(container);
              }
            };

            const timer = setTimeout(() => {
              if (!settled) {
                settled = true;
                cleanup();
                resolve("");
              }
            }, 5000);

            img.onload = () => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);

              try {
                const bbox = svgElement.viewBox?.baseVal;
                const width = (bbox && bbox.width > 0) ? bbox.width : (svgElement.clientWidth || 800);
                const height = (bbox && bbox.height > 0) ? bbox.height : (svgElement.clientHeight || 400);

                canvas.width = Math.max(width * 2, 800);
                canvas.height = Math.max(height * 2, 400);

                if (ctx) {
                  ctx.fillStyle = "#141414";
                  ctx.fillRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                }

                // Execução segura de toDataURL envelopada contra Tainted Canvas
                const resultDataUrl = canvas.toDataURL("image/png");
                cleanup();
                resolve(resultDataUrl);
              } catch (exportErr) {
                console.warn("Falha ao exportar canvas (tainted canvas fallback):", exportErr);
                cleanup();
                resolve("");
              }
            };

            img.onerror = (err) => {
              if (settled) return;
              settled = true;
              clearTimeout(timer);
              console.warn("Falha ao carregar imagem SVG:", err);
              cleanup();
              resolve("");
            };

            img.src = dataUrlSrc;
          });

          if (pngDataUrl) {
            diagramImages[match[0]] = pngDataUrl;
          }
        } else {
          if (container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      } catch (err) {
        console.warn(`Falha ao renderizar diagrama Mermaid #${i}:`, err);
      }
    }
  } catch (err) {
    console.warn("Módulo Mermaid não disponível para pré-renderização de PDF:", err);
  }

  return diagramImages;
}

/**
 * Utilitário de parsing de tabelas Markdown
 */
function parseMarkdownTable(tableLines: string[]): any {
  if (tableLines.length < 2) return null;

  const parseRow = (line: string) =>
    line
      .split("|")
      .map((c) => c.trim())
      .filter((c, idx, arr) => !(idx === 0 && c === "") && !(idx === arr.length - 1 && c === ""));

  const headers = parseRow(tableLines[0]);
  const rows = tableLines.slice(2).map(parseRow);

  if (headers.length === 0) return null;

  const colWidths = headers.map(() => "*");

  const tableBody = [
    headers.map((h) => ({
      text: h.replace(/\*\*/g, ""),
      style: "tableTh",
    })),
    ...rows.map((r, rowIdx) =>
      r.map((cell) => ({
        text: cell.replace(/\*\*/g, ""),
        style: rowIdx % 2 === 0 ? "tableTd" : "tableTdAlt",
      }))
    ),
  ];

  return {
    table: {
      widths: colWidths,
      body: tableBody,
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#333333",
      vLineColor: () => "#333333",
    },
    margin: [0, 8, 0, 14],
  };
}

/**
 * Converte blocos Markdown para objetos pdfMake estruturados com visual institucional Coffee++
 */
function convertMarkdownToPdfMakeContent(
  markdown: string,
  diagramImages: Record<string, string>
): any[] {
  const content: any[] = [];
  const lines = markdown.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Títulos
    if (trimmed.startsWith("# ")) {
      const titleText = trimmed.replace(/^#\s+/, "").replace(/\*\*/g, "");
      content.push({
        text: titleText,
        style: "docHeaderTitle",
        tocItem: true,
        id: `section_${content.length}`,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("## ")) {
      const h2Text = trimmed.replace(/^##\s+/, "").replace(/\*\*/g, "");
      content.push({
        text: h2Text,
        style: "heading1",
        tocItem: true,
        id: `section_${content.length}`,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("### ")) {
      const h3Text = trimmed.replace(/^###\s+/, "").replace(/\*\*/g, "");
      content.push({
        text: h3Text,
        style: "heading2",
        tocItem: true,
        id: `section_${content.length}`,
      });
      i++;
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      const h4Text = trimmed.replace(/^####\s+/, "").replace(/\*\*/g, "");
      content.push({
        text: h4Text,
        style: "heading3",
      });
      i++;
      continue;
    }

    // 2. Divisores
    if (trimmed === "---" || trimmed === "***") {
      content.push({
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: "#333333" }],
        margin: [0, 10, 0, 10],
      });
      i++;
      continue;
    }

    // 3. Blocos de Alerta / Callout (> [!NOTE], > [!TIP], etc.)
    if (trimmed.startsWith("> [!")) {
      const alertMatch = trimmed.match(/^>\s*\[!(NOTE|TIP|WARNING|IMPORTANT|CAUTION)\]/i);
      const alertType = alertMatch ? alertMatch[1].toUpperCase() : "NOTE";
      
      const alertContent: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        alertContent.push(lines[i].trim().replace(/^>\s*/, ""));
        i++;
      }

      let boxBg = "#1a2234";
      let borderColor = "#2563eb";
      let iconText = "ℹ️ NOTA";

      if (alertType === "TIP") {
        boxBg = "#14241c";
        borderColor = "#16a34a";
        iconText = "💡 DICA DE OURO";
      } else if (alertType === "WARNING" || alertType === "CAUTION") {
        boxBg = "#2e1a14";
        borderColor = "#dc2626";
        iconText = "⚠️ ATENÇÃO / ALERTA";
      } else if (alertType === "IMPORTANT") {
        boxBg = "#251a34";
        borderColor = "#9333ea";
        iconText = "📌 IMPORTANTE";
      }

      content.push({
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: boxBg,
                margin: [12, 10, 12, 10],
                stack: [
                  { text: iconText, style: "calloutHeader", color: borderColor },
                  { text: alertContent.join("\n").replace(/\*\*/g, ""), style: "calloutText" },
                ],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i: number) => (i === 0 ? 4 : 0),
          vLineColor: () => borderColor,
        },
        margin: [0, 8, 0, 12],
      });
      continue;
    }

    // 4. Diagramas Mermaid
    if (trimmed.startsWith("```mermaid")) {
      const codeLines: string[] = [line];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) {
        codeLines.push(lines[i]);
        i++;
      }

      const fullBlock = codeLines.join("\n");
      const pngDataUrl = diagramImages[fullBlock];

      if (pngDataUrl) {
        content.push({
          image: pngDataUrl,
          fit: [515, 300],
          alignment: "center",
          margin: [0, 10, 0, 15],
        });
      } else {
        content.push({
          table: {
            widths: ["*"],
            body: [
              [
                {
                  fillColor: "#1a1614",
                  margin: [10, 10, 10, 10],
                  stack: [
                    { text: "📊 DIAGRAMA DE FLUXO DE PROCESSO (MERMAID)", style: "codeTitle" },
                    { text: codeLines.slice(1, -1).join("\n"), style: "codeContent" },
                  ],
                },
              ],
            ],
          },
          layout: "noBorders",
          margin: [0, 8, 0, 12],
        });
      }
      continue;
    }

    // 5. Outros blocos de código
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;

      content.push({
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: "#141414",
                margin: [10, 8, 10, 8],
                stack: [{ text: codeLines.join("\n"), style: "codeContent" }],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 6, 0, 10],
      });
      continue;
    }

    // 6. Tabelas Markdown
    if (trimmed.startsWith("|")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const parsedTable = parseMarkdownTable(tableLines);
      if (parsedTable) {
        content.push(parsedTable);
      }
      continue;
    }

    // 7. Listas e Checklists
    if (trimmed.startsWith("- [ ]") || trimmed.startsWith("- [x]") || trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const listItems: any[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith("- ") || lines[i].trim().startsWith("* ") || lines[i].trim().startsWith("- ["))
      ) {
        const itemStr = lines[i].trim();
        if (itemStr.startsWith("- [x]")) {
          listItems.push({
            text: `☑ ${itemStr.replace("- [x]", "").trim().replace(/\*\*/g, "")}`,
            style: "checkDone",
          });
        } else if (itemStr.startsWith("- [ ]")) {
          listItems.push({
            text: `☐ ${itemStr.replace("- [ ]", "").trim().replace(/\*\*/g, "")}`,
            style: "checkTodo",
          });
        } else {
          listItems.push({
            text: itemStr.replace(/^[-*]\s+/, "").replace(/\*\*/g, ""),
            style: "listItem",
          });
        }
        i++;
      }
      content.push({
        ul: listItems,
        margin: [10, 4, 0, 8],
      });
      continue;
    }

    // 8. Parágrafos normais
    if (trimmed.length > 0) {
      content.push({
        text: trimmed.replace(/\*\*/g, ""),
        style: "paragraph",
      });
    }

    i++;
  }

  return content;
}

/**
 * Gera o documento PDF institucional padronizado para qualquer documento Markdown
 */
export async function exportMarkdownToPdf(
  markdownContent: string,
  options: PdfExportOptions
): Promise<void> {
  if (typeof window === "undefined") return;

  // Assegurar VFS no pdfMake
  if (!(pdfMake as any).vfs) {
    (pdfMake as any).vfs = (pdfFonts as any).pdfMake ? (pdfFonts as any).pdfMake.vfs : (pdfMake as any).vfs;
  }

  // 1. Renderizar diagramas Mermaid previamente
  const diagramImages = await renderMermaidDiagrams(markdownContent);

  // 2. Parser do Markdown
  const parsedContent = convertMarkdownToPdfMakeContent(markdownContent, diagramImages);

  const title = options.title || "Documento Institucional";
  const subtitle = options.subtitle || "Plataforma Comercial Coffee++";
  const moduleName = options.module || "Módulo Corporativo";
  const version = options.version || "2.0 (Homologado)";
  const baseline = options.baseline || "BASELINE CONFIRMED";
  const status = options.status || "CONFIDENCIAL / OFICIAL";
  const dateStr = options.date || new Date().toLocaleDateString("pt-BR");
  const author = options.author || "Equipe de Engenharia e Governança Coffee++";
  const filename = options.filename || `${title.toLowerCase().replace(/[\/\s]/g, "_")}.pdf`;

  // 3. Definição do Documento PDFMake
  const docDefinition: any = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [40, 55, 40, 50],

    background: function () {
      return {
        canvas: [{ type: "rect", x: 0, y: 0, w: 595.28, h: 841.89, color: "#0F0A06" }],
      };
    },

    header: function (currentPage: number) {
      if (currentPage === 1) return null;
      return {
        columns: [
          { text: `Coffee++ • ${moduleName.toUpperCase()}`, style: "headerLeft" },
          { text: `Status: ${status}`, style: "headerRight" },
        ],
        margin: [40, 20, 40, 0],
      };
    },

    footer: function (currentPage: number, pageCount: number) {
      return {
        columns: [
          { text: `Confidencial • © 2026 Coffee++ • Todos os Direitos Reservados`, style: "footerLeft" },
          { text: `Página ${currentPage} de ${pageCount}`, style: "footerRight" },
        ],
        margin: [40, 0, 40, 20],
      };
    },

    content: [
      // ═════════════════════════════════════════════════════════════════
      // CAPA INSTITUCIONAL COFFEE++
      // ═════════════════════════════════════════════════════════════════
      { text: "COFFEE++", style: "brandLogo", margin: [0, 70, 0, 5] },
      { text: title.toUpperCase(), style: "capaTitle", margin: [0, 0, 0, 10] },
      { text: subtitle.toUpperCase(), style: "capaSubtitle", margin: [0, 0, 0, 30] },

      {
        canvas: [{ type: "line", x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: "#D4A373" }],
        margin: [0, 0, 0, 30],
      },

      {
        table: {
          widths: ["*"],
          body: [
            [
              {
                fillColor: "#1A1410",
                margin: [18, 18, 18, 18],
                stack: [
                  { text: `MÓDULO: ${moduleName.toUpperCase()}`, style: "metaLabel" },
                  { text: `VERSÃO DO DOCUMENTO: ${version}`, style: "metaVal" },
                  { text: `STATUS ARQUITETURAL: ${baseline}`, style: "metaValHighlight" },
                  { text: `DATA DE EMISSÃO: ${dateStr}`, style: "metaVal" },
                  { text: `AUTOR / EMISSOR: ${author}`, style: "metaVal" },
                  { text: `CLASSIFICAÇÃO: ${status}`, style: "metaVal" },
                ],
              },
            ],
          ],
        },
        layout: "noBorders",
        margin: [0, 0, 0, 40],
      },

      {
        text: "DOCUMENTO TÉCNICO E OPERACIONAL OFICIAL — USO INTERNO E AUDITORIA",
        style: "confidentialNotice",
        margin: [0, 40, 0, 0],
      },

      // ═════════════════════════════════════════════════════════════════
      // SUMÁRIO EXECUTIVO E CONTEÚDO DO DOCUMENTO
      // ═════════════════════════════════════════════════════════════════
      { text: "", pageBreak: "after" },

      ...parsedContent,
    ],

    styles: {
      brandLogo: { fontSize: 26, bold: true, color: "#D4A373", letterSpacing: 2 },
      capaTitle: { fontSize: 18, bold: true, color: "#FFFFFF" },
      capaSubtitle: { fontSize: 11, bold: true, color: "#A3A3A3" },
      metaLabel: { fontSize: 10, bold: true, color: "#D4A373" },
      metaVal: { fontSize: 9, color: "#E5E5E5", margin: [0, 2, 0, 0] },
      metaValHighlight: { fontSize: 9, bold: true, color: "#22C55E", margin: [0, 2, 0, 0] },
      confidentialNotice: { fontSize: 8, color: "#737373", alignment: "center", italic: true },
      headerLeft: { fontSize: 8, color: "#A3A3A3" },
      headerRight: { fontSize: 8, color: "#A3A3A3", alignment: "right" },
      footerLeft: { fontSize: 8, color: "#737373" },
      footerRight: { fontSize: 8, color: "#737373", alignment: "right" },
      docHeaderTitle: { fontSize: 16, bold: true, color: "#D4A373", margin: [0, 12, 0, 8] },
      heading1: { fontSize: 13, bold: true, color: "#D4A373", margin: [0, 14, 0, 6] },
      heading2: { fontSize: 11, bold: true, color: "#FFFFFF", margin: [0, 10, 0, 4] },
      heading3: { fontSize: 10, bold: true, color: "#E5E5E5", margin: [0, 8, 0, 3] },
      paragraph: { fontSize: 9, color: "#D4D4D4", leading: 13, margin: [0, 2, 0, 6] },
      listItem: { fontSize: 9, color: "#D4D4D4", margin: [0, 1, 0, 2] },
      checkDone: { fontSize: 9, bold: true, color: "#22C55E", margin: [0, 1, 0, 2] },
      checkTodo: { fontSize: 9, color: "#A3A3A3", margin: [0, 1, 0, 2] },
      calloutHeader: { fontSize: 9, bold: true, margin: [0, 0, 0, 3] },
      calloutText: { fontSize: 8.5, color: "#E5E5E5", leading: 12 },
      codeTitle: { fontSize: 9, bold: true, color: "#D4A373", margin: [0, 0, 0, 4] },
      codeContent: { fontSize: 8, color: "#A3E635", font: "Courier" },
      tableTh: { fontSize: 8.5, bold: true, color: "#D4A373", fillColor: "#1F1A14", padding: 5 },
      tableTd: { fontSize: 8, color: "#E5E5E5", fillColor: "#141414", padding: 4 },
      tableTdAlt: { fontSize: 8, color: "#E5E5E5", fillColor: "#191919", padding: 4 },
    },
  };

  // 4. Executar Download ou Impressão
  if (options.mode === "print") {
    pdfMake.createPdf(docDefinition).print();
  } else {
    pdfMake.createPdf(docDefinition).download(filename);
  }
}
