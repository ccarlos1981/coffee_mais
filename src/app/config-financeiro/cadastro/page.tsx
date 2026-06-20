"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Save, FileText, Banknote, MapPin, Building, ArrowLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { notificarFinanceiroNovoCliente, notificarTransicaoFase } from "../clientes/actions";

export default function ClienteCadastroPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);

  // States for search by client code
  const [codigoBusca, setCodigoBusca] = useState("");
  const [searchingCodigo, setSearchingCodigo] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    cnpj: "",
    matriz: "",
    codigo_matriz: "",
    responsavel: "",
    tipo_parceiro: "",
    nome_parceiro: "",
    razao_social: "",
    inscricao_estadual: "",
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    cidade: "",
    uf: "",
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
    status: "ativo",
    fase: "comercial",
  });
  const [tipoCadastro, setTipoCadastro] = useState("novo");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleTipoCadastroChange = (tipo: string) => {
    setTipoCadastro(tipo);
    setSelectedClientId(null);
    setCodigoBusca("");
    setFormData({
      cnpj: "",
      matriz: "",
      codigo_matriz: "",
      responsavel: "",
      tipo_parceiro: "",
      nome_parceiro: "",
      razao_social: "",
      inscricao_estadual: "",
      cep: "",
      endereco: "",
      numero: "",
      complemento: "",
      cidade: "",
      uf: "",
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
      status: "ativo",
      fase: "comercial",
    });
  };

  const buscarPorCodigo = async () => {
    if (!codigoBusca.trim()) {
      toast.error("Por favor, digite o código do cliente.");
      return;
    }
    await buscarPorCodigoDirect(codigoBusca);
  };

  const buscarPorCodigoDirect = async (code: string) => {
    setSearchingCodigo(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("cm_clientes")
        .select("*")
        .eq("codigo", parseInt(code))
        .single();

      if (error || !data) {
        throw new Error("Cliente não encontrado com este código.");
      }

      setFormData({
        cnpj: data.cnpj || "",
        matriz: data.matriz || "",
        codigo_matriz: data.codigo_matriz || "",
        responsavel: data.responsavel || "",
        tipo_parceiro: data.tipo_parceiro || "",
        nome_parceiro: data.nome_parceiro || "",
        razao_social: data.razao_social || "",
        inscricao_estadual: data.inscricao_estadual || "",
        cep: data.cep || "",
        endereco: data.endereco || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        cidade: data.cidade || "",
        uf: data.uf || "",
        condicao_pagamento: data.condicao_pagamento || "",
        classificacao_icms: data.classificacao_icms || "",
        retirar_st: data.retirar_st || "",
        empresa_preferencial: data.empresa_preferencial || "",
        tipo_geracao_boleto: data.tipo_geracao_boleto || "",
        enviar_danfe: data.enviar_danfe || "Nao",
        email_nfe: data.email_nfe || "",
        banco: data.banco || "",
        agencia: data.agencia || "",
        conta: data.conta || "",
        desconto_contratual: data.desconto_contratual || "",
        data_vigor: data.data_vigor || "",
        status: data.status || "ativo",
        fase: data.fase || "comercial",
      });

      setSelectedClientId(data.id);
      setTipoCadastro("atualizacao");
      toast.success(`Cliente #${data.codigo} carregado com sucesso!`);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao buscar cliente pelo código.");
    } finally {
      setSearchingCodigo(false);
    }
  };

  // Load user profile and code from query parameters on mount
  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const supabaseClient = createClient();
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (user) {
          const { data } = await supabaseClient
            .from("cm_user_profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          if (data) {
            setUserRole(data.role);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar papel do usuário:", err);
      }
    };
    fetchUserRole();

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("codigo");
      if (code) {
        setCodigoBusca(code);
        buscarPorCodigoDirect(code);
      }
    }
  }, []);

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
        cidade: data.municipio || "",
        uf: data.uf || "",
      }));

      toast.success("Dados do CNPJ importados com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível buscar os dados desse CNPJ.");
    } finally {
      setFetchingCnpj(false);
    }
  };

  // Role & Permission Mappings
  const isAdminOrCeo = userRole === "Admin" || userRole === "CEO";
  const isCommercialUser = userRole === "Gerente Regional" || userRole === "Vendedor" || userRole === "Supervisor" || userRole === "Promotor";
  const isFinancialUser = userRole === "Financeiro";
  const isOperationsUser = userRole === "Trade";

  // Lock logic
  const isCommercialDisabled = !isAdminOrCeo && (formData.fase !== "comercial" || !isCommercialUser);
  const isFinancialDisabled = !isAdminOrCeo && (formData.fase !== "financeiro" || !isFinancialUser);
  const isAllDisabled = !isAdminOrCeo && formData.fase === "concluido";

  const salvarCliente = async (nextPhase?: "comercial" | "financeiro" | "operacoes" | "concluido") => {
    setLoading(true);
    
    try {
      const supabase = createClient();
      const targetPhase = nextPhase || formData.fase || "comercial";

      // Validation before transition
      if (nextPhase === "financeiro") {
        if (!formData.cnpj) {
          toast.error("CNPJ é obrigatório para concluir a fase comercial.");
          setLoading(false);
          return;
        }
        if (!formData.nome_parceiro || !formData.razao_social) {
          toast.error("Razão Social e Nome Fantasia são obrigatórios.");
          setLoading(false);
          return;
        }
      }

      if (nextPhase === "operacoes") {
        if (!formData.classificacao_icms || !formData.retirar_st || !formData.empresa_preferencial || !formData.tipo_geracao_boleto) {
          toast.error("Por favor, preencha todos os campos financeiros obrigatórios.");
          setLoading(false);
          return;
        }
      }
      
      const payload: any = {
        cnpj: formData.cnpj,
        matriz: formData.matriz,
        codigo_matriz: formData.codigo_matriz || null,
        responsavel: formData.responsavel || null,
        tipo_parceiro: formData.tipo_parceiro,
        nome_parceiro: formData.nome_parceiro,
        razao_social: formData.razao_social,
        inscricao_estadual: formData.inscricao_estadual,
        cep: formData.cep,
        endereco: formData.endereco,
        numero: formData.numero,
        complemento: formData.complemento,
        cidade: formData.cidade,
        uf: formData.uf || null,
        condicao_pagamento: formData.condicao_pagamento,
        classificacao_icms: formData.classificacao_icms,
        retirar_st: formData.retirar_st,
        empresa_preferencial: formData.empresa_preferencial,
        tipo_geracao_boleto: formData.tipo_geracao_boleto,
        enviar_danfe: formData.enviar_danfe,
        email_nfe: formData.email_nfe,
        banco: formData.banco,
        agencia: formData.agencia,
        conta: formData.conta,
        desconto_contratual: formData.desconto_contratual,
        data_vigor: formData.data_vigor || null,
        status: formData.status,
        fase: targetPhase,
      };

      let resultData: any = null;

      if (tipoCadastro === "novo") {
        payload.tipo_cadastro = tipoCadastro;
        const { data, error } = await supabase
          .from("cm_clientes")
          .insert([payload])
          .select();

        if (error) throw error;
        resultData = data && data[0];
        
        const createdCodigo = resultData?.codigo;
        toast.success(createdCodigo ? `Cliente cadastrado com sucesso! Código: ${createdCodigo}` : "Cliente cadastrado com sucesso!");

        // Trigger transition email
        if (nextPhase && resultData) {
          notificarTransicaoFase(resultData, "comercial").catch((err) => {
            console.error("Erro ao enviar e-mail de transição:", err);
          });
        } else if (resultData) {
          notificarFinanceiroNovoCliente(resultData, "novo").catch((err) => {
            console.error("Erro ao enviar e-mail:", err);
          });
        }
        
        if (resultData) {
          setFormData((prev) => ({
            ...prev,
            fase: targetPhase,
          }));
          setSelectedClientId(resultData.id);
          setCodigoBusca(String(resultData.codigo || ""));
          setTipoCadastro("atualizacao");
        }
      } else {
        if (!selectedClientId) {
          toast.error("Por favor, busque um cliente por código antes de salvar as atualizações.");
          setLoading(false);
          return;
        }
        
        const { data, error } = await supabase
          .from("cm_clientes")
          .update(payload)
          .eq("id", selectedClientId)
          .select();

        if (error) throw error;
        resultData = data && data[0];
        
        toast.success("Dados do cliente atualizados com sucesso!");

        // Trigger emails if transitioning
        if (nextPhase && resultData) {
          if (nextPhase === "financeiro") {
            notificarTransicaoFase(resultData, "comercial").catch((err) => {
              console.error("Erro ao enviar e-mail de transição:", err);
            });
          } else if (nextPhase === "operacoes") {
            notificarTransicaoFase(resultData, "financeiro").catch((err) => {
              console.error("Erro ao enviar e-mail de transição:", err);
            });
          }
        } else if (resultData) {
          notificarFinanceiroNovoCliente(resultData, "atualizacao").catch((err) => {
            console.error("Erro ao enviar e-mail:", err);
          });
        }

        if (resultData) {
          setFormData((prev) => ({
            ...prev,
            fase: targetPhase,
          }));
        }
      }

      if (nextPhase && resultData) {
        router.push("/config-financeiro/clientes");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar cliente: " + (err.message || err.details || ""));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await salvarCliente();
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
              Cadastro de Cliente (Cadastro Único)
            </h1>
            <p className="text-foreground-secondary mt-1">
              Preencha os dados do cliente, vincule a Matriz e o Responsável Comercial.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-background-card border border-border px-4 py-2 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
              <input 
                type="radio" 
                name="tipoCadastro" 
                value="novo" 
                checked={tipoCadastro === "novo"} 
                onChange={(e) => handleTipoCadastroChange(e.target.value)}
                className="accent-gold"
              /> 
              Novo Cadastro
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-semibold text-sm">
              <input 
                type="radio" 
                name="tipoCadastro" 
                value="atualizacao" 
                checked={tipoCadastro === "atualizacao"} 
                onChange={(e) => handleTipoCadastroChange(e.target.value)}
                className="accent-gold"
              /> 
              Atualização
            </label>
          </div>
        </header>

        {/* Stepper Visual */}
        <div className="bg-background-card border border-border p-4 rounded-xl shadow-sm">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <span className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Fase do Cadastro:</span>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-center">
              {(() => {
                const phasesList = [
                  { id: "comercial", label: "Comercial", color: "amber" },
                  { id: "financeiro", label: "Financeiro", color: "blue" },
                  { id: "operacoes", label: "Operações", color: "purple" },
                  { id: "concluido", label: "Concluído", color: "green" },
                ];
                
                const currentPhaseIndex = phasesList.findIndex(p => p.id === (formData.fase || 'comercial'));
                
                return phasesList.map((phase, idx) => {
                  const isActive = phase.id === (formData.fase || 'comercial');
                  const isCompleted = idx < currentPhaseIndex;
                  
                  let badgeStyles = "";
                  if (isActive) {
                    if (phase.color === "amber") badgeStyles = "bg-amber-500/15 text-amber-500 border-amber-500/30 ring-2 ring-amber-500/20";
                    else if (phase.color === "blue") badgeStyles = "bg-blue-500/15 text-blue-500 border-blue-500/30 ring-2 ring-blue-500/20";
                    else if (phase.color === "purple") badgeStyles = "bg-purple-500/15 text-purple-500 border-purple-500/30 ring-2 ring-purple-500/20";
                    else badgeStyles = "bg-green-500/15 text-green-500 border-green-500/30 ring-2 ring-green-500/20";
                  } else if (isCompleted) {
                    badgeStyles = "bg-green-500/5 text-green-500/80 border-green-500/10";
                  } else {
                    badgeStyles = "bg-background border-border text-foreground-dim opacity-55";
                  }
                  
                  return (
                    <div key={phase.id} className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border transition-all ${badgeStyles}`}>
                        {isCompleted ? <CheckCircle className="w-3.5 h-3.5" /> : <span>{idx + 1}</span>}
                        {phase.label}
                      </span>
                      {idx < phasesList.length - 1 && (
                        <span className="text-foreground-dim/40 text-xs hidden sm:inline">➔</span>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Identificação Section */}
          <div className="bg-background-card border border-border rounded-xl overflow-hidden shadow-lg">
            <div className="bg-background-elevated px-4 py-3 border-b border-border flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-gold" />
              <h2 className="font-semibold text-base">Identificação e Estrutura Comercial</h2>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Código de Busca para Atualização */}
              {tipoCadastro === "atualizacao" && (
                <div className="flex flex-col sm:flex-row gap-4 items-end pb-4 border-b border-border/50 mb-2">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                      Código do Cliente <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="codigo_busca"
                      value={codigoBusca}
                      onChange={(e) => setCodigoBusca(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          buscarPorCodigo();
                        }
                      }}
                      placeholder="Digite o código do Sankhya para carregar os dados"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors font-mono font-bold"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={buscarPorCodigo}
                    disabled={searchingCodigo}
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
                      cursor: searchingCodigo ? "not-allowed" : "pointer",
                    }}
                    className="transition-all hover:bg-[rgba(200,169,110,0.2)]"
                  >
                    {searchingCodigo ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Buscar Cliente
                  </button>
                </div>
              )}

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
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                {tipoCadastro !== "atualizacao" && (
                  <button
                    type="button"
                    onClick={buscarCnpj}
                    disabled={fetchingCnpj || isCommercialDisabled}
                    style={{
                      height: "40px",
                      padding: "0 16px",
                      background: (fetchingCnpj || isCommercialDisabled) ? "var(--border)" : "rgba(200, 169, 110, 0.1)",
                      color: (fetchingCnpj || isCommercialDisabled) ? "var(--foreground-dim)" : "var(--accent-gold)",
                      border: "1px solid rgba(200, 169, 110, 0.3)",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      cursor: (fetchingCnpj || isCommercialDisabled) ? "not-allowed" : "pointer",
                    }}
                    className="transition-all hover:bg-[rgba(200,169,110,0.2)]"
                  >
                    {fetchingCnpj ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                    Buscar Dados
                  </button>
                )}
              </div>

              {/* Row 2: Matriz, Código da Matriz and Responsável */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Matriz (Nome)
                  </label>
                  <input
                    type="text"
                    name="matriz"
                    value={formData.matriz}
                    onChange={handleInputChange}
                    placeholder="Ex: VERDEMAR"
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Código da Matriz
                  </label>
                  <input
                    type="text"
                    name="codigo_matriz"
                    value={formData.codigo_matriz}
                    onChange={handleInputChange}
                    placeholder="Ex: 78273.0"
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Responsável (Gerente)
                  </label>
                  <input
                    type="text"
                    name="responsavel"
                    value={formData.responsavel}
                    onChange={handleInputChange}
                    placeholder="Ex: Luciano, Leandro, Luiz..."
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Row 3: Names & Channel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-1">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Canal / Tipo do Parceiro
                  </label>
                  <input
                    type="text"
                    name="tipo_parceiro"
                    value={formData.tipo_parceiro}
                    onChange={handleInputChange}
                    placeholder="Ex: KA, Distribuidor..."
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Nome do Parceiro (Fantasia)
                  </label>
                  <input
                    type="text"
                    name="nome_parceiro"
                    value={formData.nome_parceiro}
                    onChange={handleInputChange}
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Row 4: IE and CEP */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Insc. Estadual
                  </label>
                  <input
                    type="text"
                    name="inscricao_estadual"
                    value={formData.inscricao_estadual}
                    onChange={handleInputChange}
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    placeholder="00000-000"
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Row 6: Cidade / UF */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-3 space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    Cidade
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-dim" />
                    <input
                      type="text"
                      name="cidade"
                      value={formData.cidade}
                      onChange={handleInputChange}
                      disabled={isCommercialDisabled}
                      className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    UF (Estado)
                  </label>
                  <input
                    type="text"
                    name="uf"
                    value={formData.uf}
                    onChange={handleInputChange}
                    placeholder="Ex: MG, SP..."
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors uppercase font-bold disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isFinancialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isFinancialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isFinancialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    disabled={isFinancialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider flex items-center gap-2">
                    Status do Cliente
                  </label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
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
                      <input type="radio" name="enviar_danfe" value="Sim" checked={formData.enviar_danfe === "Sim"} onChange={handleInputChange} disabled={isCommercialDisabled} /> Sim
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" name="enviar_danfe" value="Nao" checked={formData.enviar_danfe === "Nao"} onChange={handleInputChange} disabled={isCommercialDisabled} /> Não
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
                    disabled={isCommercialDisabled}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
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
                  disabled={isCommercialDisabled}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isCommercialDisabled}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isCommercialDisabled}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors font-mono disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isCommercialDisabled}
                  placeholder="Ex: 5%"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  disabled={isCommercialDisabled}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex justify-between items-center bg-background-elevated p-4 rounded-xl border border-border">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-lg text-foreground-secondary hover:bg-foreground/5 font-semibold transition-colors text-sm"
            >
              Cancelar
            </button>
            
            <div className="flex flex-wrap gap-3">
              {/* Salvar Rascunho button - only if not concluído, and user has permission to edit the current phase */}
              {formData.fase !== "concluido" && (isAdminOrCeo || (formData.fase === "comercial" && isCommercialUser) || (formData.fase === "financeiro" && isFinancialUser)) && (
                <button
                  type="button"
                  onClick={() => salvarCliente()} // regular save, stays in current phase
                  disabled={loading}
                  className="px-5 py-2.5 bg-background border border-border hover:bg-background-card text-foreground rounded-lg flex items-center gap-2 font-semibold text-sm transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 text-accent-gold" />}
                  Salvar Rascunho
                </button>
              )}
              
              {/* Transition Buttons */}
              {/* Comercial User / Admin -> Concluir Fase Comercial (Advances to 'financeiro') */}
              {formData.fase === "comercial" && (isAdminOrCeo || isCommercialUser) && (
                <button
                  type="button"
                  onClick={() => salvarCliente("financeiro")}
                  disabled={loading}
                  className="px-5 py-2.5 bg-accent-gold hover:brightness-110 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-all shadow-[0_4px_12px_rgba(200,169,110,0.3)] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Concluir Fase Comercial
                </button>
              )}

              {/* Financial User / Admin -> Concluir Fase Financeira (Advances to 'operacoes') */}
              {formData.fase === "financeiro" && (isAdminOrCeo || isFinancialUser) && (
                <button
                  type="button"
                  onClick={() => salvarCliente("operacoes")}
                  disabled={loading}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-all shadow-[0_4px_12px_rgba(37,99,235,0.3)] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Concluir Fase Financeira
                </button>
              )}

              {/* Operations User / Admin -> Concluir Cadastro (Advances to 'concluido') */}
              {formData.fase === "operacoes" && (isAdminOrCeo || isOperationsUser) && (
                <button
                  type="button"
                  onClick={() => salvarCliente("concluido")}
                  disabled={loading}
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-all shadow-[0_4px_12px_rgba(22,163,74,0.3)] disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Concluir Cadastro
                </button>
              )}

              {/* If phase is Concluido, or user has no permissions to transition, we can show a notice or let Admin edit. */}
              {formData.fase === "concluido" && isAdminOrCeo && (
                <button
                  type="button"
                  onClick={() => salvarCliente()}
                  disabled={loading}
                  className="px-5 py-2.5 bg-accent-gold hover:brightness-110 text-white rounded-lg flex items-center gap-2 font-bold text-sm transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Alterações (Admin)
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
