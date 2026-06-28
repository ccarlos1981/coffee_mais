"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Trophy, 
  Target, 
  Award, 
  TrendingUp, 
  Users, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Sparkles, 
  ShieldAlert, 
  Crown,
  Gift
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";

interface Challenge {
  id: string;
  title: string;
  description: string;
  target: string;
  current: string;
  progress: number;
  reward: string;
  endDate: string;
  status: "active" | "completed" | "failed";
  type: "positivacao" | "mix" | "vendas" | "presenca";
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  supervisor: string;
  points: number;
  achievements: number;
  isCurrentUser?: boolean;
}

export default function DesafioPromotorPage() {
  const [activeTab, setActiveTab] = useState<"challenges" | "leaderboard">("challenges");

  // Mock data for challenges
  const challenges: Challenge[] = [
    {
      id: "ch-1",
      title: "Positivação de Ouro",
      description: "Mantenha o índice de positivação dos PDVs da sua rota acima de 95% este mês.",
      target: "95% de positivação",
      current: "92% de positivação",
      progress: 96.8,
      reward: "Bônus de R$ 350,00",
      endDate: "30/06/2026",
      status: "active",
      type: "positivacao"
    },
    {
      id: "ch-2",
      title: "Mix Perfeito Coffee++",
      description: "Garanta a presença de pelo menos 5 SKUs diferentes em todos os PDVs atendidos.",
      target: "5 SKUs médios por PDV",
      current: "4.2 SKUs médios",
      progress: 84,
      reward: "Kit Exclusivo Coffee++ (Garrafa Térmica + Caneca)",
      endDate: "15/07/2026",
      status: "active",
      type: "mix"
    },
    {
      id: "ch-3",
      title: "Fidelidade e Pontualidade",
      description: "Registre todas as batidas de ponto no raio do PDV (geofencing) sem atrasos no mês.",
      target: "100% de batidas válidas",
      current: "100% (22 de 22 batidas)",
      progress: 100,
      reward: "Folga Compensatória (1 dia)",
      endDate: "30/06/2026",
      status: "completed",
      type: "presenca"
    },
    {
      id: "ch-4",
      title: "Recorde de Vendas Extra",
      description: "Exceder a meta de faturamento de sell-out nos PDVs da sua rota em 10%.",
      target: "110% da meta de vendas",
      current: "95% da meta",
      progress: 86.3,
      reward: "Bônus de R$ 500,00",
      endDate: "30/06/2026",
      status: "active",
      type: "vendas"
    }
  ];

  // Mock data for leaderboard
  const leaderboard: LeaderboardEntry[] = [
    { rank: 1, name: "Ana Paula Mendes (3006)", supervisor: "Marcos Souza", points: 2450, achievements: 6 },
    { rank: 2, name: "Bruno Gomes (3007)", supervisor: "Fernanda Costa", points: 2310, achievements: 5 },
    { rank: 3, name: "Cristiano Santos (0100)", supervisor: "Marcos Souza", points: 2200, achievements: 5, isCurrentUser: true },
    { rank: 4, name: "Mariana Costa (3008)", supervisor: "Fernanda Costa", points: 2050, achievements: 4 },
    { rank: 5, name: "Pedro Oliveira (3009)", supervisor: "Marcos Souza", points: 1980, achievements: 4 },
    { rank: 6, name: "Juliana Santos (3010)", supervisor: "Fernanda Costa", points: 1850, achievements: 3 },
    { rank: 7, name: "Rodrigo Almeida (3011)", supervisor: "Marcos Souza", points: 1720, achievements: 3 }
  ];

  const getStatusBadge = (status: Challenge["status"]) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <CheckCircle2 className="w-3 h-3" /> Concluído
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-red-500/10 text-red-500 border border-red-500/20 px-2 py-0.5 rounded-full">
            <ShieldAlert className="w-3 h-3" /> Encerrado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase bg-gold/10 text-gold border border-gold/20 px-2 py-0.5 rounded-full animate-pulse">
            <Clock className="w-3 h-3" /> Em Andamento
          </span>
        );
    }
  };

  const getChallengeIcon = (type: Challenge["type"]) => {
    switch (type) {
      case "positivacao":
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case "mix":
        return <Award className="w-5 h-5 text-indigo-500" />;
      case "vendas":
        return <TrendingUp className="w-5 h-5 text-blue-500" />;
      default:
        return <Calendar className="w-5 h-5 text-amber-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col font-sans transition-colors duration-300">
      {/* Decorative noise grain overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Rich radial background glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] rounded-full bg-gold/5 blur-[120px] pointer-events-none -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute bottom-10 right-10 w-[500px] h-[500px] rounded-full bg-amber-600/3 blur-[120px] pointer-events-none translate-x-1/3 translate-y-1/3" />

      {/* Header */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/"
              className="flex items-center justify-center w-9 h-9 rounded-xl border border-border bg-card/40 hover:bg-neutral-500/10 transition-all text-neutral-400 hover:text-foreground"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-gold animate-bounce" />
                <h1 className="text-lg font-black tracking-tight text-foreground">
                  Desafios e Campanhas
                </h1>
              </div>
              <p className="text-[10px] text-muted uppercase tracking-wider font-semibold">
                Módulo Promotor de Campo
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8 w-full flex-grow relative z-10">
        
        {/* Top Summary Widget */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* Card 1 */}
          <div className="p-4 rounded-2xl glass-card border border-border shadow-sm flex items-center justify-between bg-card/30">
            <div className="space-y-1">
              <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Sua Pontuação</span>
              <h3 className="text-2xl font-black text-foreground flex items-center gap-1.5">
                2.200 <span className="text-xs text-gold font-medium">pts</span>
              </h3>
              <p className="text-[10px] text-muted">Próximo nível em 300 pts</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
              <Crown className="w-6 h-6" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-4 rounded-2xl glass-card border border-border shadow-sm flex items-center justify-between bg-card/30">
            <div className="space-y-1">
              <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Desafios Ativos</span>
              <h3 className="text-2xl font-black text-foreground">3 / 4</h3>
              <p className="text-[10px] text-emerald-500 font-medium">1 Concluído este mês</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <Target className="w-6 h-6" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-4 rounded-2xl glass-card border border-border shadow-sm flex items-center justify-between bg-card/30">
            <div className="space-y-1">
              <span className="text-[10px] text-muted uppercase tracking-wider font-bold">Posição no Ranking</span>
              <h3 className="text-2xl font-black text-foreground">3º Lugar</h3>
              <p className="text-[10px] text-muted">Entre 45 promotores</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
              <TrendingUp className="w-6 h-6" />
            </div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-border mb-6">
          <button
            onClick={() => setActiveTab("challenges")}
            className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === "challenges"
                ? "border-gold text-gold"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Trophy className="w-4 h-4" />
            Campanhas Ativas
          </button>
          <button
            onClick={() => setActiveTab("leaderboard")}
            className={`pb-3 px-4 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === "leaderboard"
                ? "border-gold text-gold"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Users className="w-4 h-4" />
            Ranking da Equipe
          </button>
        </div>

        {/* Content Area */}
        {activeTab === "challenges" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {challenges.map((ch) => (
              <div 
                key={ch.id} 
                className={`p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden bg-card/40 ${
                  ch.status === "completed"
                    ? "border-emerald-500/30 shadow-md shadow-emerald-500/5"
                    : "border-border hover:border-gold/30 shadow-sm"
                }`}
              >
                {/* Accent Background Orb */}
                <div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none ${
                  ch.status === "completed" ? "bg-emerald-500" : "bg-gold"
                }`} />

                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${
                      ch.status === "completed" 
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                        : "bg-neutral-900 border-border"
                    }`}>
                      {getChallengeIcon(ch.type)}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{ch.title}</h4>
                      <p className="text-[10px] text-muted flex items-center gap-1 mt-0.5">
                        <Calendar className="w-3.5 h-3.5" /> Expira em {ch.endDate}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(ch.status)}
                </div>

                <p className="text-xs text-muted mb-4 leading-relaxed">
                  {ch.description}
                </p>

                {/* Progress bar */}
                <div className="space-y-1.5 mb-4">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-muted">Progresso</span>
                    <span className={ch.status === "completed" ? "text-emerald-500" : "text-foreground"}>
                      {ch.progress}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-neutral-900 border border-border/40 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        ch.status === "completed" 
                          ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" 
                          : "bg-gradient-to-r from-amber-500 to-gold"
                      }`}
                      style={{ width: `${ch.progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-muted">
                    <span>Atual: {ch.current}</span>
                    <span>Meta: {ch.target}</span>
                  </div>
                </div>

                {/* Reward section */}
                <div className={`p-3 rounded-xl border flex items-center gap-3 bg-neutral-900/50 ${
                  ch.status === "completed" ? "border-emerald-500/20" : "border-border/60"
                }`}>
                  <Gift className={`w-5 h-5 shrink-0 ${ch.status === "completed" ? "text-emerald-500" : "text-gold"}`} />
                  <div>
                    <span className="text-[8px] text-muted uppercase tracking-wider font-extrabold block">Recompensa</span>
                    <span className="text-xs font-bold text-foreground">{ch.reward}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-card/20 overflow-hidden shadow-sm">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-neutral-900/60 border-b border-border/80 text-muted font-bold">
                  <th className="p-4 w-16 text-center">Posição</th>
                  <th className="p-4">Promotor</th>
                  <th className="p-4">Supervisor</th>
                  <th className="p-4 text-center">Desafios Concluídos</th>
                  <th className="p-4 text-right pr-6">Pontos Acumulados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {leaderboard.map((row) => (
                  <tr 
                    key={row.rank} 
                    className={`transition-colors duration-150 hover:bg-neutral-500/5 ${
                      row.isCurrentUser ? "bg-gold/5 font-semibold" : ""
                    }`}
                  >
                    <td className="p-4 text-center font-bold">
                      {row.rank === 1 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gold/15 text-gold border border-gold/20 shadow-sm" title="1º Lugar">
                          <Crown className="w-3.5 h-3.5" />
                        </span>
                      ) : row.rank === 2 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-300/15 text-slate-300 border border-slate-300/20" title="2º Lugar">
                          2
                        </span>
                      ) : row.rank === 3 ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-700/15 text-amber-700 border border-amber-700/20" title="3º Lugar">
                          3
                        </span>
                      ) : (
                        row.rank
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span>{row.name}</span>
                        {row.isCurrentUser && (
                          <span className="bg-gold/10 text-gold border border-gold/25 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                            Você
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-muted">{row.supervisor}</td>
                    <td className="p-4 text-center font-medium">{row.achievements}</td>
                    <td className="p-4 text-right pr-6 font-bold text-foreground">
                      {row.points.toLocaleString("pt-BR")} <span className="text-[10px] text-muted font-normal">pts</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Helpful Info Section */}
        <div className="mt-8 p-4 rounded-2xl border border-gold/10 bg-gold/5 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-foreground">Como funcionam as campanhas?</h4>
            <p className="text-[11px] text-muted leading-relaxed">
              Os desafios são lançados mensalmente pelo time de Trade e Supervisão. 
              Ao bater as metas propostas, os pontos são creditados automaticamente na sua carteira digital, 
              dando direito a resgatar prêmios físicos ou bônus direto em sua folha de pagamento.
            </p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center text-[10px] text-muted z-10 mt-auto">
        &copy; {new Date().getFullYear()} Coffee Mais S.A. Todos os direitos reservados.
      </footer>
    </div>
  );
}
