# DOCUMENTAÇÃO TÉCNICA — INFRAESTRUTURA DE GERAÇÃO E EXPORTAÇÃO DE PDF INSTITUCIONAL

> **Status Arquitetural:** `GENERIC_PDF_EXPORTER = IMPLEMENTED & VERIFIED`  
> **Data de Homologação:** 28/07/2026  
> **Escopo:** Infraestrutura reutilizável para renderização e exportação de qualquer documento Markdown institucional da plataforma Coffee++ para PDF com layout corporativo padronizado.

---

## 1. VISÃO GERAL DA ARQUITETURA

A infraestrutura de exportação de PDF institucional foi desenvolvida de forma 100% **genérica, desacoplada e reutilizável**. Ela permite que qualquer documento Markdown mantido na plataforma (seja uma Especificação Funcional, Manual Operacional, Arquitetura ou Procedimento) seja convertido e baixado/impresso em formato PDF com a identidade visual da **Coffee++**.

```
┌─────────────────────────┐
│ Documento Markdown      │
│ (ex: spec.md/manual.md) │
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│ API GET /api/docs/raw   │ ──(Leitura segura de arquivos do sistema)
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│ Markdown PDF Exporter   │ ──(Parser de Markdown + Renderizador de Mermaid via Canvas)
│ (markdownPdfExporter.ts)│
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│ Motor PDFMake           │ ──(Geração de PDF Institucional com Capa, Header, Footer e Estilos)
└─────────────────────────┘
             │
             ▼
┌─────────────────────────┐
│ PDF Final Baixado/Impresso
└─────────────────────────┘
```

---

## 2. COMPONENTES E ARQUIVOS ADICIONADOS

### 2.1 Engine Principal (`src/lib/docs/markdownPdfExporter.ts`)
* **Função:** Parser genérico de Markdown e construtor do documento `pdfMake`.
* **Recursos Implementados:**
  * **Capa Institucional:** Renderiza o título, subtítulo, marca Coffee++, tabela de metadados (Módulo, Versão, Baseline, Data, Autor, Status) e aviso de confidencialidade.
  * **Estilização Corporativa Coffee++:**
    * Primária: Deep Velvet Black (`#0F0A06`)
    * Secundária: Coffee Brown (`#4A2C11`)
    * Destaque: Premium Gold (`#D4A373`)
    * Fundo de cartões: Dark Dark (`#141414`) e (`#1F1A14`)
  * **Header e Footer Dinâmicos:** Cabeçalho no topo com o nome do módulo e status; Rodapé com `Confidencial` e numeração dinâmica `Página X de Y`.
  * **Renderizador de Diagramas Mermaid:** Intercepta blocos ````mermaid ... ````, executa o renderizador client-side do `mermaid`, converte o SVG gerado para Canvas e insere a imagem PNG no PDFMake com qualidade de alta resolução. **Garantia de 0% de código Mermaid bruto no PDF final.**
  * **Blocos de Alerta e Callouts:** Suporte completo aos tags GitHub:
    * `> [!NOTE]`: Caixa azul de observação.
    * `> [!TIP]`: Caixa verde de dica de ouro.
    * `> [!WARNING]` / `> [!CAUTION]`: Caixa vermelha de atenção/risco.
    * `> [!IMPORTANT]`: Caixa roxa de importância.
  * **Tabelas e Listas:** Parsing completo de tabelas Markdown com alinhamento, zebra striping e formatação de listas/checklists `[x]` / `[ ]`.

### 2.2 Componente UI de Botão (`src/components/docs/ExportPdfButton.tsx`)
* **Função:** Botão de interface reutilizável para disparar a geração de PDF.
* **Modos de Operação:** `mode="download"` (Baixar PDF) ou `mode="print"` (Abrir diálogo de impressão).
* **Variantes de Estilo:** `gold`, `primary`, `secondary`, `outline`.
* **Comportamento:** Exibe spinner de carregamento (`Loader2`) durante o parsing do Markdown e a conversão dos diagramas Mermaid.

### 2.3 Rota de API (`src/app/api/docs/raw/route.ts`)
* **Função:** API endpoint para leitura segura de arquivos `.md` do projeto.
* **Segurança:** Trava contra ataques de Path Traversal (`resolvedPath.startsWith(projectRoot)`).

### 2.4 Integração na Interface (`src/app/investimento/ajuda/page.tsx`)
* Inclusão dos botões de exportação direta:
  * `📘 Manual (PDF)` -> Gera o PDF do Manual Operacional do Gerente Regional.
  * `📄 Espec. Funcional (PDF)` -> Gera o PDF da Especificação Funcional Oficial.

---

## 3. BIBLIOTECAS UTILIZADAS

* **`pdfmake` (`^0.2.10`):** Motor de layout e renderização de PDF vetorial client-side.
* **`mermaid` (`^11.12.0`):** Motor de renderização de diagramas de fluxo para conversão em SVG/Canvas PNG.
* **`lucide-react` (`^1.7.0`):** Ícones de interface para botões de download, impressora e carregamento.

---

## 4. COMO REUTILIZAR EM NOVOS MÓDULOS

Para adicionar exportação em PDF em qualquer outro módulo (ex: RPS, DRE, CRM, Promotor), basta importar o componente `ExportPdfButton`:

```tsx
import { ExportPdfButton } from "@/components/docs/ExportPdfButton";

<ExportPdfButton
  docPath="docs/processos/meu_modulo_especificacao_funcional.md"
  title="Especificação Funcional do Módulo X"
  subtitle="Documento Canônico Oficial"
  module="Módulo X"
  label="📄 Baixar PDF Institucional"
  variant="gold"
/>
```

---

## 5. EVIDÊNCIAS DE VALIDAÇÃO E FUNCIONAMENTO

1. **Compilação de Tipos:** `npx tsc --noEmit` executado com **0 erros**.
2. **Documentos Testados e Homologados:**
   - ✅ `docs/processos/modulo_investimentos_especificacao_funcional.md`
   - ✅ `docs/manuais/manual_operacional_gerente_regional_investimentos.md`
3. **Diagramas Mermaid:** Renderizados com sucesso como imagens PNG nativas no PDF.
