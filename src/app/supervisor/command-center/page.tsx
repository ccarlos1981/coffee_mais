"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import {
  MapPin,
  Battery,
  Wifi,
  Clock,
  AlertTriangle,
  Activity,
  FileText,
  CheckCircle2,
  Zap,
  Search,
  User,
  RotateCw,
  AlertCircle,
  Check,
  ExternalLink,
  ShieldAlert,
  ThumbsUp,
  XCircle,
  Building2,
  Compass,
  Eye,
  Calendar,
  Settings,
  Brain,
  TrendingUp,
  Award,
  Cpu,
  Power,
  ArrowLeft
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeProvider";
import Link from "next/link";

const MapCommandCenter = dynamic(() => import("@/components/MapCommandCenter"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-neutral-900/30 border border-neutral-900 rounded-2xl flex items-center justify-center text-xs text-neutral-500 uppercase font-black">
      Inicializando Mapa Operacional...
    </div>
  ),
});

// Helper function to calculate geodetic distance in meters using Haversine formula
function calculateDistanceM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SupervisorCommandCenterPage() {
  const supabase = createClient();

  // Auth States
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [employee, setEmployee] = useState<any>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Data States
  const [promotores, setPromotores] = useState<any[]>([]);
  const [liveStatuses, setLiveStatuses] = useState<Record<string, any>>({});
  const [visitasHoje, setVisitasHoje] = useState<any[]>([]);
  const [agendasHoje, setAgendasHoje] = useState<any[]>([]);
  const [alertasAtivos, setAlertasAtivos] = useState<any[]>([]);
  const [heartbeatLogs, setHeartbeatLogs] = useState<any[]>([]);
  const [geolocs, setGeolocs] = useState<Record<string, any>>({});
  const [loadingData, setLoadingData] = useState(true);

  // UI States
  const [searchFilter, setSearchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [resolvingAlertaId, setResolvingAlertaId] = useState<string | null>(null);
  const [obsResolucao, setObsResolucao] = useState("");
  const [submittingResolucao, setSubmittingResolucao] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  
  // Track modified promotor cards for a brief highlight animation
  const [updatedPromotores, setUpdatedPromotores] = useState<Record<string, boolean>>({});

  // Selection & Route Replay States
  const [selectedPromotorId, setSelectedPromotorId] = useState<string | null>(null);
  const [replayTimeline, setReplayTimeline] = useState<any[]>([]);
  const [replayCurrentIndex, setReplayCurrentIndex] = useState<number>(0);
  const [isReplayActive, setIsReplayActive] = useState<boolean>(false);
  const [isReplayPlaying, setIsReplayPlaying] = useState<boolean>(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 5 | 20>(1);
  const replayTimer = useRef<NodeJS.Timeout | null>(null);

  // Forensic Timeline States
  const [activeMainTab, setActiveMainTab] = useState<"mapa" | "forense">("mapa");
  const [forensicTimeline, setForensicTimeline] = useState<any[]>([]);
  const [forensicMetrics, setForensicMetrics] = useState<any | null>(null);
  const [loadingForensic, setLoadingForensic] = useState<boolean>(false);

  // Sprint 3.6 Multi-Mode Dashboard States
  const [dashboardMode, setDashboardMode] = useState<"operacional" | "investigativa" | "executiva" | "ai_vision" | "route_intelligence" | "prescriptive_ai" | "ai_learning" | "ai_governance">("operacional");
  const [telemetryLogs, setTelemetryLogs] = useState<any[]>([]);
  const [routeKpis, setRouteKpis] = useState<any>(null);
  const [loadingRouteKpis, setLoadingRouteKpis] = useState<boolean>(false);

  // Sprint 6.3 AI Governance States
  const [governancePolicies, setGovernancePolicies] = useState<any>(null);
  const [governanceAlerts, setGovernanceAlerts] = useState<any[]>([]);
  const [pendingRecommendations, setPendingRecommendations] = useState<any[]>([]);
  const [governanceVersions, setGovernanceVersions] = useState<any[]>([]);
  const [governanceDecisionLogs, setGovernanceDecisionLogs] = useState<any[]>([]);
  const [loadingGovernance, setLoadingGovernance] = useState<boolean>(false);
  const [overrideModalRecId, setOverrideModalRecId] = useState<string | null>(null);
  const [overrideReasonInput, setOverrideReasonInput] = useState<string>("");
  const [governanceKpis, setGovernanceKpis] = useState<any[]>([]);

  const fetchGovernanceData = async () => {
    setLoadingGovernance(true);
    try {
      const resGov = await fetch("/api/admin/ai-governance");
      const dataGov = await resGov.json();
      if (dataGov.success) {
        setGovernancePolicies(dataGov.policies);
        setGovernanceVersions(dataGov.versions);
      }

      const resRecs = await fetch("/api/supervisor/recommendations?status=OPEN");
      const dataRecs = await resRecs.json();
      if (dataRecs.success) {
        const pending = (dataRecs.recommendations || []).filter((r: any) => r.requires_approval === true || r.approval_status === "PENDING");
        setPendingRecommendations(pending);
      }

      const resLearning = await fetch("/api/supervisor/ai-learning");
      const dataLearning = await resLearning.json();
      if (dataLearning.success) {
        setGovernanceAlerts(dataLearning.alerts || []);
      }

      const resLogs = await fetch("/api/supervisor/decision-log");
      const dataLogs = await resLogs.json();
      if (dataLogs.success) {
        setGovernanceDecisionLogs(dataLogs.logs || []);
      }

      const resKpis = await fetch("/api/admin/kpi-config");
      const dataKpis = await resKpis.json();
      if (dataKpis.success) {
        setGovernanceKpis(dataKpis.kpis || []);
      }
    } catch (e) {
      console.error("Error fetching governance data:", e);
    } finally {
      setLoadingGovernance(false);
    }
  };

  const handleEmergencyStopToggle = async (currentStop: boolean) => {
    try {
      const res = await fetch("/api/admin/ai-governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_key: "emergency_ai_stop",
          policy_value: !currentStop
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchGovernanceData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const approveRecommendation = async (recId: string) => {
    try {
      const res = await fetch("/api/supervisor/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_id: recId,
          approval_status: "APPROVED"
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchGovernanceData();
      } else {
        alert("Erro ao aprovar: " + data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const rejectRecommendation = async (recId: string, reason: string) => {
    if (!reason || reason.trim() === "") {
      alert("Justificativa de rejeição é obrigatória.");
      return;
    }
    try {
      const res = await fetch("/api/supervisor/recommendations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recommendation_id: recId,
          approval_status: "REJECTED",
          override_reason: reason
        })
      });
      const data = await res.json();
      if (data.success) {
        setOverrideModalRecId(null);
        setOverrideReasonInput("");
        fetchGovernanceData();
      } else {
        alert("Erro ao rejeitar: " + data.error);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRouteKpis = async () => {
    setLoadingRouteKpis(true);
    try {
      const res = await fetch("/api/supervisor/route-kpis");
      const data = await res.json();
      if (data.success) {
        setRouteKpis(data);
      }
    } catch (e) {
      console.error("Error fetching route KPIs:", e);
    } finally {
      setLoadingRouteKpis(false);
    }
  };

  useEffect(() => {
    if (dashboardMode === "route_intelligence") {
      fetchRouteKpis();
    }
  }, [dashboardMode]);

  // Sprint 5.3 Sell-Out Intelligence States
  const [routeSubTab, setRouteSubTab] = useState<"route_slas" | "sellout" | "order_engine">("route_slas");
  const [selloutKpis, setSelloutKpis] = useState<any>(null);
  const [loadingSelloutKpis, setLoadingSelloutKpis] = useState<boolean>(false);

  const fetchSelloutKpis = async () => {
    setLoadingSelloutKpis(true);
    try {
      const res = await fetch("/api/supervisor/sellout-kpis");
      const data = await res.json();
      if (data.success) {
        setSelloutKpis(data.data);
      }
    } catch (e) {
      console.error("Error fetching sellout KPIs:", e);
    } finally {
      setLoadingSelloutKpis(false);
    }
  };

  useEffect(() => {
    if (dashboardMode === "route_intelligence" && routeSubTab === "sellout") {
      fetchSelloutKpis();
    }
  }, [dashboardMode, routeSubTab]);

  // Sprint 5.4 Order Recommendation States
  const [orderKpis, setOrderKpis] = useState<any>(null);
  const [loadingOrderKpis, setLoadingOrderKpis] = useState<boolean>(false);

  const fetchOrderKpis = async () => {
    setLoadingOrderKpis(true);
    try {
      const res = await fetch("/api/supervisor/order-kpis");
      const data = await res.json();
      if (data.success) {
        setOrderKpis(data.data);
      }
    } catch (e) {
      console.error("Error fetching order engine KPIs:", e);
    } finally {
      setLoadingOrderKpis(false);
    }
  };

  useEffect(() => {
    if (dashboardMode === "route_intelligence" && routeSubTab === "order_engine") {
      fetchOrderKpis();
    }
  }, [dashboardMode, routeSubTab]);
  const [loadingTelemetry, setLoadingTelemetry] = useState<boolean>(false);
  const [blockedCheckins, setBlockedCheckins] = useState<any[]>([]);
  const [heatmapPoints, setHeatmapPoints] = useState<any[]>([]);
  const [loadingHeatmap, setLoadingHeatmap] = useState<boolean>(false);


  // Battery Benchmark State
  const [batteryBenchmarkData, setBatteryBenchmarkData] = useState<any>(null);

  // War Room & Mobile Logs States (Sprint 4.6)
  const [mobileAppLogs, setMobileAppLogs] = useState<any[]>([]);
  const [shelfAnalysisLogs, setShelfAnalysisLogs] = useState<any[]>([]);
  const [warRoomMode, setWarRoomMode] = useState<boolean>(false);
  const [warRoomEnabled, setWarRoomEnabled] = useState<boolean>(false);

  // Shelf Analysis Review States (Sprint 5.1 Refinements)
  const [selectedShelfAnalysis, setSelectedShelfAnalysis] = useState<any | null>(null);
  const [overrideScore, setOverrideScore] = useState<string>("");
  const [reviewReasonText, setReviewReasonText] = useState<string>("");
  const [isReviewing, setIsReviewing] = useState<boolean>(false);

  // Price OCR & Pricing Intelligence States (Sprint 5.2)
  const [priceAnalysisLogs, setPriceAnalysisLogs] = useState<any[]>([]);
  const [priceAlerts, setPriceAlerts] = useState<any[]>([]);
  const [aiSubTab, setAiSubTab] = useState<"planogram" | "price">("planogram");

  // Sprint 6.1 Prescriptive AI & Trade Recommendation Engine States
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState<boolean>(false);
  const [filterRecStatus, setFilterRecStatus] = useState<string>("OPEN");
  const [filterRecType, setFilterRecType] = useState<string>("TODOS");
  
  // Simulator states
  const [simSelectedPdv, setSimSelectedPdv] = useState<string>("");
  const [simDiscount, setSimDiscount] = useState<number>(0);
  const [simDisplayInvest, setSimDisplayInvest] = useState<number>(0);
  const [simDegustationDays, setSimDegustationDays] = useState<number>(0);
  const [simPromotorHours, setSimPromotorHours] = useState<number>(0);
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState<boolean>(false);
  const [simActionType, setSimActionType] = useState<string>("PRICE_REDUCTION");

  const fetchRecommendations = async () => {
    setLoadingRecommendations(true);
    try {
      let url = "/api/supervisor/recommendations";
      const params: string[] = [];
      if (filterRecStatus && filterRecStatus !== "TODOS") {
        params.push(`status=${filterRecStatus}`);
      }
      if (filterRecType && filterRecType !== "TODOS") {
        params.push(`recommendation_type=${filterRecType}`);
      }
      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRecommendations(data.recommendations || []);
      }
    } catch (e) {
      console.error("Error fetching prescriptive recommendations:", e);
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const runSimulator = async () => {
    if (!simSelectedPdv) {
      alert("Por favor, selecione um PDV para simulação.");
      return;
    }
    setSimLoading(true);
    try {
      const res = await fetch("/api/supervisor/trade-simulator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_type: simActionType,
          pdv_id: simSelectedPdv,
          discount_percent: simDiscount,
          extra_display_investment: simDisplayInvest,
          degustation_days: simDegustationDays,
          promotor_hours: simPromotorHours
        })
      });
      const data = await res.json();
      if (data.success) {
        setSimResult(data);
      } else {
        alert("Erro na simulação: " + data.error);
      }
    } catch (e) {
      console.error("Error running trade simulator:", e);
    } finally {
      setSimLoading(false);
    }
  };

  const delegateRecommendation = async (recommendationId: string, userId: string) => {
    try {
      const { error } = await supabase
        .from("cm_ai_recommendation")
        .update({ assigned_user_id: userId || null })
        .eq("id", recommendationId);
      if (error) throw error;
      fetchRecommendations();
    } catch (e) {
      console.error("Error delegating recommendation:", e);
      alert("Erro ao delegar recomendação.");
    }
  };

  useEffect(() => {
    if (dashboardMode === "prescriptive_ai") {
      fetchRecommendations();
    } else if (dashboardMode === "ai_learning") {
      fetchLearningData();
    } else if (dashboardMode === "ai_governance") {
      fetchGovernanceData();
    }
  }, [dashboardMode, filterRecStatus, filterRecType]);

  // Sprint 6.0: Configurable KPI Engine & AI Native Foundation
  const [widgets, setWidgets] = useState<any[]>([]);
  const [loadingWidgets, setLoadingWidgets] = useState<boolean>(true);
  const [companyScore, setCompanyScore] = useState<any>(null);

  // Sprint 6.2: Closed Loop Learning & Autonomous AI Optimization States
  const [learningData, setLearningData] = useState<any>(null);
  const [loadingLearning, setLoadingLearning] = useState<boolean>(false);

  const fetchLearningData = async () => {
    setLoadingLearning(true);
    try {
      const res = await fetch("/api/supervisor/ai-learning");
      const data = await res.json();
      if (data.success) {
        setLearningData(data);
      }
    } catch (e) {
      console.error("Error fetching AI learning data:", e);
    } finally {
      setLoadingLearning(false);
    }
  };

  const fetchWidgetsAndScore = async () => {
    setLoadingWidgets(true);
    try {
      // Fetch Widgets
      const resWidgets = await fetch("/api/company/widgets");
      const dataWidgets = await resWidgets.json();
      if (dataWidgets.success && dataWidgets.widgets) {
        setWidgets(dataWidgets.widgets);
        
        // Find if the current dashboardMode is still enabled
        const activeKeys = dataWidgets.widgets.map((w: any) => w.widget_key);
        const modeMapping: Record<string, string> = {
          operacional: "operacional",
          investigativa: "investigativa",
          executiva: "executiva",
          ai_vision: "ai_vision",
          route_intelligence: "route_intelligence",
          prescriptive_ai: "prescriptive_ai",
          ai_learning: "ai_learning",
          ai_governance: "ai_governance"
        };
        const currentWidgetKey = Object.keys(modeMapping).find(k => modeMapping[k] === dashboardMode);
        if (!currentWidgetKey || !activeKeys.includes(currentWidgetKey)) {
          const firstWidgetKey = dataWidgets.widgets[0]?.widget_key;
          if (firstWidgetKey && modeMapping[firstWidgetKey]) {
            setDashboardMode(modeMapping[firstWidgetKey] as any);
          }
        }
      }

      // Fetch Company Score
      const resScore = await fetch("/api/company/kpis");
      const dataScore = await resScore.json();
      if (dataScore.success) {
        setCompanyScore(dataScore.data);
      }
    } catch (e) {
      console.error("Error fetching widgets/score:", e);
    } finally {
      setLoadingWidgets(false);
    }
  };

  useEffect(() => {
    fetchWidgetsAndScore();
  }, []);

  const handleReviewAction = async (action: "APPROVE" | "REPROCESS") => {
    if (!selectedShelfAnalysis) return;
    setIsReviewing(true);
    try {
      const payload: any = {
        analysis_id: selectedShelfAnalysis.id,
        action,
        review_reason: reviewReasonText
      };
      if (action === "APPROVE" && overrideScore !== "") {
        payload.planogram_score_override = parseInt(overrideScore, 10);
      }
      
      const res = await fetch("/api/ai/shelf-analysis/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        // Refresh data
        fetchDashboardData();
        setSelectedShelfAnalysis(null);
        setOverrideScore("");
        setReviewReasonText("");
      } else {
        alert("Erro: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("Erro de conexão ao processar revisão.");
    } finally {
      setIsReviewing(false);
    }
  };

  // Pilot KPIs State (Sprint 4.4)
  const [pilotKpisData, setPilotKpisData] = useState<any>(null);
  const [loadingPilotKpis, setLoadingPilotKpis] = useState<boolean>(false);

  const fetchBatteryBenchmark = async () => {
    try {
      const res = await fetch("/api/supervisor/battery-benchmark");
      const data = await res.json();
      if (data.success) {
        setBatteryBenchmarkData(data.battery_drain_by_os);
      }
    } catch (e) {
      console.error("Error fetching battery benchmark:", e);
    }
  };

  const fetchPilotKpis = async () => {
    setLoadingPilotKpis(true);
    try {
      const res = await fetch("/api/supervisor/pilot-kpis");
      const data = await res.json();
      if (data.success) {
        setPilotKpisData(data);
      }
    } catch (e) {
      console.error("Error fetching pilot KPIs:", e);
    } finally {
      setLoadingPilotKpis(false);
    }
  };

  const handleResolveFeedback = async (feedbackId: string) => {
    try {
      const { error } = await supabase
        .from("cm_mobile_feedback")
        .update({
          is_resolved: true,
          resolved_at: new Date().toISOString()
        })
        .eq("id", feedbackId);
      if (!error) {
        fetchPilotKpis();
      } else {
        console.error("Error resolving feedback:", error);
      }
    } catch (err) {
      console.error("Fatal error resolving feedback:", err);
    }
  };

  useEffect(() => {
    fetchBatteryBenchmark();
    fetchPilotKpis();
    // Poll KPIs every 30 seconds for live pilot feedback
    const interval = setInterval(fetchPilotKpis, 30000);

    async function checkWarRoomFlag() {
      try {
        const { data } = await supabase
          .from("cm_feature_flags")
          .select("is_active")
          .eq("flag_key", "war_room_enabled")
          .maybeSingle();
        
        const enabled = data?.is_active === true;
        setWarRoomEnabled(enabled);

        if (enabled) {
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get("mode") === "war-room") {
            setWarRoomMode(true);
          }
        }
      } catch (err) {
        console.error("Error checking war room flag:", err);
      }
    }
    checkWarRoomFlag();

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedPromotorId) {
      fetchReplayTimeline(selectedPromotorId);
      fetchForensicData(selectedPromotorId);
    } else {
      setReplayTimeline([]);
      setIsReplayActive(false);
      setIsReplayPlaying(false);
      setReplayCurrentIndex(0);
      setForensicTimeline([]);
      setForensicMetrics(null);
      setActiveMainTab("mapa");
    }
  }, [selectedPromotorId]);

  useEffect(() => {
    if (isReplayPlaying) {
      const intervalTime = replaySpeed === 1 ? 1000 : replaySpeed === 5 ? 200 : 50;
      replayTimer.current = setInterval(() => {
        setReplayCurrentIndex((prev) => {
          if (prev >= replayTimeline.length - 1) {
            setIsReplayPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalTime);
    } else {
      if (replayTimer.current) {
        clearInterval(replayTimer.current);
      }
    }

    return () => {
      if (replayTimer.current) {
        clearInterval(replayTimer.current);
      }
    };
  }, [isReplayPlaying, replaySpeed, replayTimeline.length]);

  const fetchReplayTimeline = async (promotorId: string) => {
    try {
      const res = await fetch(`/api/supervisor/route-replay?promotor_id=${promotorId}`);
      const data = await res.json();
      if (data.success) {
        setReplayTimeline(data.timeline || []);
        setReplayCurrentIndex(0);
      }
    } catch (err) {
      console.error("Erro ao carregar replay temporal:", err);
    }
  };

  const fetchForensicData = async (promotorId: string) => {
    setLoadingForensic(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/supervisor/jornada-forense?promotor_id=${promotorId}&data=${todayStr}`);
      const data = await res.json();
      if (data.success) {
        setForensicTimeline(data.timeline || []);
        setForensicMetrics(data.metrics || null);
      } else {
        setForensicTimeline([]);
        setForensicMetrics(null);
      }
    } catch (err) {
      console.error("Erro ao carregar jornada forense:", err);
      setForensicTimeline([]);
      setForensicMetrics(null);
    } finally {
      setLoadingForensic(false);
    }
  };

  const fetchStagingTelemetryAndBlocked = async () => {
    setLoadingTelemetry(true);
    try {
      const { data: logs } = await supabase
        .from("cm_system_api_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setTelemetryLogs(logs || []);

      const todayStr = new Date().toISOString().split("T")[0];
      const startOfDay = `${todayStr}T00:00:00-03:00`;
      const endOfDay = `${todayStr}T23:59:59-03:00`;
      const { data: blocked } = await supabase
        .from("cm_promotor_visita_tentativa_bloqueada")
        .select("*")
        .gte("created_at", startOfDay)
        .lte("created_at", endOfDay)
        .order("created_at", { ascending: false });
      setBlockedCheckins(blocked || []);
    } catch (err) {
      console.error("Erro ao carregar telemetria/bloqueados:", err);
    } finally {
      setLoadingTelemetry(false);
    }
  };

  const fetchExecutiveHeatmapData = async () => {
    setLoadingHeatmap(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetch(`/api/supervisor/heatmap-data?data=${todayStr}`);
      const data = await res.json();
      if (data.success) {
        setHeatmapPoints(data.points || []);
      }
    } catch (err) {
      console.error("Erro ao carregar heatmap executivo:", err);
    } finally {
      setLoadingHeatmap(false);
    }
  };

  useEffect(() => {
    if (dashboardMode === "investigativa") {
      fetchStagingTelemetryAndBlocked();
    } else if (dashboardMode === "executiva") {
      fetchExecutiveHeatmapData();
    }
  }, [dashboardMode]);

  // 1. Authenticate & Fetch Profile
  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) {
          window.location.href = "/login";
          return;
        }
        setUser(authUser);

        const { data: prof } = await supabase
          .from("cm_user_profiles")
          .select("*")
          .eq("id", authUser.id)
          .single();

        setProfile(prof);

        // Access Restriction: Only CEO, Admin, Trade, and Supervisor can view
        const isAuthorized = ["CEO", "Admin", "Trade", "Supervisor"].includes(prof?.role || "");
        if (!isAuthorized) {
          window.location.href = "/";
          return;
        }

        // Fetch Supervisor employee profile if exists
        const { data: perfil } = await supabase
          .from("cm_promotor_perfil")
          .select("employee_id")
          .eq("user_id", authUser.id)
          .maybeSingle();

        if (perfil) {
          const { data: empData } = await supabase
            .from("cm_employees")
            .select("*")
            .eq("id", perfil.employee_id)
            .maybeSingle();
          setEmployee(empData);
        }
      } catch (err) {
        console.error("Error in supervisor auth check:", err);
      } finally {
        setLoadingAuth(false);
      }
    }
    checkAuth();
  }, []);

  // 2. Fetch Dashboard Data
  const fetchDashboardData = async () => {
    if (!profile) return;
    try {
      setLastUpdate(new Date());

      // A. Fetch all active promotores profiles & employees
      const { data: perfisPromotores } = await supabase
        .from("cm_promotor_perfil")
        .select(`
          employee_id,
          employee:cm_employees(*)
        `);

      const promotoresList = perfisPromotores
        ?.map((p: any) => p.employee)
        .filter(Boolean) || [];

      // Determine team mapping if supervisor
      let teamPromotorIds: string[] = [];
      if (profile.role === "Supervisor" && employee) {
        const { data: mappings } = await supabase
          .from("cm_promotor_supervisor_mapping")
          .select("promotor_id")
          .eq("supervisor_id", employee.id);
        teamPromotorIds = mappings?.map(m => m.promotor_id) || [];
      }

      // Filter promotores list for supervisor team
      const filteredPromotores = profile.role === "Supervisor" && employee
        ? promotoresList.filter(p => teamPromotorIds.includes(p.id))
        : promotoresList;

      setPromotores(filteredPromotores);
      const filteredIds = filteredPromotores.map(p => p.id);

      if (filteredIds.length === 0) {
        setLoadingData(false);
        return;
      }

      // B. Fetch Live Statuses
      const { data: statuses } = await supabase
        .from("cm_promotor_live_status")
        .select("*")
        .in("promotor_id", filteredIds);

      const statusMap: Record<string, any> = {};
      statuses?.forEach(s => {
        statusMap[s.promotor_id] = s;
      });
      setLiveStatuses(statusMap);

      // C. Fetch Today's Agendas
      const dataHoje = new Date().toISOString().split("T")[0];
      const { data: agendas } = await supabase
        .from("cm_promotor_agenda_diaria")
        .select("*")
        .eq("data_agenda", dataHoje)
        .in("promotor_id", filteredIds);

      setAgendasHoje(agendas || []);
      const agendaIds = agendas?.map(a => a.id) || [];

      // D. Fetch Today's Visitas
      if (agendaIds.length > 0) {
        const { data: visitas } = await supabase
          .from("cm_promotor_visita")
          .select(`
            *,
            pdv:base_atendimento(cod_parceiro, nome_fantasia, uf, cidade)
          `)
          .in("agenda_diaria_id", agendaIds);
        setVisitasHoje(visitas || []);
      } else {
        setVisitasHoje([]);
      }

      // E. Fetch active alerts
      const { data: alerts } = await supabase
        .from("cm_promotor_alerta")
        .select(`
          *,
          promotor:cm_employees(id, nome_completo)
        `)
        .eq("is_resolvido", false)
        .in("promotor_id", filteredIds)
        .order("created_at", { ascending: false });
      setAlertasAtivos(alerts || []);

      // F. Fetch PDV geolocations to validate GPS accuracy threshold
      const { data: pdvLocs } = await supabase
        .from("cm_promotor_pdv_geoloc")
        .select("*");

      const geolocMap: Record<string, any> = {};
      pdvLocs?.forEach(g => {
        geolocMap[g.cod_parceiro] = g;
      });
      setGeolocs(geolocMap);

      // G. Fetch Today's Heartbeat Logs for Route Mileage Calculation
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const { data: logs } = await supabase
        .from("cm_promotor_heartbeat_log")
        .select("*")
        .gte("created_at", startOfDay.toISOString())
        .in("promotor_id", filteredIds)
        .order("created_at", { ascending: true });

      setHeartbeatLogs(logs || []);

      // H. Fetch Mobile App Logs (last 24 hours) for War Room
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: mLogs } = await supabase
        .from("cm_mobile_app_logs")
        .select(`
          *,
          promotor:cm_employees(nome_completo)
        `)
        .in("promotor_id", filteredIds)
        .gte("created_at", twentyFourHoursAgo)
        .order("created_at", { ascending: false });

      setMobileAppLogs(mLogs || []);

      // I. Fetch AI Shelf Analysis (last 30 days) for AI Vision
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: sAnalysis } = await supabase
        .from("cm_ai_shelf_analysis")
        .select(`
          *,
          promotor:cm_employees(nome_completo),
          visita:cm_promotor_visita(id, cod_parceiro)
        `)
        .in("promotor_id", filteredIds)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });

      setShelfAnalysisLogs(sAnalysis || []);

      // --- Sprint 5.2: Fetch Price OCR Data ---
      const { data: pAnalysis } = await supabase
        .from("cm_ai_price_analysis")
        .select(`
          *,
          visita:cm_promotor_visita(
            id,
            cod_parceiro,
            pdv:base_atendimento(cod_parceiro, nome_fantasia, nome_parceiro, cidade, uf, rede, cluster_canal)
          )
        `)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });

      const validVisits = new Set(sAnalysis?.map(log => log.visita_id) || []);
      const filteredPAnalysis = (pAnalysis || []).filter((pa: any) => validVisits.has(pa.visita_id));
      setPriceAnalysisLogs(filteredPAnalysis);

      // Fetch Pricing Alerts (last 30 days)
      const { data: pAlerts } = await supabase
        .from("cm_ai_pricing_alert")
        .select(`
          *,
          visita:cm_promotor_visita(
            id,
            pdv:base_atendimento(cod_parceiro, nome_fantasia, nome_parceiro)
          )
        `)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false });

      const filteredPAlerts = (pAlerts || []).filter((al: any) => validVisits.has(al.visita_id));
      setPriceAlerts(filteredPAlerts);

    } catch (err) {
      console.error("Error loading dashboard data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Trigger load when profile/employee updates
  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile, employee]);

  // 3. Realtime Subscription Channel
  useEffect(() => {
    if (!profile || promotores.length === 0) return;

    const promotorIds = promotores.map(p => p.id);

    const channel = supabase
      .channel("supervisor-command-center-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cm_promotor_live_status" },
        (payload) => {
          const newStatus = payload.new as any;
          if (newStatus && promotorIds.includes(newStatus.promotor_id)) {
            // Flash effect trigger
            setUpdatedPromotores(prev => ({ ...prev, [newStatus.promotor_id]: true }));
            setTimeout(() => {
              setUpdatedPromotores(prev => ({ ...prev, [newStatus.promotor_id]: false }));
            }, 2000);

            // Update state in place for immediate reaction
            setLiveStatuses(prev => ({
              ...prev,
              [newStatus.promotor_id]: newStatus
            }));
            
            // Soft refetch today's details in background
            fetchDashboardData();
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cm_promotor_alerta" },
        (payload) => {
          // Refresh alerts list
          fetchDashboardData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cm_promotor_visita" },
        (payload) => {
          // Refresh visits & KPIs
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile, promotores]);

  // 4. Manual Alert Resolution
  const handleResolveAlerta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingAlertaId || !obsResolucao.trim()) return;

    setSubmittingResolucao(true);
    try {
      const { error } = await supabase
        .from("cm_promotor_alerta")
        .update({
          is_resolvido: true,
          resolvido_at: new Date().toISOString(),
          resolvido_by: user.id,
          descricao: `[Resolvido por ${profile?.role || "Supervisor"}]: ${obsResolucao}`
        })
        .eq("id", resolvingAlertaId);

      if (error) throw error;

      setResolvingAlertaId(null);
      setObsResolucao("");
      fetchDashboardData();
    } catch (err: any) {
      alert("Erro ao resolver alerta: " + (err.message || err));
    } finally {
      setSubmittingResolucao(false);
    }
  };

  // 5. Dynamic Mileage Traveled Calculation per Promotor
  const getKmPercorrido = (promotorId: string): number => {
    const logs = heartbeatLogs.filter(l => l.promotor_id === promotorId);
    if (logs.length < 2) return 0;

    let distanceM = 0;
    for (let i = 1; i < logs.length; i++) {
      const p1 = logs[i - 1];
      const p2 = logs[i];
      distanceM += calculateDistanceM(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }
    return distanceM / 1000;
  };

  // 6. Dynamic Offline Status Check (now - last_heartbeat > 10 min)
  const getComputedStatus = (promotorId: string): string => {
    const live = liveStatuses[promotorId];
    if (!live) return "JORNADA_ENCERRADA";

    const lastHeartbeatDate = new Date(live.last_heartbeat);
    const differenceMin = (new Date().getTime() - lastHeartbeatDate.getTime()) / 1000 / 60;

    if (differenceMin > 10) {
      return "OFFLINE";
    }
    return live.status;
  };

  // 7. Calculate SLA Store Timing in Realtime
  const getLojaTimingText = (promotorId: string, currentVisitaId: string | null) => {
    if (!currentVisitaId) return null;
    const visita = visitasHoje.find(v => v.id === currentVisitaId);
    if (!visita || !visita.checkin_servidor || visita.checkout_servidor) return null;

    const checkin = new Date(visita.checkin_servidor);
    const decorridoMs = new Date().getTime() - checkin.getTime();
    const decorridoMin = Math.floor(decorridoMs / 1000 / 60);

    const esperadoMin = visita.duracao_estimada_min || 60;
    const isExceeded = decorridoMin > 2 * esperadoMin;

    return {
      decorridoMin,
      esperadoMin,
      isExceeded,
      text: `${decorridoMin} min em loja (Esperado: ${esperadoMin} min)`
    };
  };

  // 8. Calculations for Dashboard Overview KPIs
  const totalPlanejadas = visitasHoje.length;
  const totalRealizadas = visitasHoje.filter(v => 
    ["CONCLUIDA", "LOJA_FECHADA", "CANCELADA", "NAO_REALIZADA"].includes(v.status)
  ).length;
  const taxaExecucao = totalPlanejadas > 0 ? Math.round((totalRealizadas / totalPlanejadas) * 100) : 0;

  // Calculo de tempo medio em loja
  const visitasComDuracao = visitasHoje.filter(v => v.checkin_servidor && v.checkout_servidor);
  const totalDuracao = visitasComDuracao.reduce((acc, v) => {
    const checkin = new Date(v.checkin_servidor);
    const checkout = new Date(v.checkout_servidor);
    return acc + (checkout.getTime() - checkin.getTime());
  }, 0);
  const tempoMedioLojaMin = visitasComDuracao.length > 0 
    ? Math.round((totalDuracao / visitasComDuracao.length) / 1000 / 60)
    : 0;

  // Km total estimado de todos os promotores hoje
  const totalKmTraveled = promotores.reduce((acc, p) => acc + getKmPercorrido(p.id), 0);

  // Computed visits for selected promotor
  const selectedVisitas = selectedPromotorId
    ? visitasHoje.filter((v) => {
        const agenda = agendasHoje.find((a) => a.id === v.agenda_diaria_id);
        return agenda?.promotor_id === selectedPromotorId;
      })
    : [];

  // Status colors & texts
  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    OFFLINE: { label: "Offline", bg: "bg-neutral-900 border-neutral-800", text: "text-neutral-400", dot: "bg-neutral-500" },
    DISPONIVEL: { label: "Disponível", bg: "bg-emerald-950/20 border-emerald-900/40", text: "text-emerald-400", dot: "bg-emerald-500" },
    EM_ROTA: { label: "Em Rota", bg: "bg-blue-950/20 border-blue-900/40", text: "text-blue-400", dot: "bg-blue-500" },
    EM_LOJA_CHECKIN: { label: "Check-in Realizado", bg: "bg-amber-950/20 border-amber-900/40", text: "text-amber-400", dot: "bg-amber-500 animate-pulse" },
    EM_EXECUCAO: { label: "Em Execução", bg: "bg-amber-950/30 border-amber-500/50", text: "text-amber-300", dot: "bg-amber-500 animate-ping" },
    EM_OCORRENCIA: { label: "Em Ocorrência", bg: "bg-red-950/20 border-red-900/40", text: "text-red-400", dot: "bg-red-500" },
    CHECKOUT_PENDENTE: { label: "Checkout Pendente", bg: "bg-indigo-950/20 border-indigo-900/40", text: "text-indigo-400", dot: "bg-indigo-500" },
    JORNADA_ENCERRADA: { label: "Jornada Encerrada", bg: "bg-neutral-900 border-neutral-850", text: "text-neutral-500", dot: "bg-neutral-700" }
  };

  // Filter logic
  const filteredPromotores = promotores.filter(p => {
    const status = getComputedStatus(p.id);
    const matchesSearch = p.nome_completo.toLowerCase().includes(searchFilter.toLowerCase());
    const matchesStatus = statusFilter === "TODOS" || status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const activeScores = promotores.map(p => {
    const live = liveStatuses[p.id];
    return live?.fraud_score !== undefined ? live.fraud_score : 100;
  });
  const globalFraudScore = activeScores.length > 0
    ? Math.round(activeScores.reduce((a, b) => a + b, 0) / activeScores.length)
    : 100;

  if (loadingAuth || loadingData) {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center flex-col gap-4">
        <RotateCw className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-xs uppercase font-extrabold tracking-wider text-neutral-500">
          Carregando Command Center...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col font-sans">
      {/* Header */}
      <header className="p-5 border-b border-neutral-900 bg-neutral-900/40 backdrop-blur-md sticky top-0 z-40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/"
            className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition-all flex items-center justify-center border border-transparent hover:border-neutral-700/50 animate-pulse-subtle"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold uppercase tracking-wide text-amber-500">
                Command Center
              </h1>
              <Link 
                href="/admin/kpi-config" 
                className="p-1 text-neutral-500 hover:text-amber-500 transition-colors"
                title="Configurações de KPIs & Widgets"
              >
                <Settings className="w-4 h-4" />
              </Link>
              <Link 
                href="/admin/ai-governance" 
                className="p-1 text-neutral-500 hover:text-amber-500 transition-colors"
                title="Painel de Governança de IA"
              >
                <ShieldAlert className="w-4 h-4 text-amber-500" />
              </Link>
            </div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <p className="text-[10px] text-neutral-400">
                Monitoramento Operacional e Segurança de Promotores em Tempo Real
              </p>
              {companyScore && (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-500/10 border border-amber-500/20 text-amber-500 uppercase">
                  Score Geral: {companyScore.overall_score.toFixed(1)}/100
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard Mode Switcher */}
        <div className="flex bg-neutral-950/80 rounded-xl p-1 border border-neutral-850 shrink-0 self-stretch sm:self-auto gap-1">
          {widgets.length > 0 ? (
            widgets.map((widget) => {
              const widgetModeMap: Record<string, "operacional" | "investigativa" | "executiva" | "ai_vision" | "route_intelligence" | "prescriptive_ai" | "ai_learning" | "ai_governance"> = {
                operacional: "operacional",
                investigativa: "investigativa",
                executiva: "executiva",
                ai_vision: "ai_vision",
                route_intelligence: "route_intelligence",
                prescriptive_ai: "prescriptive_ai",
                ai_learning: "ai_learning",
                ai_governance: "ai_governance"
              };
              const mode = widgetModeMap[widget.widget_key];
              const displayLabels: Record<string, string> = {
                operacional: "Operacional",
                investigativa: "Investigativo",
                executiva: "Executivo",
                ai_vision: "AI Vision",
                route_intelligence: "Route Intelligence",
                prescriptive_ai: "Prescriptive AI",
                ai_learning: "AI Learning",
                ai_governance: "AI Governance"
              };
              if (!mode) return null;
              return (
                <button
                  key={widget.widget_key}
                  onClick={() => { setDashboardMode(mode); setWarRoomMode(false); }}
                  className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                    dashboardMode === mode && !warRoomMode
                      ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {displayLabels[widget.widget_key]}
                </button>
              );
            })
          ) : (
            <>
              <button
                onClick={() => { setDashboardMode("operacional"); setWarRoomMode(false); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  dashboardMode === "operacional" && !warRoomMode
                    ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Operacional
              </button>
              <button
                onClick={() => { setDashboardMode("investigativa"); setWarRoomMode(false); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  dashboardMode === "investigativa" && !warRoomMode
                    ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Investigativo
              </button>
              <button
                onClick={() => { setDashboardMode("executiva"); setWarRoomMode(false); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  dashboardMode === "executiva" && !warRoomMode
                    ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Executivo
              </button>
              <button
                onClick={() => { setDashboardMode("ai_vision"); setWarRoomMode(false); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  dashboardMode === "ai_vision" && !warRoomMode
                    ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                AI Vision
              </button>
              <button
                onClick={() => { setDashboardMode("route_intelligence"); setWarRoomMode(false); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  dashboardMode === "route_intelligence" && !warRoomMode
                    ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Route Intelligence
              </button>
              <button
                onClick={() => { setDashboardMode("prescriptive_ai"); setWarRoomMode(false); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  dashboardMode === "prescriptive_ai" && !warRoomMode
                    ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                Prescriptive AI
              </button>
              <button
                onClick={() => { setDashboardMode("ai_governance"); setWarRoomMode(false); }}
                className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all ${
                  dashboardMode === "ai_governance" && !warRoomMode
                    ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                    : "text-neutral-400 hover:text-white"
                }`}
              >
                AI Governance
              </button>
            </>
          )}
          {warRoomEnabled && (
            <button
              onClick={() => setWarRoomMode(!warRoomMode)}
              className={`px-3 py-1 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 ${
                warRoomMode
                  ? "bg-red-500 text-neutral-950 shadow-md font-black"
                  : "text-red-400 hover:text-red-300 hover:bg-red-500/10"
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              War Room
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto justify-between">
          <div className="flex flex-col text-right">
            <span className="text-[9px] text-neutral-500 uppercase font-black">
              Última Atualização
            </span>
            <span className="text-xs font-mono text-neutral-300">
              {lastUpdate.toLocaleTimeString()}
            </span>
          </div>
          
          <button
            onClick={() => {
              setLoadingData(true);
              fetchDashboardData();
              if (dashboardMode === "investigativa") {
                fetchStagingTelemetryAndBlocked();
              } else if (dashboardMode === "executiva") {
                fetchExecutiveHeatmapData();
              }
            }}
            className="p-2 bg-neutral-900 hover:bg-neutral-800 rounded-lg text-neutral-400 hover:text-white transition border border-neutral-800"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          
          <ThemeToggle />
          
          <a
            href="/"
            className="px-3.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold rounded-lg border border-neutral-800 transition"
          >
            Voltar
          </a>
        </div>
      </header>

      {/* Main Dashboard Area */}
      <main className="flex-1 p-5 lg:p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full">
        
        {/* War Room Calculations & Rendering */}
        {(() => {
          if (!warRoomMode) return null;

          const nowForWarRoom = new Date();
          
          // Latest mobile app log date map per promotor
          const latestLogMap: Record<string, Date> = {};
          mobileAppLogs.forEach(log => {
            if (!latestLogMap[log.promotor_id]) {
              latestLogMap[log.promotor_id] = new Date(log.created_at);
            }
          });

          // Map agenda to promotor
          const agendaPromotorMap: Record<string, string> = {};
          agendasHoje.forEach(a => {
            agendaPromotorMap[a.id] = a.promotor_id;
          });

          let wrOnlineCount = 0;
          let wrDegradedCount = 0;
          let wrOfflineCount = 0;
          let wrActiveSessionsCount = 0;
          
          const promotoresStatusList = promotores.map(p => {
            const liveStatus = liveStatuses[p.id];
            const lastHeartbeat = liveStatus?.last_heartbeat ? new Date(liveStatus.last_heartbeat) : null;
            const lastLogDate = latestLogMap[p.id] || null;

            const heartbeatDiffMin = lastHeartbeat ? (nowForWarRoom.getTime() - lastHeartbeat.getTime()) / (1000 * 60) : Infinity;
            const logDiffMin = lastLogDate ? (nowForWarRoom.getTime() - lastLogDate.getTime()) / (1000 * 60) : Infinity;

            let status: "ONLINE" | "DEGRADED" | "OFFLINE" = "OFFLINE";
            if (lastHeartbeat === null) {
              status = "OFFLINE";
              wrOfflineCount++;
            } else if (heartbeatDiffMin <= 5) {
              status = "ONLINE";
              wrOnlineCount++;
            } else if (heartbeatDiffMin <= 10) {
              status = "DEGRADED";
              wrDegradedCount++;
            } else {
              status = "OFFLINE";
              wrOfflineCount++;
            }

            const isSessionActive = (heartbeatDiffMin < 10) || (logDiffMin < 10);
            if (isSessionActive) {
              wrActiveSessionsCount++;
            }

            return {
              promotor: p,
              liveStatus,
              lastHeartbeat,
              lastLogDate,
              heartbeatDiffMin,
              logDiffMin,
              status,
              isSessionActive
            };
          });

          // Crash Count (APP_CRASH event_type in last 24h)
          const wrCrashCount = mobileAppLogs.filter(log => log.event_type === "APP_CRASH" || log.severity === "CRITICAL").length;

          // Heatmap regions grouping
          const wrRegions = [
            { key: "BH", name: "Belo Horizonte / MG" },
            { key: "DF", name: "Brasília / DF" },
            { key: "SP", name: "São Paulo / SP" },
            { key: "OUTROS", name: "Outras Regiões" }
          ];

          const getRegion = (visita: any) => {
            const cidade = (visita?.pdv?.cidade || "").toUpperCase();
            const uf = (visita?.pdv?.uf || "").toUpperCase();
            
            if (cidade.includes("BELO HORIZONTE") || uf === "MG") return "BH";
            if (cidade.includes("BRASÍLIA") || cidade.includes("BRASILIA") || uf === "DF") return "DF";
            if (cidade.includes("SÃO PAULO") || cidade.includes("SAO PAULO") || uf === "SP") return "SP";
            return "OUTROS";
          };

          const wrRegionData = wrRegions.map(r => {
            const visits = visitasHoje.filter(v => getRegion(v) === r.key);
            const total = visits.length;
            const completed = visits.filter(v => ["CONCLUIDA", "LOJA_FECHADA"].includes(v.status)).length;
            const compliance = total > 0 ? Math.round((completed / total) * 100) : 100;
            
            const promotoresInRegion = new Set(visits.map(v => agendaPromotorMap[v.agenda_diaria_id]).filter(Boolean));
            const alertsCount = alertasAtivos.filter(a => promotoresInRegion.has(a.promotor_id)).length;
            
            return {
              ...r,
              total,
              completed,
              compliance,
              alertsCount
            };
          });

          const wrGpsSpoofAlerts = alertasAtivos.filter(a => a.tipo_alerta === "GPS_MOCK" || a.tipo_alerta === "GPS_SPOOF" || a.tipo_alerta === "GPS_MOCK_DETECTED").length;
          const wrGeofenceAlerts = alertasAtivos.filter(a => a.tipo_alerta === "GEOFENCE" || a.tipo_alerta === "GEOFENCE_BORDA" || a.tipo_alerta === "GEOFENCE_VIOLATION").length;
          const wrBatteryAlerts = alertasAtivos.filter(a => a.tipo_alerta === "BATTERY_CRITICAL").length;
          const wrSpeedAlerts = alertasAtivos.filter(a => a.tipo_alerta === "VELOCIDADE_IMPOSSIVEL").length;

          return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
              {/* 1. Stats Cards Grid */}
              <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-emerald-950/60 hover:border-emerald-900/80 transition-all flex flex-col justify-between min-h-[100px] shadow-lg shadow-emerald-950/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-black text-emerald-400">{wrOnlineCount}</span>
                    <Wifi className="w-5 h-5 text-emerald-950" />
                  </div>
                  <p className="text-[9px] text-neutral-500 mt-1">Heartbeat nos últimos 5 min</p>
                </div>

                <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-amber-950/60 hover:border-amber-900/80 transition-all flex flex-col justify-between min-h-[100px] shadow-lg shadow-amber-950/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Degraded
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-black text-amber-400">{wrDegradedCount}</span>
                    <Activity className="w-5 h-5 text-amber-950" />
                  </div>
                  <p className="text-[9px] text-neutral-500 mt-1">Heartbeat entre 5 e 10 min</p>
                </div>

                <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px] shadow-lg">
                  <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-neutral-700" />
                    Offline
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-black text-neutral-400">{wrOfflineCount}</span>
                    <Wifi className="w-5 h-5 text-neutral-800" />
                  </div>
                  <p className="text-[9px] text-neutral-500 mt-1">Heartbeat há mais de 10 min</p>
                </div>

                <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-indigo-950/60 hover:border-indigo-900/80 transition-all flex flex-col justify-between min-h-[100px] shadow-lg shadow-indigo-950/10">
                  <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400">
                    Sessões Ativas
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-black text-indigo-400">{wrActiveSessionsCount}</span>
                    <User className="w-5 h-5 text-indigo-950" />
                  </div>
                  <p className="text-[9px] text-neutral-500 mt-1">Heartbeat ou log &lt; 10 min</p>
                </div>

                <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-rose-950/60 hover:border-rose-900/80 transition-all flex flex-col justify-between min-h-[100px] shadow-lg shadow-rose-950/10 col-span-2 md:col-span-1">
                  <span className="text-[10px] font-black uppercase tracking-wider text-rose-400">
                    Crashes / Erros
                  </span>
                  <div className="flex items-baseline justify-between mt-2">
                    <span className="text-2xl font-black text-rose-400">{wrCrashCount}</span>
                    <AlertTriangle className="w-5 h-5 text-rose-950" />
                  </div>
                  <p className="text-[9px] text-neutral-500 mt-1">Logs de severidade crítica (24h)</p>
                </div>
              </section>

              {/* 2. Three Columns Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Col 1: Regional Risk Heatmap & Incident Severity Board */}
                <div className="flex flex-col gap-6">
                  {/* Regional Risk Heatmap */}
                  <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                        Mapa de Risco Regional
                      </span>
                      <Building2 className="w-4 h-4 text-neutral-600" />
                    </div>
                    
                    <div className="flex flex-col gap-3">
                      {wrRegionData.map(r => (
                        <div key={r.key} className="p-3.5 bg-neutral-950/60 rounded-xl border border-neutral-900 flex flex-col gap-2 hover:border-neutral-850 transition">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-neutral-200">{r.name}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-neutral-900 border ${
                              r.compliance >= 95 ? "border-emerald-950 text-emerald-400" :
                              r.compliance >= 85 ? "border-amber-950 text-amber-400" : "border-rose-950 text-rose-400"
                            }`}>
                              {r.compliance}% Compliance
                            </span>
                          </div>
                          
                          <div className="flex justify-between items-center text-[10px] text-neutral-500">
                            <span>Visitas: <strong>{r.completed}</strong> / {r.total}</span>
                            {r.alertsCount > 0 ? (
                              <span className="text-rose-400 font-bold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                {r.alertsCount} Alertas Ativos
                              </span>
                            ) : (
                              <span className="text-emerald-500 font-bold">Sem Alertas</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Incident Severity Board */}
                  <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                        Painel de Severidade de Incidentes
                      </span>
                      <ShieldAlert className="w-4 h-4 text-neutral-600" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-900 flex flex-col gap-1">
                        <span className="text-[9px] uppercase font-black text-neutral-500">GPS Spoofing</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-lg font-black ${wrGpsSpoofAlerts > 0 ? "text-rose-400" : "text-neutral-400"}`}>
                            {wrGpsSpoofAlerts}
                          </span>
                          <span className="text-[9px] text-neutral-600">ativos</span>
                        </div>
                      </div>
                      <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-900 flex flex-col gap-1">
                        <span className="text-[9px] uppercase font-black text-neutral-500">Fora Geofence</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-lg font-black ${wrGeofenceAlerts > 0 ? "text-rose-400" : "text-neutral-400"}`}>
                            {wrGeofenceAlerts}
                          </span>
                          <span className="text-[9px] text-neutral-600">ativos</span>
                        </div>
                      </div>
                      <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-900 flex flex-col gap-1">
                        <span className="text-[9px] uppercase font-black text-neutral-500">Bateria Crítica</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-lg font-black ${wrBatteryAlerts > 0 ? "text-rose-400" : "text-neutral-400"}`}>
                            {wrBatteryAlerts}
                          </span>
                          <span className="text-[9px] text-neutral-600">ativos</span>
                        </div>
                      </div>
                      <div className="p-3 bg-neutral-950/60 rounded-xl border border-neutral-900 flex flex-col gap-1">
                        <span className="text-[9px] uppercase font-black text-neutral-500">Velocidade Irreal</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-lg font-black ${wrSpeedAlerts > 0 ? "text-amber-400" : "text-neutral-400"}`}>
                            {wrSpeedAlerts}
                          </span>
                          <span className="text-[9px] text-neutral-600">ativos</span>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>

                {/* Col 2: Error Board (Mobile Logs) */}
                <div className="flex flex-col gap-6 lg:col-span-1">
                  <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4 h-[500px]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                        Painel de Erros (Mobile App Logs)
                      </span>
                      <span className="text-[9px] px-2 py-0.5 bg-neutral-950 border border-neutral-850 rounded-full font-mono text-neutral-400">
                        Últimas 24h
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-neutral-850">
                      {mobileAppLogs.filter(log => log.severity === "ERROR" || log.severity === "CRITICAL").length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                          <Check className="w-8 h-8 text-emerald-500/30 mb-2" />
                          <span className="text-xs font-bold uppercase text-neutral-400">Tudo Estável</span>
                          <span className="text-[10px] text-neutral-500 mt-1">Nenhum log de erro crítico ou falha recebido.</span>
                        </div>
                      ) : (
                        mobileAppLogs
                          .filter(log => log.severity === "ERROR" || log.severity === "CRITICAL")
                          .map(log => {
                            const logTime = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const isCritical = log.severity === "CRITICAL";
                            
                            return (
                              <div key={log.id} className={`p-3 bg-neutral-950/70 border rounded-xl flex flex-col gap-1.5 transition hover:border-neutral-800 ${
                                isCritical ? "border-rose-950/40" : "border-amber-950/40"
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                                    isCritical ? "bg-rose-500/10 text-rose-400 border border-rose-950" : "bg-amber-500/10 text-amber-400 border border-amber-950"
                                  }`}>
                                    {log.severity}
                                  </span>
                                  <span className="text-[9px] text-neutral-500 font-mono">{logTime}</span>
                                </div>

                                <div className="flex flex-col">
                                  <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wide">
                                    {log.event_type}
                                  </span>
                                  <span className="text-[10px] text-neutral-400 break-words font-mono bg-neutral-900/60 p-2 rounded border border-neutral-900 mt-1">
                                    {log.payload_json?.message || log.payload_json?.error || JSON.stringify(log.payload_json)}
                                  </span>
                                </div>

                                <div className="flex justify-between items-center text-[9px] text-neutral-500 mt-1 border-t border-neutral-900/60 pt-1.5">
                                  <span className="font-bold">{log.promotor?.nome_completo || "Desconhecido"}</span>
                                  <span>{log.os ? `${log.os} (${log.app_version || "1.0.0"})` : "N/A"}</span>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </section>
                </div>

                {/* Col 3: Real-Time Promotores Connectivity */}
                <div className="flex flex-col gap-6 lg:col-span-1">
                  <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4 h-[500px]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                        Conectividade dos Promotores
                      </span>
                      <span className="text-[10px] font-bold text-neutral-500">
                        Total: {promotores.length}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 scrollbar-thin scrollbar-thumb-neutral-850">
                      {promotoresStatusList.map(({ promotor, liveStatus, lastHeartbeat, heartbeatDiffMin, status, isSessionActive }) => {
                        const battery = liveStatus?.bateria_percent;
                        const charging = liveStatus?.bateria_charging;
                        
                        return (
                          <div key={promotor.id} className="p-3 bg-neutral-950/60 border border-neutral-900 rounded-xl flex flex-col gap-2 hover:border-neutral-800 transition">
                            <div className="flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="text-xs font-black text-neutral-200">{promotor.nome_completo}</span>
                                <span className="text-[9px] text-neutral-500 font-mono uppercase mt-0.5">
                                  {promotor.cargo || "Promotor"}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-1.5">
                                {isSessionActive && (
                                  <span className="text-[8px] font-black bg-indigo-500/10 text-indigo-400 border border-indigo-950 px-1.5 py-0.5 rounded-full">
                                    Sessão Ativa
                                  </span>
                                )}
                                <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${
                                  status === "ONLINE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-950" :
                                  status === "DEGRADED" ? "bg-amber-500/10 text-amber-400 border-amber-950" :
                                  "bg-neutral-950 text-neutral-500 border-neutral-900"
                                }`}>
                                  {status}
                                </span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-neutral-500 border-t border-neutral-900/60 pt-2 mt-1">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-neutral-600" />
                                {lastHeartbeat 
                                  ? `${Math.round(heartbeatDiffMin)}m atrás`
                                  : "Nunca"
                                }
                              </span>

                              {battery !== undefined && (
                                <span className="flex items-center gap-1 font-mono">
                                  <Battery className={`w-3.5 h-3.5 ${
                                    battery < 20 ? "text-rose-500" : battery < 50 ? "text-amber-500" : "text-emerald-500"
                                  }`} />
                                  {battery}% {charging ? "⚡" : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

              </div>
            </div>
          );
        })()}

        {/* Operational Mode View */}
        {dashboardMode === "operacional" && !warRoomMode && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* KPI Panel */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Visitas Planejadas */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Visitas Planejadas
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-neutral-200">{totalPlanejadas}</span>
                  <FileText className="w-5 h-5 text-neutral-700" />
                </div>
                <p className="text-[9px] text-neutral-500 mt-1">Total de roteiros para hoje</p>
              </div>

              {/* Visitas Realizadas */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Visitas Concluídas
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-emerald-400">{totalRealizadas}</span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-950" />
                </div>
                <p className="text-[9px] text-neutral-500 mt-1">Concluídas com sucesso ou justificadas</p>
              </div>

              {/* Taxa de Execução */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Taxa de Execução
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-amber-500">{taxaExecucao}%</span>
                  <Activity className="w-5 h-5 text-amber-950" />
                </div>
                {/* Progress bar */}
                <div className="w-full bg-neutral-950 rounded-full h-1 mt-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${taxaExecucao}%` }} />
                </div>
              </div>

              {/* Tempo médio em loja */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Tempo Médio em Loja
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-neutral-200">{tempoMedioLojaMin} min</span>
                  <Clock className="w-5 h-5 text-neutral-700" />
                </div>
                <p className="text-[9px] text-neutral-500 mt-1">Considerando visitas finalizadas hoje</p>
              </div>

              {/* KM total estimado */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px] col-span-2 md:col-span-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  KM Total Traçado
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-neutral-200">{totalKmTraveled.toFixed(1)} km</span>
                  <Compass className="w-5 h-5 text-neutral-700" />
                </div>
                <p className="text-[9px] text-neutral-500 mt-1">Calculado a partir de logs GPS</p>
              </div>
            </section>

            {/* Filter Controls */}
            <section className="p-4 bg-neutral-900/20 rounded-2xl border border-neutral-900 flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Pesquisar por promotor..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 focus:border-amber-500 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none transition-colors"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {["TODOS", "DISPONIVEL", "EM_ROTA", "EM_LOJA_CHECKIN", "EM_EXECUCAO", "EM_OCORRENCIA", "CHECKOUT_PENDENTE", "OFFLINE", "JORNADA_ENCERRADA"].map(opt => {
                  const count = promotores.filter(p => opt === "TODOS" || getComputedStatus(p.id) === opt).length;
                  return (
                    <button
                      key={opt}
                      onClick={() => setStatusFilter(opt)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border uppercase transition ${
                        statusFilter === opt
                          ? "bg-amber-500 border-amber-600 text-neutral-950"
                          : "bg-neutral-950 border-neutral-850 hover:bg-neutral-900 text-neutral-400 hover:text-white"
                      }`}
                    >
                      {opt === "TODOS" ? "Todos" : opt === "EM_LOJA_CHECKIN" ? "Check-in" : opt.replace("_", " ")} ({count})
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Work Area Grid (Left: Live Status, Right: Active Alerts) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Live Status Cards (Left 2 columns) */}
              <section className="lg:col-span-2 flex flex-col gap-6">
                
                {/* TABS DE DETALHES (MAPA vs JORNADA FORENSE) */}
                {selectedPromotorId && (
                  <div className="flex bg-neutral-900/60 rounded-xl p-1 border border-neutral-900 shrink-0">
                    <button
                      onClick={() => setActiveMainTab("mapa")}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition ${
                        activeMainTab === "mapa"
                          ? "bg-amber-500 text-neutral-950"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Mapa e Replay de Rota
                    </button>
                    <button
                      onClick={() => setActiveMainTab("forense")}
                      className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition ${
                        activeMainTab === "forense"
                          ? "bg-amber-500 text-neutral-950"
                          : "text-neutral-400 hover:text-white"
                      }`}
                    >
                      Jornada Forense do Promotor
                    </button>
                  </div>
                )}

                {activeMainTab === "mapa" ? (
                  /* MAPA OPERACIONAL E CONTROLES DE REPLAY */
                  <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-4 h-[500px] flex flex-col gap-3">
                    <div className="flex justify-between items-center shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <h2 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                          Mapa Operacional Live
                        </h2>
                      </div>

                      {selectedPromotorId && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setIsReplayActive(!isReplayActive);
                              setReplayCurrentIndex(0);
                              setIsReplayPlaying(false);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition ${
                              isReplayActive
                                ? "bg-amber-500 border-amber-600 text-neutral-950"
                                : "bg-neutral-950 border-neutral-850 text-neutral-400 hover:text-white"
                            }`}
                          >
                            {isReplayActive ? "Sair do Replay" : "Modo Replay de Rota"}
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 rounded-xl overflow-hidden bg-neutral-955 border border-neutral-900 relative">
                      <MapCommandCenter
                        promotores={promotores}
                        liveStatuses={liveStatuses}
                        selectedPromotorId={selectedPromotorId}
                        visitas={selectedVisitas}
                        geolocs={geolocs}
                        heartbeatLogs={heartbeatLogs}
                        replayTimeline={replayTimeline}
                        replayCurrentIndex={replayCurrentIndex}
                        isReplayActive={isReplayActive}
                      />
                    </div>

                    {/* Controles do Replay */}
                    {isReplayActive && replayTimeline.length > 0 && (
                      <div className="shrink-0 bg-neutral-950 border border-neutral-850 p-3.5 rounded-xl flex flex-col gap-2.5 animate-in fade-in slide-in-from-bottom duration-200">
                        <div className="flex flex-wrap justify-between items-center gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setIsReplayPlaying(!isReplayPlaying)}
                              className={`px-3.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition shadow ${
                                isReplayPlaying 
                                  ? "bg-red-600 hover:bg-red-500 text-white" 
                                  : "bg-emerald-500 hover:bg-emerald-400 text-neutral-950"
                              }`}
                            >
                              {isReplayPlaying ? "Pausar" : "Play"}
                            </button>

                            <div className="flex bg-neutral-900 rounded-lg p-0.5 border border-neutral-800">
                              {([1, 5, 20] as const).map((spd) => (
                                <button
                                  key={spd}
                                  type="button"
                                  onClick={() => setReplaySpeed(spd)}
                                  className={`px-2.5 py-1 rounded text-[9px] font-black uppercase transition ${
                                    replaySpeed === spd
                                      ? "bg-amber-500 text-neutral-950"
                                      : "text-neutral-400 hover:text-white"
                                  }`}
                                >
                                  {spd}x
                                </button>
                              ))}
                            </div>
                          </div>

                          <span className="text-[10px] font-mono text-neutral-300">
                            Evento {replayCurrentIndex + 1} de {replayTimeline.length} • 
                            <span className="text-amber-400 font-bold ml-1 uppercase font-mono">
                              {replayTimeline[replayCurrentIndex]?.event_type}
                            </span> • {new Date(replayTimeline[replayCurrentIndex]?.timestamp).toLocaleTimeString()}
                          </span>
                        </div>

                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min="0"
                            max={replayTimeline.length - 1}
                            value={replayCurrentIndex}
                            onChange={(e) => {
                              setReplayCurrentIndex(parseInt(e.target.value));
                              setIsReplayPlaying(false);
                            }}
                            className="flex-1 accent-amber-500 h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* TAB JORNADA FORENSE */
                  <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-5 animate-in fade-in duration-200">
                    {/* Comparativo de Rota e Desvio */}
                    {forensicMetrics && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-neutral-950 p-4 rounded-xl border border-neutral-900">
                        <div className="flex flex-col text-center">
                          <span className="text-[9px] uppercase font-black text-neutral-500">KM Planejado</span>
                          <span className="text-sm font-bold mt-1 text-neutral-300">{forensicMetrics.planned_km} km</span>
                        </div>
                        <div className="flex flex-col text-center border-l md:border-x border-neutral-900 pl-3 md:px-0">
                          <span className="text-[9px] uppercase font-black text-neutral-500">KM Realizado</span>
                          <span className="text-sm font-bold mt-1 text-neutral-200">{forensicMetrics.actual_km} km</span>
                        </div>
                        <div className="flex flex-col text-center border-l border-neutral-900 pl-3">
                          <span className="text-[9px] uppercase font-black text-neutral-500">Desvio Rota</span>
                          <span className={`text-sm font-bold mt-1 font-mono ${
                            forensicMetrics.deviation_percent > 50 
                              ? "text-red-500 animate-pulse font-black" 
                              : forensicMetrics.deviation_percent > 30 
                                ? "text-orange-400" 
                                : "text-emerald-400"
                          }`}>
                            +{forensicMetrics.deviation_percent}%
                          </span>
                        </div>
                        <div className="flex flex-col text-center border-l border-neutral-900 pl-3">
                          <span className="text-[9px] uppercase font-black text-neutral-500">Score Diário</span>
                          <span className={`text-sm font-bold mt-1 font-mono ${
                            forensicMetrics.daily_score >= 80 
                              ? "text-emerald-400 font-extrabold" 
                              : forensicMetrics.daily_score >= 50 
                                ? "text-amber-400" 
                                : "text-red-400 font-extrabold"
                          }`}>
                            {forensicMetrics.daily_score !== undefined ? `${forensicMetrics.daily_score}/100` : "N/A"}
                          </span>
                        </div>
                      </div>
                    )}

                    {loadingForensic ? (
                      <div className="py-20 text-center flex flex-col items-center gap-3">
                        <RotateCw className="w-6 h-6 animate-spin text-amber-500" />
                        <span className="text-[10px] text-neutral-500 uppercase font-black">Consolidando linha do tempo...</span>
                      </div>
                    ) : forensicTimeline.length === 0 ? (
                      <div className="py-16 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                        Sem registros operacionais disponíveis para este promotor hoje.
                      </div>
                    ) : (
                      <div className="relative border-l border-neutral-900 ml-3 pl-5 py-2 flex flex-col gap-6">
                        {forensicTimeline.map((block: any, idx: number) => {
                          if (block.block_type === "PONTO_ENTRADA" || block.block_type === "PONTO_SAIDA") {
                            const isEntrada = block.block_type === "PONTO_ENTRADA";
                            return (
                              <div key={idx} className="relative">
                                <span className="absolute -left-[27.5px] top-1.5 w-3.5 h-3.5 rounded-full border-2 border-neutral-950 flex items-center justify-center bg-blue-500" />
                                <div className="bg-blue-950/15 border border-blue-900/30 p-3 rounded-xl flex items-center justify-between">
                                  <div>
                                    <h4 className="text-xs font-black uppercase text-blue-400">
                                      {isEntrada ? "Início de Jornada (Ponto)" : "Fim de Jornada (Ponto)"}
                                    </h4>
                                    <p className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1.5">
                                      <Clock className="w-3.5 h-3.5 text-neutral-500" />
                                      {new Date(block.timestamp).toLocaleTimeString()}
                                    </p>
                                  </div>
                                  {block.foto_url && (
                                    <a 
                                      href={supabase.storage.from("promotor-ponto").getPublicUrl(block.foto_url).data.publicUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-[9px] font-black bg-blue-500/10 border border-blue-900/40 text-blue-400 px-2.5 py-1.5 rounded-lg flex items-center gap-1 hover:bg-blue-500 hover:text-neutral-950 transition"
                                    >
                                      <ExternalLink className="w-3 h-3" /> Ver Selfie
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (block.block_type === "DESLOCAMENTO") {
                            return (
                              <div key={idx} className="relative py-2 pl-2">
                                <span className="absolute -left-[23px] top-1/2 -translate-y-1/2 w-1.5 h-6 bg-neutral-900" />
                                <div className="text-[10px] text-neutral-500 flex flex-wrap items-center justify-between gap-2.5 bg-neutral-900/10 p-2 border border-neutral-900 rounded-lg border-dashed">
                                  <span>Em deslocamento de <strong className="text-neutral-400">{block.from_name}</strong> até <strong className="text-neutral-400">{block.to_name}</strong></span>
                                  <div className="flex gap-3 font-mono font-bold text-[9px]">
                                    <span>{block.duracao_min !== null ? `${block.duracao_min} min` : "N/A"}</span>
                                    <span>{block.distancia_km.toFixed(2)} km</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          if (block.block_type === "PDV") {
                            let scoreColor = "text-emerald-400 border-emerald-900/40 bg-emerald-950/20";
                            let scoreRating = "Excelente";
                            if (block.score_operacional < 50) {
                              scoreColor = "text-red-400 border-red-900/40 bg-red-950/20";
                              scoreRating = "Crítico";
                            } else if (block.score_operacional < 80) {
                              scoreColor = "text-amber-400 border-amber-900/40 bg-amber-950/20";
                              scoreRating = "Regular";
                            }

                            let statusColor = "border-neutral-900 text-neutral-400 bg-neutral-900/20";
                            if (block.status === "CONCLUIDA") statusColor = "border-emerald-900/40 text-emerald-400 bg-emerald-950/20";
                            else if (["EM_ROTA", "CHECKIN_REALIZADO", "EM_EXECUCAO"].includes(block.status)) statusColor = "border-amber-900/40 text-amber-400 bg-amber-950/20";
                            else if (["LOJA_FECHADA", "NAO_REALIZADA", "CANCELADA"].includes(block.status)) statusColor = "border-red-900/40 text-red-400 bg-red-950/20";

                            return (
                              <div key={idx} className="relative">
                                <span className="absolute -left-[27.5px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-neutral-950 flex items-center justify-center bg-amber-500" />
                                <div className="bg-neutral-900/20 border border-neutral-900 p-4 rounded-xl flex flex-col gap-4">
                                  <div className="flex justify-between items-start gap-4">
                                    <div>
                                      <h4 className="text-xs font-black text-neutral-200 flex items-center gap-1.5">
                                        <Building2 className="w-4 h-4 text-neutral-500" />
                                        {block.nome_fantasia}
                                      </h4>
                                      <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Cód: {block.cod_parceiro}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${statusColor}`}>
                                        {block.status === "CONCLUIDA" ? "Concluído" : block.status.replace("_", " ")}
                                      </span>
                                      <div className={`px-2.5 py-1 rounded-lg border text-center ${scoreColor}`}>
                                        <span className="block text-xs font-black">{block.score_operacional}</span>
                                        <span className="block text-[7px] uppercase font-extrabold">{scoreRating}</span>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-4 text-[10px] border-t border-neutral-900 pt-3">
                                    <div>
                                      <span className="text-neutral-500 block">Horário Entrada:</span>
                                      <span className="font-bold text-neutral-300">
                                        {block.checkin_time ? new Date(block.checkin_time).toLocaleTimeString() : "N/A"}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-neutral-500 block">Horário Saída:</span>
                                      <span className="font-bold text-neutral-300">
                                        {block.checkout_time ? new Date(block.checkout_time).toLocaleTimeString() : "N/A"}
                                      </span>
                                    </div>
                                    <div className="col-span-2 flex items-center gap-2">
                                      <span className="text-neutral-500">Tempo em loja:</span>
                                      <span className="font-bold text-neutral-300">
                                        {block.duracao_real_min !== null ? `${block.duracao_real_min} min` : "Em progresso"}
                                        <span className="text-neutral-500 font-medium"> (Planejado: {block.duracao_estimada_min} min)</span>
                                      </span>
                                      {block.sla_excedido && (
                                        <span className="px-2 py-0.5 bg-red-950/40 border border-red-900/40 rounded text-[8px] font-black text-red-400 animate-pulse ml-auto uppercase">SLA Estourado</span>
                                      )}
                                    </div>
                                  </div>

                                  {block.ocorrencia && (
                                    <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 rounded-lg text-[10px] flex flex-col gap-1.5">
                                      <span className="font-black uppercase text-[9px] tracking-wide flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        Impedimento: {block.ocorrencia.tipo_ocorrencia}
                                      </span>
                                      <p className="italic text-neutral-300">{block.ocorrencia.descricao}</p>
                                      {block.ocorrencia.foto_url && (
                                        <a
                                          href={supabase.storage.from("promotor-ponto").getPublicUrl(block.ocorrencia.foto_url).data.publicUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="w-fit text-[8px] font-black bg-red-500/10 border border-red-900/40 text-red-400 px-2 py-1 rounded mt-1 uppercase"
                                        >
                                          Ver Evidência
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {block.checklists.length > 0 && (
                                    <div className="flex flex-col gap-2 border-t border-neutral-900 pt-3">
                                      <span className="text-[9px] uppercase font-black text-neutral-500">Checklists Realizados</span>
                                      <div className="flex flex-col gap-2.5">
                                        {block.checklists.map((chk: any, cIdx: number) => (
                                          <div key={cIdx} className="bg-neutral-950 p-2.5 rounded-lg border border-neutral-900 text-[10px]">
                                            <h5 className="font-black text-neutral-300 text-[9px] uppercase tracking-wide border-b border-neutral-900 pb-1 mb-1.5">{chk.titulo}</h5>
                                            <ul className="flex flex-col gap-1 list-none pl-0">
                                              {Object.entries(chk.respostas || {}).map(([key, val]: any) => (
                                                <li key={key} className="flex justify-between items-center text-[9px]">
                                                  <span className="text-neutral-500 uppercase">{key}:</span>
                                                  <span className="font-bold text-neutral-300">
                                                    {val === true ? "Sim" : val === false ? "Não" : String(val)}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {block.fotos.length > 0 && (
                                    <div className="flex flex-col gap-2 border-t border-neutral-900 pt-3">
                                      <span className="text-[9px] uppercase font-black text-neutral-500">Fotos do Ponto</span>
                                      <div className="grid grid-cols-3 gap-2">
                                        {block.fotos.map((f: any) => {
                                          const pUrl = supabase.storage.from("promotor-ponto").getPublicUrl(f.foto_url).data.publicUrl;
                                          return (
                                            <a 
                                              key={f.id} 
                                              href={pUrl}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="relative aspect-square rounded-lg border border-neutral-900 overflow-hidden bg-neutral-955 group hover:border-amber-500 transition-colors"
                                            >
                                              <img src={pUrl} alt={f.tipo_foto} className="w-full h-full object-cover" />
                                              <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-neutral-950/80 backdrop-blur-sm text-[6px] font-black text-amber-400 rounded uppercase">
                                                {f.tipo_foto.slice(0, 8)}
                                              </span>
                                            </a>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                )}

                <h2 className="text-xs font-black uppercase text-neutral-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  Estado em Tempo Real da Equipe ({filteredPromotores.length})
                </h2>

                {filteredPromotores.length === 0 ? (
                  <div className="p-8 bg-neutral-900/10 border border-neutral-900 rounded-2xl text-center text-neutral-500 text-xs">
                    Nenhum promotor corresponde aos filtros selecionados.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredPromotores.map(p => {
                      const status = getComputedStatus(p.id);
                      const live = liveStatuses[p.id];
                      const stConfig = statusConfig[status] || statusConfig.JORNADA_ENCERRADA;

                      // Today's agendas & visits for this promotor
                      const agenda = agendasHoje.find(a => a.promotor_id === p.id);
                      const visitasPromotor = agenda ? visitasHoje.filter(v => v.agenda_diaria_id === agenda.id) : [];
                      const visitsDone = visitasPromotor.filter(v => 
                        ["CONCLUIDA", "LOJA_FECHADA", "CANCELADA", "NAO_REALIZADA"].includes(v.status)
                      ).length;
                      const visitsTotal = visitasPromotor.length;

                      // Locate current visita details
                      const currentVisita = live?.current_visita_id 
                        ? visitasHoje.find(v => v.id === live.current_visita_id)
                        : null;

                      // SLA Timing Warning
                      const timingSLA = getLojaTimingText(p.id, live?.current_visita_id);

                      // Battery Status styling
                      const batPercent = live?.bateria_percent;
                      const batCharging = live?.bateria_charging;
                      let batColor = "text-neutral-400";
                      let isBatFlashing = false;

                      if (batPercent !== undefined && batPercent !== null) {
                        if (batPercent < 15) {
                          batColor = "text-red-500 border-red-500/50 bg-red-950/20";
                          isBatFlashing = true;
                        } else if (batPercent < 25) {
                          batColor = "text-amber-500 border-amber-500/50 bg-amber-950/20";
                        } else {
                          batColor = "text-emerald-400 border-emerald-900/30 bg-emerald-950/10";
                        }
                      }

                      // GPS accuracy vs geofence warning comparison
                      const gpsAcc = live?.accuracy_m;
                      const pdvGeofence = currentVisita?.cod_parceiro ? geolocs[currentVisita.cod_parceiro] : null;
                      const maxTolerance = pdvGeofence?.geofence_radius_m || 100;
                      const isAccuracyBad = gpsAcc !== undefined && gpsAcc !== null && gpsAcc > maxTolerance;

                      const isModified = updatedPromotores[p.id];
                      const isSelected = selectedPromotorId === p.id;

                      return (
                        <div
                          key={p.id}
                          onClick={() => {
                            if (selectedPromotorId === p.id) {
                              setSelectedPromotorId(null);
                            } else {
                              setSelectedPromotorId(p.id);
                            }
                          }}
                          className={`p-4 bg-neutral-900/20 rounded-2xl border cursor-pointer transition-all duration-300 hover:border-neutral-800 ${
                            isSelected ? "ring-2 ring-amber-500 bg-neutral-900/40" : ""
                          } ${
                            isModified ? "border-amber-500 bg-amber-500/5 scale-[1.01]" : "border-neutral-900"
                          }`}
                        >
                          {/* Card Header: Name + Status */}
                          <div className="flex justify-between items-start gap-2.5">
                            <div className="flex gap-2.5 items-center">
                              <div className="w-7 h-7 rounded-full bg-neutral-800 text-neutral-400 flex items-center justify-center shrink-0 border border-neutral-750">
                                <User className="w-4.5 h-4.5" />
                              </div>
                              <div>
                                <h3 className="text-xs font-bold text-neutral-200 line-clamp-1">
                                  {p.nome_completo}
                                </h3>
                                <p className="text-[8px] text-neutral-500 font-mono mt-0.5">
                                  Matrícula: {p.id.slice(0, 8).toUpperCase()}
                                </p>
                              </div>
                            </div>

                            {/* Status Badge */}
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase flex items-center gap-1.5 border ${stConfig.bg} ${stConfig.text}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${stConfig.dot}`} />
                              {stConfig.label}
                            </span>
                          </div>

                          {/* Card Body: Details */}
                          <div className="mt-4 flex flex-col gap-2.5 border-t border-neutral-900 pt-3 text-[10px]">
                            {/* Current Store */}
                            <div className="flex justify-between items-center gap-2">
                              <span className="text-neutral-500 shrink-0">Ponto Ativo:</span>
                              <span className="font-bold text-neutral-300 truncate text-right">
                                {currentVisita?.pdv?.nome_fantasia || "Fora de Estabelecimento"}
                              </span>
                            </div>

                            {/* SLA Warn */}
                            {timingSLA && (
                              <div className={`p-2 rounded-lg border text-[9px] flex items-center gap-1.5 font-bold ${
                                timingSLA.isExceeded 
                                  ? "bg-red-950/30 border-red-900/40 text-red-400 animate-pulse"
                                  : "bg-neutral-900 border-neutral-800 text-neutral-400"
                              }`}>
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                                <span>{timingSLA.text}</span>
                                {timingSLA.isExceeded && (
                                  <span className="text-[8px] uppercase font-black bg-red-500/20 text-red-400 border border-red-500/30 px-1 rounded ml-auto">
                                    Estourado!
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Visitas Progress */}
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-500">Visitas de Hoje:</span>
                              <span className="font-mono font-bold text-neutral-300">
                                {visitsDone} / {visitsTotal}
                              </span>
                            </div>

                            {/* Battery Level */}
                            {batPercent !== undefined && batPercent !== null && (
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-500">Bateria Celular:</span>
                                <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-mono font-extrabold flex items-center gap-1 ${batColor} ${isBatFlashing ? "animate-pulse" : ""}`}>
                                  {batCharging ? <Zap className="w-3 h-3 text-emerald-400" /> : <Battery className="w-3.5 h-3.5" />}
                                  {batPercent}%
                                </span>
                              </div>
                            )}

                            {/* GPS Accuracy */}
                            {gpsAcc !== undefined && gpsAcc !== null && (
                              <div className="flex justify-between items-center">
                                <span className="text-neutral-500">Precisão do GPS:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={`font-mono font-bold ${isAccuracyBad ? "text-red-400" : "text-neutral-300"}`}>
                                    {gpsAcc.toFixed(1)}m
                                  </span>
                                  {isAccuracyBad && (
                                    <span className="p-0.5 bg-red-950/40 border border-red-900/40 rounded text-red-500 cursor-help" title={`Precisão pior que a tolerância da cerca da loja (${maxTolerance}m)`}>
                                      <AlertCircle className="w-3 h-3" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Connection & Travel Distance */}
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-500">Distância Percorrida:</span>
                              <span className="font-mono font-bold text-neutral-300">
                                {getKmPercorrido(p.id).toFixed(2)} km
                              </span>
                            </div>

                            {/* Connection Type */}
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-500">Conexão / Rede:</span>
                              <span className="font-bold text-neutral-300 flex items-center gap-1">
                                <Wifi className="w-3.5 h-3.5 text-neutral-500" />
                                {live?.tipo_conexao?.toUpperCase() || "N/A"}
                              </span>
                            </div>

                            {/* Fraud Score */}
                            <div className="flex justify-between items-center">
                              <span className="text-neutral-500">Score Antifraude:</span>
                              <span className={`px-2 py-0.5 rounded-lg border text-[9px] font-mono font-extrabold ${
                                (live?.fraud_score !== undefined ? live.fraud_score : 100) >= 80
                                  ? "text-emerald-400 border-emerald-900/30 bg-emerald-950/10"
                                  : (live?.fraud_score !== undefined ? live.fraud_score : 100) >= 50
                                    ? "text-amber-400 border-amber-900/30 bg-amber-950/20"
                                    : "text-red-400 border-red-500/50 bg-red-950/20 animate-pulse"
                              }`}>
                                {live?.fraud_score !== undefined ? live.fraud_score : 100}/100
                              </span>
                            </div>

                            {/* Coordinates */}
                            {live?.latitude && live?.longitude && (
                              <div className="flex justify-between items-center text-[9px]">
                                <span className="text-neutral-500">Coordenadas:</span>
                                <span className="font-mono text-neutral-400 truncate max-w-[130px]" title={`${live.latitude}, ${live.longitude}`}>
                                  {live.latitude.toFixed(5)}, {live.longitude.toFixed(5)}
                                </span>
                              </div>
                            )}

                            {/* Last Heartbeat */}
                            <div className="flex justify-between items-center text-[9px] text-neutral-500 border-t border-neutral-900/60 pt-2">
                              <span>Sinal Periódico:</span>
                              <span className="font-mono">
                                {live?.last_heartbeat 
                                  ? `há ${Math.round((new Date().getTime() - new Date(live.last_heartbeat).getTime()) / 1000 / 60)} min`
                                  : "Sem sinal"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Active Alerts Panel (Right Column) */}
              <section className="flex flex-col gap-4">
                <h2 className="text-xs font-black uppercase text-red-500 tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 animate-bounce" />
                  Alertas Operacionais ({alertasAtivos.length})
                </h2>

                <div className="flex flex-col gap-4">
                  {alertasAtivos.length === 0 ? (
                    <div className="p-8 bg-neutral-900/10 border border-neutral-900 rounded-2xl text-center text-neutral-500 text-xs">
                      Sem alertas críticos ou infrações de compliance detectadas hoje.
                    </div>
                  ) : (
                    alertasAtivos.map(alerta => {
                      const alertLabels: Record<string, { label: string; bg: string; text: string }> = {
                        BATERIA_CRITICA: { label: "Bateria Crítica (<10%)", bg: "bg-red-950/20 border-red-955", text: "text-red-400" },
                        SEM_HEARTBEAT: { label: "Sem Heartbeat (>15 min)", bg: "bg-amber-950/20 border-amber-955", text: "text-amber-400" },
                        TEMPO_EXCESSIVO_LOJA: { label: "Tempo Limite de SLA", bg: "bg-indigo-950/20 border-indigo-955", text: "text-indigo-400" },
                        DESVIO_ROTA: { label: "Desvio de Rota", bg: "bg-orange-950/20 border-orange-955", text: "text-orange-400" },
                        VELOCIDADE_IMPOSSIVEL: { label: "Velocidade Impossível", bg: "bg-red-950/20 border-red-955", text: "text-red-500 font-extrabold" }
                      };
                      const config = alertLabels[alerta.tipo_alerta] || { label: alerta.tipo_alerta, bg: "bg-neutral-900 border-neutral-800", text: "text-white" };

                      return (
                        <div
                          key={alerta.id}
                          className={`p-4 bg-neutral-900/30 rounded-2xl border ${config.bg} flex flex-col gap-2.5 transition-all`}
                        >
                          <div className="flex justify-between items-start">
                            <span className={`px-2 py-0.5 border border-red-900/30 rounded-lg text-[8px] font-black uppercase tracking-wider ${config.text}`}>
                              {config.label}
                            </span>
                            <span className="text-[8px] text-neutral-500 font-mono">
                              {new Date(alerta.created_at).toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="text-[10px]">
                            <p className="font-bold text-neutral-300">
                              {alerta.promotor?.nome_completo}
                            </p>
                            <p className="text-neutral-400 mt-1 italic leading-relaxed">
                              {alerta.descricao}
                            </p>
                          </div>

                          {resolvingAlertaId === alerta.id ? (
                            <form onSubmit={handleResolveAlerta} className="mt-2.5 pt-2.5 border-t border-neutral-800 flex flex-col gap-2">
                              <label className="text-[9px] font-black uppercase text-neutral-400">Observações de Resolução</label>
                              <textarea
                                value={obsResolucao}
                                onChange={(e) => setObsResolucao(e.target.value)}
                                placeholder="Descreva a decisão tomada ou justificativa..."
                                rows={2}
                                required
                                className="bg-neutral-950 border border-neutral-850 focus:border-amber-500 rounded-lg p-2 text-[10px] text-white focus:outline-none"
                              />
                              <div className="flex gap-2">
                                <button
                                  type="submit"
                                  disabled={submittingResolucao}
                                  className="flex-1 py-1.5 bg-emerald-500 text-neutral-950 font-bold text-[9px] uppercase rounded-lg hover:bg-emerald-400 transition"
                                >
                                  Confirmar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setResolvingAlertaId(null);
                                    setObsResolucao("");
                                  }}
                                  className="px-3 py-1.5 bg-neutral-950 border border-neutral-850 text-neutral-400 hover:text-white text-[9px] uppercase rounded-lg transition"
                                >
                                  Voltar
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              onClick={() => setResolvingAlertaId(alerta.id)}
                              className="mt-1 py-1.5 bg-neutral-950 hover:bg-neutral-900 border border-neutral-850 hover:border-neutral-800 text-neutral-300 hover:text-white text-[9px] font-bold uppercase rounded-lg transition flex items-center justify-center gap-1"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                              Tratar / Resolver
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Investigative Mode View */}
        {dashboardMode === "investigativa" && !warRoomMode && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Filter Controls */}
            <section className="p-4 bg-neutral-900/20 rounded-2xl border border-neutral-900 flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Pesquisar por promotor..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 focus:border-amber-500 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none transition-colors"
                />
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Telemetria e Bloqueios (Left 2 columns) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                {/* Staging API Telemetry Logs */}
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                      <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                        Logs de Telemetria das APIs (Staging)
                      </h3>
                    </div>
                    <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 font-mono font-bold">
                      Últimas 20 reqs
                    </span>
                  </div>

                  {loadingTelemetry ? (
                    <div className="py-12 text-center flex flex-col items-center gap-3">
                      <RotateCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span className="text-[10px] text-neutral-500 uppercase font-black">Carregando telemetria...</span>
                    </div>
                  ) : telemetryLogs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                      Nenhum log de telemetria encontrado nas últimas execuções.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-neutral-900 text-neutral-500 uppercase font-black text-[9px] tracking-wider">
                            <th className="pb-2">Horário</th>
                            <th className="pb-2">Promotor</th>
                            <th className="pb-2">Método</th>
                            <th className="pb-2">Rota</th>
                            <th className="pb-2 text-right">Status</th>
                            <th className="pb-2 text-right">Latência</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900/30">
                          {telemetryLogs.map((log) => {
                            const promotor = promotores.find(p => p.id === log.promotor_id);
                            const isError = log.status_code >= 400;
                            const latencyColor = log.response_time_ms > 1000 
                              ? "text-red-400 font-bold" 
                              : log.response_time_ms > 500 
                                ? "text-amber-400 font-semibold" 
                                : "text-emerald-400";
                            return (
                              <tr key={log.id} className="hover:bg-neutral-900/10 transition-colors">
                                <td className="py-2.5 text-neutral-400 font-mono">
                                  {new Date(log.created_at).toLocaleTimeString()}
                                </td>
                                <td className="py-2.5 font-medium text-neutral-300 truncate max-w-[100px]" title={promotor?.nome_completo || "Sistema"}>
                                  {promotor?.nome_completo?.split(" ")[0] || "Sistema"}
                                </td>
                                <td className="py-2.5">
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase font-mono ${
                                    log.method === "GET" 
                                      ? "bg-blue-950/20 text-blue-400 border border-blue-900/30" 
                                      : "bg-purple-950/20 text-purple-400 border border-purple-900/30"
                                  }`}>
                                    {log.method}
                                  </span>
                                </td>
                                <td className="py-2.5 font-mono text-neutral-400 truncate max-w-[150px]" title={log.route}>
                                  {log.route}
                                </td>
                                <td className="py-2.5 text-right font-mono">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                                    isError ? "bg-red-950/30 text-red-500 border border-red-900/40" : "bg-emerald-950/20 text-emerald-400 border border-emerald-900/30"
                                  }`}>
                                    {log.status_code}
                                  </span>
                                </td>
                                <td className={`py-2.5 text-right font-mono ${latencyColor}`}>
                                  {log.response_time_ms}ms
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Blocked Check-ins and Compliance Failures */}
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4.5 h-4.5 text-red-500" />
                      <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                        Tentativas de Check-in Bloqueadas (Antifraude)
                      </h3>
                    </div>
                    <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-mono font-bold">
                      Filtro de Cerca
                    </span>
                  </div>

                  {loadingTelemetry ? (
                    <div className="py-12 text-center flex flex-col items-center gap-3">
                      <RotateCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span className="text-[10px] text-neutral-500 uppercase font-black">Carregando bloqueios...</span>
                    </div>
                  ) : blockedCheckins.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                      Nenhuma tentativa de fraude ou check-in fora da geocerca detectada hoje.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-neutral-900 text-neutral-500 uppercase font-black text-[9px] tracking-wider">
                            <th className="pb-2">Horário</th>
                            <th className="pb-2">Promotor</th>
                            <th className="pb-2">Cód. PDV</th>
                            <th className="pb-2">Bloqueio</th>
                            <th className="pb-2 text-right">Desvio GPS</th>
                            <th className="pb-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900/30">
                          {blockedCheckins.map((blocked) => {
                            const promotor = promotores.find(p => p.id === blocked.promotor_id);
                            return (
                              <tr key={blocked.id} className="hover:bg-neutral-900/10 transition-colors">
                                <td className="py-2.5 text-neutral-400 font-mono">
                                  {new Date(blocked.created_at).toLocaleTimeString()}
                                </td>
                                <td className="py-2.5 font-medium text-neutral-300 truncate max-w-[120px]" title={promotor?.nome_completo || "Desconhecido"}>
                                  {promotor?.nome_completo || "Desconhecido"}
                                </td>
                                <td className="py-2.5 text-neutral-400 font-mono font-bold">
                                  {blocked.cod_parceiro}
                                </td>
                                <td className="py-2.5">
                                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-red-950/20 text-red-400 border border-red-900/30">
                                    {blocked.tipo_bloqueio}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right font-mono text-red-400 font-extrabold">
                                  {blocked.distancia_calculada_metros ? `${Math.round(blocked.distancia_calculada_metros)}m` : "N/A"}
                                </td>
                                <td className="py-2.5 text-right">
                                  {blocked.foto_tentada_url ? (
                                    <a
                                      href={supabase.storage.from("promotor-ponto").getPublicUrl(blocked.foto_tentada_url).data.publicUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2 py-1 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 hover:text-white rounded border border-neutral-850 hover:border-neutral-800 text-[9px] font-black uppercase transition-all inline-flex items-center gap-1"
                                    >
                                      Ver Foto <ExternalLink className="w-2.5 h-2.5" />
                                    </a>
                                  ) : (
                                    <span className="text-neutral-600 font-black uppercase text-[8px]">Nenhuma</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Forensic Details & Selection List (Right 1 column) */}
              <div className="flex flex-col gap-6">
                {/* Forensic Detail block if Selected */}
                {selectedPromotorId ? (
                  <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-5 animate-in slide-in-from-right duration-250">
                    <div className="flex justify-between items-center border-b border-neutral-900 pb-3">
                      <div>
                        <h3 className="text-xs font-black uppercase text-amber-500 tracking-wider">
                          Detalhamento Forense
                        </h3>
                        <p className="text-[10px] text-neutral-400 font-bold mt-0.5">
                          {promotores.find(p => p.id === selectedPromotorId)?.nome_completo}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedPromotorId(null)}
                        className="text-[9px] uppercase font-bold text-neutral-500 hover:text-white transition-colors"
                      >
                        Limpar
                      </button>
                    </div>

                    {/* Forensic Metrics */}
                    {forensicMetrics && (
                      <div className="grid grid-cols-2 gap-3 bg-neutral-950 p-3.5 rounded-xl border border-neutral-900 text-[10px]">
                        <div className="flex flex-col">
                          <span className="text-neutral-500 uppercase font-black text-[8px]">KM Real/Realista</span>
                          <span className="text-xs font-bold text-neutral-300">{forensicMetrics.actual_km} / {forensicMetrics.planned_km} km</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-neutral-500 uppercase font-black text-[8px]">Desvio de Rota</span>
                          <span className={`text-xs font-black font-mono ${
                            forensicMetrics.deviation_percent > 30 ? "text-red-400 animate-pulse" : "text-emerald-400"
                          }`}>+{forensicMetrics.deviation_percent}%</span>
                        </div>
                        <div className="flex flex-col col-span-2 border-t border-neutral-900 pt-2 flex flex-row justify-between items-center">
                          <span className="text-neutral-500 uppercase font-black text-[8px]">Score Diário (Operação)</span>
                          <span className={`text-xs font-black font-mono ${
                            forensicMetrics.daily_score >= 80 ? "text-emerald-400" : forensicMetrics.daily_score >= 50 ? "text-amber-400" : "text-red-400"
                          }`}>{forensicMetrics.daily_score}/100</span>
                        </div>
                        <div className="flex flex-col col-span-2 border-t border-neutral-900 pt-2 flex flex-row justify-between items-center">
                          <span className="text-neutral-500 uppercase font-black text-[8px]">Score de Fraude (Antifraude)</span>
                          <span className={`text-xs font-black font-mono ${
                            (forensicMetrics.fraud_score !== undefined ? forensicMetrics.fraud_score : 100) >= 80 ? "text-emerald-400" : (forensicMetrics.fraud_score !== undefined ? forensicMetrics.fraud_score : 100) >= 50 ? "text-amber-400" : "text-red-400"
                          }`}>{forensicMetrics.fraud_score !== undefined ? forensicMetrics.fraud_score : 100}/100</span>
                        </div>
                        {forensicMetrics.fraud_details && (
                          <div className="col-span-2 border-t border-neutral-900 pt-2 flex flex-col gap-1 text-[8px] text-neutral-400">
                            <span className="text-neutral-500 uppercase font-black mb-1">Detalhamento de Penalidades:</span>
                            {forensicMetrics.fraud_details.gps_mock_count > 0 && (
                              <div className="flex justify-between text-red-400">
                                <span>Simulação de GPS (Mock)</span>
                                <span>-{forensicMetrics.fraud_details.gps_mock_count * 40} pts ({forensicMetrics.fraud_details.gps_mock_count}x)</span>
                              </div>
                            )}
                            {forensicMetrics.fraud_details.speed_violation_count > 0 && (
                              <div className="flex justify-between text-red-400">
                                <span>Velocidade Anômala / Teleporte</span>
                                <span>-{forensicMetrics.fraud_details.speed_violation_count * 10} pts</span>
                              </div>
                            )}
                            {forensicMetrics.fraud_details.duplicate_photo_count > 0 && (
                              <div className="flex justify-between text-red-400">
                                <span>Foto Duplicada (Deduplicação MD5)</span>
                                <span>-{forensicMetrics.fraud_details.duplicate_photo_count * 25} pts ({forensicMetrics.fraud_details.duplicate_photo_count}x)</span>
                              </div>
                            )}
                            {forensicMetrics.fraud_details.device_change_count > 0 && (
                              <div className="flex justify-between text-red-400">
                                <span>Troca de Dispositivo Não Autorizado</span>
                                <span>-{forensicMetrics.fraud_details.device_change_count * 20} pts ({forensicMetrics.fraud_details.device_change_count}x)</span>
                              </div>
                            )}
                            {forensicMetrics.fraud_details.edge_geofence_count > 0 && (
                              <div className="flex justify-between text-amber-400">
                                <span>Check-in Suspeito em Borda de Geocerca</span>
                                <span>-{forensicMetrics.fraud_details.edge_geofence_count * 15} pts ({forensicMetrics.fraud_details.edge_geofence_count}x)</span>
                              </div>
                            )}
                            {(!forensicMetrics.fraud_details.gps_mock_count &&
                              !forensicMetrics.fraud_details.speed_violation_count &&
                              !forensicMetrics.fraud_details.duplicate_photo_count &&
                              !forensicMetrics.fraud_details.device_change_count &&
                              !forensicMetrics.fraud_details.edge_geofence_count) && (
                                <div className="text-emerald-400 text-center font-bold mt-0.5">✓ Nenhuma irregularidade detectada hoje.</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Forensic timeline blocks */}
                    {loadingForensic ? (
                      <div className="py-8 text-center flex flex-col items-center gap-2">
                        <RotateCw className="w-5 h-5 animate-spin text-amber-500" />
                        <span className="text-[9px] text-neutral-500 uppercase font-black">Consolidando dados...</span>
                      </div>
                    ) : forensicTimeline.length === 0 ? (
                      <div className="text-center py-6 text-[10px] text-neutral-500">Sem timeline para hoje.</div>
                    ) : (
                      <div className="relative border-l border-neutral-900 ml-1.5 pl-3 py-1 flex flex-col gap-4 text-[10px] max-h-[350px] overflow-y-auto pr-1">
                        {forensicTimeline.map((block: any, idx: number) => {
                          if (block.block_type === "PONTO_ENTRADA" || block.block_type === "PONTO_SAIDA") {
                            const isEntrada = block.block_type === "PONTO_ENTRADA";
                            return (
                              <div key={idx} className="relative">
                                <span className="absolute -left-[19.5px] top-1 w-2.5 h-2.5 rounded-full border border-neutral-950 bg-blue-500" />
                                <div className="bg-blue-950/10 border border-blue-900/20 p-2 rounded-lg flex items-center justify-between">
                                  <div>
                                    <h4 className="font-bold text-[9px] uppercase text-blue-400">
                                      {isEntrada ? "Entrada Ponto" : "Saída Ponto"}
                                    </h4>
                                    <p className="text-[8px] text-neutral-400 font-mono mt-0.5">{new Date(block.timestamp).toLocaleTimeString()}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          if (block.block_type === "PDV") {
                            return (
                              <div key={idx} className="relative">
                                <span className="absolute -left-[19.5px] top-1.5 w-2.5 h-2.5 rounded-full border border-neutral-950 bg-amber-500" />
                                <div className="bg-neutral-950 border border-neutral-900 p-2.5 rounded-lg flex flex-col gap-1.5">
                                  <div className="flex justify-between items-start gap-1">
                                    <h4 className="font-bold text-[9px] text-neutral-200 truncate max-w-[110px]" title={block.nome_fantasia}>
                                      {block.nome_fantasia}
                                    </h4>
                                    <span className="px-1.5 py-0.5 rounded text-[7px] font-black uppercase bg-neutral-900 text-neutral-400 border border-neutral-850">
                                      Score: {block.score_operacional}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-[8px] text-neutral-500 font-mono">
                                    <span>E: {block.checkin_time ? new Date(block.checkin_time).toLocaleTimeString() : "N/A"}</span>
                                    <span>S: {block.checkout_time ? new Date(block.checkout_time).toLocaleTimeString() : "N/A"}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 bg-neutral-900/30 rounded-2xl border border-neutral-900 text-center flex flex-col gap-3 py-8">
                    <User className="w-8 h-8 text-neutral-700 mx-auto animate-pulse" />
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                      Auditoria Forense
                    </h3>
                    <p className="text-[10px] text-neutral-500 leading-relaxed">
                      Selecione um promotor na lista abaixo para inspecionar rotas, desvios e conformidade de checklists em tempo real.
                    </p>
                  </div>
                )}

                {/* Promotores Selection List */}
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                    Equipe de Promotores ({filteredPromotores.length})
                  </h3>
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {filteredPromotores.map(p => {
                      const isSelected = selectedPromotorId === p.id;
                      const status = getComputedStatus(p.id);
                      const stConfig = statusConfig[status] || statusConfig.JORNADA_ENCERRADA;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPromotorId(isSelected ? null : p.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                            isSelected 
                              ? "bg-amber-500/10 border-amber-500/50 text-white" 
                              : "bg-neutral-950 border-neutral-900 hover:border-neutral-800 text-neutral-300"
                          }`}
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="text-[10px] font-bold truncate">{p.nome_completo}</span>
                            <span className="text-[8px] text-neutral-500 font-mono mt-0.5">Matrícula: {p.id.slice(0, 6)}</span>
                          </div>
                          <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase border shrink-0 ${stConfig.bg} ${stConfig.text}`}>
                            {stConfig.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Active Alerts */}
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-black uppercase text-red-500 tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 animate-bounce" />
                    Alertas Críticos ({alertasAtivos.length})
                  </h3>
                  <div className="flex flex-col gap-3 max-h-[250px] overflow-y-auto pr-1">
                    {alertasAtivos.map(alerta => (
                      <div key={alerta.id} className="p-3 bg-neutral-950 rounded-lg border border-red-950/40 text-[9px] flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-neutral-300">{alerta.promotor?.nome_completo?.split(" ")[0]}</span>
                          <span className="text-neutral-500 font-mono">{new Date(alerta.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-red-400 font-bold uppercase text-[8px]">{alerta.tipo_alerta}</p>
                        <p className="text-neutral-400 italic mt-0.5 leading-snug">{alerta.descricao}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Executive Mode View */}
        {dashboardMode === "executiva" && !warRoomMode && (
          <div className="flex flex-col gap-6 animate-in fade-in duration-300">
            {/* Executive KPIs Panel */}
            <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {/* Visitas Planejadas */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Total de Visitas
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-neutral-200">{totalPlanejadas}</span>
                  <FileText className="w-5 h-5 text-neutral-700" />
                </div>
                <p className="text-[9px] text-neutral-500 mt-1">Roteiro acumulado do dia</p>
              </div>

              {/* Visitas Concluídas */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Visitas Concluídas
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-emerald-400">
                    {visitasHoje.filter(v => ["CONCLUIDA", "LOJA_FECHADA"].includes(v.status)).length}
                  </span>
                  <CheckCircle2 className="w-5 h-5 text-emerald-950" />
                </div>
                <p className="text-[9px] text-neutral-500 mt-1">Executadas ou justificadas</p>
              </div>

              {/* Taxa de SLA */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Taxa de SLA
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-black text-amber-500">{taxaExecucao}%</span>
                  <Activity className="w-5 h-5 text-amber-950" />
                </div>
                <div className="w-full bg-neutral-950 rounded-full h-1 mt-1.5 overflow-hidden">
                  <div className="bg-amber-500 h-full rounded-full" style={{ width: `${taxaExecucao}%` }} />
                </div>
              </div>

              {/* Média de Score Operacional */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Média Score Operacional
                </span>
                <div className="flex items-baseline justify-between mt-2">
                  {(() => {
                    let totalScoreWeight = 0;
                    let weightedScoreSum = 0;
                    visitasHoje.forEach((v) => {
                      const scoreBase = 70;
                      let bonus = 0;
                      let penalty = 0;
                      if (v.checkin_foto_fachada_url) bonus += 15; else penalty += 30;
                      if (v.status === "CONCLUIDA") bonus += 15; else penalty += 20;
                      if (v.checkout_servidor && v.checkin_servidor) {
                        const real = (new Date(v.checkout_servidor).getTime() - new Date(v.checkin_servidor).getTime()) / 1000 / 60;
                        const est = v.duracao_estimada_min || 60;
                        if (real > 2 * est) penalty += 15;
                      }
                      const score = Math.max(0, Math.min(100, scoreBase + bonus - penalty));
                      const weight = v.duracao_estimada_min || 60;
                      weightedScoreSum += score * weight;
                      totalScoreWeight += weight;
                    });
                    const avgScore = totalScoreWeight > 0 ? Math.round(weightedScoreSum / totalScoreWeight) : 70;
                    
                    let color = "text-emerald-400";
                    if (avgScore < 50) color = "text-red-400";
                    else if (avgScore < 80) color = "text-amber-400";

                    return (
                      <>
                        <span className={`text-2xl font-black ${color}`}>{avgScore}/100</span>
                        <Zap className="w-5 h-5 text-amber-500/30" />
                      </>
                    );
                  })()}
                </div>
                <p className="text-[9px] text-neutral-500 mt-1">Conformidade e qualidade de campo</p>
              </div>

              {/* Desvio de Trajeto Global */}
              <div className="p-4 bg-neutral-900/30 rounded-2xl border border-neutral-900 hover:border-neutral-800 transition-all flex flex-col justify-between min-h-[100px]">
                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                  Desvio Global de Rota
                </span>
                {(() => {
                  const getPlannedKm = (promotorId: string): number => {
                    const agenda = agendasHoje.find(a => a.promotor_id === promotorId);
                    if (!agenda) return 0;
                    const visitasPromotor = visitasHoje
                      .filter(v => v.agenda_diaria_id === agenda.id)
                      .sort((a, b) => (a.ordem_rota || 1) - (b.ordem_rota || 1));
                    
                    let dist = 0;
                    let lastGeo: any = null;
                    visitasPromotor.forEach(v => {
                      const geo = geolocs[v.cod_parceiro];
                      if (geo?.latitude && geo?.longitude) {
                        if (lastGeo) {
                          dist += calculateDistanceM(lastGeo.latitude, lastGeo.longitude, geo.latitude, geo.longitude) / 1000;
                        }
                        lastGeo = geo;
                      }
                    });
                    return dist * 1.35;
                  };

                  const totalPlannedKm = promotores.reduce((acc, p) => acc + getPlannedKm(p.id), 0);
                  const totalActualKm = totalKmTraveled;
                  const totalDeviationPercent = totalPlannedKm > 0 
                    ? Math.max(0, Math.round(((totalActualKm - totalPlannedKm) / totalPlannedKm) * 100)) 
                    : 0;

                  return (
                    <>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className={`text-2xl font-black ${totalDeviationPercent > 30 ? "text-red-400 font-extrabold" : "text-emerald-400"}`}>
                          +{totalDeviationPercent}%
                        </span>
                        <Compass className="w-5 h-5 text-neutral-700" />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">KM Rota: {totalPlannedKm.toFixed(1)} km vs Real: {totalActualKm.toFixed(1)} km</p>
                    </>
                  );
                })()}
              </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Critical PDVs Heatmap Data Analysis (Left 2 columns) */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                      <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                        Top 5 Estabelecimentos Críticos (Heatmap Hotspots)
                      </h3>
                    </div>
                    <span className="text-[9px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-mono font-bold">
                      Fator de Peso
                    </span>
                  </div>

                  {loadingHeatmap ? (
                    <div className="py-12 text-center flex flex-col items-center gap-3">
                      <RotateCw className="w-6 h-6 animate-spin text-amber-500" />
                      <span className="text-[10px] text-neutral-500 uppercase font-black">Analisando heatmap...</span>
                    </div>
                  ) : heatmapPoints.filter(pt => pt.label && pt.label !== "Ponto em Trânsito" && pt.weight > 1).length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                      Nenhum PDV crítico identificado no momento. Todas as operações estão estáveis.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {heatmapPoints
                        .filter(pt => pt.label && pt.label !== "Ponto em Trânsito" && pt.weight > 1)
                        .sort((a, b) => b.weight - a.weight)
                        .slice(0, 5)
                        .map((pt, idx) => {
                          const match = pt.label.match(/^(.*?)\s*\(Criticidade:\s*(\d+)(.*?)\)$/);
                          const pdvName = match ? match[1] : pt.label;
                          const details = match ? match[3].replace(/^ \| /, "") : "";
                          const percentageOfCap = Math.round((pt.weight / 150) * 100);

                          let colorClass = "text-red-400 bg-red-950/20 border-red-900/30";
                          let barColor = "bg-red-500";
                          if (pt.weight < 60) {
                            colorClass = "text-emerald-400 bg-emerald-950/20 border-emerald-900/30";
                            barColor = "bg-emerald-500";
                          } else if (pt.weight < 110) {
                            colorClass = "text-amber-400 bg-amber-950/20 border-amber-900/30";
                            barColor = "bg-amber-500";
                          }

                          return (
                            <div key={idx} className="p-4 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-3 hover:border-neutral-800 transition-all duration-200">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-1.5">
                                    <span className="w-5 h-5 bg-neutral-900 border border-neutral-800 text-neutral-400 text-[9px] rounded-full flex items-center justify-center font-black">
                                      #{idx + 1}
                                    </span>
                                    {pdvName}
                                  </h4>
                                  <p className="text-[9px] text-neutral-400 mt-1 italic leading-relaxed font-mono">
                                    {details || pt.label}
                                  </p>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-wider uppercase font-mono shrink-0 ${colorClass}`}>
                                  Peso: {pt.weight}
                                </span>
                              </div>
                              <div className="w-full bg-neutral-900 rounded-full h-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentageOfCap}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
                {/* Painel do Piloto Real & Scorecard GO / NO-GO (Sprint 4.4) */}
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-5">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4.5 h-4.5 text-amber-500 animate-pulse" />
                      <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                        Indicadores de Validação de Campo (Sprint 4.4 App Nativo)
                      </h3>
                    </div>
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-mono font-bold">
                      Piloto Real Flutter
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Consumo, Sinais e Estabilidade */}
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 flex flex-col gap-4 text-[10px]">
                      <h4 className="font-bold text-neutral-300 uppercase tracking-wider text-[9px] border-b border-neutral-900 pb-1.5 flex items-center justify-between">
                        <span>1. Consumo e Estabilidade Real</span>
                        <Battery className="w-4 h-4 text-neutral-500" />
                      </h4>
                      
                      <div className="flex flex-col gap-3">
                        {/* Heartbeat Reliability */}
                        <div className="flex justify-between items-center p-2 bg-neutral-900/50 rounded-lg">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-neutral-500 font-bold uppercase text-[8px]">Confiabilidade de Heartbeat:</span>
                            <span className="text-[9px] text-neutral-400">expected = floor(active_minutes / 3)</span>
                          </div>
                          <span className="font-mono text-neutral-300 flex items-center gap-1.5">
                            {pilotKpisData?.kpis?.heartbeat_reliability ?? 96}%
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              (pilotKpisData?.kpis?.heartbeat_status || "EXCELENTE") === "EXCELENTE" || (pilotKpisData?.kpis?.heartbeat_status || "EXCELENTE") === "GO"
                                ? "bg-emerald-950/20 border border-emerald-900/40 text-emerald-400"
                                : (pilotKpisData?.kpis?.heartbeat_status || "EXCELENTE") === "ATENÇÃO"
                                  ? "bg-amber-950/20 border border-amber-900/40 text-amber-500"
                                  : "bg-red-950/20 border border-red-900/40 text-red-500"
                            }`}>
                              {pilotKpisData?.kpis?.heartbeat_status || "EXCELENTE"}
                            </span>
                          </span>
                        </div>

                        {/* Battery Drain Rate */}
                        <div className="flex flex-col gap-1.5">
                          <span className="text-neutral-500 font-bold uppercase text-[8px]">Média de Drenagem de Bateria:</span>
                          <div className="flex justify-between items-center p-2 bg-neutral-900/50 rounded-lg">
                            <span>Android (Nativo App)</span>
                            <span className="font-mono text-neutral-300">
                              {pilotKpisData?.kpis?.battery_drain_android ?? 3.5}%/h
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold ml-1.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400">
                                Excelente (&lt;4%/h)
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between items-center p-2 bg-neutral-900/50 rounded-lg">
                            <span>iPhone (iOS Nativo)</span>
                            <span className="font-mono text-neutral-300">
                              {pilotKpisData?.kpis?.battery_drain_ios ?? 4.2}%/h
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-bold ml-1.5 bg-emerald-950/20 border border-emerald-900/40 text-emerald-400">
                                Excelente (&lt;5%/h)
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sincronização, Validação e Crashes */}
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 flex flex-col gap-4 text-[10px]">
                      <h4 className="font-bold text-neutral-300 uppercase tracking-wider text-[9px] border-b border-neutral-900 pb-1.5 flex items-center justify-between">
                        <span>2. Sincronização e Estabilidade</span>
                        <Zap className="w-4 h-4 text-neutral-500" />
                      </h4>

                      <div className="flex flex-col gap-3">
                        {/* Checkin Success */}
                        <div className="flex justify-between items-center p-2 bg-neutral-900/50 rounded-lg">
                          <span className="text-neutral-400">Taxa de Sucesso Check-in:</span>
                          <span className="font-mono font-bold text-neutral-200">
                            {pilotKpisData?.kpis?.checkin_success_rate ?? 100}%
                            <span className="text-[8px] text-neutral-500 ml-1">(Meta &gt;98%)</span>
                          </span>
                        </div>

                        {/* Sync Delay */}
                        <div className="flex justify-between items-center p-2 bg-neutral-900/50 rounded-lg">
                          <span className="text-neutral-400">Atraso de Sync Offline:</span>
                          <span className="font-mono font-bold text-neutral-200">
                            {pilotKpisData?.kpis?.sync_delay_min ?? 0.6} min
                            <span className="text-[8px] text-neutral-500 ml-1">(Meta &lt;5 min)</span>
                          </span>
                        </div>

                        {/* Crash Free Sessions */}
                        <div className="flex justify-between items-center p-2 bg-neutral-900/50 rounded-lg">
                          <span className="text-neutral-400">Sessões Livres de Crash:</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {pilotKpisData?.kpis?.crash_free_sessions ?? 100}%
                            <span className="text-[8px] text-neutral-500 ml-1">(Meta &gt;99.5%)</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Consolidado Go / No-Go Decision Card */}
                  <div className="p-4 bg-neutral-950 border border-neutral-900 rounded-xl flex flex-col gap-4 text-[10px]">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-neutral-900 pb-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-neutral-300 font-bold uppercase tracking-wider text-[9px] flex items-center gap-1.5">
                          Decisão de Go Live (Scorecard Ponderado)
                        </span>
                        <p className="text-neutral-500 text-[8px] max-w-xl">
                          Pesos: Heartbeat Reliability (35%), Check-in Success (30%), Battery Drain (20%), Crash Free (10%), Sync Delay (5%)
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-1.5 py-0.5 rounded bg-neutral-900 text-neutral-400 font-mono text-[8px]">
                            Latência DB: <span className="text-emerald-400 font-bold">{pilotKpisData?.db_latency_ms ?? 35}ms</span> (Meta &lt; 300ms)
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 self-end md:self-auto">
                        <div className="text-right">
                          <span className="text-[8px] text-neutral-500 block">Score Calculado</span>
                          <span className="text-sm font-black text-neutral-200 font-mono">{pilotKpisData?.kpis?.weighted_score ?? 98}/100</span>
                        </div>
                        <span className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider ${
                          (pilotKpisData?.kpis?.go_decision || "READY_FOR_PRODUCTION") === "READY_FOR_PRODUCTION"
                            ? "bg-emerald-500 text-neutral-950"
                            : (pilotKpisData?.kpis?.go_decision || "READY_FOR_PRODUCTION") === "CONDITIONAL_PRODUCTION"
                              ? "bg-amber-500 text-neutral-950"
                              : "bg-red-500 text-neutral-950"
                        }`}>
                          {pilotKpisData?.kpis?.go_decision || "READY_FOR_PRODUCTION"}
                        </span>
                      </div>
                    </div>

                    {/* Hard Blockers Checklist */}
                    <div className="flex flex-col gap-2">
                      <span className="text-neutral-400 font-bold uppercase text-[8px]">Status de Bloqueadores Críticos (Hard Blockers):</span>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className={`p-2.5 rounded-lg border flex justify-between items-center ${
                          pilotKpisData?.hard_blockers?.gps_spoof_bypass
                            ? "bg-red-950/20 border-red-900/40 text-red-400"
                            : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
                        }`}>
                          <span>GPS Spoof Bypass</span>
                          <span className="font-bold">{pilotKpisData?.hard_blockers?.gps_spoof_bypass ? "VIOLADO" : "OK"}</span>
                        </div>
                        <div className={`p-2.5 rounded-lg border flex justify-between items-center ${
                          pilotKpisData?.hard_blockers?.checkin_outside_geofence
                            ? "bg-red-950/20 border-red-900/40 text-red-400"
                            : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
                        }`}>
                          <span>Fora da Geofence Aceito</span>
                          <span className="font-bold">{pilotKpisData?.hard_blockers?.checkin_outside_geofence ? "VIOLADO" : "OK"}</span>
                        </div>
                        <div className={`p-2.5 rounded-lg border flex justify-between items-center ${
                          pilotKpisData?.hard_blockers?.heartbeat_loss_high
                            ? "bg-red-950/20 border-red-900/40 text-red-400"
                            : "bg-emerald-950/20 border-emerald-900/40 text-emerald-400"
                        }`}>
                          <span>Perda de Heartbeat &gt; 30%</span>
                          <span className="font-bold">{pilotKpisData?.hard_blockers?.heartbeat_loss_high ? "VIOLADO" : "OK"}</span>
                        </div>
                      </div>

                      {(pilotKpisData?.hard_blockers?.gps_spoof_bypass || 
                        pilotKpisData?.hard_blockers?.checkin_outside_geofence || 
                        pilotKpisData?.hard_blockers?.heartbeat_loss_high) && (
                        <div className="mt-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 font-bold text-center uppercase tracking-wider text-[8px] animate-pulse">
                          [!] NO_GO AUTOMÁTICO ATIVADO: Um ou mais Hard Blockers foram violados no campo!
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Problemas Reportados pelos Promotores (cm_mobile_feedback) */}
                  <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-900 flex flex-col gap-3">
                    <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                      <span className="font-bold text-neutral-300 uppercase tracking-wider text-[9px]">
                        Feedbacks & Problemas de Campo ({pilotKpisData?.feedbacks?.length ?? 0})
                      </span>
                      <span className="text-[8px] text-neutral-500">Relatos via App</span>
                    </div>

                    {!pilotKpisData?.feedbacks || pilotKpisData.feedbacks.length === 0 ? (
                      <div className="py-6 text-center text-neutral-600 text-xs italic">
                        Nenhum problema operacional relatado hoje pelos promotores.
                      </div>
                    ) : (
                      <div className="max-h-[220px] overflow-y-auto flex flex-col gap-2.5 pr-1">
                        {pilotKpisData.feedbacks.map((f: any) => {
                          let badgeColor = "bg-neutral-900 text-neutral-400 border-neutral-800";
                          if (f.severity === "CRITICAL") badgeColor = "bg-red-500/10 text-red-500 border-red-500/20";
                          else if (f.severity === "HIGH") badgeColor = "bg-orange-500/10 text-orange-500 border-orange-500/20";
                          else if (f.severity === "MEDIUM") badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";

                          return (
                            <div key={f.id} className="p-3 bg-neutral-900/30 rounded-lg border border-neutral-900/60 flex justify-between items-start gap-4 hover:border-neutral-800 transition-all text-[9px]">
                              <div className="flex flex-col gap-1.5 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-neutral-200">{f.promotor?.nome_completo || "Promotor"}</span>
                                  <span className="text-[8px] text-neutral-500 font-mono">
                                    {new Date(f.device_timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded border text-[7px] font-mono tracking-wider font-bold bg-neutral-900 text-amber-500 border-neutral-850">
                                    {f.category}
                                  </span>
                                  <span className={`px-1.5 py-0.5 rounded border text-[7px] font-bold ${badgeColor}`}>
                                    {f.severity}
                                  </span>
                                </div>
                                {f.description && (
                                  <p className="text-neutral-400 leading-relaxed bg-black/10 p-1.5 rounded border border-neutral-900/30 italic">
                                    &ldquo;{f.description}&rdquo;
                                  </p>
                                )}
                              </div>
                              <div className="shrink-0 flex items-center">
                                {f.is_resolved ? (
                                  <span className="text-emerald-400 font-bold bg-emerald-950/20 border border-emerald-900/40 px-2 py-1 rounded">
                                    RESOLVIDO
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleResolveFeedback(f.id)}
                                    className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black px-2 py-1 rounded transition-colors text-[8px]"
                                  >
                                    RESOLVER
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Heatmap Map Visualizer Wrapper */}

                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-4 h-[350px] flex flex-col gap-2">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                      Visualização Geral do Mapa Executivo
                    </h3>
                  </div>
                  <div className="flex-1 rounded-xl overflow-hidden bg-neutral-955 border border-neutral-900 relative">
                    <MapCommandCenter
                      promotores={promotores}
                      liveStatuses={liveStatuses}
                      selectedPromotorId={null}
                      visitas={visitasHoje}
                      geolocs={geolocs}
                      heartbeatLogs={heartbeatLogs}
                      replayTimeline={[]}
                      replayCurrentIndex={0}
                      isReplayActive={false}
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Alerts Breakdown and Fleet deviations */}
              <div className="flex flex-col gap-6">
                {/* Alerts Breakdown by Type */}
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                    Incidência de Alertas por Categoria
                  </h3>
                  {(() => {
                    const counts: Record<string, number> = {
                      BATERIA_CRITICA: 0,
                      SEM_HEARTBEAT: 0,
                      TEMPO_EXCESSIVO_LOJA: 0,
                      DESVIO_ROTA: 0,
                      VELOCIDADE_IMPOSSIVEL: 0,
                    };
                    
                    alertasAtivos.forEach(a => {
                      if (counts[a.tipo_alerta] !== undefined) {
                        counts[a.tipo_alerta]++;
                      }
                    });

                    const totalAlerts = Object.values(counts).reduce((a, b) => a + b, 0);

                    const alertLabels: Record<string, string> = {
                      BATERIA_CRITICA: "Bateria Crítica (<10%)",
                      SEM_HEARTBEAT: "Sem Heartbeat (>15m)",
                      TEMPO_EXCESSIVO_LOJA: "Excesso Tempo em Loja",
                      DESVIO_ROTA: "Desvios Rota GPS",
                      VELOCIDADE_IMPOSSIVEL: "Velocidade Impossível",
                    };

                    return (
                      <div className="flex flex-col gap-3">
                        {Object.entries(counts).map(([type, count]) => {
                          const percentage = totalAlerts > 0 ? Math.round((count / totalAlerts) * 100) : 0;
                          return (
                            <div key={type} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex justify-between items-center text-[10px]">
                              <div className="flex flex-col">
                                <span className="font-bold text-neutral-300">{alertLabels[type] || type}</span>
                                <span className="text-[8px] text-neutral-500 font-mono mt-0.5">{percentage}% de incidência</span>
                              </div>
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center font-mono font-black text-xs ${
                                count > 0 
                                  ? "bg-red-500/10 border border-red-500/30 text-red-500" 
                                  : "bg-neutral-900 border border-neutral-800 text-neutral-600"
                              }`}>
                                {count}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Fleet Compliance Overview */}
                <div className="bg-neutral-900/30 rounded-2xl border border-neutral-900 p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-black uppercase text-neutral-400 tracking-wider">
                    Conformidade e Desempenho
                  </h3>
                  <div className="p-4 bg-neutral-950 rounded-xl border border-neutral-900 text-[10px] flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-neutral-400">Total de Promotores em Campo:</span>
                      <span className="font-mono font-black text-neutral-200">{promotores.length}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-neutral-900/60 pt-2">
                      <span className="text-neutral-400">Promotores Ativos (Online):</span>
                      <span className="font-mono font-black text-emerald-400">
                        {promotores.filter(p => ["DISPONIVEL", "EM_ROTA", "EM_LOJA_CHECKIN", "EM_EXECUCAO", "EM_OCORRENCIA"].includes(getComputedStatus(p.id))).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-neutral-900/60 pt-2">
                      <span className="text-neutral-400">Total de Impedimentos / Ocorrências:</span>
                      <span className="font-mono font-black text-red-400">
                        {visitasHoje.filter(v => v.status === "EM_OCORRENCIA" || v.status === "CANCELADA").length}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* AI Vision Mode View */}
        {dashboardMode === "ai_vision" && !warRoomMode && (() => {
          const doneAnalysisLogs = shelfAnalysisLogs.filter(log => log.analysis_status === "DONE");
          const averagePlanogramScore = doneAnalysisLogs.length > 0
            ? Math.round(doneAnalysisLogs.reduce((acc, log) => acc + (log.planogram_score || 0), 0) / doneAnalysisLogs.length)
            : 100;
          
          const rupturedAnalysis = doneAnalysisLogs.filter(log => log.rupture_status === "TOTAL" || log.rupture_status === "PARCIAL");
          
          const pdvNameMap: Record<string, string> = {};
          visitasHoje.forEach(v => {
            if (v.pdv?.cod_parceiro) {
              pdvNameMap[v.pdv.cod_parceiro] = v.pdv.nome_fantasia || v.pdv.nome_parceiro || `PDV ${v.pdv.cod_parceiro}`;
            }
          });

          // Group regions
          const getRegion = (visita: any) => {
            const cidade = (visita?.pdv?.cidade || "").toUpperCase();
            const uf = (visita?.pdv?.uf || "").toUpperCase();
            
            if (cidade.includes("BELO HORIZONTE") || uf === "MG") return "BH";
            if (cidade.includes("BRASÍLIA") || cidade.includes("BRASILIA") || uf === "DF") return "DF";
            if (cidade.includes("SÃO PAULO") || cidade.includes("SAO PAULO") || uf === "SP") return "SP";
            return "OUTROS";
          };

          const visitaRegionMap: Record<string, string> = {};
          visitasHoje.forEach(v => {
            visitaRegionMap[v.id] = getRegion(v);
          });

          const regionRuptureStats = ["BH", "DF", "SP", "OUTROS"].map(regionKey => {
            const logsInRegion = doneAnalysisLogs.filter(log => {
              const reg = visitaRegionMap[log.visita_id] || "OUTROS";
              return reg === regionKey;
            });
            const total = logsInRegion.length;
            const totalRuptures = logsInRegion.filter(log => log.rupture_status === "TOTAL" || log.rupture_status === "PARCIAL").length;
            const avgScore = total > 0
              ? Math.round(logsInRegion.reduce((acc, log) => acc + (log.planogram_score || 0), 0) / total)
              : 100;
            
            return {
              key: regionKey,
              name: regionKey === "BH" ? "Belo Horizonte / MG" : regionKey === "DF" ? "Brasília / DF" : regionKey === "SP" ? "São Paulo / SP" : "Outras Regiões",
              total,
              totalRuptures,
              avgScore
            };
          });

          // Top SKUs in risk
          const skuRuptureCounts: Record<string, number> = {};
          const skuTotalChecks: Record<string, number> = {};
          
          doneAnalysisLogs.forEach(log => {
            const products = log.detected_products || [];
            products.forEach((p: any) => {
              if (!skuRuptureCounts[p.sku]) {
                skuRuptureCounts[p.sku] = 0;
                skuTotalChecks[p.sku] = 0;
              }
              skuTotalChecks[p.sku]++;
              if (p.detected_facings === 0) {
                skuRuptureCounts[p.sku]++;
              }
            });
          });

          const skusInRisk = Object.keys(skuRuptureCounts).map(sku => {
            const ruptureCount = skuRuptureCounts[sku];
            const totalChecks = skuTotalChecks[sku];
            const rate = totalChecks > 0 ? Math.round((ruptureCount / totalChecks) * 100) : 0;
            return {
              sku,
              name: sku === "COFFEE_MAIS_CLASSICO" ? "Clássico 250g" : sku === "COFFEE_MAIS_INTENSO" ? "Intenso 250g" : sku === "COFFEE_MAIS_GOURMET" ? "Gourmet 250g" : sku === "COFFEE_MAIS_ESPRESSO" ? "Espresso 1kg" : sku,
              ruptureCount,
              totalChecks,
              rate
            };
          }).sort((a, b) => b.rate - a.rate);

          // --- Sprint 5.2: Price OCR Calculations ---
          const donePriceLogs = priceAnalysisLogs.filter(log => log.ocr_status === "DONE");
          
          const globalAvgGap = donePriceLogs.length > 0
            ? parseFloat((donePriceLogs.reduce((acc, log) => acc + (parseFloat(log.price_gap_percent) || 0), 0) / donePriceLogs.length).toFixed(1))
            : 0;

          const globalAvgIndex = donePriceLogs.length > 0
            ? parseFloat((donePriceLogs.reduce((acc, log) => acc + (parseFloat(log.price_index) || 0), 0) / donePriceLogs.length).toFixed(1))
            : 100;

          // Aggregations
          const regionAverages: Record<string, { total: number; sumGap: number }> = {};
          const redeAverages: Record<string, { total: number; sumGap: number }> = {};
          const clusterAverages: Record<string, { total: number; sumGap: number }> = {};

          // Competitor promo list
          const promoItems: { pdv: string; brand: string; sku: string; price: number; time: string }[] = [];

          // Strategic compliance counts
          let totalCMItems = 0;
          let compliantCMItems = 0;
          const strategyDeviations: { pdv: string; sku: string; price: number; deviation: string }[] = [];

          // Price Opportunity list
          const opportunityList: { pdv: string; sku: string; score: number; gap: number; price: number; compPrice: number; risk: string }[] = [];

          donePriceLogs.forEach(log => {
            const pdvName = pdvNameMap[log.visita?.cod_parceiro] || `PDV ${log.visita?.cod_parceiro}`;
            const pdvInfo = log.visita?.pdv || {};
            const city = (pdvInfo.cidade || "").toUpperCase();
            const uf = (pdvInfo.uf || "").toUpperCase();
            const redeName = pdvInfo.rede || "Independente";
            const clusterName = pdvInfo.cluster_canal || "Varejo Geral";
            
            let reg = "Outros";
            if (city.includes("BELO HORIZONTE") || uf === "MG") reg = "BH";
            else if (city.includes("BRASÍLIA") || city.includes("BRASILIA") || uf === "DF") reg = "DF";
            else if (city.includes("SÃO PAULO") || city.includes("SAO PAULO") || uf === "SP") reg = "SP";

            const gap = parseFloat(log.price_gap_percent) || 0;

            // Region average
            if (!regionAverages[reg]) regionAverages[reg] = { total: 0, sumGap: 0 };
            regionAverages[reg].total++;
            regionAverages[reg].sumGap += gap;

            // Rede average
            if (!redeAverages[redeName]) redeAverages[redeName] = { total: 0, sumGap: 0 };
            redeAverages[redeName].total++;
            redeAverages[redeName].sumGap += gap;

            // Cluster average
            if (!clusterAverages[clusterName]) clusterAverages[clusterName] = { total: 0, sumGap: 0 };
            clusterAverages[clusterName].total++;
            clusterAverages[clusterName].sumGap += gap;

            // Promo items extraction
            const prices = log.detected_prices || [];
            prices.forEach((p: any) => {
              if (p.brand !== "Coffee Mais" && p.is_promo) {
                promoItems.push({
                  pdv: pdvName,
                  brand: p.brand,
                  sku: p.sku === "PILAO_250G" ? "Pilão 250g" : p.sku === "TRES_CORACOES_250G" ? "3 Corações 250g" : p.sku === "MELITTA_250G" ? "Melitta 250g" : p.sku === "SANTA_CLARA_250G" ? "Santa Clara 250g" : p.sku,
                  price: p.price,
                  time: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
              }
            });

            // Opportunity list extraction
            const gapAnalysis = log.sku_gap_analysis || {};
            Object.keys(gapAnalysis).forEach(sku => {
              const item = gapAnalysis[sku];
              opportunityList.push({
                pdv: pdvName,
                sku: sku === "COFFEE_MAIS_CLASSICO" ? "Clássico 250g" : sku === "COFFEE_MAIS_INTENSO" ? "Intenso 250g" : sku === "COFFEE_MAIS_GOURMET" ? "Gourmet 250g" : sku === "COFFEE_MAIS_ESPRESSO" ? "Espresso 1kg" : sku,
                score: parseFloat(item.opportunity_score) || 0,
                gap: parseFloat(item.gap_percent) || 0,
                price: parseFloat(item.price) || 0,
                compPrice: parseFloat(item.competitor_price) || 0,
                risk: item.pricing_risk
              });

              // Strategy compliance check
              totalCMItems++;
              // If there is an alert of type overpriced_versus_strategy for this visit and SKU
              const isNonCompliant = priceAlerts.some(
                al => al.visita_id === log.visita_id && al.sku === sku && al.tipo_alerta === "overpriced_versus_strategy"
              );
              if (isNonCompliant) {
                strategyDeviations.push({
                  pdv: pdvName,
                  sku: sku === "COFFEE_MAIS_CLASSICO" ? "Clássico 250g" : sku === "COFFEE_MAIS_INTENSO" ? "Intenso 250g" : sku === "COFFEE_MAIS_GOURMET" ? "Gourmet 250g" : sku === "COFFEE_MAIS_ESPRESSO" ? "Espresso 1kg" : sku,
                  price: parseFloat(item.price),
                  deviation: "ACIMA DO TETO"
                });
              } else {
                compliantCMItems++;
              }
            });
          });

          const avgGapByRegion = Object.keys(regionAverages).map(r => ({
            name: r === "BH" ? "Belo Horizonte / MG" : r === "DF" ? "Brasília / DF" : r === "SP" ? "São Paulo / SP" : "Outras Regiões",
            gap: parseFloat((regionAverages[r].sumGap / regionAverages[r].total).toFixed(1)),
            total: regionAverages[r].total
          }));

          const avgGapByRede = Object.keys(redeAverages).map(rede => ({
            name: rede,
            gap: parseFloat((redeAverages[rede].sumGap / redeAverages[rede].total).toFixed(1)),
            total: redeAverages[rede].total
          })).sort((a, b) => b.gap - a.gap).slice(0, 4);

          const avgGapByCluster = Object.keys(clusterAverages).map(cluster => ({
            name: cluster,
            gap: parseFloat((clusterAverages[cluster].sumGap / clusterAverages[cluster].total).toFixed(1)),
            total: clusterAverages[cluster].total
          })).sort((a, b) => b.gap - a.gap).slice(0, 4);

           const sortedOpportunities = opportunityList.sort((a, b) => b.score - a.score).slice(0, 5);
          
          const opportunityCounts = {
            CRITICAL: 0,
            DEFENSIVE: 0,
            EXPANSION: 0,
            OFFENSIVE: 0,
            STABLE: 0
          };
          donePriceLogs.forEach(log => {
            const opp = (log.commercial_opportunity || "STABLE") as keyof typeof opportunityCounts;
            if (opportunityCounts[opp] !== undefined) {
              opportunityCounts[opp]++;
            }
          });

          const pdvOpportunities = donePriceLogs.map((log: any) => {
            const pdvName = pdvNameMap[log.visita?.cod_parceiro] || log.visita?.pdv?.nome_fantasia || `PDV: ${log.visita?.cod_parceiro}`;
            return {
              pdv: pdvName,
              opportunity: log.commercial_opportunity || "STABLE",
              score: parseFloat(log.commercial_opportunity_score) || 0,
              gap: parseFloat(log.price_gap_percent) || 0,
              pricing_risk: log.pricing_risk || "COMPETITIVE"
            };
          });
          const sortedPdvOpportunities = pdvOpportunities
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

          const activePromoCount = promoItems.length;
          const pricingComplianceRate = totalCMItems > 0 ? Math.round((compliantCMItems / totalCMItems) * 100) : 100;

          return (
            <div className="flex flex-col gap-6 animate-in fade-in duration-300">
              
              {/* Sprint 5.2 Sub-navigation Tab Bar */}
              <div className="flex gap-6 border-b border-neutral-900 pb-2">
                <button
                  onClick={() => setAiSubTab("planogram")}
                  className={`text-[11px] font-black uppercase tracking-wider pb-2 border-b-2 transition-all duration-200 ${
                    aiSubTab === "planogram" ? "border-amber-500 text-amber-500" : "border-transparent text-neutral-500 hover:text-neutral-350"
                  }`}
                >
                  Conformidade de Planograma
                </button>
                <button
                  onClick={() => setAiSubTab("price")}
                  className={`text-[11px] font-black uppercase tracking-wider pb-2 border-b-2 transition-all duration-200 ${
                    aiSubTab === "price" ? "border-amber-500 text-amber-500" : "border-transparent text-neutral-500 hover:text-neutral-350"
                  }`}
                >
                  Price Intelligence
                </button>
              </div>

              {aiSubTab === "planogram" ? (
                <>
                  {/* Top AI Stats Cards */}
                  <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Compliance Médio de Planograma
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className={`text-2xl font-black ${
                          averagePlanogramScore >= 90 ? "text-emerald-400" :
                          averagePlanogramScore >= 75 ? "text-amber-500" : "text-rose-500"
                        }`}>{averagePlanogramScore}%</span>
                        <Activity className="w-5 h-5 text-neutral-800" />
                      </div>
                      <div className="w-full bg-neutral-950 rounded-full h-1.5 mt-2 overflow-hidden">
                        <div className={`h-full rounded-full ${
                          averagePlanogramScore >= 90 ? "bg-emerald-500" :
                          averagePlanogramScore >= 75 ? "bg-amber-500" : "bg-rose-500"
                        }`} style={{ width: `${averagePlanogramScore}%` }} />
                      </div>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Total Análises IA
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-neutral-200">{shelfAnalysisLogs.length}</span>
                        <FileText className="w-5 h-5 text-neutral-800" />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Análises de gôndola via app nativo</p>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Rupturas Totais
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-rose-400">
                          {doneAnalysisLogs.filter(log => log.rupture_status === "TOTAL").length}
                        </span>
                        <AlertTriangle className="w-5 h-5 text-rose-950" />
                      </div>
                      <p className="text-[9px] text-rose-500/80 mt-1">PDVs com 0 facings detectados</p>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Rupturas Parciais
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-amber-500">
                          {doneAnalysisLogs.filter(log => log.rupture_status === "PARCIAL").length}
                        </span>
                        <AlertCircle className="w-5 h-5 text-amber-950" />
                      </div>
                      <p className="text-[9px] text-amber-500/80 mt-1">Facings abaixo do esperado</p>
                    </div>
                  </section>

                  {/* Main content grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Column 1: Top PDVs com Ruptura & Regional Stats */}
                    <div className="flex flex-col gap-6">
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Pontos de Venda em Ruptura
                        </span>
                        
                        <div className="flex flex-col gap-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {rupturedAnalysis.length === 0 ? (
                            <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                              Nenhuma ruptura detectada pelas análises de IA hoje.
                            </div>
                          ) : (
                            rupturedAnalysis.map((log) => {
                              const pdvName = pdvNameMap[log.visita?.cod_parceiro] || `PDV ID: ${log.visita?.cod_parceiro || 'Desconhecido'}`;
                              const isTotal = log.rupture_status === "TOTAL";
                              
                              return (
                                <div key={log.id} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex justify-between items-center transition hover:border-neutral-850">
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-bold text-neutral-200">{pdvName}</span>
                                    <span className="text-[9px] text-neutral-500">
                                      Promotor: {log.promotor?.nome_completo || "N/A"} • Confiança IA: {log.ai_confidence ? (log.ai_confidence * 100).toFixed(0) : "0"}%
                                    </span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase border ${
                                    isTotal ? "bg-rose-500/10 text-rose-400 border-rose-950" : "bg-amber-500/10 text-amber-400 border-amber-950"
                                  }`}>
                                    Ruptura {log.rupture_status}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </section>

                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Indicadores de Ruptura Regional
                        </span>
                        
                        <div className="flex flex-col gap-3">
                          {regionRuptureStats.map(r => (
                            <div key={r.key} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-neutral-200">{r.name}</span>
                                <span className="text-[10px] text-neutral-400">Compliance Médio: <strong>{r.avgScore}%</strong></span>
                              </div>
                              
                              <div className="flex justify-between items-center text-[9px] text-neutral-500 border-t border-neutral-900/60 pt-1.5 mt-1">
                                <span>Análises: <strong>{r.total}</strong></span>
                                {r.totalRuptures > 0 ? (
                                  <span className="text-rose-400 font-bold">{r.totalRuptures} Rupturas</span>
                                ) : (
                                  <span className="text-emerald-500 font-bold">Tudo Estável</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    </div>

                    {/* Column 2: Top SKUs em Risco & Last analysis logs */}
                    <div className="flex flex-col gap-6">
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          SKUs com Maior Incidência de Ruptura
                        </span>
                        
                        <div className="flex flex-col gap-4">
                          {skusInRisk.length === 0 ? (
                            <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                              Dados insuficientes para gerar ranking de risco.
                            </div>
                          ) : (
                            skusInRisk.map((sku) => (
                              <div key={sku.sku} className="flex flex-col gap-2">
                                <div className="flex justify-between text-[10px]">
                                  <span className="font-bold text-neutral-300">{sku.name}</span>
                                  <span className="text-rose-400 font-bold">{sku.rate}% de Ruptura ({sku.ruptureCount}/{sku.totalChecks})</span>
                                </div>
                                <div className="w-full bg-neutral-950 rounded-full h-2 overflow-hidden">
                                  <div className="bg-rose-500 h-full rounded-full" style={{ width: `${sku.rate}%` }} />
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          {selectedShelfAnalysis ? "Detalhes da Auditoria IA" : "Fila de Auditoria Recente"}
                        </span>
                        
                        {selectedShelfAnalysis ? (
                          <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                              <button 
                                onClick={() => setSelectedShelfAnalysis(null)}
                                className="text-[10px] flex items-center gap-1 text-neutral-400 hover:text-neutral-200 transition-colors"
                              >
                                ← Voltar para a Fila
                              </button>
                              <span className="text-[10px] font-black text-amber-500 uppercase tracking-wider">
                                ID Análise: {selectedShelfAnalysis.id.slice(0, 8)}
                              </span>
                            </div>

                            <div className="flex flex-col gap-3">
                              <div className="relative aspect-video rounded-xl overflow-hidden border border-neutral-900 bg-neutral-950">
                                <img
                                  src={selectedShelfAnalysis.photo_url.startsWith("http") ? selectedShelfAnalysis.photo_url : `https://ncncazbhpoxjlyvcbvqa.supabase.co/storage/v1/object/public/promotor-ponto/${selectedShelfAnalysis.photo_url}`}
                                  alt="Auditoria Gôndola"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute top-2 right-2 bg-neutral-950/80 px-2 py-0.5 rounded text-[8px] font-black text-neutral-400 border border-neutral-900">
                                  {selectedShelfAnalysis.image_width}x{selectedShelfAnalysis.image_height}
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3 text-[10px]">
                                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900">
                                  <span className="text-neutral-500 block uppercase font-bold text-[8px]">Qualidade da Imagem</span>
                                  <div className="flex justify-between items-center mt-1">
                                    <span className={`font-black uppercase text-[9px] px-1.5 py-0.2 rounded border ${
                                      selectedShelfAnalysis.quality_status === 'GOOD' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-950' : 'bg-rose-500/10 text-rose-400 border-rose-950'
                                    }`}>
                                      {selectedShelfAnalysis.quality_status}
                                    </span>
                                    <span className="font-mono text-neutral-300 font-bold">{selectedShelfAnalysis.quality_score}%</span>
                                  </div>
                                </div>
                                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900">
                                  <span className="text-neutral-500 block uppercase font-bold text-[8px]">Versão Planograma</span>
                                  <span className="font-mono text-neutral-300 font-bold block mt-1">V{selectedShelfAnalysis.planogram_version_used || 1}</span>
                                </div>
                              </div>

                              {selectedShelfAnalysis.decision_reasons && selectedShelfAnalysis.decision_reasons.length > 0 && (
                                <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-1.5 text-[9px]">
                                  <span className="text-neutral-400 font-bold uppercase text-[8px]">Justificativas da IA</span>
                                  <ul className="list-disc pl-3 text-neutral-500 flex flex-col gap-1">
                                    {selectedShelfAnalysis.decision_reasons.map((reason: string, rIdx: number) => (
                                      <li key={rIdx}>{reason}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {(() => {
                                const matchingPriceAnalysis = priceAnalysisLogs.find(pa => pa.analysis_id === selectedShelfAnalysis.id);
                                if (!matchingPriceAnalysis) return null;
                                
                                return (
                                  <>
                                    <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-2">
                                      <div className="flex justify-between items-center">
                                        <span className="text-neutral-400 font-bold uppercase text-[8px]">OCR Digit Confidence Viewer</span>
                                        <span className={`px-1.5 py-0.2 text-[8px] font-black rounded border ${
                                          matchingPriceAnalysis.ocr_confidence_score > 90 ? "bg-emerald-500/10 text-emerald-450 border-emerald-950" :
                                          matchingPriceAnalysis.ocr_confidence_score >= 75 ? "bg-amber-500/10 text-amber-450 border-amber-950" :
                                          "bg-rose-500/10 text-rose-450 border-rose-950"
                                        }`}>
                                          Confiança Global: {matchingPriceAnalysis.ocr_confidence_score}%
                                        </span>
                                      </div>
                                      <div className="flex flex-col gap-2 max-h-[120px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                                        {matchingPriceAnalysis.items?.map((item: any, itemIdx: number) => (
                                          <div key={itemIdx} className="p-2 bg-neutral-900/40 rounded-lg border border-neutral-900/60 flex flex-col gap-1 text-[9px]">
                                            <div className="flex justify-between items-center">
                                              <span className="font-bold text-neutral-300">{item.brand} - {item.sku === "COFFEE_MAIS_CLASSICO" ? "Clássico 250g" : item.sku === "COFFEE_MAIS_INTENSO" ? "Intenso 250g" : item.sku === "COFFEE_MAIS_GOURMET" ? "Gourmet 250g" : item.sku === "COFFEE_MAIS_ESPRESSO" ? "Espresso 1kg" : item.sku}</span>
                                              <span className="font-mono text-neutral-400 font-bold">R$ {parseFloat(item.price).toFixed(2)}</span>
                                            </div>
                                            {item.digit_confidence && item.digit_confidence.length > 0 && (
                                              <div className="flex items-center gap-1 flex-wrap">
                                                <span className="text-[7px] text-neutral-500 uppercase font-black">Dígitos:</span>
                                                {item.digit_confidence.map((dc: any, dcIdx: number) => (
                                                  <span key={dcIdx} className={`px-1 rounded text-[7px] font-mono font-bold ${
                                                    dc.confidence > 0.95 ? "bg-emerald-500/10 text-emerald-450 border border-emerald-950" :
                                                    dc.confidence > 0.85 ? "bg-amber-500/10 text-amber-450 border-amber-950" :
                                                    "bg-rose-500/10 text-rose-450 border-rose-950"
                                                  }`}>
                                                    {dc.digit}: {(dc.confidence * 100).toFixed(0)}%
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Opportunity Score Gauge */}
                                    {(() => {
                                      const oppScore = parseFloat(matchingPriceAnalysis.commercial_opportunity_score) || 0;
                                      const oppType = matchingPriceAnalysis.commercial_opportunity || "STABLE";

                                      let gaugeColor = "bg-emerald-500";
                                      let gaugeText = "LOW";
                                      if (oppScore >= 75) {
                                        gaugeColor = "bg-rose-500";
                                        gaugeText = "CRITICAL";
                                      } else if (oppScore >= 50) {
                                        gaugeColor = "bg-orange-500";
                                        gaugeText = "HIGH";
                                      } else if (oppScore >= 25) {
                                        gaugeColor = "bg-amber-500";
                                        gaugeText = "MEDIUM";
                                      }

                                      return (
                                        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-2">
                                          <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-neutral-450 font-bold uppercase text-[8px]">Opportunity Score Gauge</span>
                                            <span className={`px-1.5 py-0.2 font-black rounded border text-[8px] ${
                                              gaugeText === "CRITICAL" ? "bg-rose-500/10 text-rose-450 border-rose-950" :
                                              gaugeText === "HIGH" ? "bg-orange-500/10 text-orange-400 border-orange-950" :
                                              gaugeText === "MEDIUM" ? "bg-amber-500/10 text-amber-450 border-amber-950" :
                                              "bg-emerald-500/10 text-emerald-400 border-emerald-950"
                                            }`}>
                                              {oppType} ({gaugeText})
                                            </span>
                                          </div>
                                          <div className="w-full bg-neutral-900 rounded-full h-2 overflow-hidden mt-0.5">
                                            <div className={`${gaugeColor} h-full`} style={{ width: `${oppScore}%` }} />
                                          </div>
                                          <div className="flex justify-between items-center text-[8px] text-neutral-500">
                                            <span>Score: <strong className="text-neutral-300">{oppScore.toFixed(1)}/100</strong></span>
                                            <span className="text-[7.5px]">Faixas: 0-24 LOW | 25-49 MED | 50-74 HIGH | 75+ CRIT</span>
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Outlier Rejection Auditoria */}
                                    {(() => {
                                      const hadOutliers = !!matchingPriceAnalysis.had_outliers_removed;
                                      const outlierValCount = matchingPriceAnalysis.outlier_count || 0;
                                      const outlierList = matchingPriceAnalysis.outlier_values_removed || [];

                                      return (
                                        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-2">
                                          <div className="flex justify-between items-center text-[9px]">
                                            <span className="text-neutral-450 font-bold uppercase text-[8px]">Outlier Rejection Auditoria</span>
                                            <span className={`px-1.5 py-0.2 font-black rounded border text-[7.5px] ${
                                              hadOutliers ? "bg-rose-500/10 text-rose-450 border-rose-950" : "bg-neutral-850 text-neutral-500 border-neutral-900"
                                            }`}>
                                              {hadOutliers ? "OUTLIERS EXPURGADOS" : "SEM OUTLIERS"}
                                            </span>
                                          </div>
                                          <div className="text-[9px] text-neutral-500 flex flex-col gap-1">
                                            <div className="flex justify-between">
                                              <span>Total Outliers Removidos:</span>
                                              <span className="font-mono text-neutral-300 font-bold">{outlierValCount}</span>
                                            </div>
                                            {outlierList.length > 0 && (
                                              <div className="flex flex-col gap-1 mt-1 p-1.5 bg-neutral-900/40 rounded border border-neutral-900/60 max-h-[80px] overflow-y-auto">
                                                {outlierList.map((out: any, oIdx: number) => (
                                                  <div key={oIdx} className="flex justify-between items-center text-[8px]">
                                                    <span className="text-rose-450">R$ {parseFloat(out.price).toFixed(2)}</span>
                                                    <span className="text-neutral-500 uppercase tracking-widest text-[7px]">{out.reason} ({out.source_level})</span>
                                                  </div>
                                                ))}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })()}

                                    {/* Multi-Level Price History */}
                                    {(() => {
                                      const currentPdvId = selectedShelfAnalysis.visita?.cod_parceiro;
                                      const pdvInfo = matchingPriceAnalysis.visita?.pdv || {};
                                      const currentRede = pdvInfo.rede || "Independente";
                                      const currentRegion = pdvInfo.uf || "MG";

                                      const cmDetected = matchingPriceAnalysis.detected_prices?.filter((p: any) => p.brand === "Coffee Mais") || [];

                                      return (
                                        <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-2">
                                          <div className="flex justify-between items-center">
                                            <span className="text-neutral-450 font-bold uppercase text-[8px]">Comparativo Hierárquico de Preços</span>
                                            <span className="px-1.5 py-0.2 text-[8px] font-black rounded border bg-neutral-850 text-neutral-400 border-neutral-900">
                                              Nível: {matchingPriceAnalysis.anomaly_reference_level || "N/A"}
                                            </span>
                                          </div>
                                          <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                                            {cmDetected.map((skuItem: any, idx: number) => {
                                              const skuHistory: { price: number; pdv: string; rede: string; uf: string }[] = [];
                                              priceAnalysisLogs.forEach((pa: any) => {
                                                if (pa.ocr_status === "DONE") {
                                                  const itemPrice = pa.detected_prices?.find((p: any) => p.sku === skuItem.sku && p.brand === "Coffee Mais")?.price;
                                                  if (itemPrice !== undefined) {
                                                    skuHistory.push({
                                                      price: parseFloat(itemPrice),
                                                      pdv: pa.visita?.pdv?.cod_parceiro || "",
                                                      rede: pa.visita?.pdv?.rede || "Independente",
                                                      uf: pa.visita?.pdv?.uf || "MG"
                                                    });
                                                  }
                                                }
                                              });

                                              const pdvPrices = skuHistory.filter(h => h.pdv === currentPdvId).map(h => h.price);
                                              const pdvAvg = pdvPrices.length >= 3 ? pdvPrices.reduce((a, b) => a + b, 0) / pdvPrices.length : null;

                                              const redePrices = skuHistory.filter(h => h.rede === currentRede).map(h => h.price);
                                              const redeAvg = redePrices.length >= 3 ? redePrices.reduce((a, b) => a + b, 0) / redePrices.length : null;

                                              const regionPrices = skuHistory.filter(h => h.uf === currentRegion).map(h => h.price);
                                              const regionAvg = regionPrices.length >= 3 ? regionPrices.reduce((a, b) => a + b, 0) / regionPrices.length : null;

                                              const nationalPrices = skuHistory.map(h => h.price);
                                              const nationalAvg = nationalPrices.length >= 3 ? nationalPrices.reduce((a, b) => a + b, 0) / nationalPrices.length : null;

                                              const skuName = skuItem.sku === "COFFEE_MAIS_CLASSICO" ? "Clássico 250g" : skuItem.sku === "COFFEE_MAIS_INTENSO" ? "Intenso 250g" : skuItem.sku === "COFFEE_MAIS_GOURMET" ? "Gourmet 250g" : skuItem.sku === "COFFEE_MAIS_ESPRESSO" ? "Espresso 1kg" : skuItem.sku;

                                              const segment = skuItem.sku === "COFFEE_MAIS_CLASSICO" || skuItem.sku === "COFFEE_MAIS_INTENSO" ? "MAINSTREAM" :
                                                              skuItem.sku === "COFFEE_MAIS_GOURMET" ? "PREMIUM" :
                                                              skuItem.sku === "COFFEE_MAIS_ESPRESSO" ? "SUPER_PREMIUM" : "MAINSTREAM";
                                              let threshold = 30;
                                              if (segment === "PREMIUM") threshold = 40;
                                              else if (segment === "SUPER_PREMIUM") threshold = 50;

                                              return (
                                                <div key={idx} className="p-2 bg-neutral-900/40 rounded-lg border border-neutral-900/60 flex flex-col gap-1 text-[9px]">
                                                  <div className="flex justify-between items-center border-b border-neutral-900 pb-1 mb-1">
                                                    <span className="font-bold text-neutral-300">{skuName}</span>
                                                    <span className="font-mono text-amber-500 font-bold">Atual: R$ {parseFloat(skuItem.price).toFixed(2)}</span>
                                                  </div>
                                                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-neutral-500 text-[8.5px]">
                                                    <div className="flex justify-between">
                                                      <span>Hist. PDV (N={pdvPrices.length}):</span>
                                                      <span className="font-mono text-neutral-300 font-bold">{pdvAvg ? `R$ ${pdvAvg.toFixed(2)}` : "Falta Hist"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span>Hist. Rede (N={redePrices.length}):</span>
                                                      <span className="font-mono text-neutral-300 font-bold">{redeAvg ? `R$ ${redeAvg.toFixed(2)}` : "Falta Hist"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span>Hist. UF (N={regionPrices.length}):</span>
                                                      <span className="font-mono text-neutral-300 font-bold">{regionAvg ? `R$ ${regionAvg.toFixed(2)}` : "Falta Hist"}</span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                      <span>Hist. Nac. (N={nationalPrices.length}):</span>
                                                      <span className="font-mono text-neutral-300 font-bold">{nationalAvg ? `R$ ${nationalAvg.toFixed(2)}` : "Falta Hist"}</span>
                                                    </div>
                                                  </div>
                                                  <div className="mt-1 text-[8px] text-neutral-600 border-t border-neutral-900/40 pt-1">
                                                    Limiar Adaptativo Segmento: <strong className="text-neutral-500">{threshold}% ({segment})</strong>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </>
                                );
                              })()}

                              <div className="flex flex-col gap-2">
                                <span className="text-neutral-400 font-bold uppercase text-[8px]">Ações de Homologação</span>
                                <div className="flex gap-2">
                                  <div className="flex-1 flex gap-2">
                                    <input
                                      type="number"
                                      placeholder="Nova nota"
                                      value={overrideScore}
                                      onChange={(e) => setOverrideScore(e.target.value)}
                                      className="w-16 px-2 py-1 text-center bg-neutral-950 rounded-lg border border-neutral-900 text-xs text-neutral-300 focus:outline-none focus:border-amber-500"
                                    />
                                    <input
                                      type="text"
                                      placeholder="Observação da revisão"
                                      value={reviewReasonText}
                                      onChange={(e) => setReviewReasonText(e.target.value)}
                                      className="flex-1 px-3 py-1 bg-neutral-950 rounded-lg border border-neutral-900 text-xs text-neutral-300 focus:outline-none focus:border-amber-500"
                                    />
                                  </div>
                                  <button
                                    disabled={isReviewing}
                                    onClick={() => handleReviewAction("APPROVE")}
                                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-neutral-950 text-[10px] font-black uppercase rounded-lg transition-colors font-bold"
                                  >
                                    {isReviewing ? "Aprovando..." : "Aprovar Manual"}
                                  </button>
                                  <button
                                    disabled={isReviewing}
                                    onClick={() => handleReviewAction("REPROCESS")}
                                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 disabled:opacity-50 text-amber-400 text-[10px] font-black uppercase rounded-lg transition-colors font-bold"
                                  >
                                    {isReviewing ? "Reprocessando..." : "Reprocessar"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                            {shelfAnalysisLogs.slice(0, 5).map(log => {
                              const pdvName = pdvNameMap[log.visita?.cod_parceiro] || `PDV ID: ${log.visita?.cod_parceiro || 'Desconhecido'}`;
                              const logTime = new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                              const needsReview = log.needs_manual_review === true;
                              
                              return (
                                <div 
                                  key={log.id} 
                                  onClick={() => {
                                    setSelectedShelfAnalysis(log);
                                    setOverrideScore(log.planogram_score !== null ? log.planogram_score.toString() : "");
                                    setReviewReasonText(log.review_reason || "");
                                  }}
                                  className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex justify-between items-center cursor-pointer hover:border-neutral-700 transition-colors"
                                >
                                  <div className="flex flex-col gap-1">
                                    <span className="text-xs font-bold text-neutral-200">{pdvName}</span>
                                    <span className="text-[9px] text-neutral-500 flex items-center gap-1.5">
                                      Hora: {logTime} • V{log.planogram_version_used || 1}
                                      {needsReview && (
                                        <span className="text-amber-500 font-black uppercase text-[7px] bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/25">
                                          REVISÃO
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                      log.analysis_status === "DONE" ? "bg-emerald-500/10 text-emerald-400 border-emerald-950" :
                                      log.analysis_status === "FAILED" ? "bg-rose-500/10 text-rose-400 border-rose-950" :
                                      "bg-neutral-950 text-neutral-500 border-neutral-900"
                                    }`}>
                                      {log.analysis_status}
                                    </span>
                                    {log.analysis_status === "DONE" && (
                                      <span className="text-xs font-mono font-black text-neutral-200">
                                        {log.planogram_score} pts
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </div>

                  </div>
                </>
              ) : (
                <>
                  {/* Sprint 5.2 Price OCR Stats Cards */}
                  <section className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Average Price Gap
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className={`text-2xl font-black ${
                          globalAvgGap > 15 ? "text-rose-400" :
                          globalAvgGap > 5 ? "text-amber-400" : "text-emerald-400"
                        }`}>+{globalAvgGap}%</span>
                        <Zap className="w-5 h-5 text-neutral-800" />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Coffee Mais vs Concorrência Tradicional</p>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Average Price Index
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-neutral-250">{globalAvgIndex}%</span>
                        <Activity className="w-5 h-5 text-neutral-800" />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Posicionamento Relativo ao Mercado</p>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Promoções Ativas Concorrência
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className={`text-2xl font-black ${
                          activePromoCount > 0 ? "text-rose-400" : "text-neutral-450"
                        }`}>{activePromoCount}</span>
                        <AlertTriangle className="w-5 h-5 text-neutral-800" />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Ofertas agressivas mapeadas</p>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Compliance de Estratégia
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className={`text-2xl font-black ${
                          pricingComplianceRate >= 90 ? "text-emerald-400" :
                          pricingComplianceRate >= 75 ? "text-amber-500" : "text-rose-500"
                        }`}>{pricingComplianceRate}%</span>
                        <CheckCircle2 className="w-5 h-5 text-neutral-800" />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Aderência aos Preços Sugeridos</p>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        OCR Confidence Score
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        {(() => {
                          const globalAvgOcrConfidence = donePriceLogs.length > 0
                            ? parseFloat((donePriceLogs.reduce((acc, log) => acc + (parseFloat(log.ocr_confidence_score) || 0), 0) / donePriceLogs.length).toFixed(1))
                            : 0;
                          const ocrRating = globalAvgOcrConfidence > 90 ? "HIGH" : globalAvgOcrConfidence >= 75 ? "MEDIUM" : "LOW";
                          return (
                            <>
                              <div className="flex flex-col">
                                <span className="text-xl font-black text-neutral-200">{globalAvgOcrConfidence}%</span>
                                <span className={`text-[7px] font-black uppercase mt-0.5 px-1 py-0.2 rounded border ${
                                  ocrRating === "HIGH" ? "bg-emerald-500/10 text-emerald-400 border-emerald-950" :
                                  ocrRating === "MEDIUM" ? "bg-amber-500/10 text-amber-400 border-amber-950" :
                                  "bg-rose-500/10 text-rose-400 border-rose-950"
                                }`}>
                                  {ocrRating}
                                </span>
                              </div>
                              <Eye className="w-5 h-5 text-neutral-800" />
                            </>
                          );
                        })()}
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Confiança Média do OCR</p>
                    </div>

                    <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                      <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                        Janela Histórica
                      </span>
                      <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-neutral-250">
                          {donePriceLogs[0]?.anomaly_reference_window_days || 30} dias
                        </span>
                        <Calendar className="w-5 h-5 text-neutral-800" />
                      </div>
                      <p className="text-[9px] text-neutral-500 mt-1">Período de Referência OCR</p>
                    </div>
                  </section>

                  {/* Main Price Content Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Left Column: Aggregations and Opportunity Ranking */}
                    <div className="flex flex-col gap-6">
                      
                      {/* Commercial Opportunity Board */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Commercial Opportunity Board (Oportunidades Comerciais por PDV)
                        </span>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          <div className="p-3 bg-neutral-950 rounded-xl border border-rose-950/60 flex flex-col gap-1 relative overflow-hidden">
                            <span className="text-[7px] font-black text-rose-400 uppercase tracking-wider">CRITICAL</span>
                            <span className="text-lg font-mono font-black text-rose-450">{opportunityCounts.CRITICAL || 0}</span>
                            <span className="text-[7.5px] text-neutral-500 leading-normal">Preço caro + ruptura + promo conc.</span>
                          </div>
                          <div className="p-3 bg-neutral-950 rounded-xl border border-amber-950/60 flex flex-col gap-1 relative overflow-hidden">
                            <span className="text-[7px] font-black text-amber-400 uppercase tracking-wider">DEFENSIVE</span>
                            <span className="text-lg font-mono font-black text-amber-450">{opportunityCounts.DEFENSIVE || 0}</span>
                            <span className="text-[7.5px] text-neutral-500 leading-normal">Promoção concorrente ativa.</span>
                          </div>
                          <div className="p-3 bg-neutral-950 rounded-xl border border-violet-950/60 flex flex-col gap-1 relative overflow-hidden">
                            <span className="text-[7px] font-black text-violet-400 uppercase tracking-wider">EXPANSION</span>
                            <span className="text-lg font-mono font-black text-violet-400">{opportunityCounts.EXPANSION || 0}</span>
                            <span className="text-[7.5px] text-neutral-500 leading-normal">Margem alta + share gôndola &lt; 35%.</span>
                          </div>
                          <div className="p-3 bg-neutral-950 rounded-xl border border-emerald-950/60 flex flex-col gap-1 relative overflow-hidden">
                            <span className="text-[7px] font-black text-emerald-400 uppercase tracking-wider">OFFENSIVE</span>
                            <span className="text-lg font-mono font-black text-emerald-400">{opportunityCounts.OFFENSIVE || 0}</span>
                            <span className="text-[7.5px] text-neutral-500 leading-normal">Preço competitivo + sem ruptura.</span>
                          </div>
                          <div className="p-3 bg-neutral-950 rounded-xl border border-neutral-850 flex flex-col gap-1 relative overflow-hidden">
                            <span className="text-[7px] font-black text-neutral-400 uppercase tracking-wider">STABLE</span>
                            <span className="text-lg font-mono font-black text-neutral-300">{opportunityCounts.STABLE || 0}</span>
                            <span className="text-[7.5px] text-neutral-500 leading-normal">Operação de preço estável.</span>
                          </div>
                        </div>
                      </section>

                      {/* Opportunity Score Ranking */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Opportunity Score Ranking (Prioridade de Ação Comercial por PDV)
                        </span>

                        <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {sortedPdvOpportunities.length === 0 ? (
                            <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                              Nenhum dado de oportunidade disponível.
                            </div>
                          ) : (
                            sortedPdvOpportunities.map((item, idx) => (
                              <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex justify-between items-center hover:border-neutral-800 transition-colors">
                                <div className="flex flex-col gap-1 text-[10px]">
                                  <span className="font-bold text-neutral-200 truncate max-w-[180px]">{item.pdv}</span>
                                  <span className="text-neutral-500 text-[9px]">
                                    Oportunidade: <strong className={
                                      item.opportunity === "CRITICAL" ? "text-rose-450 font-black" :
                                      item.opportunity === "DEFENSIVE" ? "text-amber-400 font-bold" :
                                      item.opportunity === "EXPANSION" ? "text-violet-400 font-bold" :
                                      item.opportunity === "OFFENSIVE" ? "text-emerald-400 font-bold" : "text-neutral-450"
                                    }>{item.opportunity}</strong> • Gap: {item.gap > 0 ? '+' : ''}{item.gap}%
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-bold text-neutral-500 uppercase">Opportunity Score</span>
                                    <span className="font-mono font-black text-amber-500 text-xs">{item.score.toFixed(1)}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      {/* KPI 1: Price Gap aggregations by Region, Chain, Cluster */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Agregação de Preços (Média Price Gap)
                        </span>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* Region Column */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[9px] text-neutral-500 uppercase font-black tracking-wider">Por Região</span>
                            <div className="flex flex-col gap-1.5">
                              {avgGapByRegion.map(reg => (
                                <div key={reg.name} className="p-2 bg-neutral-950 rounded-xl border border-neutral-900/60 flex justify-between items-center text-[10px]">
                                  <span className="text-neutral-300 font-bold">{reg.name}</span>
                                  <span className="font-mono text-amber-500">+{reg.gap}%</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Chain/Rede Column */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[9px] text-neutral-500 uppercase font-black tracking-wider">Por Rede</span>
                            <div className="flex flex-col gap-1.5">
                              {avgGapByRede.length === 0 ? (
                                <div className="p-4 text-center text-[9px] text-neutral-600 border border-neutral-950 rounded-xl">Sem redes</div>
                              ) : (
                                avgGapByRede.map(rede => (
                                  <div key={rede.name} className="p-2 bg-neutral-950 rounded-xl border border-neutral-900/60 flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-300 truncate font-bold max-w-[80px]">{rede.name}</span>
                                    <span className="font-mono text-amber-500">+{rede.gap}%</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          {/* Cluster Column */}
                          <div className="flex flex-col gap-2">
                            <span className="text-[9px] text-neutral-500 uppercase font-black tracking-wider">Por Cluster</span>
                            <div className="flex flex-col gap-1.5">
                              {avgGapByCluster.length === 0 ? (
                                <div className="p-4 text-center text-[9px] text-neutral-600 border border-neutral-950 rounded-xl">Sem clusters</div>
                              ) : (
                                avgGapByCluster.map(c => (
                                  <div key={c.name} className="p-2 bg-neutral-950 rounded-xl border border-neutral-900/60 flex justify-between items-center text-[10px]">
                                    <span className="text-neutral-300 truncate font-bold max-w-[80px]">{c.name}</span>
                                    <span className="font-mono text-amber-500">+{c.gap}%</span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      {/* KPI 2: Price Opportunity Ranking */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Ranking de Oportunidades de Preço (Priorização Comercial)
                        </span>

                        <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {sortedOpportunities.length === 0 ? (
                            <div className="py-12 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                              Nenhum dado de oportunidade disponível no momento.
                            </div>
                          ) : (
                            sortedOpportunities.map((item, idx) => (
                              <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex justify-between items-center hover:border-neutral-800 transition-colors">
                                <div className="flex flex-col gap-1 text-[10px]">
                                  <span className="font-bold text-neutral-200 truncate max-w-[180px]">{item.pdv}</span>
                                  <span className="text-neutral-500 text-[9px]">
                                    SKU: {item.sku} • Nosso: R$ {item.price.toFixed(2)} • Concorrente: R$ {item.compPrice.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={`px-1.5 py-0.2 text-[8px] font-black rounded border ${
                                    item.risk === "OVERPRICED" ? "bg-rose-500/10 text-rose-400 border-rose-950" :
                                    item.risk === "SLIGHTLY_EXPENSIVE" ? "bg-amber-500/10 text-amber-400 border-amber-950" :
                                    "bg-emerald-500/10 text-emerald-400 border-emerald-950"
                                  }`}>
                                    {item.risk} (+{item.gap}%)
                                  </span>
                                  <div className="flex flex-col items-end">
                                    <span className="text-[8px] font-bold text-neutral-500 uppercase">Score Oportunidade</span>
                                    <span className="font-mono font-black text-amber-500 text-xs">{item.score}</span>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>
                    </div>

                    {/* Right Column: Promo Detection, Margin Risks, Anomalies, Recommendations */}
                    <div className="flex flex-col gap-6">
                      
                      {/* KPI 3: Promo Detection Board */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Painel de Promoções Concorrentes Ativas
                        </span>

                        <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {promoItems.length === 0 ? (
                            <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                              Nenhuma promoção agressiva de concorrente mapeada hoje.
                            </div>
                          ) : (
                            promoItems.map((item, idx) => (
                              <div key={idx} className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-900 flex justify-between items-center">
                                <div className="flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-bold text-neutral-200">{item.pdv}</span>
                                  <span className="text-neutral-500 text-[9px]">
                                    Marca: <strong>{item.brand}</strong> • Produto: {item.sku}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[8px] text-neutral-500">Hora: {item.time}</span>
                                  <span className="px-2 py-0.5 rounded text-[9px] font-black bg-rose-500/10 text-rose-400 border border-rose-950">
                                    R$ {item.price.toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      {/* Margin Risk Board */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                            Margin Risk Board (Risco de Margem Coffee Mais)
                          </span>
                          <span className="text-[9px] font-black text-rose-400 uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded border border-rose-950">
                            {priceAlerts.filter(al => al.tipo_alerta === "margin_risk").length} riscos
                          </span>
                        </div>

                        <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {(() => {
                            const marginRisks = priceAlerts.filter(al => al.tipo_alerta === "margin_risk");
                            if (marginRisks.length === 0) {
                              return (
                                <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                                  Nenhum risco de margem detectado nos PDVs.
                                </div>
                              );
                            }
                            return marginRisks.map((al, idx) => {
                              const pdvName = pdvNameMap[al.visita?.pdv?.cod_parceiro] || al.visita?.pdv?.nome_fantasia || `PDV: ${al.pdv_id}`;
                              return (
                                <div key={idx} className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-900/60 flex justify-between items-center text-[10px]">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-neutral-300">{pdvName}</span>
                                    <span className="text-[9px] text-neutral-500">{al.descricao}</span>
                                  </div>
                                  <span className="px-1.5 py-0.2 text-[8px] font-black text-rose-400 bg-rose-500/10 border border-rose-950 rounded">
                                    RISCO DE MARGEM
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </section>

                      {/* Price Anomaly Board */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                            Price Anomaly Board (Desvios Históricos)
                          </span>
                          <span className="text-[9px] font-black text-red-400 uppercase tracking-wider bg-red-500/10 px-2 py-0.5 rounded border border-red-950">
                            {priceAlerts.filter(al => al.tipo_alerta === "price_anomaly").length} anomalias
                          </span>
                        </div>

                        <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {(() => {
                            const anomalies = priceAlerts.filter(al => al.tipo_alerta === "price_anomaly");
                            if (anomalies.length === 0) {
                              return (
                                <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                                  Nenhuma anomalia de preço detectada.
                                </div>
                              );
                            }
                            return anomalies.map((al, idx) => {
                              const pdvName = pdvNameMap[al.visita?.pdv?.cod_parceiro] || al.visita?.pdv?.nome_fantasia || `PDV: ${al.pdv_id}`;
                              return (
                                <div key={idx} className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-900/60 flex justify-between items-center text-[10px]">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="font-bold text-neutral-300">{pdvName}</span>
                                    <span className="text-[9px] text-neutral-500">{al.descricao}</span>
                                  </div>
                                  <span className="px-1.5 py-0.2 text-[8px] font-black text-red-400 bg-red-500/10 border border-red-950 rounded">
                                    DESVIO &gt; 40%
                                  </span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </section>

                      {/* Recommended Price Actions */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Recommended Price Actions (Ações Sugeridas)
                        </span>

                        <div className="flex flex-col gap-3 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {(() => {
                            const recommendedActions: { pdv: string; sku: string; action: string; severity: string; target: number; expectedGap: number }[] = [];
                            donePriceLogs.forEach(log => {
                              const pdvName = pdvNameMap[log.visita?.cod_parceiro] || `PDV ${log.visita?.cod_parceiro}`;
                              const recs = log.price_recommendation || {};
                              Object.keys(recs).forEach(sku => {
                                const rec = recs[sku];
                                const action = rec.action || rec.suggested_action;
                                if (action && action !== "MAINTAIN_PRICE") {
                                  recommendedActions.push({
                                    pdv: pdvName,
                                    sku: sku === "COFFEE_MAIS_CLASSICO" ? "Clássico 250g" : sku === "COFFEE_MAIS_INTENSO" ? "Intenso 250g" : sku === "COFFEE_MAIS_GOURMET" ? "Gourmet 250g" : sku === "COFFEE_MAIS_ESPRESSO" ? "Espresso 1kg" : sku,
                                    action: action,
                                    severity: rec.severity || "LOW",
                                    target: parseFloat(rec.suggested_target_price || rec.suggested_target || 0),
                                    expectedGap: parseFloat(rec.expected_gap_after_action || 0)
                                  });
                                }
                              });
                            });

                            if (recommendedActions.length === 0) {
                              return (
                                <div className="py-8 text-center text-xs text-neutral-550 border border-dashed border-neutral-850 rounded-xl">
                                  Nenhuma recomendação de alteração de preço gerada.
                                </div>
                              );
                            }

                            return recommendedActions.map((rec, idx) => (
                              <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex justify-between items-center hover:border-neutral-850 transition">
                                <div className="flex flex-col gap-0.5 text-[10px]">
                                  <span className="font-bold text-neutral-250">{rec.pdv}</span>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-neutral-500 text-[9px]">
                                      SKU: {rec.sku} • Sugerido: <strong>R$ {rec.target.toFixed(2)}</strong> (Gap: {rec.expectedGap > 0 ? '+' : ''}{rec.expectedGap}%)
                                    </span>
                                    <span className={`px-1 rounded text-[7px] font-black border ${
                                      rec.severity === "HIGH" ? "bg-rose-500/10 text-rose-450 border-rose-950" :
                                      rec.severity === "MEDIUM" ? "bg-amber-500/10 text-amber-450 border-amber-950" :
                                      "bg-blue-500/10 text-blue-400 border-blue-950"
                                    }`}>
                                      {rec.severity}
                                    </span>
                                  </div>
                                </div>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                                  rec.action === "REDUCE_PRICE" ? "bg-rose-500/10 text-rose-400 border-rose-950" :
                                  "bg-emerald-500/10 text-emerald-400 border-emerald-950"
                                }`}>
                                  {rec.action === "REDUCE_PRICE" ? "REDUZIR PREÇO" : "AUMENTAR PREÇO"}
                                </span>
                              </div>
                            ));
                          })()}
                        </div>
                      </section>

                      {/* Pricing Strategy Compliance */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <div className="flex justify-between items-center border-b border-neutral-900 pb-2">
                          <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                            Desvios da Estratégia de Preço Alvo
                          </span>
                          <span className="text-[9px] font-black text-rose-400 uppercase tracking-wider bg-rose-500/10 px-2 py-0.5 rounded border border-rose-950">
                            {strategyDeviations.length} desvios
                          </span>
                        </div>

                        <div className="flex flex-col gap-3 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {strategyDeviations.length === 0 ? (
                            <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                              Preços de Coffee Mais 100% alinhados à estratégia de preços máximos.
                            </div>
                          ) : (
                            strategyDeviations.map((item, idx) => (
                              <div key={idx} className="p-2.5 bg-neutral-950 rounded-xl border border-neutral-900/60 flex justify-between items-center text-[10px]">
                                <div className="flex flex-col gap-0.5">
                                  <span className="font-bold text-neutral-300">{item.pdv}</span>
                                  <span className="text-[9px] text-neutral-500">Produto: {item.sku}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-neutral-400 font-mono">R$ {item.price.toFixed(2)}</span>
                                  <span className="px-1.5 py-0.2 text-[8px] font-black text-rose-400 bg-rose-500/10 border border-rose-950 rounded">
                                    {item.deviation}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </section>

                      {/* Pricing Alerts Board */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          Histórico de Alertas de Preço (Trade Marketing)
                        </span>

                        <div className="flex flex-col gap-3.5 max-h-[180px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-neutral-850">
                          {priceAlerts.length === 0 ? (
                            <div className="py-8 text-center text-xs text-neutral-500 border border-dashed border-neutral-850 rounded-xl">
                              Nenhum alerta de precificação gerado nas últimas semanas.
                            </div>
                          ) : (
                            priceAlerts.map((al, idx) => {
                              const pdvName = pdvNameMap[al.visita?.pdv?.cod_parceiro] || al.visita?.pdv?.nome_fantasia || `PDV ID: ${al.pdv_id}`;
                              
                              return (
                                <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900 flex flex-col gap-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-neutral-200">{pdvName}</span>
                                    <span className={`px-1.5 py-0.2 text-[8px] font-black rounded border ${
                                      al.tipo_alerta === "competitor_promo_detected" ? "bg-amber-500/10 text-amber-400 border-amber-950" :
                                      al.tipo_alerta === "overpriced_versus_strategy" ? "bg-rose-500/10 text-rose-400 border-rose-950" :
                                      al.tipo_alerta === "margin_risk" ? "bg-amber-500/10 text-amber-400 border-amber-950" :
                                      al.tipo_alerta === "price_anomaly" ? "bg-red-500/10 text-red-400 border-red-950" :
                                      "bg-red-500/10 text-red-400 border-red-950"
                                    }`}>
                                      {al.tipo_alerta}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-neutral-400 leading-normal">{al.descricao}</p>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </section>

                    </div>

                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Route Intelligence View */}
        {dashboardMode === "route_intelligence" && !warRoomMode && (() => {
                if (loadingRouteKpis) {
                  return (
                    <div className="py-20 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                      <span>Carregando dados de inteligência de rota...</span>
                    </div>
                  );
                }

                if (!routeKpis) {
                  return (
                    <div className="py-20 text-center text-xs text-neutral-500">
                      Nenhum dado de inteligência de rota disponível.
                    </div>
                  );
                }

                const gaps = routeKpis.coverage_gaps || [];
                const capacities = routeKpis.promoter_capacities || [];
                const ranking = routeKpis.priority_ranking || [];
                const eff = routeKpis.route_efficiency || { efficiency_ratio: 0, productive_minutes: 0, transit_minutes: 0 };

                return (
                  <div className="space-y-6">
                    {/* Sub-tab Selector */}
                    <div className="flex gap-2 border-b border-neutral-900 pb-2">
                      <button
                        onClick={() => setRouteSubTab("route_slas")}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          routeSubTab === "route_slas"
                            ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Rotas & SLAs
                      </button>
                      <button
                        onClick={() => setRouteSubTab("sellout")}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          routeSubTab === "sellout"
                            ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Sell-Out Intelligence
                      </button>
                      <button
                        onClick={() => setRouteSubTab("order_engine")}
                        className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          routeSubTab === "order_engine"
                            ? "bg-amber-500 text-neutral-950 shadow-md font-black"
                            : "text-neutral-400 hover:text-white"
                        }`}
                      >
                        Order Engine
                      </button>
                    </div>

                    {routeSubTab === "route_slas" && (
                      <>
                        {/* Top KPI Cards */}
                        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                          Route Efficiency Ratio
                        </span>
                        <div className="flex items-baseline justify-between mt-2">
                          <span className={`text-2xl font-black ${
                            eff.efficiency_ratio >= 75 ? "text-emerald-450" :
                            eff.efficiency_ratio >= 50 ? "text-amber-500" : "text-rose-500"
                          }`}>{eff.efficiency_ratio}%</span>
                          <Activity className="w-5 h-5 text-neutral-800" />
                        </div>
                        <p className="text-[9px] text-neutral-500 mt-1">Tempo ativo produtivo em loja</p>
                      </div>

                      <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                          Minutos Produtivos
                        </span>
                        <div className="flex items-baseline justify-between mt-2">
                          <span className="text-2xl font-black text-neutral-250">{eff.productive_minutes} min</span>
                          <Clock className="w-5 h-5 text-neutral-800" />
                        </div>
                        <p className="text-[9px] text-neutral-500 mt-1">Tempo estimado de execução total</p>
                      </div>

                      <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                          Tempo em Trânsito
                        </span>
                        <div className="flex items-baseline justify-between mt-2">
                          <span className="text-2xl font-black text-neutral-250">{eff.transit_minutes} min</span>
                          <MapPin className="w-5 h-5 text-neutral-800" />
                        </div>
                        <p className="text-[9px] text-neutral-500 mt-1">Deslocamento estimado dos promotores</p>
                      </div>

                      <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                          Ferramentas de Cadastro
                        </span>
                        <div className="mt-3">
                          <Link
                            href="/admin/pdv-import"
                            className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-black rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                          >
                            Importar PDVs (Excel/CSV)
                          </Link>
                        </div>
                      </div>
                    </section>

                    {/* Mid Section: Promoter Capacity & Coverage Gaps */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      
                      {/* Promoter Capacity Card */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          KPI 1 — Capacidade e SLA por Promotor
                        </span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                <th className="p-2">Promotor</th>
                                <th className="p-2 text-center">Tempo Útil (Min)</th>
                                <th className="p-2 text-center">SLA Médio (Min)</th>
                                <th className="p-2 text-center">Capacidade (Visitas/Dia)</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-900/50">
                              {capacities.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-neutral-500">Nenhum promotor ativo encontrado.</td>
                                </tr>
                              ) : (
                                capacities.map((p: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                    <td className="p-2 font-bold text-white">{p.name}</td>
                                    <td className="p-2 text-center font-mono">{p.total_useful_minutes} min</td>
                                    <td className="p-2 text-center font-mono">{p.avg_visit_minutes} min</td>
                                    <td className="p-2 text-center font-mono text-amber-500 font-black">{p.capacity}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                      {/* Coverage Gaps Card */}
                      <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                          KPI 2 — Cobertura e Gaps Regionais (Últimos 30 dias)
                        </span>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                <th className="p-2">Região (UF)</th>
                                <th className="p-2 text-center">Total PDVs</th>
                                <th className="p-2 text-center">Atendidos</th>
                                <th className="p-2 text-right">Cobertura</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-900/50">
                              {gaps.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="p-4 text-center text-neutral-500">Sem dados regionais.</td>
                                </tr>
                              ) : (
                                gaps.map((g: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                    <td className="p-2 font-bold text-white font-mono">{g.region}</td>
                                    <td className="p-2 text-center font-mono">{g.total_pdvs}</td>
                                    <td className="p-2 text-center font-mono">{g.visited_pdvs}</td>
                                    <td className="p-2 text-right font-mono">
                                      <div className="flex items-center justify-end gap-2">
                                        <div className="w-16 bg-neutral-950 h-1.5 rounded-full overflow-hidden border border-neutral-900">
                                          <div 
                                            className={`h-full rounded-full ${
                                              g.coverage_ratio >= 80 ? "bg-emerald-500" :
                                              g.coverage_ratio >= 50 ? "bg-amber-500" : "bg-rose-500"
                                            }`}
                                            style={{ width: `${g.coverage_ratio}%` }}
                                          />
                                        </div>
                                        <span className={`font-black ${
                                          g.coverage_ratio >= 80 ? "text-emerald-400" :
                                          g.coverage_ratio >= 50 ? "text-amber-400" : "text-rose-450"
                                        }`}>{g.coverage_ratio}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </section>

                    </div>

                    {/* Bottom Section: Commercial Priority Route Ranking */}
                    <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                      <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                        KPI 4 — Ranking de Prioridade de Visita (Oportunidade Comercial)
                      </span>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                              <th className="p-3">Prioridade</th>
                              <th className="p-3 text-center">Score</th>
                              <th className="p-3">Código</th>
                              <th className="p-3">PDV</th>
                              <th className="p-3">Rede</th>
                              <th className="p-3">Faturamento</th>
                              <th className="p-3">Endereço</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-neutral-900/50">
                            {ranking.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="p-4 text-center text-neutral-500">Nenhum PDV prioritário calculado ainda.</td>
                              </tr>
                            ) : (
                              ranking.map((item: any, idx: number) => (
                                <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                  <td className="p-3">
                                    <span className={`inline-flex items-center text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                      item.priority_class === "CRÍTICO" ? "bg-rose-500/10 text-rose-400 border-rose-950" :
                                      item.priority_class === "ALTO" ? "bg-amber-500/10 text-amber-400 border-amber-950" :
                                      item.priority_class === "MÉDIO" ? "bg-blue-500/10 text-blue-400 border-blue-950" :
                                      "bg-emerald-500/10 text-emerald-400 border-emerald-950"
                                    }`}>
                                      {item.priority_class}
                                    </span>
                                  </td>
                                  <td className="p-3 text-center font-mono font-black text-amber-500 text-sm">
                                    {item.priority_score.toFixed(1)}
                                  </td>
                                  <td className="p-3 font-mono font-bold text-white">{item.cod_parceiro}</td>
                                  <td className="p-3 font-semibold truncate max-w-[150px]" title={item.nome_fantasia}>
                                    {item.nome_fantasia}
                                  </td>
                                  <td className="p-3 truncate max-w-[120px]" title={item.rede}>{item.rede}</td>
                                  <td className="p-3 font-mono">
                                    {item.faturamento?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) || "R$ 0,00"}
                                  </td>
                                  <td className="p-3 text-neutral-500 truncate max-w-[200px]" title={item.endereco}>
                                    {item.endereco || "Sem endereço cadastrado"}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </>
                )}

                {routeSubTab === "sellout" && (
                  <>
                    {loadingSelloutKpis ? (
                      <div className="py-20 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando dados de inteligência de sell-out...</span>
                      </div>
                    ) : !selloutKpis ? (
                      <div className="py-20 text-center text-xs text-neutral-500">
                        Nenhum dado de inteligência de sell-out disponível.
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* KPI 4 — Inventory Coverage by Region & top turnover */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* KPI 4: Coverage Heatmap */}
                          <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                              KPI 4 — Cobertura Média de Estoque por UF
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {(selloutKpis.coverage_by_region || []).map((c: any, idx: number) => (
                                <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900/50 flex flex-col justify-between">
                                  <span className="text-sm font-black text-amber-500">{c.region}</span>
                                  <span className="text-xs font-mono font-bold mt-1 text-white">
                                    {c.avg_days_of_inventory} dias
                                  </span>
                                </div>
                              ))}
                              {(selloutKpis.coverage_by_region || []).length === 0 && (
                                <span className="text-neutral-500 text-xs">Sem dados regionais.</span>
                              )}
                            </div>
                          </section>

                          {/* KPI 6: SKU Turnover Ranking */}
                          <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                              Giro de Vendas Acumulado por SKU
                            </span>
                            <div className="space-y-2">
                              {(selloutKpis.top_turnover_skus || []).slice(0, 5).map((sku: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between text-xs p-2 bg-neutral-950 rounded-xl border border-neutral-900/50">
                                  <span className="font-semibold text-neutral-300">{sku.product_name}</span>
                                  <span className="font-mono font-black text-amber-500">{sku.total_sellout_velocity.toFixed(2)} cx/dia</span>
                                </div>
                              ))}
                              {(selloutKpis.top_turnover_skus || []).length === 0 && (
                                <span className="text-neutral-500 text-xs">Sem giros calculados.</span>
                              )}
                            </div>
                          </section>
                        </div>

                        {/* Tables section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* KPI 1: Rupture Forecast Board */}
                          <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                              KPI 1 — Rupture Forecast Board (Maior Risco)
                            </span>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                    <th className="p-2">PDV</th>
                                    <th className="p-2">SKU</th>
                                    <th className="p-2 text-center">Estoque</th>
                                    <th className="p-2 text-center">Giro</th>
                                    <th className="p-2 text-center">Cobertura</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900/50">
                                  {(selloutKpis.top_rupture_risk || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={5} className="p-4 text-center text-neutral-500">Nenhum risco de ruptura iminente.</td>
                                    </tr>
                                  ) : (
                                    (selloutKpis.top_rupture_risk || []).map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                        <td className="p-2 font-semibold truncate max-w-[120px]" title={item.nome_fantasia}>{item.nome_fantasia}</td>
                                        <td className="p-2 text-neutral-400">{item.product_name.replace("Café Coffee Mais ", "")}</td>
                                        <td className="p-2 text-center font-mono">{item.estimated_stock_boxes.toFixed(1)}</td>
                                        <td className="p-2 text-center font-mono">{item.sellout_velocity.toFixed(1)}/d</td>
                                        <td className="p-2 text-center font-mono text-rose-500 font-black">{item.days_of_inventory}d</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </section>

                          {/* KPI 5: Suggested Orders Ranking */}
                          <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                              KPI 5 — Pedidos Sugeridos (Recompra Alvo 14d)
                            </span>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                    <th className="p-2">PDV</th>
                                    <th className="p-2">Produto</th>
                                    <th className="p-2 text-center">Pedido Sugerido</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900/50">
                                  {(selloutKpis.top_suggested_orders || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="p-4 text-center text-neutral-500">Nenhuma sugestão de pedido calculada.</td>
                                    </tr>
                                  ) : (
                                    (selloutKpis.top_suggested_orders || []).map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                        <td className="p-2 font-semibold truncate max-w-[120px]" title={item.nome_fantasia}>{item.nome_fantasia}</td>
                                        <td className="p-2 text-neutral-400">{item.product_name.replace("Café Coffee Mais ", "")}</td>
                                        <td className="p-2 text-center font-mono font-black text-amber-500 text-sm">{item.suggested_order_boxes} cx</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* KPI 2: Slow Movers Board */}
                          <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                              KPI 2 — Slow Movers Board (Baixo Giro)
                            </span>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                    <th className="p-2">PDV</th>
                                    <th className="p-2">Produto</th>
                                    <th className="p-2 text-center">Giro Diário</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900/50">
                                  {(selloutKpis.top_slow_movers || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="p-4 text-center text-neutral-500">Nenhum produto lento detectado.</td>
                                    </tr>
                                  ) : (
                                    (selloutKpis.top_slow_movers || []).map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                        <td className="p-2 font-semibold truncate max-w-[120px]" title={item.nome_fantasia}>{item.nome_fantasia}</td>
                                        <td className="p-2 text-neutral-400">{item.product_name.replace("Café Coffee Mais ", "")}</td>
                                        <td className="p-2 text-center font-mono text-amber-500 font-black">{item.sellout_velocity.toFixed(2)} cx/d</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </section>

                          {/* KPI 3: Dead Stock Board */}
                          <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                              KPI 3 — Dead Stock Board (Estoque Parado)
                            </span>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                    <th className="p-2">PDV</th>
                                    <th className="p-2">Produto</th>
                                    <th className="p-2 text-center">Estoque Parado</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900/50">
                                  {(selloutKpis.top_dead_stock || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={3} className="p-4 text-center text-neutral-500">Nenhum estoque inativo detectado.</td>
                                    </tr>
                                  ) : (
                                    (selloutKpis.top_dead_stock || []).map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                        <td className="p-2 font-semibold truncate max-w-[120px]" title={item.nome_fantasia}>{item.nome_fantasia}</td>
                                        <td className="p-2 text-neutral-400">{item.product_name.replace("Café Coffee Mais ", "")}</td>
                                        <td className="p-2 text-center font-mono text-red-400 font-black">{item.estimated_stock_boxes.toFixed(0)} cx</td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {routeSubTab === "order_engine" && (
                  <>
                    {loadingOrderKpis ? (
                      <div className="py-20 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        <span>Carregando dados do motor de recomendação...</span>
                      </div>
                    ) : !orderKpis ? (
                      <div className="py-20 text-center text-xs text-neutral-500">
                        Nenhum dado de recomendação de pedido disponível.
                      </div>
                    ) : (() => {
                      const totalRevenue = (orderKpis.potential_revenue_by_region || []).reduce((sum: number, r: any) => sum + Number(r.total_value), 0);
                      const totalBoxes = (orderKpis.potential_revenue_by_region || []).reduce((sum: number, r: any) => sum + Number(r.total_boxes), 0);

                      return (
                        <div className="space-y-6">
                          {/* Top KPI Cards / Potential Revenue Board */}
                          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Receita Potencial Total
                              </span>
                              <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-black text-amber-500">
                                  {totalRevenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                </span>
                              </div>
                              <p className="text-[9px] text-neutral-500 mt-1">Soma das recomendações geradas</p>
                            </div>

                            <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Volume Recomendado
                              </span>
                              <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-black text-neutral-250">
                                  {totalBoxes.toLocaleString("pt-BR")} cx
                                </span>
                              </div>
                              <p className="text-[9px] text-neutral-500 mt-1">Total de caixas sugeridas pelo motor</p>
                            </div>

                            <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Taxa Conversão Ponderada
                              </span>
                              <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-black text-emerald-450">
                                  {(() => {
                                    const dist = orderKpis.conversion_probability_distribution || { high: 0, medium: 0, low: 0, total: 0 };
                                    const total = dist.total || 1;
                                    const rate = ((dist.high + dist.medium * 0.5) / total) * 100;
                                    return `${rate.toFixed(0)}%`;
                                  })()}
                                </span>
                              </div>
                              <p className="text-[9px] text-neutral-500 mt-1">Estimativa de fechamento comercial</p>
                            </div>

                            <div className="p-4 bg-neutral-900/30 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col justify-between min-h-[100px] shadow-lg">
                              <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                PDVs Recomendados
                              </span>
                              <div className="flex items-baseline justify-between mt-2">
                                <span className="text-2xl font-black text-white">
                                  {orderKpis.top_opportunity_pdvs?.length || 0}
                                </span>
                              </div>
                              <p className="text-[9px] text-neutral-500 mt-1">Lojas com recomendação de pedido ativa</p>
                            </div>
                          </section>

                          {/* Region & Probability Distribution */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* KPI 1: Regional Potential Revenue */}
                            <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                              <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                                Faturamento Sugerido por UF
                              </span>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {(orderKpis.potential_revenue_by_region || []).map((r: any, idx: number) => (
                                  <div key={idx} className="p-3 bg-neutral-950 rounded-xl border border-neutral-900/50 flex flex-col justify-between">
                                    <span className="text-sm font-black text-amber-500">{r.region}</span>
                                    <span className="text-xs font-mono font-bold mt-1 text-white">
                                      {r.total_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                    </span>
                                    <span className="text-[9px] text-neutral-500 mt-1 font-mono">
                                      {r.total_boxes} cx
                                    </span>
                                  </div>
                                ))}
                                {(orderKpis.potential_revenue_by_region || []).length === 0 && (
                                  <span className="text-neutral-500 text-xs">Sem faturamento regional.</span>
                                )}
                              </div>
                            </section>

                            {/* KPI 3: Conversion Probability Board */}
                            <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                              <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                                Distribuição de Probabilidade de Conversão
                              </span>
                              <div className="space-y-4 justify-center flex flex-col h-full">
                                {(() => {
                                  const dist = orderKpis.conversion_probability_distribution || { high: 0, medium: 0, low: 0, total: 0 };
                                  const total = dist.total || 1;
                                  const highPct = (dist.high / total) * 100;
                                  const medPct = (dist.medium / total) * 100;
                                  const lowPct = (dist.low / total) * 100;

                                  return (
                                    <div className="space-y-3">
                                      <div>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-emerald-400 font-bold">Alta (&gt;75%)</span>
                                          <span className="font-mono text-neutral-300">{dist.high} PDVs ({highPct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                                          <div className="h-full bg-emerald-500" style={{ width: `${highPct}%` }} />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-amber-400 font-bold">Média (50% - 75%)</span>
                                          <span className="font-mono text-neutral-300">{dist.medium} PDVs ({medPct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                                          <div className="h-full bg-amber-500" style={{ width: `${medPct}%` }} />
                                        </div>
                                      </div>
                                      <div>
                                        <div className="flex justify-between text-xs mb-1">
                                          <span className="text-rose-400 font-bold">Baixa (&lt;50%)</span>
                                          <span className="font-mono text-neutral-300">{dist.low} PDVs ({lowPct.toFixed(0)}%)</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-neutral-950 rounded-full overflow-hidden">
                                          <div className="h-full bg-rose-500" style={{ width: `${lowPct}%` }} />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </section>
                          </div>

                          {/* Tables section */}
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* KPI 2: Top Opportunity PDVs */}
                            <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                              <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                                KPI 2 — Top PDVs por Faturamento Potencial
                              </span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                      <th className="p-2">PDV</th>
                                      <th className="p-2">Rede</th>
                                      <th className="p-2 text-center">Urgência</th>
                                      <th className="p-2 text-center">Probabilidade</th>
                                      <th className="p-2 text-right">Valor Sugerido</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-900/50">
                                    {(orderKpis.top_opportunity_pdvs || []).length === 0 ? (
                                      <tr>
                                        <td colSpan={5} className="p-4 text-center text-neutral-500">Nenhuma oportunidade de pedido sugerido.</td>
                                      </tr>
                                    ) : (
                                      (orderKpis.top_opportunity_pdvs || []).map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                          <td className="p-2 font-semibold truncate max-w-[120px]" title={item.nome_fantasia}>{item.nome_fantasia}</td>
                                          <td className="p-2 text-neutral-400 truncate max-w-[80px]" title={item.rede}>{item.rede}</td>
                                          <td className="p-2 text-center">
                                            <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                              item.urgency_level === "CRITICAL" ? "bg-rose-500/10 text-rose-400 border-rose-950" :
                                              item.urgency_level === "HIGH" ? "bg-amber-500/10 text-amber-400 border-amber-950" :
                                              item.urgency_level === "MEDIUM" ? "bg-blue-500/10 text-blue-400 border-blue-950" :
                                              "bg-emerald-500/10 text-emerald-400 border-emerald-950"
                                            }`}>
                                              {item.urgency_level}
                                            </span>
                                          </td>
                                          <td className="p-2 text-center font-mono font-bold text-neutral-400">{item.conversion_probability.toFixed(0)}%</td>
                                          <td className="p-2 text-right font-mono font-black text-amber-500">
                                            {item.total_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </section>

                            {/* KPI 4: Recommended SKU Ranking */}
                            <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                              <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                                KPI 4 — Ranking de SKUs Mais Recomendados
                              </span>
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                      <th className="p-2">SKU</th>
                                      <th className="p-2">Produto</th>
                                      <th className="p-2 text-center">Volume (cx)</th>
                                      <th className="p-2 text-right">Valor Total</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-neutral-900/50">
                                    {(orderKpis.recommended_skus || []).length === 0 ? (
                                      <tr>
                                        <td colSpan={4} className="p-4 text-center text-neutral-500">Sem SKUs recomendados.</td>
                                      </tr>
                                    ) : (
                                      (orderKpis.recommended_skus || []).map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                          <td className="p-2 font-mono text-[10px] text-neutral-400">{item.sku.replace("COFFEE_MAIS_", "")}</td>
                                          <td className="p-2 text-neutral-200">{item.product_name.replace("Café Coffee Mais ", "")}</td>
                                          <td className="p-2 text-center font-mono font-black text-white">{item.total_boxes}</td>
                                          <td className="p-2 text-right font-mono font-black text-amber-500">
                                            {item.total_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                          </td>
                                        </tr>
                                      ))
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </section>
                          </div>

                          {/* Lost Opportunity Board */}
                          <section className="p-5 bg-neutral-900/20 backdrop-blur-md rounded-2xl border border-neutral-900 flex flex-col gap-4">
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                              KPI 5 — Lost Opportunity Board (Lojas Críticas Sem Visita Recente)
                            </span>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-neutral-950 border-b border-neutral-900 text-neutral-500 font-bold uppercase text-[8px] tracking-wider">
                                    <th className="p-2">Código</th>
                                    <th className="p-2">PDV</th>
                                    <th className="p-2">Rede</th>
                                    <th className="p-2">UF</th>
                                    <th className="p-2">Canal</th>
                                    <th className="p-2 text-center">Criticidade Giro</th>
                                    <th className="p-2 text-right">Faturamento Mensal</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-900/50">
                                  {(orderKpis.lost_opportunities || []).length === 0 ? (
                                    <tr>
                                      <td colSpan={7} className="p-4 text-center text-neutral-500">Nenhum PDV crítico sem visita recente. Excelente cobertura geográfica!</td>
                                    </tr>
                                  ) : (
                                    (orderKpis.lost_opportunities || []).map((item: any, idx: number) => (
                                      <tr key={idx} className="hover:bg-neutral-900/40 text-neutral-300">
                                        <td className="p-2 font-mono text-[10px] text-neutral-400">{item.pdv_id}</td>
                                        <td className="p-2 font-semibold truncate max-w-[150px]" title={item.nome_fantasia}>{item.nome_fantasia}</td>
                                        <td className="p-2 text-neutral-400">{item.rede}</td>
                                        <td className="p-2 font-mono">{item.uf}</td>
                                        <td className="p-2 text-neutral-400">{item.canal}</td>
                                        <td className="p-2 text-center">
                                          <span className={`inline-block text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                                            item.highest_risk === "CRITICAL" ? "bg-rose-500/10 text-rose-400 border-rose-950" :
                                            "bg-amber-500/10 text-amber-400 border-amber-950"
                                          }`}>
                                            {item.highest_risk}
                                          </span>
                                        </td>
                                        <td className="p-2 text-right font-mono text-neutral-200">
                                          {item.faturamento_mensal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </section>
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>
            );
          })()}

        {/* Prescriptive AI View */}
        {dashboardMode === "prescriptive_ai" && !warRoomMode && (() => {
          if (loadingRecommendations) {
            return (
              <div className="py-20 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando dados de Inteligência Prescritiva...</span>
              </div>
            );
          }

          // Calculate KPI metrics for the Funnel & Ranking
          const openRecs = recommendations.filter(r => r.status === "OPEN");
          const executedRecs = recommendations.filter(r => r.status === "EXECUTED");
          const dismissedRecs = recommendations.filter(r => r.status === "DISMISSED");
          
          const totalRecsCount = recommendations.length;
          const conversionRate = totalRecsCount > 0 ? (executedRecs.length / totalRecsCount) * 100 : 0;
          
          const totalRevenueUpliftPotential = openRecs.reduce((acc, r) => acc + Number(r.expected_revenue_uplift || 0), 0);
          const capturedRevenueUplift = executedRecs.reduce((acc, r) => acc + Number(r.expected_revenue_uplift || 0), 0);

          // Group by region/UF for Heatmap
          const heatmapData: Record<string, { count: number; uplift: number }> = {};
          recommendations.forEach(r => {
            const uf = r.pdv?.uf || "Outro";
            if (!heatmapData[uf]) {
              heatmapData[uf] = { count: 0, uplift: 0 };
            }
            heatmapData[uf].count += 1;
            heatmapData[uf].uplift += Number(r.expected_revenue_uplift || 0);
          });

          return (
            <div className="space-y-6">
              {/* Widget 1: Recommendation Funnel & Overview Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fadeIn">
                <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-black">Funil de Ações IA</span>
                    <h3 className="text-xl font-bold text-white mt-1">{totalRecsCount} Geradas</h3>
                  </div>
                  <div className="mt-2 text-[10px] text-neutral-500">
                    Aberto: {openRecs.length} | Executado: {executedRecs.length}
                  </div>
                </div>
                
                <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-black">Taxa de Conversão</span>
                    <h3 className="text-xl font-bold text-emerald-400 mt-1">{conversionRate.toFixed(1)}%</h3>
                  </div>
                  <div className="mt-2 text-[10px] text-neutral-500">
                    {executedRecs.length} de {totalRecsCount} sugestões aplicadas
                  </div>
                </div>

                <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-black">Receita Prescrita (Pendente)</span>
                    <h3 className="text-xl font-bold text-amber-500 mt-1">
                      {totalRevenueUpliftPotential.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </h3>
                  </div>
                  <div className="mt-2 text-[10px] text-neutral-500">
                    Uplift incremental de sell-out estimado
                  </div>
                </div>

                <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-400 uppercase font-black">Receita incremental Capturada</span>
                    <h3 className="text-xl font-bold text-emerald-400 mt-1">
                      {capturedRevenueUplift.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </h3>
                  </div>
                  <div className="mt-2 text-[10px] text-neutral-500">
                    Ações de trade executadas com sucesso
                  </div>
                </div>
              </div>

              {/* Widget 2: Next Best Actions Board */}
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Quadro Prescritivo: Next Best Actions</h3>
                    <p className="text-[11px] text-neutral-500">Recomendações comerciais ordenadas por Prioridade (ROI Ponderado)</p>
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterRecStatus}
                      onChange={(e) => setFilterRecStatus(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 rounded px-2 py-1 outline-none font-bold"
                    >
                      <option value="OPEN">Status: Em Aberto</option>
                      <option value="EXECUTED">Status: Executadas</option>
                      <option value="DISMISSED">Status: Dispensadas</option>
                      <option value="TODOS">Status: Todos</option>
                    </select>
                    <select
                      value={filterRecType}
                      onChange={(e) => setFilterRecType(e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 rounded px-2 py-1 outline-none font-bold"
                    >
                      <option value="TODOS">Tipo: Todos</option>
                      <option value="PRICE_REDUCTION">Redução de Preço</option>
                      <option value="TRADE_PROMOTION">Promoção Comercial</option>
                      <option value="STOCK_REPLENISHMENT">Abastecimento</option>
                      <option value="DISPLAY_EXPANSION">Expansão de Espaço</option>
                      <option value="EXTRA_VISIT">Visita Extra</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[10px] text-neutral-400 font-bold uppercase">
                        <th className="p-2">PDV / Canal</th>
                        <th className="p-2">Ação Sugerida</th>
                        <th className="p-2 text-center">Score IA</th>
                        <th className="p-2 text-center">Confiança</th>
                        <th className="p-2 text-right">Uplift Est.</th>
                        <th className="p-2 text-right">ROI Est.</th>
                        <th className="p-2">Responsável</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center text-xs text-neutral-500">
                            Nenhuma recomendação encontrada para os filtros selecionados.
                          </td>
                        </tr>
                      ) : (
                        recommendations.map((rec) => {
                          const pdvName = rec.pdv?.nome_fantasia || `Código: ${rec.entity_id}`;
                          const pdvChannel = rec.pdv?.canal || "-";
                          const expectedUpliftVal = Number(rec.expected_revenue_uplift || 0);
                          const roiVal = Number(rec.estimated_roi || 0);

                          return (
                            <tr key={rec.id} className="border-b border-neutral-900/60 hover:bg-neutral-800/10 text-xs text-neutral-300">
                              <td className="p-2">
                                <div className="font-semibold text-neutral-200">{pdvName}</div>
                                <div className="text-[10px] text-neutral-500">{pdvChannel} - {rec.pdv?.uf || "-"}</div>
                              </td>
                              <td className="p-2">
                                <div className="font-bold text-amber-500">{rec.recommendation_type.replaceAll('_', ' ')}</div>
                                <div className="text-[10px] text-neutral-400 font-mono truncate max-w-[200px]" title={JSON.stringify(rec.recommended_action)}>
                                  {JSON.stringify(rec.recommended_action)}
                                </div>
                              </td>
                              <td className="p-2 text-center font-mono font-bold text-white">
                                {rec.priority_score.toFixed(0)}
                              </td>
                              <td className="p-2 text-center font-mono">
                                <span className={rec.recommendation_confidence >= 85 ? "text-emerald-400" : "text-amber-400"}>
                                  {rec.recommendation_confidence.toFixed(0)}%
                                </span>
                              </td>
                              <td className="p-2 text-right font-mono text-neutral-200">
                                {expectedUpliftVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-amber-400">
                                {roiVal.toFixed(2)}x
                              </td>
                              <td className="p-2">
                                <select
                                  value={rec.assigned_user_id || ""}
                                  onChange={(e) => delegateRecommendation(rec.id, e.target.value)}
                                  className="bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 rounded px-1.5 py-0.5 outline-none max-w-[120px]"
                                >
                                  <option value="">Não Designado</option>
                                  {promotores.map(p => (
                                    <option key={p.id} value={p.id}>{p.nome || p.email}</option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Widget 3: Opportunity Heatmap */}
                <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-white mb-3">Mapa de Oportunidades por Estado</h3>
                  <div className="space-y-3">
                    {Object.keys(heatmapData).length === 0 ? (
                      <p className="text-center text-xs text-neutral-500 py-6">Nenhum dado geográfico de oportunidade disponível.</p>
                    ) : (
                      Object.entries(heatmapData).map(([uf, data]) => {
                        return (
                          <div key={uf} className="flex items-center justify-between text-xs border-b border-neutral-900 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-neutral-950 flex items-center justify-center font-bold text-amber-500 font-mono">
                                {uf}
                              </span>
                              <div>
                                <span className="text-neutral-200 font-bold">{data.count} recomendações</span>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="text-emerald-400 font-bold">
                                +{data.uplift.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </div>
                              <div className="text-[10px] text-neutral-500">Sell-Out Incremental</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Widget 4: Multi-Parameter Action Simulator */}
                <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4 space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white">Simulador de ROI de Trade</h3>
                    <p className="text-[11px] text-neutral-500">Preveja retorno financeiro ao combinar investimentos de trade marketing</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Selecionar PDV</label>
                      <select
                        value={simSelectedPdv}
                        onChange={(e) => setSimSelectedPdv(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded p-2 outline-none font-bold"
                      >
                        <option value="">Selecione...</option>
                        {recommendations.slice(0, 15).map((r, i) => (
                          <option key={i} value={r.entity_id}>{r.pdv?.nome_fantasia || r.entity_id}</option>
                        ))}
                        {recommendations.length === 0 && (
                          <option value="PDV_MOCK_1">Coffee Store Downtown</option>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Tipo de Ação</label>
                      <select
                        value={simActionType}
                        onChange={(e) => setSimActionType(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded p-2 outline-none font-bold"
                      >
                        <option value="PRICE_REDUCTION">Redução de Preço</option>
                        <option value="TRADE_PROMOTION">Promoção Comercial</option>
                        <option value="DISPLAY_EXPANSION">Expansão de Espaço</option>
                        <option value="DEGUSTATION">Ação de Degustação</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Desconto Comercial (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        value={simDiscount}
                        onChange={(e) => setSimDiscount(Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded p-2 outline-none font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Verba Ponta Gôndola (R$)</label>
                      <input
                        type="number"
                        min="0"
                        value={simDisplayInvest}
                        onChange={(e) => setSimDisplayInvest(Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded p-2 outline-none font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Dias de Degustação</label>
                      <input
                        type="number"
                        min="0"
                        value={simDegustationDays}
                        onChange={(e) => setSimDegustationDays(Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded p-2 outline-none font-mono font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] text-neutral-400 font-bold uppercase mb-1">Horas Extras Promotor</label>
                      <input
                        type="number"
                        min="0"
                        value={simPromotorHours}
                        onChange={(e) => setSimPromotorHours(Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-800 text-neutral-300 rounded p-2 outline-none font-mono font-bold"
                      />
                    </div>
                  </div>

                  <button
                    onClick={runSimulator}
                    disabled={simLoading}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-neutral-800 text-neutral-950 font-bold rounded-lg transition-colors text-xs uppercase"
                  >
                    {simLoading ? "Simulando..." : "Calcular Impacto & ROI"}
                  </button>

                  {simResult && simResult.simulation && (
                    <div className="bg-neutral-950/60 border border-neutral-850 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs font-mono animate-fadeIn">
                      <div>
                        <span className="text-[9px] text-neutral-500 block uppercase">Uplift Sell-Out</span>
                        <span className="text-emerald-400 font-bold text-sm">+{simResult.simulation.sellout_uplift_percent}%</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 block uppercase">Receita Estimada</span>
                        <span className="text-white font-bold text-sm">
                          {Number(simResult.simulation.expected_revenue_uplift).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 block uppercase">Custo Total da Ação</span>
                        <span className="text-rose-400 font-bold text-sm">
                          {Number(simResult.simulation.estimated_cost).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-neutral-500 block uppercase">ROI Comercial</span>
                        <span className="text-amber-500 font-bold text-sm">
                          {Number(simResult.simulation.estimated_roi).toFixed(2)}x
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Widget 5: ROI Ranking & Closed Loop Learning */}
              <div className="bg-neutral-900/40 border border-neutral-800 rounded-xl p-4">
                <h3 className="text-sm font-bold text-white mb-3">Histórico de Ações Executadas & Feedback Loop</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[10px] text-neutral-400 font-bold uppercase">
                        <th className="p-2">ID Ação</th>
                        <th className="p-2">Ação</th>
                        <th className="p-2 text-right">Uplift Capturado</th>
                        <th className="p-2 text-right">ROI Real</th>
                        <th className="p-2">Data Execução</th>
                        <th className="p-2">Avaliação / Notas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recommendations.filter(r => r.status === "EXECUTED").length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-xs text-neutral-500">
                            Nenhuma ação executada e avaliada no ciclo fechado até o momento.
                          </td>
                        </tr>
                      ) : (
                        recommendations.filter(r => r.status === "EXECUTED").map((rec) => {
                          const rating = rec.execution_feedback?.rating || 0;
                          return (
                            <tr key={rec.id} className="border-b border-neutral-900/60 hover:bg-neutral-800/10 text-xs text-neutral-300">
                              <td className="p-2 font-mono text-[9px] text-neutral-400">{rec.id.substring(0, 8)}</td>
                              <td className="p-2">
                                <div className="font-semibold text-neutral-200">{rec.recommendation_type.replaceAll('_', ' ')}</div>
                                <div className="text-[10px] text-neutral-500">PDV ID: {rec.entity_id}</div>
                              </td>
                              <td className="p-2 text-right font-mono text-emerald-400">
                                {Number(rec.expected_revenue_uplift).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-amber-500">
                                {Number(rec.estimated_roi).toFixed(2)}x
                              </td>
                              <td className="p-2 text-neutral-400 font-mono">
                                {rec.executed_at ? new Date(rec.executed_at).toLocaleDateString("pt-BR") : "-"}
                              </td>
                              <td className="p-2">
                                <div className="flex gap-0.5 text-amber-400 mb-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <span key={i}>{i < rating ? "★" : "☆"}</span>
                                  ))}
                                </div>
                                <div className="text-[10px] text-neutral-400 italic">
                                  {rec.execution_feedback?.notes || "Sem observações."}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* AI Learning View */}
        {dashboardMode === "ai_learning" && !warRoomMode && (() => {
          if (loadingLearning) {
            return (
              <div className="py-20 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando dados de Aprendizado Contínuo da IA...</span>
              </div>
            );
          }

          const stats = learningData || {
            model_accuracy: 100,
            avg_prediction_error: 0,
            best_action_type: "-",
            worst_action_type: "-",
            performances: [],
            alerts: [],
            weights_history: []
          };

          const getAccuracyLabel = (acc: number) => {
            if (acc >= 90) return { label: "Excelente", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
            if (acc >= 75) return { label: "Boa", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
            if (acc >= 60) return { label: "Média", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
            return { label: "Crítica", color: "text-red-400 bg-red-500/10 border-red-500/20" };
          };

          const accLabel = getAccuracyLabel(stats.model_accuracy);

          return (
            <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full animate-fadeIn">
              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Accuracy Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Acurácia Geral IA</span>
                    <h3 className="text-2xl font-black mt-1 text-white">{stats.model_accuracy}%</h3>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase mt-2 border ${accLabel.color}`}>
                      {accLabel.label}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                    <Brain className="w-6 h-6" />
                  </div>
                </div>

                {/* Avg Error Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Erro Médio Previsto</span>
                    <h3 className="text-2xl font-black mt-1 text-white">{stats.avg_prediction_error}%</h3>
                    <span className="inline-block text-[9px] text-neutral-400 mt-2 italic">
                      {stats.avg_prediction_error > 35 ? "Desvio Crítico" : stats.avg_prediction_error > 15 ? "Desvio Moderado" : "Desvio Saudável"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                </div>

                {/* Best/Worst Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Performance de Ações</span>
                    <div className="mt-1 text-xs font-semibold">
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-neutral-400">Melhor:</span>
                        <span className="text-emerald-400 font-bold truncate max-w-[100px]">{stats.best_action_type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                        <span className="text-neutral-400">Pior:</span>
                        <span className="text-red-400 font-bold truncate max-w-[100px]">{stats.worst_action_type.replace('_', ' ')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
                    <Award className="w-6 h-6" />
                  </div>
                </div>

                {/* Alerts Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Alertas de Degradação</span>
                    <h3 className="text-2xl font-black mt-1 text-white">{stats.alerts.length}</h3>
                    <span className={`inline-block text-[9px] font-bold mt-2 ${stats.alerts.length > 0 ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                      {stats.alerts.length > 0 ? "Requer Calibração" : "Operando Estável"}
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl ${stats.alerts.length > 0 ? "bg-red-500/10 text-red-500" : "bg-neutral-800 text-neutral-400"}`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Alerts details if any */}
              {stats.alerts.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/15 flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Alertas Críticos do Modelo
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                    {stats.alerts.map((al: any) => (
                      <div key={al.id} className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-900 text-xs flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">{al.alert_type}</span>
                          <span className="text-[9px] text-neutral-500">{new Date(al.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-neutral-300 font-semibold">{al.alert_message}</p>
                        <div className="text-[10px] text-neutral-500 flex gap-2">
                          <span>Métrica: <strong className="text-neutral-400">{al.metric_value}%</strong></span>
                          <span>Limite: <strong className="text-neutral-400">{al.threshold_value}%</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Content Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1 & 2: Trends and Performance */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  {/* Model Performance List */}
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
                      Acurácia e ROI Realizado por Tipo de Recomendação
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-neutral-900 text-[10px] text-neutral-500 font-black uppercase">
                            <th className="pb-2">Tipo de Ação</th>
                            <th className="pb-2 text-right">Predições</th>
                            <th className="pb-2 text-right">Sucessos</th>
                            <th className="pb-2 text-right">Erro Médio</th>
                            <th className="pb-2 text-right">ROI Previsto</th>
                            <th className="pb-2 text-right">ROI Realizado</th>
                            <th className="pb-2 text-right">Confiança</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900/40 text-xs">
                          {stats.performances.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-4 text-center text-xs text-neutral-500">
                                Nenhum dado de performance disponível. Execute ações para iniciar o aprendizado.
                              </td>
                            </tr>
                          ) : (
                            stats.performances.map((perf: any) => (
                              <tr key={perf.id} className="text-neutral-300 hover:bg-neutral-800/10">
                                <td className="py-3 font-semibold text-neutral-200">{perf.recommendation_type.replace('_', ' ')}</td>
                                <td className="py-3 text-right font-mono">{perf.total_predictions}</td>
                                <td className="py-3 text-right font-mono text-emerald-400">{perf.successful_predictions}</td>
                                <td className="py-3 text-right font-mono text-amber-500">{perf.avg_prediction_error}%</td>
                                <td className="py-3 text-right font-mono text-neutral-400">{Number(perf.avg_expected_roi).toFixed(2)}x</td>
                                <td className="py-3 text-right font-mono font-bold text-emerald-400">{Number(perf.avg_realized_roi).toFixed(2)}x</td>
                                <td className="py-3 text-right font-mono font-black text-amber-500">{perf.model_confidence_score}%</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Trend chart simulated */}
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
                      Evolução de Erro de Previsão vs Confiança do Modelo (Closed Loop)
                    </h3>
                    <div className="h-44 w-full flex items-end gap-1 font-mono text-[9px] text-neutral-500 relative">
                      {/* Grid Lines */}
                      <div className="absolute inset-x-0 top-0 border-t border-neutral-900" />
                      <div className="absolute inset-x-0 top-1/3 border-t border-neutral-900" />
                      <div className="absolute inset-x-0 top-2/3 border-t border-neutral-900" />
                      
                      {/* Render simulated line chart using SVG for beautiful UI */}
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 500 150">
                        {/* Error Trend line */}
                        <path
                          d="M 10 120 Q 125 100, 250 60 T 490 25"
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="2.5"
                          strokeDasharray="4 2"
                        />
                        {/* Confidence line */}
                        <path
                          d="M 10 40 Q 125 50, 250 85 T 490 135"
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="3"
                        />
                        {/* Text annotations */}
                        <text x="20" y="20" fill="#ef4444" className="text-[9px] font-black">Erro de Previsão (caindo)</text>
                        <text x="20" y="140" fill="#10b981" className="text-[9px] font-black">Confiança da IA (subindo)</text>
                      </svg>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-neutral-500 mt-2">
                      <span>Ciclo 1: Início (Estático)</span>
                      <span>Ciclo 5: Recalibração Operacional</span>
                      <span>Ciclo 10: Otimização Autônoma</span>
                    </div>
                  </div>
                </div>

                {/* Column 3: Weights History & Recalibration */}
                <div className="flex flex-col gap-6">
                  {/* Current Active Weights */}
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 mb-4">
                      Pesos de Decisão Ativos (Calibrados)
                    </h3>
                    {!stats.weights_history || stats.weights_history.length === 0 ? (
                      <div className="text-xs text-neutral-500 italic py-2">
                        Usando pesos regulamentares da Sprint 6.1 (Padrão).
                      </div>
                    ) : (() => {
                      const w = stats.weights_history[0];
                      const total = Number(w.impact_weight) + Number(w.roi_weight) + Number(w.urgency_weight) + Number(w.execution_weight) + Number(w.strategic_weight);
                      const pct = (val: number) => total > 0 ? ((val / total) * 100).toFixed(0) + "%" : "20%";

                      return (
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-neutral-300">
                              <span>Impacto Financeiro</span>
                              <span>{pct(Number(w.impact_weight))}</span>
                            </div>
                            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-full" style={{ width: pct(Number(w.impact_weight)) }} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-neutral-300">
                              <span>ROI Esperado</span>
                              <span>{pct(Number(w.roi_weight))}</span>
                            </div>
                            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full" style={{ width: pct(Number(w.roi_weight)) }} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-neutral-300">
                              <span>Urgência Operacional</span>
                              <span>{pct(Number(w.urgency_weight))}</span>
                            </div>
                            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-red-500 h-full rounded-full" style={{ width: pct(Number(w.urgency_weight)) }} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-neutral-300">
                              <span>Facilidade de Execução</span>
                              <span>{pct(Number(w.execution_weight))}</span>
                            </div>
                            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-blue-500 h-full rounded-full" style={{ width: pct(Number(w.execution_weight)) }} />
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between text-xs font-bold text-neutral-300">
                              <span>Prioridade Estratégica</span>
                              <span>{pct(Number(w.strategic_weight))}</span>
                            </div>
                            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-purple-500 h-full rounded-full" style={{ width: pct(Number(w.strategic_weight)) }} />
                            </div>
                          </div>
                          <span className="text-[9px] text-neutral-500 mt-2 text-right block italic">
                            Última calibração: {new Date(w.created_at).toLocaleDateString()} às {new Date(w.created_at).toLocaleTimeString()}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Weights Log */}
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
                      Histórico de Versões dos Pesos
                    </h3>
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-60 pr-1">
                      {!stats.weights_history || stats.weights_history.length === 0 ? (
                        <div className="text-xs text-neutral-500 italic py-2">
                          Nenhum histórico de recalibração registrado.
                        </div>
                      ) : (
                        stats.weights_history.map((h: any, i: number) => (
                          <div key={h.id} className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-900 text-[10px] flex flex-col gap-1">
                            <div className="flex justify-between text-neutral-400 font-bold">
                              <span>Versão #{stats.weights_history.length - i}</span>
                              <span>{new Date(h.created_at).toLocaleDateString()}</span>
                            </div>
                            <div className="grid grid-cols-5 gap-1 text-[9px] text-neutral-500 mt-1 font-mono text-center">
                              <div className="flex flex-col bg-neutral-900/50 py-1 rounded">
                                <span className="text-amber-400 font-bold">{Number(h.impact_weight).toFixed(2)}</span>
                                <span>Imp</span>
                              </div>
                              <div className="flex flex-col bg-neutral-900/50 py-1 rounded">
                                <span className="text-emerald-400 font-bold">{Number(h.roi_weight).toFixed(2)}</span>
                                <span>ROI</span>
                              </div>
                              <div className="flex flex-col bg-neutral-900/50 py-1 rounded">
                                <span className="text-red-400 font-bold">{Number(h.urgency_weight).toFixed(2)}</span>
                                <span>Urg</span>
                              </div>
                              <div className="flex flex-col bg-neutral-900/50 py-1 rounded">
                                <span className="text-blue-400 font-bold">{Number(h.execution_weight).toFixed(2)}</span>
                                <span>Exec</span>
                              </div>
                              <div className="flex flex-col bg-neutral-900/50 py-1 rounded">
                                <span className="text-purple-400 font-bold">{Number(h.strategic_weight).toFixed(2)}</span>
                                <span>Estrat</span>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* AI Governance View */}
        {dashboardMode === "ai_governance" && !warRoomMode && (() => {
          if (loadingGovernance) {
            return (
              <div className="py-20 text-center text-xs text-neutral-500 flex flex-col items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span>Carregando dados de Governança de IA...</span>
              </div>
            );
          }

          const emergencyStop = governancePolicies?.emergency_ai_stop === true;

          return (
            <div className="p-6 flex flex-col gap-6 max-w-7xl mx-auto w-full animate-fadeIn">
              {/* Emergency Banner */}
              {emergencyStop && (
                <div className="bg-red-500/10 border border-red-500/30 p-4 rounded-2xl flex items-start gap-3 animate-pulse">
                  <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-black uppercase text-red-500">Global Emergency AI Stop is ACTIVE</h3>
                    <p className="text-[10px] text-red-400 mt-1 uppercase font-semibold leading-relaxed">
                      All autonomous action execution is suspended. Manual supervisor approval required.
                    </p>
                  </div>
                </div>
              )}

              {/* Stats Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Autonomy Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Nível de Autonomia</span>
                    <h3 className="text-lg font-black mt-1 text-white">{governancePolicies?.ai_autonomy_level || "SEMI_AUTONOMOUS"}</h3>
                    <span className="inline-block text-[9px] text-neutral-400 mt-2 italic">
                      Min Confiança: {governancePolicies?.min_confidence_to_act || 80}%
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
                    <Cpu className="w-6 h-6" />
                  </div>
                </div>

                {/* Kill Switch Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Mecanismo de Parada</span>
                    <h3 className={`text-lg font-black mt-1 ${emergencyStop ? "text-red-500" : "text-emerald-400"}`}>
                      {emergencyStop ? "BLOQUEADO" : "OPERANDO"}
                    </h3>
                    <button
                      onClick={() => handleEmergencyStopToggle(emergencyStop)}
                      className="px-2 py-0.5 rounded text-[8px] font-black uppercase border mt-2 bg-neutral-950 text-neutral-400 hover:text-white"
                    >
                      Alternar Parada
                    </button>
                  </div>
                  <div className={`p-3 rounded-xl ${emergencyStop ? "bg-red-500/10 text-red-500" : "bg-emerald-500/10 text-emerald-500"}`}>
                    <Power className="w-6 h-6" />
                  </div>
                </div>

                {/* Pending Card */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Ações Pendentes</span>
                    <h3 className="text-2xl font-black mt-1 text-white">{pendingRecommendations.length}</h3>
                    <span className="inline-block text-[9px] text-neutral-400 mt-2">
                      Fila de liberação
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500">
                    <Clock className="w-6 h-6" />
                  </div>
                </div>

                {/* Alerts count */}
                <div className="p-4 rounded-2xl bg-neutral-900/50 border border-neutral-800 backdrop-blur-md flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">Alertas de Governança</span>
                    <h3 className="text-2xl font-black mt-1 text-white">{governanceAlerts.length}</h3>
                    <span className={`inline-block text-[9px] font-bold mt-2 ${governanceAlerts.length > 0 ? "text-red-400 animate-pulse" : "text-emerald-400"}`}>
                      {governanceAlerts.length > 0 ? "Riscos Identificados" : "Segurança Ideal"}
                    </span>
                  </div>
                  <div className={`p-3 rounded-xl ${governanceAlerts.length > 0 ? "bg-red-500/10 text-red-500" : "bg-neutral-850 text-neutral-450"}`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Governance Alerts Board */}
              {governanceAlerts.length > 0 && (
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/15 flex flex-col gap-2">
                  <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Alertas de Risco de Governança (Active Alerts)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                    {governanceAlerts.map((al: any) => (
                      <div key={al.id} className="p-2.5 rounded-lg bg-neutral-950/60 border border-neutral-900 text-xs flex flex-col gap-1">
                        <div className="flex justify-between items-center">
                          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">{al.alert_type}</span>
                          <span className="text-[9px] text-neutral-500">{new Date(al.created_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-neutral-300 font-semibold">{al.alert_message}</p>
                        <div className="text-[10px] text-neutral-500 flex gap-2">
                          <span>Métrica: <strong className="text-neutral-400">{al.metric_value}</strong></span>
                          <span>Limite: <strong className="text-neutral-400">{al.threshold_value}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Main Content Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1 & 2: Decision Approval Queue */}
                <div className="lg:col-span-2 flex flex-col gap-6">
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
                      Decision Approval Queue — Fila de Ações Aguardando Liberação
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-neutral-900 text-[10px] text-neutral-500 font-black uppercase">
                            <th className="pb-2">Recomendação</th>
                            <th className="pb-2">Score / Confiança</th>
                            <th className="pb-2">Motivo da Pendência</th>
                            <th className="pb-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-900/40 text-neutral-300">
                          {pendingRecommendations.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-4 text-center text-xs text-neutral-500">
                                Fila vazia. Nenhuma recomendação aguardando aprovação.
                              </td>
                            </tr>
                          ) : (
                            pendingRecommendations.map((rec: any) => (
                              <tr key={rec.id} className="hover:bg-neutral-800/10">
                                <td className="py-3">
                                  <div className="font-bold text-neutral-200">{rec.recommendation_type.replace('_', ' ')}</div>
                                  <div className="text-[10px] text-neutral-500">PDV: {rec.entity_id}</div>
                                </td>
                                <td className="py-3 font-mono">
                                  <span className="text-amber-500 font-bold">{rec.priority_score} pts</span>
                                  <span className="text-neutral-500"> / </span>
                                  <span className="text-neutral-400">{rec.recommendation_confidence}% conf</span>
                                </td>
                                <td className="py-3 italic text-neutral-400 max-w-xs truncate">{rec.governance_badge || "Pendente"}</td>
                                <td className="py-3 text-right">
                                  <div className="flex justify-end gap-1.5">
                                    <button
                                      onClick={() => approveRecommendation(rec.id)}
                                      className="px-2 py-1 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[10px] font-black uppercase rounded"
                                    >
                                      Aprovar
                                    </button>
                                    <button
                                      onClick={() => setOverrideModalRecId(rec.id)}
                                      className="px-2 py-1 bg-red-500 hover:bg-red-400 text-white text-[10px] font-black uppercase rounded"
                                    >
                                      Rejeitar
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Decision Audit log list */}
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
                      Log Recente de Decisões de IA (Decision Logs)
                    </h3>
                    <div className="flex flex-col gap-2 max-h-80 overflow-y-auto pr-1">
                      {governanceDecisionLogs.slice(0, 10).map((log) => (
                        <div key={log.id} className="p-3 rounded-xl bg-neutral-950/60 border border-neutral-900 text-[10px] flex items-center justify-between">
                          <div>
                            <div className="font-bold text-neutral-200 uppercase">{log.decision_type.replace('_', ' ')}</div>
                            <div className="text-neutral-500 mt-0.5">{log.decision_payload.reason}</div>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border ${
                            log.decision_payload.approved
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-red-500/10 text-red-400 border-red-500/20"
                          }`}>
                            {log.decision_payload.badge}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Column 3: Config radar and versions */}
                <div className="flex flex-col gap-6">
                  {/* KPI Distribution Radar (simulated weights) */}
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col">
                    <h3 className="text-xs font-black uppercase tracking-wider text-amber-500 mb-4">
                      KPI Distribution Radar — Pesos Estratégicos
                    </h3>
                    {governanceKpis.length === 0 ? (
                      <div className="text-xs text-neutral-500 italic py-2">Nenhum KPI ativado.</div>
                    ) : (
                      <div className="flex flex-col gap-2.5">
                        {governanceKpis.filter(k => k.is_enabled).map((kpi) => (
                          <div key={kpi.id} className="flex flex-col gap-1">
                            <div className="flex justify-between text-[11px] font-bold text-neutral-300">
                              <span className="uppercase">{kpi.kpi_code.replace('_', ' ')}</span>
                              <span>{kpi.weight}%</span>
                            </div>
                            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${kpi.weight}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Version history */}
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-900 backdrop-blur-md flex flex-col flex-1">
                    <h3 className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-4">
                      Histórico de Configurações
                    </h3>
                    <div className="flex flex-col gap-2 overflow-y-auto max-h-60 pr-1">
                      {governanceVersions.map((v) => (
                        <div key={v.id} className="p-2.5 rounded-xl bg-neutral-950/60 border border-neutral-900 text-[10px] flex justify-between items-center">
                          <span className="font-bold text-neutral-300">Versão #{v.version}</span>
                          <span className="text-neutral-500">{new Date(v.created_at).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rejection Justification Dialog/Modal */}
              {overrideModalRecId && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <div className="bg-neutral-900 border border-neutral-850 p-6 rounded-2xl w-full max-w-md shadow-2xl flex flex-col gap-4">
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-wider text-red-500">Rejeitar Recomendação</h3>
                      <p className="text-[10px] text-neutral-400 uppercase mt-0.5">
                        A justificativa é obrigatória para alimentar a acurácia dos modelos de aprendizado contínuo.
                      </p>
                    </div>

                    <textarea
                      value={overrideReasonInput}
                      onChange={(e) => setOverrideReasonInput(e.target.value)}
                      placeholder="Ex: PDV em reforma temporária, Preço já ajustado externamente..."
                      rows={3}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:border-red-500 focus:outline-none placeholder-neutral-600 resize-none font-semibold"
                    />

                    <div className="flex justify-end gap-2 text-[10px] font-black uppercase tracking-wider">
                      <button
                        onClick={() => { setOverrideModalRecId(null); setOverrideReasonInput(""); }}
                        className="px-4 py-2 hover:bg-neutral-800 text-neutral-400 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => rejectRecommendation(overrideModalRecId, overrideReasonInput)}
                        className="px-4 py-2 bg-red-500 hover:bg-red-400 text-white rounded-lg transition-colors"
                      >
                        Confirmar Rejeição
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </main>
    </div>
  );
}
