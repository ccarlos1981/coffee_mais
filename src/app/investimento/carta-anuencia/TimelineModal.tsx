"use client";

import React, { useEffect, useState } from "react";
import { X, History, Clock, Send, Download, FileText, CheckCircle2, AlertCircle, Share2, Mail, MessageSquare, Link2, Loader2 } from "lucide-react";
import { CartaAnuenciaItem, TimelineItem, obterTimelineCarta } from "./actions";

interface TimelineModalProps {
  carta: CartaAnuenciaItem | null;
  onClose: () => void;
}

export function TimelineModal({ carta, onClose }: TimelineModalProps) {
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!carta) return;
    const cartaId = carta.id;
    async function load() {
      setLoading(true);
      try {
        const data = await obterTimelineCarta(cartaId);
        setTimeline(data);
      } catch (err) {
        console.error("Erro ao obter timeline:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [carta]);

  if (!carta) return null;

  const getEventIcon = (evento: string, canal?: string | null) => {
    if (evento === "CRIADA") return <FileText className="w-4 h-4 text-sky-500" />;
    if (evento === "UPLOAD_ASSINADA") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    if (evento === "CANCELADA") return <AlertCircle className="w-4 h-4 text-rose-500" />;
    if (evento === "DOWNLOAD") return <Download className="w-4 h-4 text-indigo-500" />;
    if (evento === "COMPARTILHADA") {
      if (canal === "WHATSAPP") return <MessageSquare className="w-4 h-4 text-emerald-500" />;
      if (canal === "EMAIL") return <Mail className="w-4 h-4 text-sky-500" />;
      if (canal === "LINK") return <Link2 className="w-4 h-4 text-amber-500" />;
      return <Share2 className="w-4 h-4 text-purple-500" />;
    }
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/60">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Linha do Tempo e Rastreabilidade
              </h2>
              <p className="text-xs text-muted-foreground">
                {carta.numero_carta} (v{carta.versao}) — {carta.rede_nome}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {loading ? (
            <div className="p-8 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Carregando histórico...</p>
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhum evento registrado ainda para esta carta.
            </p>
          ) : (
            <div className="relative pl-6 border-l-2 border-border space-y-6">
              {timeline.map((item) => {
                const dataFmt = new Date(item.created_at).toLocaleString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div key={item.id} className="relative group">
                    {/* Icon Bullet */}
                    <div className="absolute -left-[31px] top-0 p-1.5 rounded-full bg-background border border-border shadow-sm">
                      {getEventIcon(item.evento, item.canal)}
                    </div>

                    {/* Event Box */}
                    <div className="bg-card border border-border rounded-xl p-3 shadow-sm hover:border-primary/30 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                          {item.evento} {item.canal ? `(${item.canal})` : ""}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {dataFmt}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        Responsável: <strong className="text-foreground font-medium">{item.usuario_nome || "Sistema"}</strong>
                      </p>

                      {item.detalhes && Object.keys(item.detalhes).length > 0 && (
                        <div className="mt-2 text-[11px] bg-muted/40 p-2 rounded-lg font-mono text-muted-foreground overflow-x-auto">
                          {JSON.stringify(item.detalhes, null, 2)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-3 border-t border-border bg-card/40">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            Fechar
          </button>
        </div>

      </div>
    </div>
  );
}
