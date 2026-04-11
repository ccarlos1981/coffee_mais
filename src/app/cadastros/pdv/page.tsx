"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, Building, MoreVertical, X, Check, Coffee } from "lucide-react";

type PDV = {
  id: string;
  cnpj: string;
  name: string;
  erp_code: string | null;
  status: string;
  network_matrix: {
    network: string;
    manager: string;
    network_uf: string;
  };
};

type NetworkMatrix = {
  id: number;
  network: string;
  manager: string;
  network_uf: string;
};

// CNPJ auto-masking function
function maskCNPJ(value: string) {
  let v = value.replace(/\D/g, "");
  if (v.length > 14) v = v.substring(0, 14);
  v = v.replace(/^(\d{2})(\d)/, "$1.$2");
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
  v = v.replace(/(\d{4})(\d)/, "$1-$2");
  return v;
}

export default function PdvManagement() {
  const [pdvs, setPdvs] = useState<PDV[]>([]);
  const [networks, setNetworks] = useState<NetworkMatrix[]>([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    cnpj: "",
    name: "",
    network_id: "",
    erp_code: "",
  });

  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPdvs = async (query = "") => {
    setLoading(true);
    try {
      const res = await fetch(`/api/pdv?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.success) {
        setPdvs(data.pdvs);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchNetworks = async () => {
    try {
      const res = await fetch("/api/networks");
      const data = await res.json();
      if (data.success) {
        setNetworks(data.networks);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNetworks();
    fetchPdvs();
  }, []);

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPdvs(search);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, cnpj: maskCNPJ(e.target.value) });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    if (formData.cnpj.replace(/\D/g, "").length !== 14) {
      setFormError("CNPJ inválido ou incompleto.");
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        network_id: formData.network_id ? parseInt(formData.network_id) : null,
      };

      const res = await fetch("/api/pdv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setFormError(data.error || "Erro ao salvar PDV.");
      } else {
        setIsModalOpen(false);
        setFormData({ cnpj: "", name: "", network_id: "", erp_code: "" });
        fetchPdvs(search);
      }
    } catch (err: unknown) {
      setFormError("Falha na comunicação com o servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangeStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    // Optimistic UI
    setPdvs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
    );

    try {
      await fetch(`/api/pdv/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (e) {
      console.error(e);
      // Revert if error
      fetchPdvs(search);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-10 font-sans relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#b87042]/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#8b4513]/10 blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Header Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/10">
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center text-sm font-medium text-white/50 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao Dashboard
            </Link>
            <div>
              <h1 className="text-4xl font-light tracking-tight flex items-center gap-3">
                Gestão de <span className="font-medium text-[#c48c5b]">PDVs</span>
                <Coffee className="w-8 h-8 text-[#c48c5b]/60" />
              </h1>
              <p className="text-white/40 mt-2 text-sm max-w-xl">
                Controle os pontos de vendas de ponta a ponta. Gerencie visões locais utilizando CNPJ para garantir que o seu histórico e cruzamento de vendas sejam precisos.
              </p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button
              onClick={() => setIsModalOpen(true)}
              className="group relative flex items-center justify-center gap-2 bg-[#b87042] hover:bg-[#c48c5b] text-white px-6 py-3 rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(184,112,66,0.3)] hover:shadow-[0_0_30px_rgba(184,112,66,0.5)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <Plus className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Novo PDV</span>
            </button>
          </div>
        </header>

        {/* Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <input
              type="text"
              placeholder="Pesquisar por Loja, CNPJ..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/30 focus:outline-none focus:border-[#b87042] focus:ring-1 focus:ring-[#b87042] transition-all"
            />
          </div>
          
          <div className="flex items-center gap-3 text-sm text-white/40">
            <span>Visão consolidada</span>
            •
            <span className="tabular-nums font-medium text-white/60">{pdvs.length} Lojas</span>
          </div>
        </div>

        {/* Listing */}
        <main className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden backdrop-blur-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-white/40">
                  <th className="p-6 font-medium">Informações da Loja</th>
                  <th className="p-6 font-medium">Matriz / Grupo</th>
                  <th className="p-6 font-medium">Gerência</th>
                  <th className="p-6 font-medium text-center">Status</th>
                  <th className="p-6 font-medium text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pdvs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-12 text-center text-white/30">
                      {loading ? "Carregando matriz de PDVs..." : "Nenhuma loja encontrada na base de dados."}
                    </td>
                  </tr>
                ) : (
                  pdvs.map((pdv) => (
                    <tr key={pdv.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                            <Building className="w-4 h-4 text-white/40" />
                          </div>
                          <div>
                            <div className="font-medium text-white/90">{pdv.name}</div>
                            <div className="text-sm font-mono text-white/50 mt-1">{pdv.cnpj}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${pdv.network_matrix ? 'bg-[#b87042]' : 'bg-red-500/50'}`} />
                          <span className="text-white/80">
                            {pdv.network_matrix?.network || <span className="text-white/30 italic">Sem Matriz Vinculada</span>}
                          </span>
                        </div>
                      </td>
                      <td className="p-6 text-white/60">
                        {pdv.network_matrix?.manager || "—"}
                      </td>
                      <td className="p-6 text-center">
                        <button
                          onClick={() => handleChangeStatus(pdv.id, pdv.status)}
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            pdv.status === 'active' 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" 
                              : "bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20"
                          }`}
                        >
                          {pdv.status === 'active' ? 'Ativo' : 'Inativo'}
                        </button>
                      </td>
                      <td className="p-6 text-right">
                        <button className="text-white/30 hover:text-white transition-colors p-2">
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </main>
      </div>

      {/* MODAL NOVO PDV */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)} />
          
          <div className="relative w-full max-w-xl bg-[#111] border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-white/5">
              <h2 className="text-xl font-medium text-white/90">Cadastrar Novo PDV</h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-white/40 hover:text-white transition-colors p-2 rounded-full hover:bg-white/5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* CNPJ */}
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-sm font-medium text-white/60">CNPJ (Composição Fiscal)*</label>
                  <input
                    type="text"
                    required
                    placeholder="00.000.000/0000-00"
                    value={formData.cnpj}
                    onChange={handleCnpjChange}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono placeholder-white/20 focus:outline-none focus:border-[#b87042] transition-colors"
                  />
                </div>

                {/* Nome fantasia */}
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-sm font-medium text-white/60">Identificação (Loja/Fantasia)*</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Assaí Atacadista Jundiaí"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-[#b87042] transition-colors"
                  />
                </div>

                {/* Matriz (Network Matrix) */}
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-sm font-medium text-white/60">Vincular Matriz (Consolidador)*</label>
                  <select
                    required
                    value={formData.network_id}
                    onChange={(e) => setFormData({ ...formData, network_id: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#b87042] transition-colors appearance-none"
                  >
                    <option value="" disabled className="text-white/40">Selecione uma rede consolidadora...</option>
                    {networks.map((net) => (
                      <option key={net.id} value={net.id} className="bg-[#111]">
                        {net.network} ({net.network_uf}) - Gerente: {net.manager}
                      </option>
                    ))}
                  </select>
                </div>

                {/* ERP Code */}
                <div className="space-y-2 col-span-1 md:col-span-2">
                  <label className="text-sm font-medium text-white/60">Código Integração ERP (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Ex: 50A4-X"
                    value={formData.erp_code}
                    onChange={(e) => setFormData({ ...formData, erp_code: e.target.value })}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white font-mono placeholder-white/20 focus:outline-none focus:border-[#b87042] transition-colors"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm">
                  {formError}
                </div>
              )}

              <div className="pt-4 flex items-center justify-end gap-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 text-sm font-medium text-white/60 hover:text-white transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-white text-black hover:bg-[#c48c5b] hover:text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Cadastrar Loja
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
