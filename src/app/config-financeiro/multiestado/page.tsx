"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, 
  Search, 
  MapPin, 
  Users, 
  Building, 
  Plus, 
  Edit2, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  X, 
  Check, 
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from "lucide-react";
import { toast } from "sonner";
import { 
  obterBasesRegionais, 
  obterDadosAuxiliares, 
  salvarBaseRegional, 
  excluirBaseRegional, 
  recalcularClientesResponsaveis,
  RegionalBaseItem
} from "./actions";

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", 
  "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export default function MultiestadoPage() {
  const router = useRouter();
  
  // State
  const [bases, setBases] = useState<RegionalBaseItem[]>([]);
  const [matrizes, setMatrizes] = useState<Array<{ codigo: string; nome: string }>>([]);
  const [usuarios, setUsuarios] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [filterUf, setFilterUf] = useState("todos");
  const [filterGerente, setFilterGerente] = useState("todos");
  
  // Modal Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    cliente_matriz_id: "",
    estado: "",
    regional: "",
    gerente_responsavel_id: "",
    supervisor_responsavel_id: "",
    distribuidor_responsavel_id: "",
    ativo: true
  });

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [resBases, resAux] = await Promise.all([
        obterBasesRegionais(),
        obterDadosAuxiliares()
      ]);

      if (resBases.success && resBases.data) {
        setBases(resBases.data);
      } else {
        toast.error(resBases.message || "Erro ao buscar bases regionais.");
      }

      if (resAux.success && resAux.data) {
        setMatrizes(resAux.data.matrizes);
        setUsuarios(resAux.data.usuarios);
      } else {
        toast.error(resAux.message || "Erro ao buscar dados auxiliares.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados da página.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered list
  const filteredBases = useMemo(() => {
    return bases.filter(b => {
      const matchSearch = b.matriz_nome?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          b.regional?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchUf = filterUf === "todos" || b.estado === filterUf;
      const matchGerente = filterGerente === "todos" || b.gerente_responsavel_id === filterGerente;
      return matchSearch && matchUf && matchGerente;
    });
  }, [bases, searchTerm, filterUf, filterGerente]);

  // Statistics
  const stats = useMemo(() => {
    const ufs = new Set(bases.map(b => b.estado));
    const gerentes = new Set(bases.map(b => b.gerente_responsavel_id).filter(Boolean));
    return {
      total: bases.length,
      ufs: ufs.size,
      gerentes: gerentes.size
    };
  }, [bases]);

  // Get only regional managers for dropdown
  const gerentesRegionais = useMemo(() => {
    return usuarios.filter(u => u.role === "Gerente Regional" || u.role === "Admin" || u.role === "CEO");
  }, [usuarios]);

  // Handle Input Changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Open Modal for New Record
  const handleNewRecord = () => {
    setEditingId(null);
    setFormData({
      cliente_matriz_id: "",
      estado: "",
      regional: "",
      gerente_responsavel_id: "",
      supervisor_responsavel_id: "",
      distribuidor_responsavel_id: "",
      ativo: true
    });
    setIsModalOpen(true);
  };

  // Open Modal for Editing Record
  const handleEditRecord = (item: RegionalBaseItem) => {
    setEditingId(item.id);
    setFormData({
      cliente_matriz_id: item.cliente_matriz_id,
      estado: item.estado,
      regional: item.regional || "",
      gerente_responsavel_id: item.gerente_responsavel_id || "",
      supervisor_responsavel_id: item.supervisor_responsavel_id || "",
      distribuidor_responsavel_id: item.distribuidor_responsavel_id || "",
      ativo: item.ativo
    });
    setIsModalOpen(true);
  };

  // Save Record
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await salvarBaseRegional({
        id: editingId || undefined,
        cliente_matriz_id: formData.cliente_matriz_id,
        estado: formData.estado,
        regional: formData.regional,
        gerente_responsavel_id: formData.gerente_responsavel_id || null,
        supervisor_responsavel_id: formData.supervisor_responsavel_id || null,
        distribuidor_responsavel_id: formData.distribuidor_responsavel_id || null,
        ativo: formData.ativo
      });

      if (res.success) {
        toast.success(editingId ? "Mapeamento atualizado com sucesso!" : "Mapeamento cadastrado com sucesso!");
        setIsModalOpen(false);
        loadData();
      } else {
        toast.error(res.message || "Erro ao salvar mapeamento.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  // Delete Record
  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta base regional? Os clientes correspondentes voltarão ao gerente padrão.")) return;
    
    try {
      const res = await excluirBaseRegional(id);
      if (res.success) {
        toast.success("Mapeamento regional excluído com sucesso!");
        loadData();
      } else {
        toast.error(res.message || "Erro ao excluir.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao excluir.");
    }
  };

  // Manual Sync Trigger
  const handleSyncManual = async () => {
    setSyncing(true);
    try {
      const res = await recalcularClientesResponsaveis();
      if (res.success && res.data) {
        toast.success(`Recálculo completo! ${res.data.rowsAffected} clientes atualizados na carteira comercial.`);
      } else {
        toast.error(res.message || "Erro ao sincronizar responsáveis.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao executar sincronização manual.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16 pt-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Back Link */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push("/config-financeiro/clientes")}
            className="h-10 w-10 flex items-center justify-center bg-background-elevated border border-border rounded-xl text-foreground hover:border-accent-gold/40 hover:text-accent-gold transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurações Regionais - Multiestado</h1>
            <p className="text-sm text-foreground-secondary">
              Gerencie os gerentes e responsáveis comerciais por estado para cada rede/matriz.
            </p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-background-card border border-border p-6 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-accent-gold/10 text-accent-gold rounded-xl">
              <Building className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Mapeamentos Regionais</p>
              <h3 className="text-2xl font-bold mt-1">{stats.total}</h3>
            </div>
          </div>

          <div className="bg-background-card border border-border p-6 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl">
              <MapPin className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">UFs Atendidas</p>
              <h3 className="text-2xl font-bold mt-1">{stats.ufs}</h3>
            </div>
          </div>

          <div className="bg-background-card border border-border p-6 rounded-2xl flex items-center gap-4 shadow-sm">
            <div className="p-3 bg-purple-500/10 text-purple-500 rounded-xl">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Gerentes Alocados</p>
              <h3 className="text-2xl font-bold mt-1">{stats.gerentes}</h3>
            </div>
          </div>
        </div>

        {/* Actions & Filters */}
        <div className="bg-background-card border border-border p-6 rounded-2xl space-y-4 shadow-sm">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-wrap gap-3 w-full md:w-auto">
              <button
                onClick={handleNewRecord}
                className="h-10 px-4 bg-accent-gold hover:brightness-110 text-white rounded-xl flex items-center justify-center gap-2 transition-all font-bold text-sm shadow-[0_4px_14px_rgba(200,169,110,0.3)]"
              >
                <Plus className="w-4 h-4" />
                Novo Vínculo Regional
              </button>

              <button
                onClick={handleSyncManual}
                disabled={syncing}
                className="h-10 px-4 bg-background-elevated border border-border hover:border-accent-gold/50 text-foreground rounded-xl flex items-center justify-center gap-2 transition-all font-semibold text-sm disabled:opacity-50"
              >
                {syncing ? <Loader2 className="w-4 h-4 animate-spin text-accent-gold" /> : <RefreshCw className="w-4 h-4 text-accent-gold" />}
                Forçar Recálculo da Carteira
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border/50">
            <div className="relative">
              <Search className="w-4 h-4 text-foreground-secondary absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por rede ou regional..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full h-10 bg-background border border-border rounded-xl pl-10 pr-4 text-sm focus:outline-none focus:border-accent-gold transition-colors"
              />
            </div>

            <div>
              <select
                value={filterUf}
                onChange={e => setFilterUf(e.target.value)}
                className="w-full h-10 bg-background border border-border rounded-xl px-4 text-sm focus:outline-none focus:border-accent-gold transition-colors"
              >
                <option value="todos">Todos os Estados (UF)</option>
                {ESTADOS_BRASIL.map(uf => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={filterGerente}
                onChange={e => setFilterGerente(e.target.value)}
                className="w-full h-10 bg-background border border-border rounded-xl px-4 text-sm focus:outline-none focus:border-accent-gold transition-colors"
              >
                <option value="todos">Todos os Gerentes</option>
                {gerentesRegionais.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Data List / Table */}
        <div className="bg-background-card border border-border rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-12 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-accent-gold" />
              <p className="text-sm text-foreground-secondary">Carregando vínculos regionais...</p>
            </div>
          ) : filteredBases.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
              <AlertTriangle className="w-10 h-10 text-amber-500/80" />
              <h3 className="font-bold text-lg">Nenhum mapeamento encontrado</h3>
              <p className="text-sm text-foreground-secondary max-w-md">
                Cadastre um novo vínculo regional para poder definir responsáveis específicos por UF em suas redes.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-background-elevated/40">
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Cliente Matriz</th>
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider text-center">UF</th>
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Regional</th>
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Gerente Responsável</th>
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Supervisor (Opc)</th>
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Distribuidor (Opc)</th>
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider text-center">Status</th>
                    <th className="p-4 text-xs font-semibold text-foreground-secondary uppercase tracking-wider text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredBases.map(b => (
                    <tr key={b.id} className="hover:bg-background-elevated/20 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-foreground">{b.matriz_nome}</div>
                        <div className="text-xs text-foreground-secondary font-mono">{b.cliente_matriz_id}</div>
                      </td>
                      <td className="p-4 text-center font-bold text-accent-gold bg-accent-gold/5">{b.estado}</td>
                      <td className="p-4 text-sm font-semibold">{b.regional}</td>
                      <td className="p-4 font-medium text-foreground">{b.gerente_nome || <span className="text-foreground-secondary italic text-xs">Sem gerente</span>}</td>
                      <td className="p-4 text-sm text-foreground-secondary">{b.supervisor_nome || "—"}</td>
                      <td className="p-4 text-sm text-foreground-secondary">{b.distribuidor_nome || "—"}</td>
                      <td className="p-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-bold rounded-lg border ${
                          b.ativo 
                            ? 'bg-green-500/10 text-green-500 border-green-500/20' 
                            : 'bg-foreground-secondary/10 text-foreground-secondary border-border'
                        }`}>
                          {b.ativo ? "ATIVO" : "INATIVO"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button
                            onClick={() => handleEditRecord(b)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground-secondary hover:border-accent-gold/40 hover:text-accent-gold transition-colors"
                            title="Editar vínculo"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-border text-foreground-secondary hover:border-red-500/40 hover:text-red-500 hover:bg-red-500/5 transition-colors"
                            title="Excluir vínculo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-background-card border border-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in-50 zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-background-elevated/30">
              <h2 className="text-lg font-bold text-foreground">
                {editingId ? "Editar Vínculo Regional" : "Novo Mapeamento Regional"}
              </h2>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-foreground-secondary hover:text-foreground p-1 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              
              {/* Matriz */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Cliente Matriz (Corporativo)</label>
                <select
                  name="cliente_matriz_id"
                  value={formData.cliente_matriz_id}
                  onChange={handleInputChange}
                  required
                  disabled={!!editingId}
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-60"
                >
                  <option value="">Selecione o Cliente Matriz</option>
                  {matrizes.map(m => (
                    <option key={m.codigo} value={m.codigo}>{m.nome} ({m.codigo})</option>
                  ))}
                </select>
              </div>

              {/* Row: Estado & Regional */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Estado (UF)</label>
                  <select
                    name="estado"
                    value={formData.estado}
                    onChange={handleInputChange}
                    required
                    disabled={!!editingId}
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-accent-gold transition-colors disabled:opacity-60"
                  >
                    <option value="">Selecione</option>
                    {ESTADOS_BRASIL.map(uf => (
                      <option key={uf} value={uf}>{uf}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Regional (Zona/Região)</label>
                  <input
                    type="text"
                    name="regional"
                    placeholder="Ex: Sudeste, Sul, etc."
                    value={formData.regional}
                    onChange={handleInputChange}
                    required
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-accent-gold transition-colors"
                  />
                </div>
              </div>

              {/* Gerente Responsável */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Gerente Responsável</label>
                <select
                  name="gerente_responsavel_id"
                  value={formData.gerente_responsavel_id}
                  onChange={handleInputChange}
                  required
                  className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-accent-gold transition-colors"
                >
                  <option value="">Selecione o Gerente</option>
                  {gerentesRegionais.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>

              {/* Supervisors & Distributors (Optional) */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Supervisor (Opcional)</label>
                  <select
                    name="supervisor_responsavel_id"
                    value={formData.supervisor_responsavel_id}
                    onChange={handleInputChange}
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-accent-gold transition-colors"
                  >
                    <option value="">Sem supervisor</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Distribuidor (Opcional)</label>
                  <select
                    name="distribuidor_responsavel_id"
                    value={formData.distribuidor_responsavel_id}
                    onChange={handleInputChange}
                    className="w-full h-10 bg-background border border-border rounded-xl px-3 text-sm focus:outline-none focus:border-accent-gold transition-colors"
                  >
                    <option value="">Sem distribuidor</option>
                    {usuarios.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Ativo Toggle */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">Vínculo Ativo</span>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, ativo: !prev.ativo }))}
                  className="p-1 focus:outline-none"
                >
                  {formData.ativo ? (
                    <ToggleRight className="w-10 h-10 text-accent-gold" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-foreground-secondary" />
                  )}
                </button>
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 bg-background border border-border hover:bg-background-elevated text-foreground rounded-xl text-sm font-semibold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 px-6 bg-accent-gold hover:brightness-110 disabled:opacity-50 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-[0_4px_14px_rgba(200,169,110,0.3)]"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
