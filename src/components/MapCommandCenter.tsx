"use client";

import React, { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapCommandCenterProps {
  promotores: any[];
  liveStatuses: Record<string, any>;
  selectedPromotorId: string | null;
  visitas: any[];
  geolocs: Record<string, any>;
  heartbeatLogs: any[];
  replayTimeline: any[];
  replayCurrentIndex: number;
  isReplayActive: boolean;
}

export default function MapCommandCenter({
  promotores,
  liveStatuses,
  selectedPromotorId,
  visitas,
  geolocs,
  heartbeatLogs,
  replayTimeline,
  replayCurrentIndex,
  isReplayActive,
}: MapCommandCenterProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

  // Layer groups to easily clear/redraw markers
  const promotoresLayer = useRef<L.LayerGroup | null>(null);
  const pdvsLayer = useRef<L.LayerGroup | null>(null);
  const polylinesLayer = useRef<L.LayerGroup | null>(null);
  const replayLayer = useRef<L.LayerGroup | null>(null);

  const [mapZoom, setMapZoom] = useState(12);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Default center in Belo Horizonte, Coffee Mais HQ area
    const initialCenter: L.LatLngExpression = [-19.919, -43.9375];

    const map = L.map(mapRef.current, {
      center: initialCenter,
      zoom: 12,
      zoomControl: true,
    });

    // Dark theme map tiles from CartoDB (perfect match for premium theme)
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    promotoresLayer.current = L.layerGroup().addTo(map);
    pdvsLayer.current = L.layerGroup().addTo(map);
    polylinesLayer.current = L.layerGroup().addTo(map);
    replayLayer.current = L.layerGroup().addTo(map);

    leafletMap.current = map;

    map.on("zoomend", () => {
      setMapZoom(map.getZoom());
    });

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  // Helper to calculate runtime status
  const getComputedStatus = (promotorId: string): string => {
    const live = liveStatuses[promotorId];
    if (!live) return "JORNADA_ENCERRADA";
    const differenceMin = (new Date().getTime() - new Date(live.last_heartbeat).getTime()) / 1000 / 60;
    if (differenceMin > 10) return "OFFLINE";
    return live.status;
  };

  // Redraw map elements when props or zoom changes
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    // Clear previous layers
    promotoresLayer.current?.clearLayers();
    pdvsLayer.current?.clearLayers();
    polylinesLayer.current?.clearLayers();
    replayLayer.current?.clearLayers();

    const bounds: L.LatLngTuple[] = [];

    // --- CASE A: REPLAY TEMPORAL ACTIVE ---
    if (isReplayActive && replayTimeline.length > 0) {
      // 1. Draw route percorrida up to current index
      const actualCoords: L.LatLngTuple[] = [];
      replayTimeline.slice(0, replayCurrentIndex + 1).forEach((evt) => {
        if (evt.latitude && evt.longitude) {
          actualCoords.push([evt.latitude, evt.longitude]);
        }
      });

      if (actualCoords.length > 0) {
        L.polyline(actualCoords, {
          color: "#10b981", // Solid green
          weight: 4,
          opacity: 0.8,
        }).addTo(polylinesLayer.current!);
      }

      // 2. Draw current replay point marker
      const activeEvent = replayTimeline[replayCurrentIndex];
      if (activeEvent && activeEvent.latitude && activeEvent.longitude) {
        const replayCoords: L.LatLngTuple = [activeEvent.latitude, activeEvent.longitude];

        // Pulsing orange marker for replay pointer
        const replayIcon = L.divIcon({
          className: "custom-replay-marker",
          html: `
            <div class="relative flex items-center justify-center w-8 h-8">
              <span class="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-ping"></span>
              <div class="relative rounded-full w-4.5 h-4.5 bg-amber-500 border-2 border-neutral-950 shadow-md flex items-center justify-center">
                <div class="w-1.5 h-1.5 rounded-full bg-white"></div>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popupContent = `
          <div class="p-1.5 text-xs bg-neutral-950 text-white rounded-lg">
            <h4 class="font-bold text-amber-400 uppercase text-[9px] tracking-wider">${activeEvent.event_type}</h4>
            <p class="text-neutral-300 mt-1">${activeEvent.description}</p>
            <p class="text-[9px] text-neutral-500 font-mono mt-1">Horário: ${new Date(
              activeEvent.timestamp
            ).toLocaleTimeString()}</p>
            ${
              activeEvent.metadata?.bateria_percent !== undefined
                ? `<p class="text-[9px] text-neutral-400 mt-0.5">Celular: ${activeEvent.metadata.bateria_percent}%</p>`
                : ""
            }
          </div>
        `;

        L.marker(replayCoords, { icon: replayIcon })
          .addTo(replayLayer.current!)
          .bindPopup(popupContent)
          .openPopup();

        map.setView(replayCoords, map.getZoom());
      }

      // 3. Draw PDVs corresponding to this promotor's agenda
      const promotorVisitas = visitas.filter((v) => {
        const agenda = v.agenda_diaria_id;
        // Verify if any visit belongs to this selected promotor
        return true; // Visitas are already filtered for the active promotor by the parent
      });

      plotPDVs(promotorVisitas, mapZoom);
      return; // Skip drawing live promotores in replay mode
    }

    // --- CASE B: LIVE MONITORING MODE ---

    // 1. Draw Promotores Pins
    promotores.forEach((p) => {
      const live = liveStatuses[p.id];
      if (!live || !live.latitude || !live.longitude) return;

      const status = getComputedStatus(p.id);
      const coords: L.LatLngTuple = [live.latitude, live.longitude];
      bounds.push(coords);

      // Determine status color
      let markerColor = "#3b82f6"; // default blue
      if (status === "EM_LOJA_CHECKIN" || status === "EM_EXECUCAO") {
        markerColor = "#10b981"; // green
      } else if (status === "EM_OCORRENCIA") {
        markerColor = "#ef4444"; // red
      } else if (status === "OFFLINE" || status === "JORNADA_ENCERRADA") {
        markerColor = "#6b7280"; // gray
      }

      // Custom SVG divIcon
      const promotorIcon = L.divIcon({
        className: `custom-promotor-marker-${p.id}`,
        html: `
          <div class="relative flex items-center justify-center w-10 h-10">
            <span class="absolute inline-flex h-full w-full rounded-full opacity-35 animate-ping" style="background-color: ${markerColor}"></span>
            <div class="relative w-8 h-8 rounded-full border-2 border-neutral-950 flex items-center justify-center shadow-lg text-[10px] font-black text-neutral-950 uppercase" style="background-color: ${markerColor}">
              ${p.nome_completo.slice(0, 2)}
            </div>
            <div class="absolute bottom-0 right-0 w-3 h-3 bg-neutral-950 border border-neutral-900 rounded-full flex items-center justify-center">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${markerColor}"></span>
            </div>
          </div>
        `,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const popupText = `
        <div class="p-2 text-xs bg-neutral-950 text-white rounded-lg">
          <h4 class="font-extrabold text-neutral-100">${p.nome_completo}</h4>
          <p class="text-[9px] text-amber-500 font-extrabold uppercase mt-1">Status: ${status.replace(
            "_",
            " "
          )}</p>
          ${
            live.bateria_percent
              ? `<p class="text-neutral-400 mt-1">Bateria: ${live.bateria_percent}%</p>`
              : ""
          }
          ${
            live.tipo_conexao
              ? `<p class="text-neutral-400">Rede: ${live.tipo_conexao.toUpperCase()}</p>`
              : ""
          }
          <p class="text-[9px] text-neutral-500 font-mono mt-1">Sinal: ${new Date(
            live.last_heartbeat
          ).toLocaleTimeString()}</p>
        </div>
      `;

      L.marker(coords, { icon: promotorIcon })
        .addTo(promotoresLayer.current!)
        .bindPopup(popupText);
    });

    // 2. Draw PDVs and routes if a promotor is selected
    if (selectedPromotorId) {
      const selectedLive = liveStatuses[selectedPromotorId];
      const agendaVisitas = visitas.filter((v) => {
        // Parent filters visitas based on agenda for selected promotor
        return true; 
      });

      plotPDVs(agendaVisitas, mapZoom);

      // Draw Planned Route (dashed line connecting scheduled PDVs)
      // Sorted by explicit ordem_rota
      const sortedVisits = [...agendaVisitas].sort(
        (a, b) => (a.ordem_rota || 1) - (b.ordem_rota || 1)
      );

      const plannedCoords: L.LatLngTuple[] = [];
      sortedVisits.forEach((v) => {
        const geo = geolocs[v.cod_parceiro];
        if (geo?.latitude && geo?.longitude) {
          plannedCoords.push([geo.latitude, geo.longitude]);
        }
      });

      if (plannedCoords.length > 0) {
        L.polyline(plannedCoords, {
          color: "#3b82f6", // Blue
          weight: 2.5,
          opacity: 0.6,
          dashArray: "6, 8",
        }).addTo(polylinesLayer.current!);
      }

      // Draw Traveled Route (solid green line from logs)
      const pLogs = heartbeatLogs.filter((l) => l.promotor_id === selectedPromotorId);
      const actualCoords: L.LatLngTuple[] = [];
      pLogs.forEach((l) => {
        if (l.latitude && l.longitude) {
          actualCoords.push([l.latitude, l.longitude]);
        }
      });

      if (actualCoords.length > 0) {
        L.polyline(actualCoords, {
          color: "#10b981", // Green
          weight: 3.5,
          opacity: 0.8,
        }).addTo(polylinesLayer.current!);
      }

      // Add selected promotor current coordinate to bounds
      if (selectedLive?.latitude && selectedLive?.longitude) {
        bounds.push([selectedLive.latitude, selectedLive.longitude]);
      }
    }

    // 3. Auto Zoom and Pan to fit all points
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [
    promotores,
    liveStatuses,
    selectedPromotorId,
    visitas,
    geolocs,
    heartbeatLogs,
    replayTimeline,
    replayCurrentIndex,
    isReplayActive,
    mapZoom,
  ]);

  // Private function to plot PDV pins, incorporating client-side clustering for zoom scale
  const plotPDVs = (pdvVisitas: any[], zoom: number) => {
    if (!pdvsLayer.current) return;

    // Filter valid geolocated visits
    const geolocatedVisits = pdvVisitas.filter((v) => {
      const geo = geolocs[v.cod_parceiro];
      return geo?.latitude && geo?.longitude;
    });

    // --- Marker Clustering Logic for scalability ---
    // If zoomed out, cluster close items together
    const useClustering = zoom < 13;
    const clusterTolerance = 0.005; // ~500m scale

    if (useClustering && geolocatedVisits.length > 1) {
      const clusters: { center: L.LatLngTuple; items: any[] }[] = [];

      geolocatedVisits.forEach((v) => {
        const geo = geolocs[v.cod_parceiro];
        const vCoords: L.LatLngTuple = [geo.latitude, geo.longitude];

        // Try to find a cluster nearby
        const existingCluster = clusters.find((c) => {
          const distLat = Math.abs(c.center[0] - vCoords[0]);
          const distLng = Math.abs(c.center[1] - vCoords[1]);
          return distLat < clusterTolerance && distLng < clusterTolerance;
        });

        if (existingCluster) {
          existingCluster.items.push(v);
        } else {
          clusters.push({ center: vCoords, items: [v] });
        }
      });

      // Plot cluster markers
      clusters.forEach((cluster, idx) => {
        if (cluster.items.length === 1) {
          plotSinglePDV(cluster.items[0]);
        } else {
          // Render a custom cluster marker
          const clusterIcon = L.divIcon({
            className: `custom-pdv-cluster-${idx}`,
            html: `
              <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900 border-2 border-amber-500 text-amber-400 font-extrabold text-[10px] shadow-lg">
                +${cluster.items.length}
              </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const popupContent = `
            <div class="p-1.5 text-[10px] bg-neutral-950 text-white rounded-lg flex flex-col gap-1">
              <span class="font-extrabold text-amber-400 uppercase tracking-wider text-[8px] border-b border-neutral-900 pb-1">Agrupamento (${cluster.items.length} PDVs)</span>
              ${cluster.items
                .map((item) => `<span>• ${item.pdv?.nome_fantasia || "PDV"}</span>`)
                .join("")}
              <span class="text-neutral-500 text-[8px] italic mt-1 text-center">Aumente o zoom para ver detalhes</span>
            </div>
          `;

          L.marker(cluster.center, { icon: clusterIcon })
            .addTo(pdvsLayer.current!)
            .bindPopup(popupContent);
        }
      });
    } else {
      // Zoom is detailed, plot individual markers
      geolocatedVisits.forEach((v) => {
        plotSinglePDV(v);
      });
    }
  };

  const plotSinglePDV = (v: any) => {
    const geo = geolocs[v.cod_parceiro];
    const coords: L.LatLngTuple = [geo.latitude, geo.longitude];

    // Status visual color matching
    let pdvColor = "#ffffff"; // Branco = Não visitado (default PLANEJADA)
    let pdvText = "Não Visitado";

    if (v.status === "EM_ROTA" || v.status === "CHECKIN_REALIZADO" || v.status === "EM_EXECUCAO") {
      pdvColor = "#eab308"; // Amarelo = Em rota
      pdvText = "Em Execução";
    } else if (v.status === "CONCLUIDA") {
      pdvColor = "#10b981"; // Verde = Concluído
      pdvText = "Concluído";
    } else if (
      v.status === "LOJA_FECHADA" ||
      v.status === "NAO_REALIZADA" ||
      v.status === "CANCELADA"
    ) {
      pdvColor = "#ef4444"; // Vermelho = Ocorrência
      pdvText = "Ocorrência / Não Realizada";
    }

    const pdvIcon = L.divIcon({
      className: `custom-pdv-marker-${v.cod_parceiro}`,
      html: `
        <div class="relative flex items-center justify-center w-7 h-7">
          <div class="w-5 h-5 rounded-full border-2 border-neutral-950 shadow-md flex items-center justify-center" style="background-color: ${pdvColor}">
            <div class="w-1.5 h-1.5 rounded-full bg-neutral-950"></div>
          </div>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    const popupContent = `
      <div class="p-1.5 text-xs bg-neutral-950 text-white rounded-lg">
        <h4 class="font-extrabold text-neutral-100">${v.pdv?.nome_fantasia || "PDV"}</h4>
        <p class="text-[9px] text-neutral-500 font-mono">Código: ${v.cod_parceiro}</p>
        <span class="px-1.5 py-0.5 rounded text-[8px] font-black uppercase mt-1.5 inline-block border" style="border-color: ${pdvColor}; color: ${pdvColor}">
          ${pdvText}
        </span>
      </div>
    `;

    L.marker(coords, { icon: pdvIcon })
      .addTo(pdvsLayer.current!)
      .bindPopup(popupContent);
  };

  return <div ref={mapRef} className="w-full h-full" />;
}
