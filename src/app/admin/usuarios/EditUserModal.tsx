"use client";

import { useState, useTransition } from "react";
import { X, Mail, User as UserIcon, Phone, MapPin, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  role?: string;
  manager_name?: string | null;
  receber_pdf_vendas?: boolean;
  receber_pdf_investimento?: boolean;
  approved?: boolean;
  phone?: string | null;
  uf?: string | null;
  name?: string | null;
}

interface EditUserModalProps {
  user: User;
  profile?: UserProfile;
  roles: string[];
  onClose: () => void;
  onSave: (userId: string, formData: FormData) => Promise<{ success?: boolean; error?: string; message?: string }>;
  onResetPassword: (userId: string) => Promise<{ success?: boolean; error?: string; message?: string }>;
}

export function EditUserModal({
  user,
  profile,
  roles,
  onClose,
  onSave,
  onResetPassword,
}: EditUserModalProps) {
  const userMetadata = user.user_metadata || {};
  
  // Extract or fallback name
  const profileName = profile?.name || "";
  let initialFirstName = userMetadata.first_name || "";
  let initialLastName = userMetadata.last_name || "";
  if (!initialFirstName && !initialLastName && profileName) {
    const parts = profileName.split(" ");
    initialFirstName = parts[0] || "";
    initialLastName = parts.slice(1).join(" ") || "";
  }

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [uf, setUf] = useState(profile?.uf || "");
  const [role, setRole] = useState(profile?.role || "Vendedor");
  const [managerName, setManagerName] = useState(profile?.manager_name || "");
  const [receberPdfVendas, setReceberPdfVendas] = useState(profile?.receber_pdf_vendas || false);
  const [receberPdfInvestimento, setReceberPdfInvestimento] = useState(profile?.receber_pdf_investimento || false);

  const [isPending, startTransition] = useTransition();
  const [isResetting, setIsResetting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("first_name", firstName);
      formData.append("last_name", lastName);
      formData.append("phone", phone);
      formData.append("uf", uf);
      formData.append("role", role);
      formData.append("manager_name", managerName);
      if (receberPdfVendas) formData.append("receber_pdf_vendas", "on");
      if (receberPdfInvestimento) formData.append("receber_pdf_investimento", "on");

      const result = await onSave(user.id, formData);
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success(result?.message || "Usuário atualizado com sucesso!");
        onClose();
      }
    });
  };

  const handleResetPassword = async () => {
    if (!window.confirm("Deseja realmente resetar a senha deste usuário para '123456'?")) {
      return;
    }
    setIsResetting(true);
    const result = await onResetPassword(user.id);
    if (result?.error) {
      toast.error(result.error);
    } else {
      toast.success(result?.message || "Senha redefinida para 123456 com sucesso!");
    }
    setIsResetting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-background-card border border-border rounded-2xl w-full max-w-lg p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow Effect */}
        <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-gold/30 to-transparent" />
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
          <h3 className="text-xl font-bold text-foreground flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-accent-gold" />
            Editar Usuário
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-foreground/5 text-foreground-secondary transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                Primeiro Nome
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 w-5 h-5 text-foreground-muted" />
                <input
                  type="text"
                  name="first_name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="João"
                  className="w-full bg-background-elevated border border-border rounded-xl py-2.5 pl-11 pr-4 text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                Último Nome
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3 w-5 h-5 text-foreground-muted" />
                <input
                  type="text"
                  name="last_name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Silva"
                  className="w-full bg-background-elevated border border-border rounded-xl py-2.5 pl-11 pr-4 text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
              E-mail Corporativo
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-5 h-5 text-foreground-muted" />
              <input
                type="email"
                name="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@coffeemais.com"
                className="w-full bg-background-elevated border border-border rounded-xl py-2.5 pl-11 pr-4 text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                Celular
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-3 w-5 h-5 text-foreground-muted" />
                <input
                  type="text"
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-background-elevated border border-border rounded-xl py-2.5 pl-11 pr-4 text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
                Estado (UF)
              </label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3 w-5 h-5 text-foreground-muted" />
                <input
                  type="text"
                  name="uf"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  placeholder="EX: MG"
                  maxLength={2}
                  className="w-full bg-background-elevated border border-border rounded-xl py-2.5 pl-11 pr-4 text-foreground placeholder-foreground-muted focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all uppercase"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
              Função (Cargo)
            </label>
            <div className="relative">
              <select
                name="role"
                required
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-background-elevated border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all appearance-none"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-foreground-muted">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
              Gerente Comercial (RPS)
            </label>
            <div className="relative">
              <select
                name="manager_name"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full bg-background-elevated border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 transition-all appearance-none"
              >
                <option value="">— Nenhum (Acesso total)</option>
                <option value="Julliano">Julliano</option>
                <option value="Leandro">Leandro</option>
                <option value="Luiz">Luiz</option>
                <option value="John Guedes">John Guedes</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-foreground-muted">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
              </div>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <label className="block text-sm font-medium text-foreground-secondary mb-1.5 ml-1">
              Relatórios Automáticos (PDF)
            </label>
            <label className="flex items-center gap-3 p-3 bg-background-elevated border border-border rounded-xl hover:border-accent-gold/30 transition-colors cursor-pointer">
              <input
                type="checkbox"
                name="receber_pdf_vendas"
                checked={receberPdfVendas}
                onChange={(e) => setReceberPdfVendas(e.target.checked)}
                className="w-4 h-4 text-accent-gold border-border rounded focus:ring-accent-gold/20"
              />
              <span className="text-sm font-medium text-foreground">
                Receber PDF: <span className="font-semibold">Venda do dia anterior</span>
              </span>
            </label>
            <label className="flex items-center gap-3 p-3 bg-background-elevated border border-border rounded-xl hover:border-accent-gold/30 transition-colors cursor-pointer">
              <input
                type="checkbox"
                name="receber_pdf_investimento"
                checked={receberPdfInvestimento}
                onChange={(e) => setReceberPdfInvestimento(e.target.checked)}
                className="w-4 h-4 text-accent-gold border-border rounded focus:ring-accent-gold/20"
              />
              <span className="text-sm font-medium text-foreground">
                Receber PDF: <span className="font-semibold">Investimento</span>
              </span>
            </label>
          </div>

          <div className="pt-4 border-t border-border mt-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-amber-500 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  Redefinir Senha
                </p>
                <p className="text-[10px] text-foreground-secondary">
                  Define a senha deste usuário temporariamente para: <span className="font-bold text-foreground">123456</span>
                </p>
              </div>
              <button
                type="button"
                disabled={isResetting || isPending}
                onClick={handleResetPassword}
                className="px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                {isResetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Resetar Senha
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border mt-4 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending || isResetting}
              className="px-4 py-2 border border-border text-foreground-secondary rounded-xl hover:bg-foreground/5 transition-colors text-sm font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || isResetting}
              className="px-4 py-2 bg-accent-gold text-black rounded-xl hover:opacity-90 transition-opacity text-sm font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
