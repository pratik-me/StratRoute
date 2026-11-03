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
  onMapClick: (lat: number, lon: number, mode: 'start' | 'stop' | 'destination' | 'inspect') => void;
  onRoadClick: (edge: GraphEdge) => void;
}

// Generate high-DPI canvas icon for GPU-accelerated WebGL symbol layer
const createMarkerImageData = (label: string, color: string): ImageData | null => {
  const size = 56;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = size / 2;
  const radius = 21;

  // Outer shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Solid background circle
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // Reset shadow for crisp border and text
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Crisp white border
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Centered white label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, center, center + 0.5);

  return ctx.getImageData(0, 0, size, size);
};

// Create a "failed" marker icon with red X
const createFailedMarkerImageData = (label: string): ImageData | null => {
  const size = 56;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const center = size / 2;
  const radius = 21;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;

  // Red background for failed legs
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#ef4444';
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Orange dashed border to distinguish from destination
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fbbf24';
  ctx.setLineDash([4, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, center, center + 0.5);

  return ctx.getImageData(0, 0, size, size);
};

export const MapComponent: React.FC<MapComponentProps> = ({
  graphData,
  waypoints,
  routeResult,
  stepTrace,
  currentStepIndex,
  clickMode,
  onMapClick,
  onRoadClick,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef<maplibregl.Popup | null>(null);

  // Keep latest refs to avoid stale closures in event listeners
  const clickModeRef = useRef(clickMode);
  clickModeRef.current = clickMode;

  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const onRoadClickRef = useRef(onRoadClick);
  onRoadClickRef.current = onRoadClick;

  const graphDataRef = useRef(graphData);
  graphDataRef.current = graphData;

  const waypointsRef = useRef(waypoints);
  waypointsRef.current = waypoints;

  const routeResultRef = useRef(routeResult);
  routeResultRef.current = routeResult;

  // Build the set of leg-index → success mapping from routeResult
  const getLegSuccessMap = (result: FullRouteResult | null): Map<number, boolean> => {
    const map = new Map<number, boolean>();
    if (result) {
      result.legs.forEach((leg) => map.set(leg.legIndex, leg.success));
    }
    return map;
  };

  // Synchronize GeoJSON source and canvas icon textures for WebGL markers
  const syncWaypointsSource = (mapInstance: maplibregl.Map, currentWaypoints: WaypointInfo[], currentRoute: FullRouteResult | null) => {
    const source = mapInstance.getSource('waypoints') as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    // Build a set of waypoint node IDs that had a failed incoming or outgoing leg
    const failedNodeIds = new Set<string>();
    if (currentRoute) {
      currentRoute.legs.forEach((leg) => {
        if (!leg.success) {
          failedNodeIds.add(leg.fromNodeId);
          failedNodeIds.add(leg.toNodeId);
        }
      });
    }

    currentWaypoints.forEach((wp) => {
      let label = '';
      let color = '#2563eb';
      let iconKey = '';

      if (wp.type === 'start') {
        label = 'S';
        color = '#10b981';
        iconKey = 'icon-start';
      } else if (wp.type === 'destination') {
        label = 'D';
        color = '#ef4444';
        iconKey = 'icon-dest';
      } else {
        label = `${wp.index ?? '•'}`;
        color = '#2563eb';
        iconKey = `icon-stop-${label}`;
      }

      if (!mapInstance.hasImage(iconKey)) {
        const imgData = createMarkerImageData(label, color);
        if (imgData) {
          mapInstance.addImage(iconKey, imgData, { pixelRatio: 2 });
        }
      }
    });

    const features = currentWaypoints.map((wp) => {
      let label = '';
      let color = '#2563eb';
      let iconKey = '';
      let isFailedEndpoint = false;

      if (wp.type === 'start') {
        label = 'S';
        color = '#10b981';
        iconKey = 'icon-start';
      } else if (wp.type === 'destination') {
        label = 'D';
        color = '#ef4444';
        iconKey = 'icon-dest';
      } else {
        label = `${wp.index ?? '•'}`;
        // Check if this stop was on a failed leg
        if (currentRoute && wp.nodeId && failedNodeIds.has(wp.nodeId)) {
          isFailedEndpoint = true;
          color = '#f97316'; // Orange for failed stop
          iconKey = `icon-stop-failed-${label}`;
          if (!mapInstance.hasImage(iconKey)) {
            const imgData = createMarkerImageData(label, color);
            if (imgData) {
              mapInstance.addImage(iconKey, imgData, { pixelRatio: 2 });
            }
          }
        } else {
          color = '#2563eb';
          iconKey = `icon-stop-${label}`;
        }
      }

      return {
        type: 'Feature' as const,
        properties: {
          id: wp.id,
          name: wp.name,
          type: wp.type,
          label,
          color,
          iconKey,
          isFailedEndpoint,
        },
        geometry: {
          type: 'Point' as const,
          // Coordinates: [lon, lat] — correct GeoJSON order
          coordinates: [wp.lon, wp.lat],
        },
      };
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });
  };

  /**
   * Synchronize GeoJSON sources for calculated route legs.
   *
   * Successful legs go into 'route-path' (blue line).
   * Failed legs have no road path rendered (no coordinates to draw).
   * Camera is fit to include ALL waypoint markers even when legs fail.
   */
  const syncRoutePathSource = (
    mapInstance: maplibregl.Map,
    currentRoute: FullRouteResult | null,
    currentWaypoints: WaypointInfo[]
  ) => {
    const routeSource = mapInstance.getSource('route-path') as maplibregl.GeoJSONSource | undefined;
    if (!routeSource) return;

    if (!currentRoute) {
      routeSource.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Build one LineString feature per SUCCESSFUL leg using legCoordinates
    // (which include the access connectors to the exact waypoint positions).
    // Do NOT merge failed legs in — that would visually connect disconnected segments.
    const successfulLegFeatures = currentRoute.legs
      .filter((leg) => leg.success && leg.legCoordinates && leg.legCoordinates.length >= 2)
      .map((leg) => ({
        type: 'Feature' as const,
        properties: {
          legIndex: leg.legIndex,
          fromName: leg.fromName,
          toName: leg.toName,
          distanceMeters: leg.distanceMeters,
          durationSeconds: leg.durationSeconds,
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: leg.legCoordinates,
        },
      }));

    routeSource.setData({
      type: 'FeatureCollection',
      features: successfulLegFeatures,
    });

    // --- Fit map bounds to encompass ALL waypoints + successful route coordinates ---
    // We always include waypoint positions so that failed-leg markers stay in view.
    try {
      const allPoints: [number, number][] = [];

      // Include ALL waypoints (markers must stay visible regardless of leg success)
      for (const wp of currentWaypoints) {
        allPoints.push([wp.lon, wp.lat]);
      }

      // Include successful leg coordinates
      for (const leg of currentRoute.legs) {
        if (leg.success && leg.legCoordinates) {
          for (const coord of leg.legCoordinates) {
            allPoints.push(coord);
          }
        }
      }

      if (allPoints.length >= 1) {
        const bounds = new maplibregl.LngLatBounds(allPoints[0], allPoints[0]);
        allPoints.forEach((pt) => bounds.extend(pt));

        const hasRoute = successfulLegFeatures.length > 0;
        mapInstance.fitBounds(bounds, {
          padding: 80,
          maxZoom: hasRoute ? 15 : 13,
          duration: 600,
        });
      }
    } catch (e) {
      console.warn('[MapComponent] Could not fit bounds for route:', e);
    }
  };

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
      center: [77.1600, 28.6300], // Whole Delhi (NCT of Delhi)
      zoom: 10.8,
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

      // Add source for calculated route — supports multiple LineString features (one per leg)
      map.addSource('route-path', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Route Casing (Dark contrast outline) — applied to all legs
      map.addLayer({
        id: 'route-path-casing',
        type: 'line',
        source: 'route-path',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#0f172a',
          'line-width': 10,
          'line-opacity': 0.95,
        },
      });

      // Route Core Line (Vibrant Electric Blue)
      map.addLayer({
        id: 'route-path-line',
        type: 'line',
        source: 'route-path',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#2563eb',
          'line-width': 6,
          'line-opacity': 1.0,
        },
      });

      // Route Inner Highlight (Bright inner spine for maximum visibility)
      map.addLayer({
        id: 'route-path-inner',
        type: 'line',
        source: 'route-path',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#93c5fd',
          'line-width': 2.5,
          'line-opacity': 1.0,
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

      // Source for interactive waypoints (Start, Stops, Destination)
      map.addSource('waypoints', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      // Layer: Waypoint soft glow halo
      map.addLayer({
        id: 'waypoint-glow',
        type: 'circle',
        source: 'waypoints',
        paint: {
          'circle-radius': 22,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.28,
          'circle-blur': 0.5,
        },
      });

      // Layer: Embedded WebGL Waypoint Markers (high-DPI canvas texture)
      map.addLayer({
        id: 'waypoint-symbols',
        type: 'symbol',
        source: 'waypoints',
        layout: {
          'icon-image': ['get', 'iconKey'],
          'icon-size': 1,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // Interactive hover popup for waypoints
      const popup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
      });
      popupRef.current = popup;

      map.on('mouseenter', 'waypoint-symbols', (e) => {
        map.getCanvas().style.cursor = 'pointer';
        if (!e.features || e.features.length === 0) return;
        const f = e.features[0];
        const coordinates = (
          f.geometry as { type: string; coordinates: [number, number] }
        ).coordinates.slice() as [number, number];
        const props = f.properties || {};

        const type = props.type;
        const name = props.name || 'Waypoint';
        const label = props.label || '';
        const isFailedEndpoint = props.isFailedEndpoint;

        let badgeColor = '#2563eb';
        let badgeTitle = `Delivery Stop #${label}`;
        if (type === 'start') {
          badgeColor = '#059669';
          badgeTitle = 'Warehouse (Start)';
        } else if (type === 'destination') {
          badgeColor = '#dc2626';
          badgeTitle = 'Final Destination';
        } else if (isFailedEndpoint) {
          badgeColor = '#ea580c';
          badgeTitle = `Delivery Stop #${label} ⚠ Failed Leg`;
        }

        popup
          .setLngLat(coordinates)
          .setHTML(`
            <div style="font-family: sans-serif; padding: 3px 6px; font-size: 11px;">
              <div style="font-weight: 700; color: ${badgeColor};">${badgeTitle}</div>
              <div style="color: #334155; margin-top: 2px; font-weight: 500;">${name}</div>
              ${isFailedEndpoint ? '<div style="color: #ea580c; margin-top: 2px; font-size: 10px;">⚠ Route could not reach this waypoint</div>' : ''}
            </div>
          `)
          .addTo(map);
      });

      map.on('mouseleave', 'waypoint-symbols', () => {
        if (clickModeRef.current !== 'inspect') {
          map.getCanvas().style.cursor = 'crosshair';
        } else {
          map.getCanvas().style.cursor = '';
        }
        popup.remove();
      });

      // Synchronize waypoints and route path immediately if already present
      syncWaypointsSource(map, waypointsRef.current, routeResultRef.current);
      syncRoutePathSource(map, routeResultRef.current, waypointsRef.current);

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
      if (popupRef.current) {
        popupRef.current.remove();
        popupRef.current = null;
      }
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
    if (!map || !graphData) return;

    const source = map.getSource('road-network') as maplibregl.GeoJSONSource | undefined;
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

  // Update Waypoint WebGL Layer — re-sync whenever waypoints or routeResult changes
  // so that failed-endpoint markers get their warning color applied.
  useEffect(() => {
    waypointsRef.current = waypoints;
    const map = mapRef.current;
    if (!map) return;
    syncWaypointsSource(map, waypoints, routeResultRef.current);
  }, [waypoints, routeResult]);

  // Update Calculated Route Path — render per-leg lines and fit bounds
  useEffect(() => {
    routeResultRef.current = routeResult;
    const map = mapRef.current;
    if (!map) return;

    // Log route result summary for development debugging
    if (routeResult) {
      const successLegs = routeResult.legs.filter((l) => l.success).length;
      const totalLegs = routeResult.legs.length;
      console.debug(
        `[MapComponent] Rendering route: ${successLegs}/${totalLegs} legs succeeded. ` +
        `Algorithm: ${routeResult.algorithm}, Metric: ${routeResult.metric}`
      );
      if (routeResult.legSummary) {
        routeResult.legSummary.forEach((s) => {
          if (!s.success) {
            console.warn(
              `[MapComponent] Failed leg ${s.legIndex}: "${s.fromName}" → "${s.toName}" — ${s.failureReason}`
            );
          }
        });
      }
    }

    syncRoutePathSource(map, routeResult, waypointsRef.current);
    // Also re-sync waypoint colors (failed legs affect marker color)
    syncWaypointsSource(map, waypointsRef.current, routeResult);
  }, [routeResult]);

  // Update Search Node Visualization Trace
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const source = map.getSource('search-trace') as maplibregl.GeoJSONSource | undefined;
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
        // step.lon, step.lat are in the correct [lon, lat] GeoJSON order
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
    </div>
  );
};
