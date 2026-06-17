"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { DeleteUserButton } from "./DeleteUserButton";
import { EditUserRoleSelect } from "./EditUserRoleSelect";
import { EditUserPdfPreferences } from "./EditUserPdfPreferences";
import { ApproveUserToggle } from "./ApproveUserToggle";
import { User } from "@supabase/supabase-js";

interface UserProfile {
  id: string;
  role?: string;
  manager_name?: string | null;
  receber_pdf_vendas?: boolean;
  receber_pdf_investimento?: boolean;
  approved?: boolean;
}

interface UserListProps {
  users: User[];
  profilesMap: Record<string, UserProfile>;
  roles: string[];
  deleteAction: (userId: string) => Promise<{ success?: boolean; error?: string }>;
}

export function UserList({ users, profilesMap, roles, deleteAction }: UserListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const filteredUsers = users.filter(user => {
    const matchesEmail = user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const userRole = profilesMap[user.id]?.role || "";
    const matchesRole = roleFilter === "" || userRole === roleFilter;
    return matchesEmail && matchesRole;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-foreground-muted" />
          <input
            type="text"
            placeholder="Buscar por e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-background-elevated border border-border rounded-lg text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-background-elevated border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-accent-gold/50 focus:ring-1 focus:ring-accent-gold/50 outline-none appearance-none pr-8 relative"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\\\'http://www.w3.org/2000/svg\\\' fill=\\\'none\\\' viewBox=\\\'0 0 24 24\\\' stroke=\\\'currentColor\\\'%3E%3Cpath stroke-linecap=\\\'round\\\' stroke-linejoin=\\\'round\\\' stroke-width=\\\'2\\\' d=\\\'M19 9l-7 7-7-7\\\'%3E%3C/path%3E%3C/svg%3E")', backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.2em 1.2em' }}
        >
          <option value="">Todas as Funções</option>
          {roles.map(role => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
      </div>

      <div className="bg-background-card border border-border rounded-2xl overflow-hidden shadow-2xl">
        {filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-foreground-muted">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filteredUsers.map((user) => (
              <li key={user.id} className="p-4 flex items-center justify-between hover:bg-foreground/5 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-linear-to-br from-gold/20 to-transparent flex items-center justify-center border border-gold/20">
                    <span className="text-gold font-semibold text-sm">
                      {user.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="text-foreground font-medium flex items-center gap-2">
                      {user.email}
                      {profilesMap[user.id] !== undefined && (
                        <EditUserRoleSelect 
                          userId={user.id} 
                          currentRole={profilesMap[user.id].role || ""} 
                          roles={roles} 
                        />
                      )}
                    </div>
                    <p className="text-xs text-foreground-muted mt-1 flex items-center gap-2">
                      Criado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      {profilesMap[user.id]?.manager_name && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent-gold/10 border border-accent-gold/20 text-accent-gold text-[10px] font-semibold uppercase">
                          RPS: {profilesMap[user.id].manager_name}
                        </span>
                      )}
                    </p>
                    {profilesMap[user.id] !== undefined && (
                      <EditUserPdfPreferences
                        userId={user.id}
                        receberVendas={profilesMap[user.id].receber_pdf_vendas || false}
                        receberInvestimento={profilesMap[user.id].receber_pdf_investimento || false}
                      />
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  {profilesMap[user.id] !== undefined && (
                    <ApproveUserToggle 
                      userId={user.id} 
                      initialApproved={profilesMap[user.id].approved || false} 
                    />
                  )}
                  <DeleteUserButton userId={user.id} deleteAction={deleteAction} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
