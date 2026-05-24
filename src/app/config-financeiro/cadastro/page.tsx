"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Save, FileText, Banknote, MapPin, Building, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ClienteCadastroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingCnpj, setFetchingCnpj] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    cnpj: "",
    matriz: "",
    tipo_parceiro: "",
    nome_parceiro: "",
    razao_social: "",
    inscricao_estadual: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    cidade: "",
    condicao_pagamento: "",
    classificacao_icms: "",
    retirar_st: "",
    empresa_preferencial: "",
    tipo_geracao_boleto: "",
    enviar_danfe: "Nao",
    email_nfe: "",
    banco: "",
    agencia: "",
    conta: "",
    desconto_contratual: "",
    data_vigor: "",
    receber_pdf_vendas: false,
    receber_pdf_investimento: false,
  });
  const [tipoCadastro, setTipoCadastro] = useState("novo");
  const [anexoTabela, setAnexoTabela] = useState<File | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: checked }));
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (value.length > 14) value = value.slice(0, 14);
    
    // Mask: 00.000.000/0000-00
    if (value.length > 12) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, "$1.$2.$3/$4-$5");
    } else if (value.length > 8) {
      value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{1,4}).*/, "$1.$2.$3/$4");
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{3})(\d{1,3}).*/, "$1.$2.$3");
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{1,3}).*/, "$1.$2");
    }

    setFormData((prev) => ({ ...prev, cnpj: value }));
  };

  const buscarCnpj = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, "");
    if (cleanCnpj.length !== 14) {
      toast.error("CNPJ inválido. Digite 14 números.");
      return;
    }

    setFetchingCnpj(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (!response.ok) throw new Error("CNPJ não encontrado");
      
      const data = await response.json();
      
      setFormData((prev) => ({
        ...prev,
        razao_social: data.razao_social || "",
        nome_parceiro: data.nome_fantasia || data.razao_social || "",
        cep: data.cep || "",
        endereco: data.logradouro ? `${data.descricao_tipo_de_logradouro} ${data.logradouro}` : "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        cidade: data.municipio ? `${data.municipio} - ${data.uf}` : "",
      }));

      toast.success("Dados do CNPJ importados com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível buscar os dados desse CNPJ.");
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // TODO: Implement server action call here
    setTimeout(() => {
      toast.success("Cliente salvo com sucesso!");
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-foreground-secondary hover:text-foreground transition-colors font-medium text-sm w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </button>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Building className="text-accent-gold" /> 
              Cadastro de Cliente
            </h1>
            <p className="text-foreground-secondary mt-1">
              Preencha os dados do cliente e utilize a busca por CNPJ para agilizar.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-background-card border border-border px-4 py-2 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
              <input 
                type="radio" 
                name="tipoCadastro" 
                value="novo" 
                checked={tipoCadastro === "novo"} 
                onChange={(e) => setTipoCadastro(e.target.value)}
                className="accent-[var(--accent-gold)]"
              /> 
              Novo Cadastro
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
              <input 
                type="radio" 
                name="tipoCadastro" 
                value="atualizacao" 
                checked={tipoCadastro === "atualizacao"} 
                onChange={(e) => setTipoCadastro(e.target.value)}
                className="accent-[var(--accent-gold)]"
              /> 
              Atualização
            </label>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identificação Section */}
          <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-lg">
            <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-gold" />
              <h2 className="font-semibold text-base">Identificação</h2>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Row 1: CNPJ Search */}
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    CNPJ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="cnpj"
                    value={formData.cnpj}
                    onChange={handleCnpjChange}
                    required
                    placeholder="00.000.000/0000-00"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors"
                  />
                </div>
                <button
                  type="button"
                  onClick={buscarCnpj}
                  disabled={fetchingCnpj}
                  style={{
                    height: "40px",
                    padding: "0 16px",
                    background: "rgba(200, 169, 110, 0.1)",
                    color: "var(--accent-gold)",
                    border: "1px solid rgba(200, 169, 110, 0.3)",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    cursor: fetchingCnpj ? "not-allowed" : "pointer",
                  }}
                  className="transition-all hover:bg-[rgba(200,169,110,0.2)]"
                >
                  {fetchingCnpj ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Buscar Dados
                </button>
              </div>

              {/* Row 2: Matriz and Tipo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Matriz
                  </label>
                  <input
                    type="text"
                    name="matriz"
                    value={formData.matriz}
                    onChange={handleInputChange}
                    placeholder="Ex: VERDEMAR"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Tipo do Parceiro
                  </label>
                  <input
                    type="text"
                    name="tipo_parceiro"
                    value={formData.tipo_parceiro}
                    onChange={handleInputChange}
                    placeholder="Ex: Supermercado, Atacado..."
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 3: Names */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Nome do Parceiro (Fantasia)
                  </label>
                  <input
                    type="text"
                    name="nome_parceiro"
                    value={formData.nome_parceiro}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Razão Social
                  </label>
                  <input
                    type="text"
                    name="razao_social"
                    value={formData.razao_social}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 4: IE and CEP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Insc. Estadual / Identidade
                  </label>
                  <input
                    type="text"
                    name="inscricao_estadual"
                    value={formData.inscricao_estadual}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    CEP
                  </label>
                  <input
                    type="text"
                    name="cep"
                    value={formData.cep}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 5: Endereço, Num, Comp */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6 space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Endereço
                  </label>
                  <input
                    type="text"
                    name="endereco"
                    value={formData.endereco}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
                <div className="md:col-span-2 space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Número
                  </label>
                  <input
                    type="text"
                    name="numero"
                    value={formData.numero}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
                <div className="md:col-span-4 space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Complemento
                  </label>
                  <input
                    type="text"
                    name="complemento"
                    value={formData.complemento}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>

              {/* Row 6: Cidade */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  Cidade / UF
                </label>
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-dim" />
                  <input
                    type="text"
                    name="cidade"
                    value={formData.cidade}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Tipo Negociação & Fiscal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
                <Banknote className="w-5 h-5 text-accent-gold" />
                <h2 className="font-semibold text-base">Tipo Negociação</h2>
              </div>
              <div className="p-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Sugestão de Venda (Condição Pgto)
                  </label>
                  <input
                    type="text"
                    name="condicao_pagamento"
                    value={formData.condicao_pagamento}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-gold" />
                <h2 className="font-semibold text-base">Fiscal</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider flex items-center gap-2">
                    Classificação ICMS
                    <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">FINANCEIRO</span>
                  </label>
                  <select
                    name="classificacao_icms"
                    value={formData.classificacao_icms}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  >
                    <option value="">Selecione...</option>
                    <option value="Consumidor Final Contribuinte">Consumidor Final Contribuinte</option>
                    <option value="Revendedor">Revendedor</option>
                    <option value="Produtor Rural">Produtor Rural</option>
                    <option value="Isento de ICMS">Isento de ICMS</option>
                    <option value="Consumidor Final Não Contribuinte">Consumidor Final Não Contribuinte</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider flex items-center gap-2">
                    Retirar ST do preço de venda?
                    <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">FINANCEIRO</span>
                  </label>
                  <select
                    name="retirar_st"
                    value={formData.retirar_st}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  >
                    <option value="">Selecione...</option>
                    <option value="Sim">Sim</option>
                    <option value="Não">Não</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Informações & NF-e */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
                <Building className="w-5 h-5 text-accent-gold" />
                <h2 className="font-semibold text-base">Informações</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider flex items-center gap-2">
                    Empresa Preferencial
                    <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">FINANCEIRO</span>
                  </label>
                  <input
                    type="text"
                    name="empresa_preferencial"
                    value={formData.empresa_preferencial}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider flex items-center gap-2">
                    Tipo Geração Boleto
                    <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full font-bold">FINANCEIRO</span>
                  </label>
                  <input
                    type="text"
                    name="tipo_geracao_boleto"
                    value={formData.tipo_geracao_boleto}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
                <FileText className="w-5 h-5 text-accent-gold" />
                <h2 className="font-semibold text-base">NF-e</h2>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Enviar DANFE por e-mail?
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input type="radio" name="enviar_danfe" value="Sim" checked={formData.enviar_danfe === "Sim"} onChange={handleInputChange} /> Sim
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="enviar_danfe" value="Nao" checked={formData.enviar_danfe === "Nao"} onChange={handleInputChange} /> Não
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    E-mail para envio
                  </label>
                  <input
                    type="email"
                    name="email_nfe"
                    value={formData.email_nfe}
                    onChange={handleInputChange}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Relatórios Automáticos */}
          <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
              <Mail className="w-5 h-5 text-accent-gold" />
              <h2 className="font-semibold text-base">Relatórios Automáticos (PDF)</h2>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:border-accent-gold/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  name="receber_pdf_vendas"
                  checked={formData.receber_pdf_vendas}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-accent-gold border-border rounded focus:ring-accent-gold/20"
                />
                <span className="text-sm font-medium text-foreground">
                  Receber PDF: <span className="font-semibold">Venda do dia anterior</span>
                </span>
              </label>

              <label className="flex items-center gap-3 p-3 border border-border rounded-lg hover:border-accent-gold/30 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  name="receber_pdf_investimento"
                  checked={formData.receber_pdf_investimento}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-accent-gold border-border rounded focus:ring-accent-gold/20"
                />
                <span className="text-sm font-medium text-foreground">
                  Receber PDF: <span className="font-semibold">Investimento</span>
                </span>
              </label>
            </div>
          </div>

          {/* Dados Bancários */}
          <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
              <Banknote className="w-5 h-5 text-accent-gold" />
              <h2 className="font-semibold text-base">Dados Bancários</h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  Banco
                </label>
                <input
                  type="text"
                  name="banco"
                  value={formData.banco}
                  onChange={handleInputChange}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  Agência
                </label>
                <input
                  type="text"
                  name="agencia"
                  value={formData.agencia}
                  onChange={handleInputChange}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  Conta
                </label>
                <input
                  type="text"
                  name="conta"
                  value={formData.conta}
                  onChange={handleInputChange}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Desconto & Anexos */}
          <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-sm">
            <div className="bg-background-elevated px-6 py-4 border-b border-border flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-gold" />
              <h2 className="font-semibold text-lg">Descontos e Histórico</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  Desconto Contratual (%)
                </label>
                <input
                  type="text"
                  name="desconto_contratual"
                  value={formData.desconto_contratual}
                  onChange={handleInputChange}
                  placeholder="Ex: 5%"
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  Tabela de Preço (Anexo)
                </label>
                <input
                  type="file"
                  onChange={(e) => setAnexoTabela(e.target.files?.[0] || null)}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  Data Vigor
                </label>
                <input
                  type="date"
                  name="data_vigor"
                  value={formData.data_vigor}
                  onChange={handleInputChange}
                  className="w-full bg-background border border-border rounded-lg px-4 py-3 focus:outline-none focus:border-[var(--accent-gold)] transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button
              type="button"
              className="px-6 py-3 rounded-lg text-foreground-secondary hover:bg-foreground/5 font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "10px 24px",
                background: "var(--accent-gold)",
                color: "#fff",
                borderRadius: "6px",
                fontWeight: "bold",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                boxShadow: "0 4px 14px rgba(200, 169, 110, 0.4)",
                opacity: loading ? 0.5 : 1,
                cursor: loading ? "not-allowed" : "pointer"
              }}
              className="transition-colors hover:brightness-110"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Cliente
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
