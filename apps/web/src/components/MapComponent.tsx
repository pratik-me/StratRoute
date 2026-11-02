'use client';

import React, { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import {
  GraphEdge,
  GraphNode,
  RoadGraphData,
  WaypointInfo,
  FullRouteResult,
  SearchNodeTrace,
} from '@ido/shared';

interface MapComponentProps {
  graphData: RoadGraphData | null;
  waypoints: WaypointInfo[];
  routeResult: FullRouteResult | null;
  stepTrace: SearchNodeTrace[] | null;
  currentStepIndex: number;
  clickMode: 'start' | 'stop' | 'destination' | 'inspect';
  setClickMode: (mode: 'start' | 'stop' | 'destination' | 'inspect') => void;
  onMapClick: (lat: number, lon: number, mode: 'start' | 'stop' | 'destination' | 'inspect') => void;
  onRoadClick: (edge: GraphEdge) => void;
}

export const MapComponent: React.FC<MapComponentProps> = ({
  graphData,
  waypoints,
  routeResult,
  stepTrace,
  currentStepIndex,
  clickMode,
  setClickMode,
  onMapClick,
  onRoadClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  // Keep latest refs for callbacks and mode to avoid stale closures in event listeners
  const clickModeRef = useRef(clickMode);
  clickModeRef.current = clickMode;

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onRoadClickRef = useRef(onRoadClick);
  onRoadClickRef.current = onRoadClick;

  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData;

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [77.2167, 28.6328], // Connaught Place, New Delhi
      zoom: 13.5,
      pitch: 0,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    mapRef.current = map;

    map.on('load', () => {
      // Add source for road network
      map.addSource('road-network', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Layer: Background road lines (casing)
      map.addLayer({
        id: 'road-casing',
        type: 'line',
        source: 'road-network',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-width': 7,
          'line-opacity': 0.85,
        },
      });

      // Layer: Traffic-colored roads
      map.addLayer({
        id: 'road-lines',
        type: 'line',
        source: 'road-network',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': [
            'case',
            ['get', 'isBlocked'],
            '#ef4444', // Red for blocked
            ['==', ['get', 'trafficMultiplier'], 0.4],
            '#f97316', // Orange for heavy traffic
            ['==', ['get', 'trafficMultiplier'], 0.75],
            '#eab308', // Yellow for moderate traffic
            '#10b981', // Green for normal traffic
          ],
          'line-width': [
            'case',
            ['get', 'isBlocked'],
            4.5,
            3.5,
          ],
        },
      });

      // Add source for calculated route
      map.addSource('route-path', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Route Casing
      map.addLayer({
        id: 'route-path-casing',
        type: 'line',
        source: 'route-path',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1e3a8a',
          'line-width': 9,
          'line-opacity': 0.65,
        },
      });

      // Route Core Line
      map.addLayer({
        id: 'route-path-line',
        type: 'line',
        source: 'route-path',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2563eb',
          'line-width': 5,
        },
      });

      // Source for search visualization nodes (frontier & explored)
      map.addSource('search-trace', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'search-trace-points',
        type: 'circle',
        source: 'search-trace',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'state'], 'stuck'],
            8,
            ['==', ['get', 'state'], 'explored'],
            6,
            5,
          ],
          'circle-color': [
            'case',
            ['==', ['get', 'state'], 'stuck'],
            '#ef4444',
            ['==', ['get', 'state'], 'explored'],
            '#0284c7', // Blue
            '#eab308', // Yellow for frontier
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      // Single Unified Click Handler: reads latest mode from ref
      map.on('click', (e) => {
        const mode = clickModeRef.current;

        // In 'inspect' mode, check if a road line was clicked to edit traffic
        if (mode === 'inspect') {
          const bbox: [maplibregl.PointLike, maplibregl.PointLike] = [
            [e.point.x - 6, e.point.y - 6],
            [e.point.x + 6, e.point.y + 6],
          ];
          const features = map.queryRenderedFeatures(bbox, { layers: ['road-lines'] });
          if (features.length > 0 && features[0].properties?.edgeId) {
            const edgeId = features[0].properties.edgeId;
            const edgeObj = graphDataRef.current?.edges.find((ed) => ed.id === edgeId);
            if (edgeObj) {
              onRoadClickRef.current(edgeObj);
              return;
            }
          }
        }

        // In 'start', 'stop', or 'destination' mode:
        // Always place/set the waypoint at clicked position (snapped to nearest road node)
        onMapClickRef.current(e.lngLat.lat, e.lngLat.lng, mode);
      });

      // Cursor hover changes
      map.on('mouseenter', 'road-lines', () => {
        if (clickModeRef.current === 'inspect') {
          map.getCanvas().style.cursor = 'pointer';
        }
      });
      map.on('mouseleave', 'road-lines', () => {
        if (clickModeRef.current === 'inspect') {
          map.getCanvas().style.cursor = '';
        } else {
          map.getCanvas().style.cursor = 'crosshair';
        }
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update canvas cursor whenever clickMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    if (!canvas) return;

    if (clickMode !== 'inspect') {
      canvas.style.cursor = 'crosshair';
    } else {
      canvas.style.cursor = '';
    }
  }, [clickMode]);

  // Update Road Network Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded() || !graphData) return;

    const source = map.getSource('road-network') as maplibregl.GeoJSONSource;
    if (!source) return;

    const features = graphData.edges.map((edge) => {
      const u = graphData.nodes.find((n) => n.id === edge.source);
      const v = graphData.nodes.find((n) => n.id === edge.target);

      const coordinates =
        edge.geometry && edge.geometry.length > 0
          ? edge.geometry
          : [
              [u ? u.lon : 77.2167, u ? u.lat : 28.6328],
              [v ? v.lon : 77.2167, v ? v.lat : 28.6328],
            ];

      return {
        type: 'Feature' as const,
        properties: {
          edgeId: edge.id,
          roadName: edge.roadName || 'Road',
          roadType: edge.roadType,
          trafficMultiplier: edge.trafficMultiplier,
          isBlocked: edge.isBlocked,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates,
        },
      };
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [graphData]);

  // Update Waypoint Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    waypoints.forEach((wp) => {
      const el = document.createElement('div');
      if (wp.type === 'start') {
        el.className = 'marker-start cursor-pointer hover:scale-110 transition-transform';
        el.innerHTML = 'S';
        el.title = `Starting Warehouse: ${wp.name}`;
      } else if (wp.type === 'destination') {
        el.className = 'marker-dest cursor-pointer hover:scale-110 transition-transform';
        el.innerHTML = 'D';
        el.title = `Final Destination: ${wp.name}`;
      } else {
        el.className = 'marker-stop cursor-pointer hover:scale-110 transition-transform';
        el.innerHTML = `${wp.index}`;
        el.title = `Delivery Stop #${wp.index}: ${wp.name}`;
      }

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([wp.lon, wp.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });
  }, [waypoints]);

  // Update Calculated Route Path
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('route-path') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!routeResult || routeResult.fullCoordinates.length < 2) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: routeResult.fullCoordinates,
          },
        },
      ],
    });
  }, [routeResult]);

  // Update Search Node Visualization Trace
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const source = map.getSource('search-trace') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!stepTrace || stepTrace.length === 0) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const visibleSteps = stepTrace.slice(0, currentStepIndex + 1);
    const features = visibleSteps.map((step) => ({
      type: 'Feature' as const,
      properties: {
        nodeId: step.nodeId,
        state: step.state,
        stepNumber: step.stepNumber,
      },
      geometry: {
        type: 'Point' as const,
        coordinates: [step.lon, step.lat],
      },
    }));

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  }, [stepTrace, currentStepIndex]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Floating Map Mode Selector & Instruction Pill */}
      <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md shadow-lg rounded-xl p-2 border border-slate-200 z-10 flex flex-col space-y-1.5 max-w-sm">
        <div className="flex items-center space-x-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1">
            Mode:
          </span>
          <button
            onClick={() => setClickMode('start')}
            className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center space-x-1 ${
              clickMode === 'start'
                ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
            <span>Start (S)</span>
          </button>

          <button
            onClick={() => setClickMode('stop')}
            className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center space-x-1 ${
              clickMode === 'stop'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span>+ Stop</span>
          </button>

          <button
            onClick={() => setClickMode('destination')}
            className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center space-x-1 ${
              clickMode === 'destination'
                ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
            <span>Dest (D)</span>
          </button>

          <button
            onClick={() => setClickMode('inspect')}
            className={`px-2 py-1 rounded text-xs font-semibold transition flex items-center space-x-1 ${
              clickMode === 'inspect'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-300'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span>Traffic</span>
          </button>
        </div>

        {/* Dynamic Contextual Helper Text */}
        <div className="text-[11px] text-slate-600 border-t border-slate-100 pt-1 flex items-center space-x-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
          <span>
            {clickMode === 'start' && 'Click anywhere on the map to set the Starting Warehouse.'}
            {clickMode === 'stop' && 'Click anywhere on the map to add an Intermediate Delivery Stop.'}
            {clickMode === 'destination' && 'Click anywhere on the map to set the Final Destination.'}
            {clickMode === 'inspect' && 'Click any colored road line on the map to edit traffic condition.'}
          </span>
        </div>
      </div>
    </div>
  );
};
