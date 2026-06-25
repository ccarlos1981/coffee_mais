"use client";

import React, { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface MapRoutePreviewProps {
  visitas: any[];
  promotorHome?: {
    latitude: number;
    longitude: number;
    nome?: string;
    endereco?: string;
  } | null;
}

export default function MapRoutePreview({ visitas, promotorHome }: MapRoutePreviewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const polylineLayer = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    // Default center: BH (Belo Horizonte)
    const map = L.map(mapRef.current, {
      center: [-19.919, -43.9375],
      zoom: 12,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: "abcd",
      maxZoom: 20,
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    polylineLayer.current = L.layerGroup().addTo(map);
    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []);

  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    markersLayer.current?.clearLayers();
    polylineLayer.current?.clearLayers();

    const bounds: L.LatLngTuple[] = [];
    const coordinates: L.LatLngTuple[] = [];

    // Plot promoter's home if available
    if (promotorHome?.latitude && promotorHome?.longitude) {
      const homeCoords: L.LatLngTuple = [promotorHome.latitude, promotorHome.longitude];
      bounds.push(homeCoords);
      // Optional: add home as start point of polyline line
      coordinates.push(homeCoords);

      const homeIcon = L.divIcon({
        className: "custom-route-home-marker",
        html: `
          <div class="relative flex items-center justify-center w-8 h-8">
            <div class="w-7 h-7 rounded-full bg-emerald-500 border border-neutral-950 flex items-center justify-center text-xs shadow-md">
              🏠
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const homePopup = `
        <div class="p-2 text-xs bg-neutral-950 text-white rounded-lg flex flex-col gap-0.5 border border-neutral-800">
          <span class="font-extrabold text-emerald-400 uppercase text-[9px] tracking-wider">Casa do Promotor</span>
          <h4 class="font-bold text-neutral-100">${promotorHome.nome || "Promotor"}</h4>
          <p class="text-[9px] text-neutral-400 mt-1">${promotorHome.endereco || "Sem endereço cadastrado"}</p>
        </div>
      `;

      L.marker(homeCoords, { icon: homeIcon })
        .addTo(markersLayer.current!)
        .bindPopup(homePopup);
    }

    // Filter valid visits with coordinates
    visitas.forEach((v, index) => {
      const lat = v.pdv?.geoloc?.latitude ?? v.latitude;
      const lng = v.pdv?.geoloc?.longitude ?? v.longitude;
      
      if (lat && lng) {
        const coords: L.LatLngTuple = [lat, lng];
        bounds.push(coords);
        coordinates.push(coords);

        const numberIcon = L.divIcon({
          className: "custom-route-number-marker",
          html: `
            <div class="relative flex items-center justify-center w-8 h-8">
              <div class="w-6 h-6 rounded-full bg-amber-500 border border-neutral-950 flex items-center justify-center text-[10px] font-black text-neutral-950 shadow-md">
                ${index + 1}
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const popupContent = `
          <div class="p-2 text-xs bg-neutral-950 text-white rounded-lg flex flex-col gap-0.5 border border-neutral-800">
            <span class="font-extrabold text-amber-500 uppercase text-[9px] tracking-wider">Parada ${index + 1}</span>
            <h4 class="font-bold text-neutral-100">${v.pdv?.nome_fantasia || "PDV"}</h4>
            <p class="text-[9px] text-neutral-500">Cód: ${v.cod_parceiro}</p>
            <p class="text-[9px] text-neutral-400 mt-1 uppercase font-bold">Criticidade: ${v.criticidade_visita || 'NORMAL'}</p>
            <p class="text-[9px] text-neutral-400 uppercase font-bold">Motivo: ${v.motivo_visita || 'rotina'}</p>
            <p class="text-[9px] text-neutral-400 uppercase font-bold">Tempo: ${v.duracao_estimada_min || 60} min</p>
          </div>
        `;

        L.marker(coords, { icon: numberIcon })
          .addTo(markersLayer.current!)
          .bindPopup(popupContent);
      }
    });

    if (coordinates.length > 1) {
      L.polyline(coordinates, {
        color: "#f59e0b",
        weight: 2.5,
        opacity: 0.7,
        dashArray: "5, 8"
      }).addTo(polylineLayer.current!);
    }

    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [visitas, promotorHome]);

  return <div className="w-full h-full rounded-2xl overflow-hidden border border-neutral-900 shadow-inner" />;
}
