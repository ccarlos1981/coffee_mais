"use client";

import { useState, useMemo } from "react";
import { ModuleGroup } from "@/components/ModuleGroup";
import { allModules } from "@/config/modules";
import { toggleFavoriteAction, updateFavoriteOrderAction } from "@/app/actions/favorites";

interface DashboardClientProps {
  role: string;
  allowedModuleNames: string[];
  hasConfigInDb: boolean;
  initialFavorites: string[];
}

export function DashboardClient({
  role,
  allowedModuleNames,
  hasConfigInDb,
  initialFavorites
}: DashboardClientProps) {
  const [favorites, setFavorites] = useState<string[]>(initialFavorites);

  const isSuperAdmin = role === 'CEO' && allowedModuleNames.length === 0;

  // Filter modules according to the role and permissions
  const filteredModules = useMemo(() => {
    return allModules.map(group => {
      // Exclude "Configuração" if not Admin/TI
      if (group.category === "Configuração") {
        if (role !== "Admin" && role !== "TI") {
          return { ...group, items: [] };
        }
      }

      return {
        ...group,
        items: group.items.filter(item => {
          if (group.category === "Configuração") {
            if (item.key === "admin_configurar_acesso") return true;
            if (item.key === "admin_usuarios") {
              return isSuperAdmin || allowedModuleNames.includes('Usuários') || role === 'Admin' || role === 'TI';
            }
            if (item.key === "admin_logs" || item.key === "admin_ranking_usuarios" || item.key === "admin_ranking_modulos") {
              return isSuperAdmin || allowedModuleNames.includes('Logs') || role === 'Admin' || role === 'TI';
            }
            return false;
          }

          if (isSuperAdmin) return true;
          
          const modulePermission = item.permission || item.title;
          
          // Se houver permissão ativa no banco, permite o acesso
          if (allowedModuleNames.includes(modulePermission)) return true;

          // Exceção explícita de visibilidade para o módulo homologado DRE Comercial
          if (item.key === "dre_comercial") return true;
          
          // Se a role não possuir NENHUMA permissão configurada no banco (tabela vazia para a role),
          // usamos os atalhos de visibilidade legados como fallback de segurança
          if (!hasConfigInDb) {
            if (item.href.startsWith("/promotor") && (role === "Promotor" || role === "Supervisor" || role === "Trade" || role === "Admin" || role === "CEO")) return true;
            if (item.href.startsWith("/supervisor") && (role === "Supervisor" || role === "Trade" || role === "Admin" || role === "CEO")) return true;
            if (item.href.startsWith("/trade") && (role === "Trade" || role === "Admin" || role === "Supervisor" || role === "CEO")) return true;
            // Treinamento e manuais são públicos por padrão
            if (item.href.startsWith("/treinamento")) return true;
            // Módulos da Plataforma Comercial e Governança (visíveis por padrão quando não há tabela de permissões customizada)
            if (item.href.startsWith("/inovacoes") || item.href.startsWith("/inteligencia") || item.href.startsWith("/forecast") || item.href.startsWith("/simulador") || item.href.startsWith("/assistente") || item.href.startsWith("/health")) return true;
          }
          
          return false;
        })
      };
    }).filter(group => group.items.length > 0);
  }, [role, allowedModuleNames, hasConfigInDb, isSuperAdmin]);

  // Flat list of allowed items for quick lookup
  const flatAllowedItems = useMemo(() => {
    return filteredModules.flatMap(g => g.items);
  }, [filteredModules]);

  // Handle favorite toggling with optimistic update
  const handleToggleFavorite = async (moduleKey: string) => {
    const isCurrentlyFavorited = favorites.includes(moduleKey);
    let updatedFavorites: string[];

    if (isCurrentlyFavorited) {
      updatedFavorites = favorites.filter(key => key !== moduleKey);
    } else {
      updatedFavorites = [...favorites, moduleKey];
    }
    setFavorites(updatedFavorites);

    // Call Server Action in background
    const result = await toggleFavoriteAction(moduleKey);
    if (!result || !result.success) {
      console.error("Failed to toggle favorite:", result?.error);
      // Revert on failure
      setFavorites(favorites);
    }
  };

  // Handle favorite manual reordering (Drag & Drop) with optimistic update and rollback
  const handleReorderFavorites = async (newOrderKeys: string[]) => {
    const previousFavorites = [...favorites];
    
    // 1. Optimistic update
    setFavorites(newOrderKeys);

    // 2. Call Server Action to persist new order
    const result = await updateFavoriteOrderAction(newOrderKeys);
    if (!result || !result.success) {
      console.error("Failed to update favorites order:", result?.error);
      // Rollback on failure
      setFavorites(previousFavorites);
    }
  };

  // Build items for the "Favoritos" group
  const favoriteItems = useMemo(() => {
    return favorites
      .map(key => {
        const item = flatAllowedItems.find(x => x.key === key);
        if (!item) return null;
        
        const Icon = item.icon;
        return {
          ...item,
          iconNode: <Icon className="w-3 h-3 text-white" />
        };
      })
      .filter((item): item is any => !!item);
  }, [favorites, flatAllowedItems]);

  // Map remaining groups to inject iconNode dynamically
  const mappedGroups = useMemo(() => {
    return filteredModules.map(group => ({
      ...group,
      items: group.items.map(item => {
        const Icon = item.icon;
        return {
          ...item,
          iconNode: <Icon className="w-3 h-3 text-white" />
        };
      })
    }));
  }, [filteredModules]);

  return (
    <div className="space-y-8">
      {/* Favoritos Section - Rendered dynamically at the top */}
      {favoriteItems.length > 0 && (
        <div className="border-b border-border/40 pb-6 mb-2">
          <ModuleGroup
            group={{
              category: "Favoritos",
              items: favoriteItems
            }}
            favoritedKeys={favorites}
            onToggleFavorite={handleToggleFavorite}
            onReorderFavorites={handleReorderFavorites}
          />
        </div>
      )}

      {/* Main Categories Section */}
      {mappedGroups.length > 0 ? (
        mappedGroups.map((group) => (
          <ModuleGroup
            key={group.category}
            group={group}
            favoritedKeys={favorites}
            onToggleFavorite={handleToggleFavorite}
          />
        ))
      ) : (
        <div className="text-center py-16 px-4 rounded-2xl bg-card border border-border/80 shadow-lg max-w-md mx-auto my-12 animate-fade-in">
          <h3 className="text-lg font-bold font-display text-foreground">Sem Acesso</h3>
          <p className="text-muted mt-2 text-xs leading-relaxed">
            Seu perfil atual ({role}) não possui permissões configuradas para nenhum módulo no sistema. 
            Entre em contato com o suporte ou administrador.
          </p>
        </div>
      )}
    </div>
  );
}
