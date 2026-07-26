"use client";

import React, { useState } from "react";
import { X, Download, Share2, Printer, CheckCircle2, ShieldCheck, Mail, Send, Copy, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { CartaAnuenciaItem, registrarCompartilhamento } from "./actions";
import { getStoragePublicUrl } from "@/lib/storage-helpers";

interface CartaPreviewModalProps {
  carta: CartaAnuenciaItem | null;
  onClose: () => void;
}

export function CartaPreviewModal({ carta, onClose }: CartaPreviewModalProps) {
  const [sharing, setSharing] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);

  if (!carta) return null;

  const logoRedePublicUrl = getStoragePublicUrl(carta.logo_snapshot_path || carta.logo_rede_url, "logos-redes");

  const dataEmissaoFmt = new Date(carta.data_emissao).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const dataValidadeFmt = carta.valida_ate
    ? new Date(carta.valida_ate).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "Sem data limite de expiração";

  const handlePrint = async () => {
    await registrarCompartilhamento(carta.id, "DOWNLOAD", { detalhe: "Impressão A4 disparada" });
    window.print();
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/investimento/carta-anuencia?busca=${carta.numero_carta}`;
    await navigator.clipboard.writeText(link);
    await registrarCompartilhamento(carta.id, "LINK", { url: link });
    toast.success("Link da Carta de Anuência copiado para a área de transferência!");
  };

  const handleShareWhatsApp = async () => {
    const texto = `Prezados,\n\nSegue a Carta de Anuência e Termo de Quitação Financeira N° ${carta.numero_carta} (Versão v${carta.versao}) emitida pela Coffee Mais para a rede ${carta.rede_nome} referente à competência ${carta.competencia}.\n\nAcesse no sistema Coffee++: ${window.location.origin}/investimento/carta-anuencia?busca=${carta.numero_carta}`;
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
    await registrarCompartilhamento(carta.id, "WHATSAPP", { texto });
    window.open(url, "_blank");
  };

  const handleShareEmail = async () => {
    const assunto = `Carta de Anuência N° ${carta.numero_carta} — Coffee++ / ${carta.rede_nome}`;
    const corpo = `Prezados,\n\nConfirmamos a emissão do Termo de Quitação Financeira e Carta de Anuência N° ${carta.numero_carta} para a competência ${carta.competencia}.\n\nRede: ${carta.rede_nome}\nCNPJ: ${carta.cnpj || "N/A"}\nValidade: ${dataValidadeFmt}\n\nAtenciosamente,\nEquipe Coffee Mais`;
    const mailto = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    await registrarCompartilhamento(carta.id, "EMAIL", { assunto });
    window.location.href = mailto;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Toolbar (Não sai na impressão) */}
        <div className="print:hidden relative z-50 flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                {carta.numero_carta}
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary border border-primary/20">
                  v{carta.versao}
                </span>
                {carta.expirada && (
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Expirada
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Documento Oficial de Quitação — Competência: {carta.competencia}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-secondary hover:bg-secondary/80 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir / PDF
            </button>

            <div className="relative">
              <button
                onClick={() => setShowShareOptions(!showShareOptions)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                Compartilhar
              </button>

              {showShareOptions && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border rounded-xl shadow-2xl p-1.5 z-[100] animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => {
                      setShowShareOptions(false);
                      handleShareWhatsApp();
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted rounded-lg flex items-center gap-2 text-emerald-600 font-medium transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Enviar WhatsApp
                  </button>
                  <button
                    onClick={() => {
                      setShowShareOptions(false);
                      handleShareEmail();
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted rounded-lg flex items-center gap-2 text-sky-600 font-medium transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Enviar E-mail
                  </button>
                  <button
                    onClick={() => {
                      setShowShareOptions(false);
                      handleCopyLink();
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted rounded-lg flex items-center gap-2 text-foreground font-medium transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copiar Link
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Visualização A4 da Carta */}
        <div className="relative z-0 flex-1 overflow-y-auto p-8 bg-neutral-100 dark:bg-neutral-900/60 flex justify-center rounded-b-2xl">
          <div className="w-[210mm] min-h-[297mm] bg-white text-neutral-900 shadow-2xl p-12 flex flex-col justify-between border border-neutral-200 rounded-sm relative font-sans text-sm leading-relaxed">
            
            {/* Marca d'água institucional */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
              <span className="text-[120px] font-black tracking-tighter text-neutral-900 uppercase rotate-[-25deg]">
                COFFEE++
              </span>
            </div>

            {/* Cabeçalho A4: Logos e Numeração Oficial */}
            <div>
              <div className="flex items-center justify-between border-b-2 border-amber-600 pb-6 mb-8">
                {/* Logo Coffee Mais Oficial */}
                <div className="flex items-center gap-3">
                  <div className="h-20 w-44 relative overflow-hidden rounded-xl shadow-lg border border-neutral-800 bg-[#1e1e1e] flex items-center justify-center p-1 hover:scale-105 transition-transform">
                    <img
                      src="/images/logo_coffee_mais_official.svg"
                      alt="Coffee ++ Cafés Especiais"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div>
                    <h1 className="font-extrabold text-xs text-neutral-900 tracking-tight uppercase">
                      Indústria e Comércio de Café Ltda
                    </h1>
                    <p className="text-[10px] text-neutral-500 font-semibold tracking-wider">
                      CNPJ: 34.656.969/0001-30
                    </p>
                  </div>
                </div>

                {/* Número Oficial & Status */}
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold rounded-md font-mono">
                    {carta.numero_carta} (v{carta.versao})
                  </span>
                  <p className="text-[11px] text-neutral-500 mt-1">
                    Emissão: {dataEmissaoFmt}
                  </p>
                </div>

                {/* Logo Snapshot da Rede (Resoluida Dinamicamente) */}
                <div className="w-24 h-16 border border-neutral-200 rounded-lg p-2 flex items-center justify-center bg-neutral-50">
                  {logoRedePublicUrl ? (
                    <img
                      src={logoRedePublicUrl}
                      alt={carta.rede_nome}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-[11px] font-bold text-neutral-400 text-center">
                      {carta.rede_nome}
                    </span>
                  )}
                </div>
              </div>

              {/* Título Principal */}
              <div className="text-center my-8">
                <h2 className="text-xl font-extrabold text-neutral-900 uppercase tracking-wide border-b border-neutral-200 inline-block pb-1">
                  TERMO DE QUITAÇÃO FINANCEIRA E CARTA DE ANUÊNCIA
                </h2>
                <p className="text-xs text-neutral-500 font-medium mt-1">
                  DECLARAÇÃO OFICIAL DE INEXISTÊNCIA DE PENDÊNCIAS COMERCIAIS
                </p>
              </div>

              {/* Corpo Oficial do Documento */}
              <div className="space-y-6 text-neutral-800 text-justify text-sm leading-relaxed px-4">
                <p>
                  Declaramos para os devidos fins de direito e a quem possa interessar que a empresa{" "}
                  <strong className="font-bold text-neutral-900">COFFEE MAIS INDÚSTRIA E COMÉRCIO DE CAFÉ LTDA</strong>,
                  concede à empresa parceira <strong className="font-bold text-neutral-900">{carta.rede_nome.toUpperCase()}</strong>
                  {carta.cnpj ? `, inscrita no CNPJ/MF sob o nº ${carta.cnpj}` : ""}, a presente{" "}
                  <strong className="font-bold text-amber-800">CARTA DE ANUÊNCIA E QUITAÇÃO PLENA, GERAL E IRREVOGÁVEL</strong>.
                </p>

                <p>
                  Atestamos expressamente que, até a competência de{" "}
                  <strong className="font-bold text-neutral-900 uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-200">{carta.competencia}</strong>,
                  não existem quaisquer pendências financeiras, débitos vencidos ou vincendos, verbas contratuais,
                  bonificações pendentes de ressarcimento ou divergências comerciais entre as partes.
                </p>

                {carta.observacoes && (
                  <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg text-xs italic text-neutral-700">
                    <strong>Observações Adicionais:</strong> {carta.observacoes}
                  </div>
                )}

                <p>
                  Por ser expressão da verdade, firmamos o presente instrumento legal para que produza os seus regulares e jurídicos efeitos.
                </p>

                <div className="pt-4 text-right text-xs text-neutral-600 font-medium">
                  Lavras / MG, {dataEmissaoFmt}.
                </div>

                <div className="text-xs text-neutral-500 border-t border-dashed border-neutral-300 pt-3 flex justify-between">
                  <span>Validade deste documento: <strong>{dataValidadeFmt}</strong></span>
                  <span>Status: <strong className="uppercase">{carta.status}</strong></span>
                </div>
              </div>
            </div>

            {/* Rodapé: Blocos de Assinatura & QR Code de Autenticidade */}
            <div className="mt-12 pt-8 border-t border-neutral-200">
              <div className="grid grid-cols-2 gap-12 text-center mb-8">
                {/* Assinatura Coffee Mais */}
                <div className="flex flex-col items-center">
                  <div className="h-16 flex items-end justify-center pb-2 w-full border-b border-neutral-400">
                    <span className="font-serif italic text-base font-bold text-amber-900">
                      Coffee Mais — Diretoria Comercial
                    </span>
                  </div>
                  <span className="text-xs font-bold text-neutral-900 mt-2">
                    COFFEE MAIS INDÚSTRIA DE CAFÉ
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    Emitido por: {carta.usuario_emissao_nome || "Representante Autorizado"}
                  </span>
                </div>

                {/* Assinatura Rede */}
                <div className="flex flex-col items-center">
                  <div className="h-16 flex items-end justify-center pb-2 w-full border-b border-neutral-400">
                    {carta.arquivo_assinado_url ? (
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> Assinado Digitalmente
                      </span>
                    ) : (
                      <span className="text-[11px] text-neutral-400 italic">
                        Espaço reservado para Assinatura e Carimbo da Rede
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-bold text-neutral-900 mt-2">
                    {carta.rede_nome.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-neutral-500">
                    {carta.cnpj ? `CNPJ: ${carta.cnpj}` : "Representante Legal"}
                  </span>
                </div>
              </div>

              {/* QR Code de Validação de Autenticidade */}
              <div className="flex items-center justify-between bg-neutral-50 p-4 border border-neutral-200 rounded-xl text-[10px] text-neutral-500">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-neutral-900 p-1 rounded flex flex-wrap gap-0.5 items-center justify-center shrink-0">
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                    <div className="w-4 h-4 bg-amber-500 rounded-sm"></div>
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                    <div className="w-4 h-4 bg-white rounded-sm"></div>
                  </div>
                  <div>
                    <p className="font-bold text-neutral-800 text-xs">
                      Autenticidade Verificada por QR Code
                    </p>
                    <p>
                      Hash: <code className="font-mono text-[9px] text-neutral-600">{carta.qr_code_hash || carta.numero_carta}</code>
                    </p>
                    <p>
                      Validação oficial via portal corporativo Coffee++
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono text-[9px] text-neutral-400">
                  REF: {carta.id.substring(0, 8)} | SISTEMA COFFEE++ V1
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
