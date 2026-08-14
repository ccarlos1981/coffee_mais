"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  BookOpen, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight, 
  ChevronLeft,
  Info, 
  AlertTriangle,
  Mail,
  FileText,
  MousePointerClick,
  X,
  Maximize2,
  Calendar,
  Clock,
  ShieldAlert,
  DollarSign,
  Users,
  ArrowRight,
  CheckSquare,
  AlertCircle,
  FileCheck,
  RefreshCw,
  Search,
  Building2,
  FileSpreadsheet,
  Award
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import { ExportPdfButton } from "@/components/docs/ExportPdfButton";

// Interface para configuração dos capítulos do curso
interface ChapterConfig {
  id: string;
  num: number;
  title: string;
  shortTitle: string;
  category: "fundamentos" | "fases" | "regras" | "operacao" | "referencia";
  responsible?: string;
  content: React.ReactNode;
}

export default function AjudaInvestimentoPage() {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string; title?: string } | null>(null);
  const [checkedChecklistItems, setCheckedChecklistItems] = useState<Record<string, boolean>>({});

  // Efeito para fechar Lightbox com tecla ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightboxImage(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Rolar para o topo do conteúdo ao mudar de capítulo
  const handleChapterChange = (index: number) => {
    setCurrentChapterIndex(index);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleChecklistItem = (id: string) => {
    setCheckedChecklistItems(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ─── COMPONENTES DIDÁTICOS AUXILIARES ─────────────────────────────────

  const ScreenshotCard = ({ 
    src, 
    alt, 
    title, 
    purpose, 
    fields 
  }: { 
    src: string; 
    alt: string; 
    title: string; 
    purpose: string; 
    fields?: Array<{ name: string; what: string; purpose?: string; fill: string; when: string; next: string }>;
  }) => (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <span className="text-xs font-bold text-gold uppercase tracking-wider flex items-center gap-1.5">
          <Maximize2 className="w-3.5 h-3.5" /> Tela da Aplicação Real
        </span>
        <span className="text-xs text-muted-foreground">Clique na imagem para ampliar</span>
      </div>

      <h4 className="text-base font-bold text-foreground">{title}</h4>

      {/* Imagem clicável com efeito de hover e Lightbox */}
      <div 
        onClick={() => setLightboxImage({ src, alt, title })}
        className="relative group cursor-pointer overflow-hidden rounded-xl border border-border bg-muted/40 transition-all hover:border-gold/50 hover:shadow-md"
      >
        <img 
          src={src} 
          alt={alt} 
          className="w-full h-auto object-cover rounded-xl transition-transform duration-300 group-hover:scale-[1.01]" 
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-semibold text-xs rounded-xl backdrop-blur-[2px]">
          <Maximize2 className="w-4 h-4" /> Ampliar em Tela Cheia
        </div>
      </div>

      <div className="bg-muted/60 p-3.5 rounded-xl border border-border/50 text-xs md:text-sm text-muted-foreground leading-relaxed">
        <strong className="text-foreground block mb-1">📌 Para que serve esta tela?</strong>
        {purpose}
      </div>

      {/* Tabela Explicativa dos Campos da Tela */}
      {fields && fields.length > 0 && (
        <div className="space-y-2 pt-2">
          <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Explicação Detalhada dos Campos:</h5>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-muted text-muted-foreground border-b border-border">
                  <th className="p-2.5 font-bold min-w-[140px]">Campo / Item</th>
                  <th className="p-2.5 font-bold min-w-[150px]">O que é?</th>
                  <th className="p-2.5 font-bold min-w-[150px]">O que preencher?</th>
                  <th className="p-2.5 font-bold min-w-[140px]">Quando preencher?</th>
                  <th className="p-2.5 font-bold min-w-[160px]">O que acontece depois?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {fields.map((f, idx) => (
                  <tr key={idx} className="hover:bg-muted/40 transition-colors">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">{f.name}</td>
                    <td className="p-2.5 text-muted-foreground">{f.what}</td>
                    <td className="p-2.5 text-foreground font-medium">{f.fill}</td>
                    <td className="p-2.5 text-muted-foreground">{f.when}</td>
                    <td className="p-2.5 text-muted-foreground">{f.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  const BoxComoFazer = ({ children, title = "COMO FAZER PASSO A PASSO" }: { children: React.ReactNode; title?: string }) => (
    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 md:p-5 text-sm text-emerald-950 dark:text-emerald-200 space-y-2">
      <div className="flex items-center gap-2 font-bold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <span>🟢 {title}</span>
      </div>
      <div className="pl-7 leading-relaxed space-y-2">{children}</div>
    </div>
  );

  const BoxAtencao = ({ children, title = "ATENÇÃO E CUIDADO OPERACIONAL" }: { children: React.ReactNode; title?: string }) => (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 md:p-5 text-sm text-amber-950 dark:text-amber-200 space-y-2">
      <div className="flex items-center gap-2 font-bold text-amber-700 dark:text-amber-400">
        <AlertTriangle className="w-5 h-5 shrink-0" />
        <span>🟡 {title}</span>
      </div>
      <div className="pl-7 leading-relaxed space-y-2">{children}</div>
    </div>
  );

  const BoxNaoFaca = ({ children, title = "NÃO FAÇA DE FORMA ALGUMA" }: { children: React.ReactNode; title?: string }) => (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 md:p-5 text-sm text-red-950 dark:text-red-200 space-y-2">
      <div className="flex items-center gap-2 font-bold text-red-700 dark:text-red-400">
        <ShieldAlert className="w-5 h-5 shrink-0" />
        <span>🔴 {title}</span>
      </div>
      <div className="pl-7 leading-relaxed space-y-2">{children}</div>
    </div>
  );

  const BoxPorQueExiste = ({ children, title = "POR QUE ISSO EXISTE NO NEGÓCIO?" }: { children: React.ReactNode; title?: string }) => (
    <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 md:p-5 text-sm text-blue-950 dark:text-blue-200 space-y-2">
      <div className="flex items-center gap-2 font-bold text-blue-700 dark:text-blue-400">
        <Info className="w-5 h-5 shrink-0" />
        <span>🔵 {title}</span>
      </div>
      <div className="pl-7 leading-relaxed space-y-2">{children}</div>
    </div>
  );

  // ─── LISTA DOS 18 CAPÍTULOS DO MANUAL ───────────────────────────────────

  const chapters: ChapterConfig[] = [
    {
      id: "cap1",
      num: 1,
      title: "Capítulo 1: O que é um Investimento Comercial?",
      shortTitle: "1. O que é Investimento?",
      category: "fundamentos",
      content: (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-base text-muted-foreground leading-relaxed">
              Para quem nunca trabalhou na área comercial, o termo <strong>"Investimento Comercial"</strong> pode soar como uma aplicação financeira ou compra de ações na bolsa. No varejo de cafés e supermercados, significa algo totalmente diferente e essencial.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Um <strong>investimento comercial</strong> é um acordo financeiro feito entre a <strong>Coffee Mais</strong> e uma <strong>Rede de Supermercados ou Distribuidor</strong> para impulsionar a venda de cafés. Em troca de uma verba financeira (ou desconto), o cliente garante um espaço de destaque para o nosso café (ex: capa do tabloide, ponta de gôndola ou degustação).
            </p>
          </div>

          <BoxPorQueExiste title="Por que o Investimento Comercial existe?">
            <p>
              Sem investimentos promocionais, o nosso produto correria o risco de ficar escondido no fundo da gôndola do supermercado. O investimento é o motor comercial que faz o consumidor enxergar o Café Coffee Mais, experimentar a marca e comprá-lo com frequência.
            </p>
          </BoxPorQueExiste>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-card border border-border p-4 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-gold uppercase tracking-wider block">1. Visibilidade</span>
              <p className="text-xs text-muted-foreground">
                Coloca o café em tabloides, jornais digitais e espaços nobres das lojas.
              </p>
            </div>
            <div className="bg-card border border-border p-4 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-gold uppercase tracking-wider block">2. Giro de Estoque</span>
              <p className="text-xs text-muted-foreground">
                Estimula a compra rápida em grande volume através de preços promocionais atrativos.
              </p>
            </div>
            <div className="bg-card border border-border p-4 rounded-2xl space-y-2">
              <span className="text-xs font-bold text-gold uppercase tracking-wider block">3. Parceria com Cliente</span>
              <p className="text-xs text-muted-foreground">
                Fortalece o relacionamento comercial garantindo espaço contínuo nas prateleiras.
              </p>
            </div>
          </div>

          <ScreenshotCard 
            src="/images/guia-investimento/investimentos_dashboard_real.png"
            alt="Painel Central do Módulo de Investimentos Coffee Mais"
            title="Painel Central de Gestão de Investimentos"
            purpose="Esta é a tela principal do sistema onde você visualiza a saúde financeira das verbas, os cards de cada fase e o acompanhamento de todas as ações promocionais em tempo real."
            fields={[
              { name: "Cartões de Fases", what: "Contadores no topo da tela", fill: "Read-only (automático)", when: "Sempre visível", next: "Filtra a tabela abaixo pela fase clicada" },
              { name: "Filtro por Gerente", what: "Dropdown de responsáveis", fill: "Selecione o seu nome", when: "Ao abrir o painel", next: "Exibe apenas as suas ações da carteira" },
              { name: "Tabela Central", what: "Lista das ações ativas", fill: "Interativo", when: "Constantemente", next: "Permite clicar para ver detalhes ou apurar" }
            ]}
          />
        </div>
      )
    },
    {
      id: "cap2",
      num: 2,
      title: "Capítulo 2: Como funciona o Ciclo Completo de uma Ação?",
      shortTitle: "2. Ciclo Completo",
      category: "fundamentos",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Uma ação promocional não nasce e morre no mesmo dia. Ela percorre uma <strong>jornada completa de 6 etapas</strong> que envolve Planejamento, Validação, Execução, Apuração de Resultados, Auditoria e Quitação Financeira.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/workflow_geral_white_1781486116926.png"
            alt="Fluxograma Oficial do Ciclo de Investimento Coffee Mais"
            title="Fluxograma Oficial de Prestação de Contas em 6 Fases"
            purpose="Ilustra visualmente o caminho sequencial que toda verba comercial obrigatoriamente percorre na esteira corporativa."
          />

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground">A História Didática de uma Ação (Do Início ao Fim):</h4>
            <ol className="list-decimal list-inside space-y-3 text-sm text-muted-foreground">
              <li className="p-3 bg-card border border-border rounded-xl">
                <strong className="text-foreground font-bold">1. O Nascimento (Fase 1):</strong> O Gerente Comercial negocia com o comprador do supermercado e cadastra o planejamento no sistema reservando verba.
              </li>
              <li className="p-3 bg-card border border-border rounded-xl">
                <strong className="text-foreground font-bold">2. A Trava de Segurança (Fase 2):</strong> O Trade Marketing confere se há café suficiente em estoque e avisa a equipe de campo para organizar as gôndolas.
              </li>
              <li className="p-3 bg-card border border-border rounded-xl">
                <strong className="text-foreground font-bold">3. A Ação no Ar & Apuração (Fase 3):</strong> A promoção roda nas lojas. Quando termina, o Gerente digita o resultado real vendido, anexa fotos e escolhe o boleto do cliente.
              </li>
              <li className="p-3 bg-card border border-border rounded-xl">
                <strong className="text-foreground font-bold">4. A Auditoria de Campo (Fase 4):</strong> O Trade confere se os relatórios e fotos provam que a promoção realmente aconteceu conforme o combinado.
              </li>
              <li className="p-3 bg-card border border-border rounded-xl">
                <strong className="text-foreground font-bold">5. O Pagamento (Fase 5):</strong> O Financeiro efetua a baixa bancária ou abatimento do boleto no ERP Sankhya e sobe o comprovante oficial.
              </li>
              <li className="p-3 bg-card border border-border rounded-xl">
                <strong className="text-foreground font-bold">6. O Encerramento Perfeito (Fase 6):</strong> A ação recebe o selo verde de concluída (✅) e fica gravada de forma imutável no histórico da Coffee Mais.
              </li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: "cap3",
      num: 3,
      title: "Capítulo 3: Quem faz o quê? (Matriz RACI do Módulo)",
      shortTitle: "3. Quem faz o quê?",
      category: "fundamentos",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Para evitar o famoso <em>"achava que fulano ia fazer isso"</em>, o módulo possui papéis e responsabilidades 100% delimitados por perfil no sistema.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/workflow_geral_white_1781486116926.png"
            alt="Divisão de Responsabilidades e Fases de Atuação"
            title="Mapeamento de Fases por Responsável no Sistema"
            purpose="Cada área possui uma etapa específica de atuação no painel corporativo para garantir independência de auditoria."
          />

          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-gold/15 text-gold border-b border-border">
                  <th className="p-3 font-bold">Papel / Função</th>
                  <th className="p-3 font-bold">Quem é essa pessoa?</th>
                  <th className="p-3 font-bold">O que faz no módulo?</th>
                  <th className="p-3 font-bold">Fases de Atuação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr className="hover:bg-muted/40">
                  <td className="p-3 font-bold text-foreground bg-muted/20">Gerente Regional (GRV)</td>
                  <td className="p-3">Executivo de vendas responsável pela carteira de clientes.</td>
                  <td className="p-3">Planeja, lança a ação, apura vendas reais, junta evidências e vincula boletos.</td>
                  <td className="p-3 font-bold text-amber-500">Fase 1 e Fase 3</td>
                </tr>
                <tr className="hover:bg-muted/40">
                  <td className="p-3 font-bold text-foreground bg-muted/20">Trade Marketing</td>
                  <td className="p-3">Equipe interna de estratégia de mercado e promotores de campo.</td>
                  <td className="p-3">Valida viabilidade de estoque, materiais e audita dossiês e fotos das gôndolas.</td>
                  <td className="p-3 font-bold text-blue-500">Fase 2 e Fase 4</td>
                </tr>
                <tr className="hover:bg-muted/40">
                  <td className="p-3 font-bold text-foreground bg-muted/20">Financeiro / Tesouraria</td>
                  <td className="p-3">Analistas de contas a pagar e abatimentos bancários.</td>
                  <td className="p-3">Executa baixas no ERP Sankhya, quita boletos e insere comprovantes bancários.</td>
                  <td className="p-3 font-bold text-emerald-500">Fase 5</td>
                </tr>
                <tr className="hover:bg-muted/40">
                  <td className="p-3 font-bold text-foreground bg-muted/20">Sistema (Automação)</td>
                  <td className="p-3">Plataforma Coffee++ automatizada.</td>
                  <td className="p-3">Dispara e-mails automáticos, calcula conversões físicas e encerra imutavelmente.</td>
                  <td className="p-3 font-bold text-purple-500">Fase 6 (Imutável)</td>
                </tr>
              </tbody>
            </table>
          </div>

          <BoxPorQueExiste title="Por que a responsabilidade é dividida?">
            <p>
              Esta divisão é uma regra fundamental de <strong>Governança Financeira</strong>. Quem vende (Gerente) não pode aprovar a própria conta para pagamento sem que o Trade confirme a execução física e o Financeiro valide o documento bancário.
            </p>
          </BoxPorQueExiste>
        </div>
      )
    },
    {
      id: "cap4",
      num: 4,
      title: "Capítulo 4: Fase 1 — Planejamento Comercial & Lançamento",
      shortTitle: "4. Fase 1 — Planejamento",
      category: "fases",
      responsible: "Gerente Regional Comercial",
      content: (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-base text-muted-foreground leading-relaxed">
              A <strong>Fase 1 (Planejamento Comercial)</strong> é onde toda verba comercial começa. O Gerente Regional cria a campanha e cadastra as ações planejadas para a sua carteira de clientes.
            </p>
          </div>

          {/* PAINEL DIDÁTICO ESPECIAL: A DIFERENÇA DOS 4 CONCEITOS DE DATAS */}
          <div className="bg-gradient-to-br from-gold/10 via-card to-card border-2 border-gold/40 rounded-2xl p-5 space-y-4 shadow-md">
            <h4 className="text-sm font-bold text-gold uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Entenda a Diferença entre as 4 Datas do Sistema (Sem Confusão!)
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              É muito comum quem está começando confundir o mês em que está lançando com o mês da promoção. Veja a diferença exata com um exemplo prático:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <span className="font-bold text-foreground block flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-500" /> 1. Data de Registro (Timestamp)
                </span>
                <p className="text-muted-foreground">O dia e a hora em que você clicou no botão "Salvar". Gravado 100% automático pelo sistema (ex: 15/07/2026 às 14:30).</p>
              </div>

              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <span className="font-bold text-foreground block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-gold" /> 2. Mês de Referência (YYYY-MM)
                </span>
                <p className="text-muted-foreground">O mês comercial/orçamentário que pagará a verba (ex: <span className="font-semibold text-foreground">2026-08</span> = Agosto/2026). NUNCA é simplesmente o "mês anterior" ou a "data de hoje".</p>
              </div>

              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <span className="font-bold text-foreground block flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-500" /> 3. Período Planejado da Ação
                </span>
                <p className="text-muted-foreground">As datas em que o folheto rodará nas lojas (ex: <span className="font-semibold text-foreground">10/08/2026 a 20/08/2026</span>).</p>
              </div>

              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <span className="font-bold text-foreground block flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500" /> 4. Período Real (Divergência)
                </span>
                <p className="text-muted-foreground">Se a entrega atrasar, a data real em que rodou (ex: <span className="font-semibold text-foreground">15/08/2026 a 25/08/2026</span>), registrada pelo Trade na Fase 2.</p>
              </div>
            </div>
          </div>

          <ScreenshotCard 
            src="/images/guia-investimento/fase1_lancar_real.png"
            alt="Formulário de Cadastro de Investimento Comercial - Topo"
            title="Formulário de Lançamento Comercial (Dados Gerais)"
            purpose="Utilizado pelo Gerente Regional para cadastrar uma nova ação comercial no sistema informando cliente, mecânica, vigência e mês de referência."
            fields={[
              { name: "Rede / Cliente", what: "Matriz comercial compradora", fill: "Selecione na lista oficial de redes", when: "No início do lançamento", next: "Associa o código da matriz oficial" },
              { name: "Tipo de Ação", what: "Mecânica promocional negociada", fill: "Tabloide, Ponta de Gôndola, Degustação, etc.", when: "Ao definir o acordo", next: "Orienta os critérios de auditoria" },
              { name: "Mês de Referência", what: "Mês comercial a que pertence a verba", fill: "Formato YYYY-MM (ex: 2026-08)", when: "Sempre obrigatório", next: "Define qual orçamento do mês pagará a ação" },
              { name: "Data Início / Fim", what: "Vigência em que a oferta roda nas lojas", fill: "Selecione no calendário", when: "Vigência combinada", next: "Acompanhamento no calendário comercial" }
            ]}
          />

          <ScreenshotCard 
            src="/images/guia-investimento/fase1_lancar_real_bottom.png"
            alt="Formulário de Cadastro de Investimento Comercial - Parâmetros e Cálculos"
            title="Definição de Produtos, Preços e Cálculo Automático"
            purpose="Permite definir se o desconto aplica-se a uma Família inteira (ex: Moídos) ou a SKUs específicos, inserindo os preços de gôndola e o volume esperado."
            fields={[
              { name: "Preço Flat (Normal)", what: "Preço regular fora da oferta", fill: "Valor numérico (ex: R$ 19,90)", when: "No cadastro", next: "Base para calcular o valor do desconto" },
              { name: "Preço da Ação", what: "Preço de oferta para o consumidor", fill: "Valor promocional (ex: R$ 14,90)", when: "No cadastro", next: "Exibido como preço de gôndola" },
              { name: "Investimento Unitário", what: "Subsídio Coffee Mais por unidade", fill: "Calculado (Flat - Ação)", when: "Automático", next: "Multiplicado pelo volume" },
              { name: "Volume Planejado", what: "Expectativa de vendas em Caixas/Unidades", fill: "Quantidade estimada", when: "No cadastro", next: "Gera o valor total estimado da ação" }
            ]}
          />

          <ScreenshotCard 
            src="/images/guia-investimento/fase1_planejamento_real.png"
            alt="Lista de Planejamento e Botão Promover"
            title="Aba de Planejamento & Promoção para o Trade"
            purpose="Exibe todas as ações em modo Rascunho. Para transformar o rascunho em investimento oficial e enviar para o Trade, o gerente clica em Promover."
            fields={[
              { name: "Status Rascunho", what: "Ação salva apenas para o gerente", fill: "Visualização", when: "Antes de promover", next: "Ainda não consome orçamento oficial" },
              { name: "Botão Promover", what: "Ativador da esteira oficial", fill: "Clique no botão", when: "Quando o acordo estiver fechado", next: "Avança a ação para a Fase 1 oficial" },
              { name: "Passar para o Trade", what: "Envia para a mesa do Trade", fill: "Clique no botão", when: "Após promover", next: "Dispara a notificação da Fase 2" }
            ]}
          />

          <BoxComoFazer title="Passo a Passo para Lançar e Enviar para o Trade">
            <ol className="list-decimal list-inside space-y-1">
              <li>Acesse o menu <span className="font-semibold text-foreground">Investimento → Lançar Novo</span>.</li>
              <li>Preencha a Rede, o Tipo de Ação, a Modalidade de Pagamento e o Mês de Referência.</li>
              <li>Informe as datas de início e fim da promoção.</li>
              <li>Digite o Preço Flat, o Preço da Ação e o Volume Esperado.</li>
              <li>Clique em <span className="font-semibold text-foreground">Salvar Ação</span>.</li>
              <li>Na aba <span className="font-semibold text-foreground">Planejamento</span>, clique em <span className="font-semibold text-foreground">Promover</span> e depois em <span className="font-semibold text-foreground">Passar para o Trade</span>.</li>
            </ol>
          </BoxComoFazer>

          <BoxNaoFaca title="O que pode dar errado na Fase 1?">
            <p>
              Salvar a ação e esquecer de clicar em <strong>Promover</strong>. A ação continuará no status Rascunho e o Trade Marketing não receberá o aviso para auditoria!
            </p>
          </BoxNaoFaca>
        </div>
      )
    },
    {
      id: "cap5",
      num: 5,
      title: "Capítulo 5: Fase 2 — Validação Trade & Divergência de Calendário",
      shortTitle: "5. Fase 2 — Trade & Divergência",
      category: "fases",
      responsible: "Trade Marketing",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Na <strong>Fase 2 (Validação Trade)</strong>, a equipe de Trade Marketing analisa a viabilidade operacional da promoção antes de ela rodar no cliente.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase2_checklist_real.png"
            alt="Checklist dos Pilares de Validação do Trade Marketing"
            title="Checklist Operacional e Trava de Segurança do Trade"
            purpose="Painel de auditoria do Trade para confirmar comunicação com campo, disponibilidade de estoque em CD e registro de eventuais atrasos logísticos."
            fields={[
              { name: "Checklist Comunicação", what: "Envio de material para promotores", fill: "Checkbox (Sim/Não)", when: "Na validação", next: "Garante que a equipe de loja sabe da ação" },
              { name: "Checklist Logística", what: "Confirmação de estoque no CD", fill: "Checkbox (Sim/Não)", when: "Na validação", next: "Evita ruptura de estoque durante a oferta" },
              { name: "Checklist Auditoria", what: "Designação de promotor para fotos", fill: "Checkbox (Sim/Não)", when: "Na validação", next: "Garante foto da ponta de gôndola" },
              { name: "Checklist Garantia", what: "Validação geral do acordo", fill: "Checkbox (Sim/Não)", when: "Na validação", next: "Pontua o score de execução da ação" },
              { name: "Divergência de Calendário", what: "Registro de atraso ou alteração real", fill: "Datas reais + Motivo", when: "Se houver divergência", next: "Preserva a rastreabilidade original" }
            ]}
          />

          <div className="bg-muted/50 p-4 rounded-2xl border border-border space-y-3">
            <h4 className="font-bold text-sm text-foreground">Entenda a Divergência Operacional de Calendário:</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Se por razões de atraso de frete ou mudança no jornal do cliente a promoção atrasar, o Trade <strong>NÃO altera a data planejada original</strong>. Em vez disso, marca a caixa de <span className="font-semibold text-foreground">Divergência de Calendário</span> e preenche as datas reais de execução com o motivo homologado:
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xxs font-mono text-muted-foreground">
              <div className="p-2 bg-card rounded-lg border border-border">• ATRASO_LOGISTICO</div>
              <div className="p-2 bg-card rounded-lg border border-border">• ALTERACAO_REDE</div>
              <div className="p-2 bg-card rounded-lg border border-border">• ALTERACAO_COMERCIAL</div>
              <div className="p-2 bg-card rounded-lg border border-border">• PROBLEMA_OPERACIONAL</div>
              <div className="p-2 bg-card rounded-lg border border-border">• RUPTURA_ESTOQUE</div>
              <div className="p-2 bg-card rounded-lg border border-border">• ALTERACAO_ENCARTE</div>
              <div className="p-2 bg-card rounded-lg border border-border">• OUTROS</div>
            </div>
          </div>

          <BoxAtencao title="Regra de Validação do Trade">
            <p>
              Ao concluir a análise, o Trade clica em <span className="font-semibold text-foreground">Validado pelo Trade</span>. A ação é automaticamente impulsionada para a <strong>Fase 3 (Apuração & Boleto)</strong>, aguardando o término da oferta para prestação de contas pelo Gerente.
            </p>
          </BoxAtencao>

          <BoxNaoFaca title="O que pode dar errado na Fase 2?">
            <p>
              O Trade reprovar a ação por falta de saldo de estoque no CD. Nesse caso, a ação retorna para o Gerente na Fase 1 para reprogramação.
            </p>
          </BoxNaoFaca>
        </div>
      )
    },
    {
      id: "cap6",
      num: 6,
      title: "Capítulo 6: Fase 3 — Apuração & Boleto (Dossiê Comercial)",
      shortTitle: "6. Fase 3 — Apuração & Boleto",
      category: "fases",
      responsible: "Gerente Regional Comercial",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Após o encerramento da promoção nas lojas do cliente, a ação entra na <strong>Fase 3 (Apuração & Boleto)</strong>. É o momento em que o Gerente Regional presta contas digitando os resultados reais de vendas.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase3_apuracao_real.png"
            alt="Formulário de Apuração Comercial e Vinculação de Boleto"
            title="Formulário de Apuração e Prestação de Contas (Fase 3)"
            purpose="Tela onde o gerente digita o número do acordo comercial, a quantidade real vendida de sell-out, faz upload das evidências fotográficas e escolhe o boleto em aberto no ERP."
            fields={[
              { name: "Número do Acordo", what: "Código do contrato/acordo no cliente", fill: "Texto livre (ex: ACORDO-2026-99)", when: "Na apuração", next: "Identificador oficial do cliente" },
              { name: "Volume Real Vendido", what: "Quantidade física real de sell-out", fill: "Número de caixas/unidades", when: "Na apuração", next: "Calcula o valor real realizado" },
              { name: "Valor Real Apurado", what: "Valor final em Reais a ser quitado", fill: "Valor numérico (R$)", when: "Na apuração", next: "Base para abatimento no financeiro" },
              { name: "Upload de Evidências", what: "Fotos de gôndola e relatórios PDF", fill: "Arquivo do celular/computador", when: "Na apuração", next: "Comprova que a ação aconteceu" },
              { name: "Vínculo de Boleto", what: "Seleção da duplicata a vencer", fill: "Dropdown de boletos em aberto", when: "Na apuração", next: "Instrui o Financeiro sobre qual boleto abater" }
            ]}
          />

          <BoxComoFazer title="Passo a Passo da Apuração">
            <ol className="list-decimal list-inside space-y-1">
              <li>Localize a ação na aba <span className="font-semibold text-foreground">Fase 3: Apuração</span> e clique em <span className="font-semibold text-foreground">Preencher Apuração</span>.</li>
              <li>Insira o número do acordo do cliente e o volume real vendido.</li>
              <li>Faça o upload do relatório de sell-out (PDF) e das fotos das gôndolas/tabloide.</li>
              <li>No campo de boleto, selecione a duplicata pendente daquela rede.</li>
              <li>Clique no botão <span className="font-semibold text-foreground">Concluir Apuração</span>.</li>
            </ol>
          </BoxComoFazer>

          <BoxNaoFaca title="O que pode dar errado na Fase 3?">
            <p>
              Preencher o volume vendido sem anexar o relatório em PDF ou esquecer de vincular o boleto. O Trade devolverá a apuração na Fase 4.
            </p>
          </BoxNaoFaca>
        </div>
      )
    },
    {
      id: "cap7",
      num: 7,
      title: "Capítulo 7: Fase 4 — Auditoria Trade (Conferência do Dossiê)",
      shortTitle: "7. Fase 4 — Auditoria Trade",
      category: "fases",
      responsible: "Trade Marketing",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Na <strong>Fase 4 (Auditoria Trade / Conferência)</strong>, a equipe de Trade analisa o dossiê enviado pelo Gerente Regional.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase4_conferencia_white_1781486234948.png"
            alt="Painel de Auditoria e Conferência pelo Trade Marketing"
            title="Painel de Conferência de Dossiê pelo Trade"
            purpose="Mesa de trabalho onde o auditor de Trade compara o relatório de vendas, as fotos enviadas e a duplicata vinculada antes de aprovar a verba para o Financeiro."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-emerald-500/30 bg-emerald-500/10 p-4 rounded-2xl space-y-2">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 block text-sm">✅ Opção 1: APROVAR</span>
              <p className="text-xs text-muted-foreground">
                Se as fotos estiverem nítidas, o sell-out bater com o acordo e o boleto for válido, o Trade clica em <strong>Aprovar</strong>. A ação avança imediatamente para a <strong>Fase 5 (Pagamento Financeiro)</strong>.
              </p>
            </div>
            <div className="border border-red-500/30 bg-red-500/10 p-4 rounded-2xl space-y-2">
              <span className="font-bold text-red-700 dark:text-red-400 block text-sm">🔄 Opção 2: REPROVAR / DEVOLVER</span>
              <p className="text-xs text-muted-foreground">
                Se faltar foto, se o relatório for ilegível ou se o boleto estiver errado, o Trade clica em <strong>Devolver</strong> e digita a justificativa. A ação retorna para a <strong>Fase 3</strong> para correção pelo Gerente.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cap8",
      num: 8,
      title: "Capítulo 8: Fase 5 — Pagamento Financeiro & Quitação",
      shortTitle: "8. Fase 5 — Pagamento Financeiro",
      category: "fases",
      responsible: "Financeiro / Tesouraria",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Na <strong>Fase 5 (Pagamento Financeiro)</strong>, a equipe de Tesouraria executa a quitação bancária ou o abatimento no ERP Sankhya.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase5_financeiro_white_1781486271243.png"
            alt="Tela de Quitação e Upload de Comprovante Bancário pelo Financeiro"
            title="Tela de Confirmação de Pagamento Financeiro"
            purpose="Interface utilizada pelo setor Financeiro para anexar o comprovante bancário em PDF e registrar a baixa definitiva no ERP corporativo."
          />

          <BoxComoFazer title="O que o Financeiro faz na Fase 5:">
            <ul className="list-disc list-inside space-y-1">
              <li>Valida o boleto vinculado e confere se a autorização do Trade foi concedida.</li>
              <li>Realiza o abatimento no ERP Sankhya ou efetua a transferência bancária.</li>
              <li>Sobe o comprovante oficial de pagamento em PDF.</li>
              <li>Clica no botão <span className="font-semibold text-foreground">Confirmar Pagamento</span>.</li>
            </ul>
          </BoxComoFazer>
        </div>
      )
    },
    {
      id: "cap9",
      num: 9,
      title: "Capítulo 9: Fase 6 — Concluído & Blindagem Imutável",
      shortTitle: "9. Fase 6 — Concluído",
      category: "fases",
      responsible: "Sistema (Automação)",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            A <strong>Fase 6 (Concluído)</strong> representa o encerramento perfeito da esteira de prestação de contas.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase6_concluido_white_1781486308877.png"
            alt="Selo de Concluído e Histórico Imutável da Ação"
            title="Selo Verde de Concluído & Histórico de Auditoria"
            purpose="Exibe a ação finalizada com o selo verde de concluído (✅), onde todas as informações ficam protegidas contra edições informais."
          />

          <BoxPorQueExiste title="O que significa a Blindagem Imutável?">
            <p>
              Após atingir a Fase 6, nenhuma informação pode ser alterada no banco de dados por usuários comuns. Isso garante que relatórios de auditoria e balanços contábeis da Coffee Mais permaneçam 100% seguros e à prova de divergências.
            </p>
          </BoxPorQueExiste>
        </div>
      )
    },
    {
      id: "cap10",
      num: 10,
      title: "Capítulo 10: E-mails e Notificações (Mapeamento dos 8 Eventos)",
      shortTitle: "10. E-mails e Notificações",
      category: "regras",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            O sistema Coffee++ não exige que os usuários fiquem enviando e-mails manuais para avisar que uma ação mudou de fase. A plataforma possui <strong>8 eventos automáticos de notificação via Nodemailer</strong>.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/email_notificacao_financeiro_white_1781486346210.png"
            alt="E-mail Automático de Alerta do Sistema Coffee Mais"
            title="Modelo Oficial de E-mail Automático do Sistema"
            purpose="Exemplo real da notificação por e-mail enviada automaticamente pelo sistema com resumo da ação, fases, valores e links diretos para auditoria."
          />

          <div className="space-y-3">
            <h4 className="text-sm font-bold text-foreground">Tabela Definitiva dos 8 Eventos de E-mail:</h4>
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-muted text-muted-foreground border-b border-border">
                    <th className="p-3 font-bold min-w-[130px]">Evento</th>
                    <th className="p-3 font-bold min-w-[120px]">Gatilho / Fase</th>
                    <th className="p-3 font-bold min-w-[150px]">Quem Recebe?</th>
                    <th className="p-3 font-bold min-w-[160px]">O que significa?</th>
                    <th className="p-3 font-bold min-w-[160px]">Ação Requerida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-muted-foreground">
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">1. ENVIAR_TRADE</td>
                    <td className="p-2.5">Fase 1 → Fase 2</td>
                    <td className="p-2.5">Trade Marketing + Gerente Regional</td>
                    <td className="p-2.5">Ação cadastrada e enviada pelo comercial.</td>
                    <td className="p-2.5 text-foreground">Trade deve conferir estoque e checklist.</td>
                  </tr>
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">2. REPROVAR_TRADE</td>
                    <td className="p-2.5">Fase 2 → Fase 1</td>
                    <td className="p-2.5">Gerente Regional + Trade</td>
                    <td className="p-2.5">Trade reprovou o planejamento.</td>
                    <td className="p-2.5 text-foreground">Gerente deve revisar parâmetros ou datas.</td>
                  </tr>
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">3. VALIDAR_TRADE</td>
                    <td className="p-2.5">Fase 2 → Fase 3</td>
                    <td className="p-2.5">Trade + Gerente Regional</td>
                    <td className="p-2.5">Trade aprovou viabilidade de execução.</td>
                    <td className="p-2.5 text-foreground">Ação liberada para rodar nas lojas.</td>
                  </tr>
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">4. CONCLUIR_APURACAO</td>
                    <td className="p-2.5">Fase 3 → Fase 4</td>
                    <td className="p-2.5">Financeiro + Gerente + Admins</td>
                    <td className="p-2.5">Gerente concluiu o dossiê e boleto.</td>
                    <td className="p-2.5 text-foreground">Trade deve auditar as evidências.</td>
                  </tr>
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">5. DEVOLVER_FINANCEIRO</td>
                    <td className="p-2.5">Fase 4 → Fase 3</td>
                    <td className="p-2.5">Gerente Regional + Trade</td>
                    <td className="p-2.5">Conferência devolvida por falha no dossiê.</td>
                    <td className="p-2.5 text-foreground">Gerente deve corrigir fotos/boleto.</td>
                  </tr>
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">6. APROVAR_FINANCEIRO</td>
                    <td className="p-2.5">Fase 4 → Fase 5</td>
                    <td className="p-2.5">Financeiro + Gerente + Trade</td>
                    <td className="p-2.5">Auditoria aprovada com sucesso.</td>
                    <td className="p-2.5 text-foreground">Financeiro deve efetuar a baixa/pix.</td>
                  </tr>
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">7. PAGAMENTO_CONFIRMADO</td>
                    <td className="p-2.5">Fase 5 → Fase 6</td>
                    <td className="p-2.5">Gerente Regional + Trade</td>
                    <td className="p-2.5">Pagamento efetuado e comprovante salvo.</td>
                    <td className="p-2.5 text-foreground">Nenhuma. Ação encerrada com sucesso!</td>
                  </tr>
                  <tr className="hover:bg-muted/40">
                    <td className="p-2.5 font-bold text-foreground bg-muted/20">8. ACAO_NAO_OCORREU</td>
                    <td className="p-2.5">Qualquer → Rascunho</td>
                    <td className="p-2.5">Gerente Regional + Trade + Admins</td>
                    <td className="p-2.5">Promoção não aconteceu nas lojas.</td>
                    <td className="p-2.5 text-foreground">Gerente deve reprogramar ou cancelar.</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cap11",
      num: 11,
      title: "Capítulo 11: O que fazer quando a Ação não Aconteceu ou Atrasou?",
      shortTitle: "11. Ações Atrasadas / Não Ocorridas",
      category: "operacao",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            No dia a dia comercial, imprevistos acontecem: um caminhão pode atrasar, a rede pode adiar o encarte ou a loja física pode não montar a ponta de gôndola. O sistema Coffee++ prevê exatamente como agir nesses dois cenários sem burlar regras de auditoria.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase2_checklist_real.png"
            alt="Divergência de Calendário e Botão Ação Não Aconteceu"
            title="Tela de Ajuste de Execução Real e Trava Rastreável"
            purpose="Exibe a interface onde o usuário registra atrasos logísticos reais sem apagar o histórico de planejamento original."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Cenário A: Ação Atrasou */}
            <div className="bg-card border border-border p-4 rounded-2xl space-y-3">
              <span className="font-bold text-amber-500 block text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Cenário A: A Ação Atrasou (Divergência)
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A promoção estava marcada para a semana 1, mas por problemas logísticos só rodará na semana 2.
              </p>
              <div className="bg-muted p-3 rounded-xl text-xs space-y-1">
                <strong className="text-foreground block">O que fazer?</strong>
                <p>Na Fase 2, o Trade marca a caixa <strong>Divergência de Calendário</strong> e informa a <strong>Data Início Real</strong> e a <strong>Data Fim Real</strong> com o motivo do atraso.</p>
              </div>
              <p className="text-xxs text-amber-600 dark:text-amber-400">
                ✅ As datas planejadas originais ficam preservadas para medir a produtividade operacional.
              </p>
            </div>

            {/* Cenário B: Ação Não Aconteceu */}
            <div className="bg-card border border-border p-4 rounded-2xl space-y-3">
              <span className="font-bold text-red-500 block text-sm flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" /> Cenário B: A Ação NÃO Aconteceu (Rota de Revisão)
              </span>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A oferta foi cancelada pela rede e a ponta de gôndola nunca foi montada.
              </p>
              <div className="bg-muted p-3 rounded-xl text-xs space-y-1">
                <strong className="text-foreground block">O que fazer?</strong>
                <p>O usuário clica no botão <strong>Marcar Ação Não Aconteceu</strong> e digita a justificativa detalhada.</p>
              </div>
              <p className="text-xxs text-red-600 dark:text-red-400">
                ⚠️ A ação retorna para a Fase 1 em Rascunho e dispara o e-mail de alerta ACAO_NAO_OCORREU.
              </p>
            </div>
          </div>

          <BoxNaoFaca title="Proibição Absoluta de Mascarar Atrasos">
            <p>
              NUNCA altere artificialmente as datas planejadas originais de uma ação para tentar esconder um atraso logístico! O sistema foi desenhado para registrar a divergência real mantendo a rastreabilidade do planejamento comercial.
            </p>
          </BoxNaoFaca>
        </div>
      )
    },
    {
      id: "cap12",
      num: 12,
      title: "Capítulo 12: Prazos e Regra de Fechamento em 10 dias",
      shortTitle: "12. Prazo de 10 Dias",
      category: "regras",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Para garantir a liquidez das contas e não acumular pendências de um mês para o outro, a Coffee Mais estabelece a **Regra Operacional do Prazo de 10 Dias**.
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase3_apuracao_real.png"
            alt="Interface de Fechamento de Apuração até 10 Dias"
            title="Interface de Submissão de Fechamento Comercial"
            purpose="Mostra a janela de apuração onde o gerente deve digitar o sell-out e vincular o boleto antes do vencimento do limite de 10 dias."
          />

          <div className="bg-card border border-border p-5 rounded-2xl space-y-4">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-gold" /> Linha do Tempo dos 10 Dias de Fechamento:
            </h4>

            <div className="relative pl-6 border-l-2 border-gold/40 space-y-4 text-xs">
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-gold border-4 border-card" />
                <strong className="text-foreground block font-bold">Dia 0: Término da Promoção nas Lojas</strong>
                <p className="text-muted-foreground">A promoção é encerrada nas lojas do cliente.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-amber-500 border-4 border-card" />
                <strong className="text-foreground block font-bold">Dias 1 a 7: Coleta de Sell-Out e Evidências</strong>
                <p className="text-muted-foreground">O Gerente Regional baixar o relatório do portal do cliente e junta as fotos.</p>
              </div>
              <div className="relative">
                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 border-4 border-card" />
                <strong className="text-foreground block font-bold">Até o Dia 10 (LIMITE): Preenchimento e Fechamento no Sistema</strong>
                <p className="text-muted-foreground">O Gerente digita a apuração na Fase 3, vincula o boleto e clica em Concluir Apuração.</p>
              </div>
            </div>
          </div>

          <BoxAtencao title="Consequência do Descumprimento do Prazo">
            <p>
              Ações não fechadas dentro do prazo de 10 dias entram no relatório de pendências do dashboard e bloqueiam o orçamento da regional para novas campanhas no mês seguinte!
            </p>
          </BoxAtencao>
        </div>
      )
    },
    {
      id: "cap13",
      num: 13,
      title: "Capítulo 13: Como funciona o Boleto no Processo? (Guia para Leigos)",
      shortTitle: "13. Como funciona o Boleto?",
      category: "operacao",
      content: (
        <div className="space-y-6">
          <div className="space-y-3">
            <p className="text-base text-muted-foreground leading-relaxed">
              Se você não é da área financeira, pode estar se perguntando: <em>"Por que preciso ficar informando boleto para pagar um investimento?"</em>
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              No comércio com grandes redes de supermercados, a forma mais comum da Coffee Mais pagar uma verba promocional é através de <strong>Abatimento em Boleto (Duplicata)</strong>. Em vez de fazer um PIX para o cliente, a Coffee Mais autoriza o cliente a pagar um valor menor na fatura de café que ele comprou de nós.
            </p>
          </div>

          <ScreenshotCard 
            src="/images/guia-investimento/fase3_apuracao_real.png"
            alt="Seleção e Vinculação de Boleto Bancário na Fase 3"
            title="Seleção da Duplicata Pendente no ERP Sankhya"
            purpose="Campo onde o gerente pesquisa a duplicata em aberto do cliente no banco de dados para realizar a amarração financeira da verba."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border p-4 rounded-2xl space-y-2">
              <span className="font-bold text-foreground block text-sm">❓ Quando o boleto é OBRIGATÓRIO?</span>
              <p className="text-xs text-muted-foreground">
                Sempre que a modalidade negociada for <strong>Abatimento em Boleto</strong>. Sem o número da duplicata vinculada, o Financeiro não sabe em qual título aplicar o desconto no ERP Sankhya.
              </p>
            </div>
            <div className="bg-card border border-border p-4 rounded-2xl space-y-2">
              <span className="font-bold text-foreground block text-sm">❓ E se a ação for Bonificação em Produto?</span>
              <p className="text-xs text-muted-foreground">
                Basta marcar o checkbox <span className="font-semibold text-foreground">Sem Boleto Físico</span> e selecionar a justificativa no menu (ex: <em>Bonificação em Mercadoria</em> ou <em>Transferência PIX Direta</em>).
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cap14",
      num: 14,
      title: "Capítulo 14: Erros mais Comuns dos Gerentes e Como Evitá-los",
      shortTitle: "14. Erros mais Comuns",
      category: "operacao",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Mapeamos os 5 erros mais frequentes cometidos pelos usuários durante a operação e como resolvê-los de forma rápida:
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase1_lancar_real.png"
            alt="Erros de Cadastro e Verificação no Formulário"
            title="Atenção aos Campos do Formulário de Lançamento"
            purpose="Demonstra a tela onde a conferência prévia da Rede e do Mês de Referência previne os principais erros operacionais."
          />

          <div className="space-y-3">
            <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">❌ Erro 1: Esquecer a ação salva em Rascunho</span>
                <span className="text-xxs bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-mono">Fase 1</span>
              </div>
              <p className="text-xs text-muted-foreground">
                O gerente cadastra a ação mas esquece de clicar em <strong>Promover</strong>. A verba fica presa e o Trade não recebe a notificação.
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                💡 <strong>Como evitar:</strong> Após salvar o cadastro, vá na aba Planejamento e clique sempre em <strong>Promover</strong> e depois em <strong>Passar para o Trade</strong>.
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">❌ Erro 2: Anexar fotos ilegíveis ou escuras</span>
                <span className="text-xxs bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-mono">Fase 3</span>
              </div>
              <p className="text-xs text-muted-foreground">
                O Trade reprova o dossiê na Fase 4 porque a imagem do jornal ou do cartaz de preço não dá para ler.
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                💡 <strong>Como evitar:</strong> Abra a foto no celular antes de fazer o upload. Certifique-se de que o preço promocional esteja 100% visível.
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">❌ Erro 3: Não vincular o boleto bancário</span>
                <span className="text-xxs bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-mono">Fase 3</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Preencher a apuração sem selecionar a duplicata no dropdown de busca.
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                💡 <strong>Como evitar:</strong> Na Fase 3, pesquise sempre o boleto pendente do cliente antes de clicar em Concluir Apuração.
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">❌ Erro 4: Confundir Mês de Referência com a data do dia</span>
                <span className="text-xxs bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-mono">Fase 1</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Digitar o mês em que você está logado no sistema em vez do mês a que a verba pertence.
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                💡 <strong>Como evitar:</strong> Pergunte-se: "Esta verba pagará uma promoção de qual mês comercial?". Preencha esse mês!
              </p>
            </div>

            <div className="p-4 bg-card border border-border rounded-2xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-500 uppercase tracking-wider">❌ Erro 5: Selecionar a filial errada da rede</span>
                <span className="text-xxs bg-red-500/10 text-red-600 px-2 py-0.5 rounded font-mono">Fase 1</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Cadastrar a ação no CNPJ de outra regional quando a rede possui múltiplos estados.
              </p>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                💡 <strong>Como evitar:</strong> Confira sempre a UF e a Regional indicadas ao lado do nome da rede na busca.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cap15",
      num: 15,
      title: "Capítulo 15: Dicionário Geral de Botões e Interfaces",
      shortTitle: "15. Dicionário de Botões",
      category: "referencia",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Consulte a ação exata executada por cada botão disponível na plataforma Coffee++:
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase1_planejamento_real.png"
            alt="Localização dos Botões de Ação na Plataforma"
            title="Interface da Tabela com os Botões de Ação Principais"
            purpose="Mostra onde cada botão fica localizado na barra de ações da tabela corporativa."
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> + Lançar Novo
              </span>
              <p className="text-muted-foreground">Abre o formulário de cadastro individual de planejamento na Fase 1.</p>
            </div>
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Importar Planilha
              </span>
              <p className="text-muted-foreground">Permite carregar modelo Excel com múltiplos planejamentos de uma só vez.</p>
            </div>
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Promover
              </span>
              <p className="text-muted-foreground">Transforma a verba rascunho em investimento oficial ativo da empresa.</p>
            </div>
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Passar para o Trade
              </span>
              <p className="text-muted-foreground">Envia a ação da Fase 1 para a Fase 2 (auditoria do Trade Marketing).</p>
            </div>
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Validado pelo Trade
              </span>
              <p className="text-muted-foreground">Salva o checklist do Trade e autoriza a promoção a rodar nas lojas (Fase 3).</p>
            </div>
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Preencher Apuração
              </span>
              <p className="text-muted-foreground">Abre a gaveta da Fase 3 para digitar o sell-out real e escolher o boleto.</p>
            </div>
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Concluir Apuração
              </span>
              <p className="text-muted-foreground">Finaliza o dossiê na Fase 3 e dispara o e-mail automático ao Financeiro (Fase 4).</p>
            </div>
            <div className="p-3 bg-card border border-border rounded-xl space-y-1">
              <span className="font-mono text-gold font-bold bg-gold/10 px-2 py-0.5 rounded inline-flex items-center gap-1">
                <MousePointerClick className="w-3 h-3" /> Confirmar Pagamento
              </span>
              <p className="text-muted-foreground">Usado pelo Financeiro na Fase 5 para subir o comprovante e finalizar (Fase 6).</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cap16",
      num: 16,
      title: "Capítulo 16: Checklist Final do Gerente Comercial",
      shortTitle: "16. Checklist do Gerente",
      category: "operacao",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Antes de submeter a sua ação ou considerar a prestação de contas encerrada, utilize este checklist interativo de segurança:
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/fase3_apuracao_real.png"
            alt="Checklist de Conferência de Dossiê Comercial"
            title="Visualização da Tela de Conferência Pré-Submissão"
            purpose="Demonstra os campos de apuração que devem ser checados antes da finalização."
          />

          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-gold" /> Checklist de Verificação Pré-Submissão:
            </h4>

            <div className="space-y-2 text-xs">
              {[
                { id: "c1", label: "A Rede Comercial selecionada corresponde exatamente à unidade negociada (UF e Regional batem)." },
                { id: "c2", label: "O Tipo de Ação (Tabloide, Ponta de Gôndola, Degustação) reflete a mecânica negociada." },
                { id: "c3", label: "O Mês de Referência representa o período comercial exato da verba." },
                { id: "c4", label: "As datas de início e fim correspondem aos dias em que a oferta rodou nas lojas." },
                { id: "c5", label: "Os preços Flat e da Ação batem com a tabela promocional acordada." },
                { id: "c6", label: "O volume de vendas real (Sell-Out) foi conferido com o extrato fornecido pelo cliente." },
                { id: "c7", label: "O número do acordo comercial do cliente foi digitado sem erros de digitação." },
                { id: "c8", label: "O relatório oficial em PDF foi anexado na apuração." },
                { id: "c9", label: "As fotos das gôndolas e tabloides estão legíveis com preço visível." },
                { id: "c10", label: "O boleto pendente correto foi vinculado (ou marcado Sem Boleto com justificativa)." },
                { id: "c11", label: "A ação foi promovida da aba rascunho para investimento oficial." },
                { id: "c12", label: "O prazo de até 10 dias após o encerramento da promoção foi respeitado." },
                { id: "c13", label: "Você conferiu o recebimento do e-mail automático de confirmação do sistema." }
              ].map((item) => (
                <div 
                  key={item.id}
                  onClick={() => toggleChecklistItem(item.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                    checkedChecklistItems[item.id]
                      ? "bg-emerald-500/10 border-emerald-500/40 text-foreground"
                      : "bg-muted/30 border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <div className={`w-4 h-4 rounded mt-0.5 flex items-center justify-center shrink-0 border ${
                    checkedChecklistItems[item.id]
                      ? "bg-emerald-500 border-emerald-600 text-white"
                      : "border-muted-foreground/40 bg-card"
                  }`}>
                    {checkedChecklistItems[item.id] && <CheckCircle2 className="w-3.5 h-3.5" />}
                  </div>
                  <span className={checkedChecklistItems[item.id] ? "line-through opacity-80" : ""}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cap17",
      num: 17,
      title: "Capítulo 17: Glossário Comercial & Financeiro para Leigos",
      shortTitle: "17. Glossário para Leigos",
      category: "referencia",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Dicionário de termos em português simples para consultar a qualquer momento:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Sell-In</strong>
              <p className="text-muted-foreground">A venda da fábrica Coffee Mais para o supermercado (nossa venda direta).</p>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Sell-Out</strong>
              <p className="text-muted-foreground">A venda da prateleira do supermercado para o consumidor final (venda na ponta).</p>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Preço Flat</strong>
              <p className="text-muted-foreground">O preço normal de tabela do produto sem nenhum desconto promocional.</p>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Investimento Unitário</strong>
              <p className="text-muted-foreground">O valor em Reais que a Coffee Mais paga de subsídio por cada caixinha vendida.</p>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Tabloide / Encarte</strong>
              <p className="text-muted-foreground">O folheto promocional impresso ou digital do supermercado com as ofertas.</p>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Ponta de Gôndola</strong>
              <p className="text-muted-foreground">A estrutura nobre no início dos corredores do supermercado com grande visibilidade.</p>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Dossiê de Apuração</strong>
              <p className="text-muted-foreground">O conjunto de documentos (relatório de vendas + fotos + boleto) que comprova a ação.</p>
            </div>
            <div className="p-3.5 bg-card border border-border rounded-xl space-y-1">
              <strong className="text-gold font-bold block text-sm">Abatimento de Boleto</strong>
              <p className="text-muted-foreground">O desconto concedido diretamente em um boleto de cobrança a vencer do cliente.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "cap18",
      num: 18,
      title: "Capítulo 18: Fluxo Completo Visual & Resumo de Bolso",
      shortTitle: "18. Cola de Operação",
      category: "referencia",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Tenha a <strong>"Cola de Operação Rápida"</strong> sempre à mão para o seu dia a dia:
          </p>

          <ScreenshotCard 
            src="/images/guia-investimento/workflow_geral_white_1781486116926.png"
            alt="Resumo do Caminho das 6 Fases"
            title="Fluxo Visual Sintético de Prestação de Contas"
            purpose="Guia visual dos 4 passos rápidos de operação."
          />

          <div className="bg-card border-2 border-gold/40 rounded-2xl p-5 space-y-4 shadow-lg">
            <h4 className="font-bold text-sm text-gold uppercase tracking-wider flex items-center gap-2">
              <Award className="w-5 h-5" /> Guia Rápido de Bolso (Resumão de 4 Passos)
            </h4>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <strong className="text-foreground font-bold block">STEP 1: LANÇAR & PROMOVER (Início do Mês)</strong>
                <p className="text-muted-foreground">Acesse Investimento → Lançar Novo → Digite a ação → Vá em Planejamento → Clique em Promover → Clique em Passar para o Trade.</p>
              </div>

              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <strong className="text-foreground font-bold block">STEP 2: ACOMPANHAR A EXECUÇÃO (Durante a Promoção)</strong>
                <p className="text-muted-foreground">Trade valida estoque na Fase 2. Promotores organizam a gôndola e tiram fotos com preços legíveis.</p>
              </div>

              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <strong className="text-foreground font-bold block">STEP 3: APURAR & VINCULAR BOLETO (Até 10 dias após o fim)</strong>
                <p className="text-muted-foreground">Acesse Fase 3: Apuração → Digite o sell-out real → Anexe PDF e fotos → Escolha o boleto do cliente → Clique em Concluir Apuração.</p>
              </div>

              <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-1">
                <strong className="text-foreground font-bold block">STEP 4: ACOMPANHAR QUITAÇÃO (Pós-Aprovação)</strong>
                <p className="text-muted-foreground">Trade audita na Fase 4. Financeiro quita na Fase 5. Ação encerra com selo verde na Fase 6 (Concluído ✅).</p>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentChapter = chapters[currentChapterIndex];
  const progressPercent = Math.round(((currentChapterIndex + 1) / chapters.length) * 100);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-6">
      
      {/* ─── MODAL LIGHTBOX PARA AMPLIAR SCREENSHOTS ───────────────────── */}
      {lightboxImage && (
        <div 
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-6xl w-full bg-card border border-border rounded-3xl p-4 md:p-6 shadow-2xl overflow-hidden flex flex-col space-y-4 max-h-[90vh]"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-5 h-5 text-gold" />
                <h3 className="font-bold text-sm md:text-base text-foreground">
                  {lightboxImage.title || lightboxImage.alt}
                </h3>
              </div>
              <button 
                onClick={() => setLightboxImage(null)}
                className="p-2 rounded-xl bg-muted hover:bg-border text-muted-foreground hover:text-foreground transition-colors"
                title="Fechar (ESC)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-auto flex-1 rounded-2xl bg-black/40 p-2 border border-border/50 flex items-center justify-center">
              <img 
                src={lightboxImage.src} 
                alt={lightboxImage.alt} 
                className="max-w-full h-auto object-contain rounded-lg max-h-[75vh]"
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
              <span>Imagem Oficial do Sistema Coffee++</span>
              <span>Clique fora ou pressione ESC para fechar</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── CABEÇALHO SUPERIOR DA PÁGINA ────────────────────────────────── */}
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between border-b border-border pb-4 gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/investimento" 
            className="p-2.5 rounded-2xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all shadow-sm"
            title="Voltar ao Módulo de Investimentos"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xxs font-black bg-gold/15 text-gold px-2 py-0.5 rounded-md uppercase tracking-widest border border-gold/30">
                RELEASE X.2 OFICIAL
              </span>
              <span className="text-xxs font-mono text-muted-foreground">Curso Operacional Completo</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-2 mt-1">
              <BookOpen className="w-7 h-7 text-gold" /> Manual Operacional de Investimentos
            </h1>
          </div>
        </div>

        {/* Botões de Exportação PDF */}
        <div className="flex flex-wrap items-center gap-2">
          <ExportPdfButton
            docPath="docs/manuais/manual_operacional_gerente_regional_investimentos.md"
            title="Manual Operacional de Investimentos"
            subtitle="Guia Didático do Usuário — Release X.2"
            module="Investimentos"
            label="📘 Manual (PDF)"
            variant="gold"
          />
          <ExportPdfButton
            docPath="docs/processos/modulo_investimentos_especificacao_funcional.md"
            title="Especificação Funcional Oficial"
            subtitle="Módulo de Investimentos — Documento Canônico"
            module="Investimentos"
            label="📄 Espec. Funcional (PDF)"
            variant="secondary"
          />
          <ThemeToggle />
        </div>
      </div>

      {/* ─── BARRA DE PROGRESSO DO CURSO ────────────────────────────────── */}
      <div className="max-w-7xl mx-auto bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-foreground flex items-center gap-2">
            <Award className="w-4 h-4 text-gold" /> Progresso de Leitura do Curso
          </span>
          <span className="font-mono text-gold font-bold">{progressPercent}% Concluído ({currentChapterIndex + 1} de {chapters.length} Capítulos)</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden border border-border/50">
          <div 
            className="bg-gradient-to-r from-gold/80 to-gold h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ─── CORPO PRINCIPAL: SIDEBAR + CONTEÚDO ────────────────────────── */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR NAVEGÁVEL DOS 18 CAPÍTULOS */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card border border-border rounded-3xl p-4 space-y-2 shadow-sm sticky top-6">
            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-3 my-2 flex items-center justify-between">
              <span>Índice do Curso</span>
              <span className="text-xxs font-mono">18 Aulas</span>
            </h3>

            <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1">
              {chapters.map((chap, idx) => {
                const isActive = currentChapterIndex === idx;
                return (
                  <button
                    key={chap.id}
                    onClick={() => handleChapterChange(idx)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-between gap-2 ${
                      isActive 
                        ? "bg-gold/15 text-gold border-l-4 border-gold pl-2.5 shadow-sm" 
                        : "hover:bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <span className={`w-5 h-5 rounded-full text-xxs flex items-center justify-center shrink-0 font-mono ${
                        isActive ? "bg-gold text-black font-bold" : "bg-muted text-muted-foreground"
                      }`}>
                        {chap.num}
                      </span>
                      <span className="truncate">{chap.shortTitle}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${isActive ? "text-gold rotate-90" : "opacity-40"}`} />
                  </button>
                );
              })}
            </div>

            <div className="pt-3 border-t border-border mt-3 space-y-2">
              <h4 className="text-xs font-bold text-foreground flex items-center gap-2 px-1">
                <HelpCircle className="w-4 h-4 text-gold" /> Dúvidas ou Suporte?
              </h4>
              <p className="text-xxs text-muted-foreground leading-relaxed px-1">
                Ficou com alguma dúvida sobre conciliação bancária ou boletos rejeitados? Fale com o suporte.
              </p>
              <a 
                href="mailto:suporte@coffeemais.com" 
                className="block text-center w-full bg-muted border border-border text-foreground hover:bg-border text-xs font-bold py-2 rounded-xl transition-all"
              >
                suporte@coffeemais.com
              </a>
            </div>
          </div>
        </div>

        {/* ÁREA DE EXIBIÇÃO DO CAPÍTULO ATUAL */}
        <div className="lg:col-span-8">
          <div className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-xl space-y-8 animate-in fade-in duration-300">
            
            {/* Cabeçalho do Capítulo */}
            <div className="space-y-3 border-b border-border pb-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-gold uppercase tracking-widest">
                  Capítulo {currentChapter.num} de {chapters.length}
                </span>
                {currentChapter.responsible && (
                  <span className="text-xxs font-semibold bg-muted text-foreground px-2.5 py-1 rounded-full border border-border flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-gold" /> Responsável: {currentChapter.responsible}
                  </span>
                )}
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-foreground tracking-tight">
                {currentChapter.title}
              </h2>
            </div>

            {/* Conteúdo Didático do Capítulo */}
            <div className="pt-2">
              {currentChapter.content}
            </div>

            {/* Navegação entre Capítulos (Anterior / Próximo) */}
            <div className="flex items-center justify-between border-t border-border pt-6 gap-4">
              <button
                disabled={currentChapterIndex === 0}
                onClick={() => handleChapterChange(currentChapterIndex - 1)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-muted border border-border hover:bg-border text-foreground transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" /> Capítulo Anterior
              </button>

              <span className="text-xxs font-mono text-muted-foreground hidden sm:inline-block">
                Página {currentChapterIndex + 1} de {chapters.length}
              </span>

              <button
                disabled={currentChapterIndex === chapters.length - 1}
                onClick={() => handleChapterChange(currentChapterIndex + 1)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-gold text-black hover:bg-gold/90 transition-all flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
              >
                Próximo Capítulo <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}
