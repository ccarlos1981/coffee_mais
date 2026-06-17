"use client";

import { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  BookOpen, 
  CheckCircle2, 
  HelpCircle, 
  ChevronRight, 
  Info, 
  AlertTriangle,
  Mail,
  FileText,
  MousePointerClick
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

interface StepConfig {
  id: string;
  title: string;
  phase: string;
  responsible: string;
  image: string;
  content: React.ReactNode;
}

export default function AjudaInvestimentoPage() {
  const [activeTab, setActiveTab] = useState("geral");

  const steps: StepConfig[] = [
    {
      id: "fase1",
      title: "Fase 1: Planejamento",
      phase: "Fase 1",
      responsible: "Gerente Regional",
      image: "",
      content: (
        <div className="space-y-6">
          <p className="text-base text-muted-foreground leading-relaxed">
            Nesta etapa, o <strong>Gerente Regional</strong> rascunha as ações comerciais futuras para suas redes. O objetivo é reservar orçamento e prever os volumes esperados de vendas.
          </p>

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-3">
            <Info className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold block">Como funciona a promoção?</span>
              Enquanto a ação está em elaboração, ela reside apenas na tela de Planejamento. Ao clicar em <strong>Promover</strong>, ela se torna oficialmente um investimento e segue para a Fase 1 da esteira de auditoria.
            </div>
          </div>

          {/* Sub-etapa A: Cadastro */}
          <div className="space-y-3">
            <h3 className="text-md font-bold text-foreground flex items-center gap-2">
              <span className="bg-gold/25 text-gold w-6 h-6 rounded-full flex items-center justify-center text-xs">A</span>
              Formulário de Cadastro Comercial (Lançamento)
            </h3>
            <p className="text-sm text-muted-foreground">
              Acesse <span className="font-semibold text-foreground">Lançar</span> e preencha a Rede, o tipo de ação (Sell Out/Sell In), o tipo de pagamento (Abatimento, Transferência ou Bonificação), período e datas.
            </p>
            <div className="bg-white p-3 rounded-2xl border border-border shadow-inner">
              <img 
                src="/images/guia-investimento/fase1_lancar_real.png" 
                alt="Formulário de Lançamento de Investimento - Topo" 
                className="w-full h-auto rounded-lg border border-gray-100"
              />
            </div>
          </div>

          {/* Sub-etapa B: Parâmetros */}
          <div className="space-y-3">
            <h3 className="text-md font-bold text-foreground flex items-center gap-2">
              <span className="bg-gold/25 text-gold w-6 h-6 rounded-full flex items-center justify-center text-xs">B</span>
              Definição de Margens, Família e Cálculo Automático
            </h3>
            <p className="text-sm text-muted-foreground">
              Escolha a abrangência (Família ou SKU). No caso de Família, defina a categoria do café (ex: <strong>Moído</strong>, <strong>Grão</strong>, <strong>Capsula</strong>, <strong>Drip</strong> ou <strong>KG</strong>). Preencha o preço normal (Flat), o preço da ação, o investimento unitário e o volume planejado. O sistema calculará o total estimado automaticamente.
            </p>
            <div className="bg-white p-3 rounded-2xl border border-border shadow-inner">
              <img 
                src="/images/guia-investimento/fase1_lancar_real_bottom.png" 
                alt="Formulário de Lançamento de Investimento - Cálculos" 
                className="w-full h-auto rounded-lg border border-gray-100"
              />
            </div>
          </div>

          {/* Sub-etapa C: Lista e Promoção */}
          <div className="space-y-3">
            <h3 className="text-md font-bold text-foreground flex items-center gap-2">
              <span className="bg-gold/25 text-gold w-6 h-6 rounded-full flex items-center justify-center text-xs">C</span>
              Visualização e Ativação do Planejamento
            </h3>
            <p className="text-sm text-muted-foreground">
              Na aba de planejamento, a verba fica listada como rascunho. Para ativá-la no fluxo e enviá-la para validação do Trade Marketing, clique em <span className="font-semibold text-foreground">Promover</span> na linha correspondente da tabela.
            </p>
            <div className="bg-white p-3 rounded-2xl border border-border shadow-inner">
              <img 
                src="/images/guia-investimento/fase1_planejamento_real.png" 
                alt="Lista de Planejamento de Investimentos" 
                className="w-full h-auto rounded-lg border border-gray-100"
              />
            </div>
          </div>
        </div>
      )
    },
    {
      id: "fase2",
      title: "Fase 2: Validação Trade",
      phase: "Fase 2",
      responsible: "Trade Marketing",
      image: "/images/guia-investimento/fase2_checklist_real.png",
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground leading-relaxed">
            A equipe de <strong>Trade Marketing</strong> realiza a auditoria de viabilidade da campanha antes de ela ir a público. É uma barreira de segurança para assegurar que a execução será perfeita.
          </p>
          <div className="space-y-2">
            <h4 className="font-bold text-foreground">O Checklist dos 4 Pilares:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                <span><strong>1) Comunicação</strong>: Envio do calendário para a equipe de campo e agências.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                <span><strong>2) Logística</strong>: Verificação de estoque para garantir ruptura zero durante a ação.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                <span><strong>3) Auditoria</strong>: Promotores confirmam a implementação (fotos e preços na gôndola).</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
                <span><strong>4) Garantia</strong>: Validação de que o que foi planejado está sendo executado.</span>
              </li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "fase3",
      title: "Fase 3: Apuração & Boleto",
      phase: "Fase 3",
      responsible: "Gerente Regional",
      image: "/images/guia-investimento/fase3_apuracao_real.png",
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground leading-relaxed">
            Após a promoção terminar, o <strong>Gerente Regional</strong> deve apurar os dados reais de sell-out nos portais do cliente, anexar as fotos de gôndola e vincular o boleto bancário de cobrança enviado pela rede.
          </p>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-sm text-purple-700 dark:text-purple-400 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold block">Vinculação Obrigatória do Boleto</span>
              Para que o financeiro saiba qual boleto pagar, você deve selecionar o boleto pendente daquela rede diretamente no campo de busca do formulário de apuração.
            </div>
          </div>
          <div className="space-y-2">
            <h4 className="font-bold text-foreground">Passo a Passo:</h4>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>Selecione o investimento na Fase 3 e clique em <span className="font-semibold text-foreground">Preencher Apuração</span>.</li>
              <li>Insira o número de acordo da rede e a quantidade real vendida.</li>
              <li>Adicione fotos dos expositores e relatórios clicando em <span className="font-semibold text-foreground">Selecionar arquivo (PDF ou Imagem)...</span>.</li>
              <li>Selecione o boleto bancário aberto correspondente no dropdown de busca.</li>
              <li>Clique em <span className="font-semibold text-foreground">Concluir Apuração</span>.</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: "email",
      title: "✉️ Notificação de E-mail",
      phase: "E-mail Automático",
      responsible: "Sistema",
      image: "/images/guia-investimento/email_notificacao_financeiro_white_1781486346210.png",
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground leading-relaxed">
            Assim que a apuração é finalizada, o sistema envia de forma automática e imediata um e-mail de alerta contendo todos os detalhes operacionais e links das evidências.
          </p>
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-400 flex items-start gap-3">
            <Mail className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <span className="font-bold block">Envio Automático!</span>
              Os gerentes comerciais não precisam encaminhar e-mails manuais ao Financeiro. O e-mail automático é enviado para <span className="underline">financeiro@coffeemais.com</span>, lideranças de Trade e gerência.
            </div>
          </div>
        </div>
      )
    },
    {
      id: "fase4",
      title: "Fase 4: Auditoria Trade",
      phase: "Fase 4",
      responsible: "Trade Marketing",
      image: "/images/guia-investimento/fase4_conferencia_white_1781486234948.png",
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground leading-relaxed">
            O Trade analisa o dossiê enviado pelo comercial. Se as evidências fotográficas e relatórios de sell-out baterem com os números cadastrados, a ação segue para o Financeiro.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-emerald-500/25 bg-emerald-500/5 p-4 rounded-xl">
              <span className="font-bold text-emerald-500 block">Opção: Aprovar</span>
              <p className="text-xs text-muted-foreground mt-1">
                Ação comercial avança para a Fase 5 (Financeiro) para quitação.
              </p>
            </div>
            <div className="border border-red-500/25 bg-red-500/5 p-4 rounded-xl">
              <span className="font-bold text-red-500 block">Opção: Reprovar</span>
              <p className="text-xs text-muted-foreground mt-1">
                O investimento retorna para a Fase 3 e o gerente regional deve refazer a apuração comercial.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "fase5",
      title: "Fase 5: Pagamento",
      phase: "Fase 5",
      responsible: "Financeiro",
      image: "/images/guia-investimento/fase5_financeiro_white_1781486271243.png",
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground leading-relaxed">
            A equipe <strong>Financeira</strong> executa a transferência bancária ou abate o valor do boleto vinculado no ERP da Coffee Mais. Em seguida, anexa o comprovante.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <h4 className="font-bold text-foreground">Passos do Financeiro:</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>Valida o valor do boleto associado e as evidências de auditoria.</li>
              <li>Realiza o pagamento no internet banking.</li>
              <li>Sobe o comprovante em PDF e adiciona notas de quitação.</li>
              <li>Clica em <strong>Confirmar Pagamento</strong>.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "fase6",
      title: "Fase 6: Concluído",
      phase: "Fase 6",
      responsible: "Sistema",
      image: "/images/guia-investimento/fase6_concluido_white_1781486308877.png",
      content: (
        <div className="space-y-4">
          <p className="text-base text-muted-foreground leading-relaxed">
            O investimento comercial é finalizado e recebe um selo verde de concluído (✅).
          </p>
          <p className="text-sm text-muted-foreground">
            A partir deste momento, as informações ficam protegidas contra alteração e uma linha do tempo detalhada mostra quem preencheu, quem validou e quem pagou com seus respectivos horários, fornecendo um log de auditoria permanente.
          </p>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-8 space-y-6">
      
      {/* Header */}
      <div className="max-w-6xl mx-auto flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/investimento" 
            className="p-2 rounded-xl bg-card border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-gold" /> Guia de Investimentos
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Passo a passo interativo das fases e controles de investimentos comerciais
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-4 space-y-3">
          <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 mb-2">
              Etapas e Fluxo
            </h3>
            
            <button
              onClick={() => setActiveTab("geral")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === "geral" 
                  ? "bg-gold/15 text-gold border-l-4 border-gold pl-2.5" 
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <span>📊 Visão Geral do Fluxo</span>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>

            {steps.map((step) => (
              <button
                key={step.id}
                onClick={() => setActiveTab(step.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-between ${
                  activeTab === step.id 
                    ? "bg-gold/15 text-gold border-l-4 border-gold pl-2.5" 
                    : "hover:bg-muted text-muted-foreground"
                }`}
              >
                <div className="flex flex-col">
                  <span>{step.title}</span>
                  <span className="text-xxs opacity-70 font-normal mt-0.5">Resp: {step.responsible}</span>
                </div>
                <ChevronRight className="w-4 h-4 opacity-50" />
              </button>
            ))}

            <button
              onClick={() => setActiveTab("botoes")}
              className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-between ${
                activeTab === "botoes" 
                  ? "bg-gold/15 text-gold border-l-4 border-gold pl-2.5" 
                  : "hover:bg-muted text-muted-foreground"
              }`}
            >
              <span>📖 Manual de Botões</span>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>
          </div>
          
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-gold" /> Suporte Interno
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Ficou com alguma dúvida sobre conciliação bancária ou boletos rejeitados? Entre em contato pelo e-mail do suporte administrativo.
            </p>
            <a 
              href="mailto:suporte@coffeemais.com" 
              className="block text-center w-full bg-muted border border-border text-foreground hover:bg-border text-xs font-bold py-2 rounded-xl transition-all"
            >
              Falar com Suporte
            </a>
          </div>
        </div>

        {/* Details Display Panel */}
        <div className="lg:col-span-8">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-xl space-y-6">
            
            {activeTab === "geral" && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-border pb-4">
                  <span className="text-xs font-black text-gold uppercase tracking-widest">Coffee Mais</span>
                  <h2 className="text-2xl font-black text-foreground">Fluxograma do Ciclo de Investimento</h2>
                  <p className="text-sm text-muted-foreground">
                    Toda verba promocional segue 6 fases obrigatórias de prestação de contas.
                  </p>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-border shadow-inner">
                  <img 
                    src="/images/guia-investimento/workflow_geral_white_1781486116926.png" 
                    alt="Fluxograma Geral do Processo" 
                    className="w-full h-auto rounded-lg"
                  />
                </div>
                <div className="bg-muted p-5 rounded-2xl space-y-2">
                  <h4 className="font-bold text-sm text-foreground">Estrutura de Rastreabilidade Comercial:</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    O ciclo garante que nenhuma verba comercial seja quitada pelo Financeiro sem que tenha sido planejada regionalmente, validada estrategicamente pelo Trade Marketing, auditada fisicamente pelo volume real de sell-out e aprovada por um analista independente.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "botoes" && (
              <div className="space-y-6">
                <div className="space-y-2 border-b border-border pb-4">
                  <span className="text-xs font-black text-gold uppercase tracking-widest">Glossário Técnico</span>
                  <h2 className="text-2xl font-black text-foreground">Dicionário Geral de Botões</h2>
                  <p className="text-sm text-muted-foreground">
                    Entenda a ação executada por cada botão disponível na plataforma.
                  </p>
                </div>
                
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  
                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> + Lançar Novo
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Abre o formulário de cadastro individual de planejamento na Fase 1.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Importar Planilha
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Permite arrastar e carregar o modelo de planilha excel com múltiplos planejamentos de uma única vez.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Promover (ou Promover Selecionadas)
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Transforma a ação planejada em Investimento Oficial ativo. A verba sai do modo rascunho.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Passar para o Trade
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Envia o investimento da Fase 1 para a Fase 2 (auditoria e checklist de viabilidade técnica pelo Trade Marketing).
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Validado pelo Trade
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Salva o checklist dos 4 pilares do Trade na Fase 2 e empurra a ação comercial para execução e apuração no PDV (Fase 3).
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Preencher Apuração
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Abre a gaveta ou formulário de apuração comercial na Fase 3 para informar os dados de sell-out e associar o boleto.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Concluir Apuração
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Finaliza o envio dos volumes reais, anexa o comprovante de evidência, vincula o boleto e dispara o e-mail automático ao Financeiro (Fase 4).
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Aprovar / Devolver
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Disponíveis na Fase 4 (Conferência). Aprovar envia para pagamento (Fase 5). Devolver retorna a ação para a Fase 3 com observações para ajuste do gerente.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 border border-border rounded-xl space-y-1">
                    <span className="font-mono text-xs text-gold font-bold bg-gold/10 px-2 py-0.5 rounded flex items-center gap-1.5 w-fit">
                      <MousePointerClick className="w-3 h-3" /> Confirmar Pagamento
                    </span>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Usado pelo Financeiro na Fase 5 para subir o comprovante bancário e finalizar o ciclo (Fase 6).
                    </p>
                  </div>

                </div>
              </div>
            )}

            {steps.map((step) => {
              if (activeTab !== step.id) return null;
              return (
                <div key={step.id} className="space-y-6 animate-in fade-in duration-300">
                  <div className="space-y-2 border-b border-border pb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <span className="text-xs font-black text-gold uppercase tracking-widest block">
                        {step.phase} • Responsável: {step.responsible}
                      </span>
                      <h2 className="text-2xl font-black text-foreground">{step.title}</h2>
                    </div>
                  </div>
                  
                  {step.image && (
                    <div className="bg-white p-3 rounded-2xl border border-border shadow-inner">
                      <img 
                        src={step.image} 
                        alt={step.title} 
                        className="w-full h-auto rounded-lg"
                      />
                    </div>
                  )}

                  <div className="pt-2">
                    {step.content}
                  </div>
                </div>
              );
            })}

          </div>
        </div>

      </div>

    </div>
  );
}
