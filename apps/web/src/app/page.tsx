'use client';

import React, { useState, useEffect } from 'react';
import {
  RoadGraphData,
  AlgorithmType,
  OptimizationMetric,
  FullRouteResult,
  WaypointInfo,
  DeliveryWaypointInput,
  GraphEdge,
  TrafficCondition,
  AlgorithmComparisonResponse,
  SearchNodeTrace,
  PRESET_DELHI_LOCATIONS,
} from '@ido/shared';
import { MapComponent } from '../components/MapComponent';
import { RoutePanel } from '../components/RoutePanel';
import { ComparisonModal } from '../components/ComparisonModal';
import { TrafficEditor } from '../components/TrafficEditor';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function HomePage() {
  const [graphData, setGraphData] = useState<RoadGraphData | null>(null);
  const [presetLocations, setPresetLocations] = useState(PRESET_DELHI_LOCATIONS);

  // Waypoints state
  const [startWaypoint, setStartWaypoint] = useState<DeliveryWaypointInput>({
    id: 'cp_warehouse',
    name: 'Connaught Place Central Hub',
    lat: 28.6328,
    lon: 77.2167,
  });

  const [stops, setStops] = useState<DeliveryWaypointInput[]>([
    {
      id: 'ndls_station',
      name: 'New Delhi Railway Logistics',
      lat: 28.6428,
      lon: 77.2195,
    },
    {
      id: 'pragati_maidan',
      name: 'Pragati Maidan Expo Center',
      lat: 28.6186,
      lon: 77.2415,
    },
    {
      id: 'khan_market',
      name: 'Khan Market Retail Stop',
      lat: 28.6003,
      lon: 77.2270,
    },
  ]);

  const [destWaypoint, setDestWaypoint] = useState<DeliveryWaypointInput>({
    id: 'lodhi_colony',
    name: 'Lodhi Art District Fulfillment',
    lat: 28.5888,
    lon: 77.2217,
  });

  // Algorithm & Search state
  const [algorithm, setAlgorithm] = useState<AlgorithmType>('astar');
  const [metric, setMetric] = useState<OptimizationMetric>('distance');
  const [clickMode, setClickMode] = useState<'start' | 'stop' | 'destination' | 'inspect'>('inspect');
  const [selectedEdge, setSelectedEdge] = useState<GraphEdge | null>(null);

  // Result state
  const [routeResult, setRouteResult] = useState<FullRouteResult | null>(null);
  const [comparisonData, setComparisonData] = useState<AlgorithmComparisonResponse | null>(null);
  const [isComparisonOpen, setIsComparisonOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Visualization state
  const [isVisualizing, setIsVisualizing] = useState(false);
  const [stepTrace, setStepTrace] = useState<SearchNodeTrace[] | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Fetch initial graph and metadata
  const loadGraph = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/map/graph`);
      if (res.ok) {
        const data = await res.json();
        setGraphData(data);
      }
    } catch (err) {
      console.error('Failed to load road graph:', err);
    }
  };

  useEffect(() => {
    loadGraph();
  }, []);

  // Map Click Handling
  const handleMapClick = async (
    lat: number,
    lon: number,
    mode: 'start' | 'stop' | 'destination' | 'inspect' = clickMode
  ) => {
    if (mode === 'inspect') return;

    try {
      // Snap clicked coordinates to nearest road node
      const snapRes = await fetch(`${API_BASE}/api/locations/snap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lon, maxDistanceMeters: 10000 }),
      });

      let name = `Point (${lat.toFixed(3)}, ${lon.toFixed(3)})`;
      let snappedNodeId: string | undefined = undefined;
      let finalLat = lat;
      let finalLon = lon;

      if (snapRes.ok) {
        const snapData = await snapRes.json();
        snappedNodeId = snapData.snappedNode.id;
        name = snapData.snappedNode.name || `Intersection ${snapData.snappedNode.id}`;
        finalLat = snapData.snappedNode.lat;
        finalLon = snapData.snappedNode.lon;
      }

      const newPoint: DeliveryWaypointInput = {
        id: `map_pt_${Date.now()}`,
        name,
        lat: finalLat,
        lon: finalLon,
        nodeId: snappedNodeId,
      };

      if (mode === 'start') {
        setStartWaypoint(newPoint);
      } else if (mode === 'destination') {
        setDestWaypoint(newPoint);
      } else if (mode === 'stop') {
        setStops((prev) => [...prev, newPoint]);
      }

      // Reset previous route when waypoints change
      setRouteResult(null);
      setStepTrace(null);
    } catch (err) {
      console.error('Snap error:', err);
    }
  };

  // Calculate Single Route
  const handleCalculateRoute = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/routes/find`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: startWaypoint,
          stops,
          destination: destWaypoint,
          algorithm,
          metric,
          autoOptimizeStops: true,
          collectSteps: true,
        }),
      });

      if (res.ok) {
        const data: FullRouteResult = await res.json();
        setRouteResult(data);

        // Aggregate steps for exploration trace
        const combinedSteps: SearchNodeTrace[] = [];
        data.legs.forEach((leg) => {
          if (leg.searchResult.steps) {
            combinedSteps.push(...leg.searchResult.steps);
          }
        });
        setStepTrace(combinedSteps);
        setCurrentStepIndex(combinedSteps.length > 0 ? combinedSteps.length - 1 : 0);
      }
    } catch (err) {
      console.error('Failed to calculate route:', err);
    } finally {
      setLoading(false);
    }
  };

  // Compare All 3 Algorithms
  const handleCompareAlgorithms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/routes/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: startWaypoint,
          stops,
          destination: destWaypoint,
          metric,
          autoOptimizeStops: true,
        }),
      });

      if (res.ok) {
        const data: AlgorithmComparisonResponse = await res.json();
        setComparisonData(data);
        setIsComparisonOpen(true);
      }
    } catch (err) {
      console.error('Failed to compare algorithms:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-optimize delivery stops using Hill Climbing TSP
  const handleOptimizeOrder = async () => {
    if (stops.length <= 1) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/routes/optimize-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: startWaypoint,
          stops,
          destination: destWaypoint,
          metric,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setStops(data.orderedStops);
      }
    } catch (err) {
      console.error('Failed to optimize stops:', err);
    } finally {
      setLoading(false);
    }
  };

  // Update Traffic Condition
  const handleUpdateTraffic = async (edgeId: string, condition: TrafficCondition) => {
    try {
      const res = await fetch(`${API_BASE}/api/traffic/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edgeId, condition }),
      });

      if (res.ok) {
        const result = await res.json();
        setSelectedEdge(result.edge);
        await loadGraph();
        // Recalculate route if one was active
        if (routeResult) {
          handleCalculateRoute();
        }
      }
    } catch (err) {
      console.error('Failed to update traffic:', err);
    }
  };

  // Reset All Traffic Modifications
  const handleResetAllTraffic = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/traffic/reset`, {
        method: 'POST',
      });
      if (res.ok) {
        setSelectedEdge(null);
        await loadGraph();
        if (routeResult) {
          handleCalculateRoute();
        }
      }
    } catch (err) {
      console.error('Failed to reset traffic:', err);
    }
  };

  // Build active waypoints for map markers
  const activeWaypoints: WaypointInfo[] = [
    {
      id: startWaypoint.id,
      name: startWaypoint.name || 'Start',
      lat: startWaypoint.lat,
      lon: startWaypoint.lon,
      nodeId: startWaypoint.nodeId || '',
      type: 'start',
      index: 0,
    },
    ...stops.map((s, idx) => ({
      id: s.id,
      name: s.name || `Stop ${idx + 1}`,
      lat: s.lat,
      lon: s.lon,
      nodeId: s.nodeId || '',
      type: 'stop' as const,
      index: idx + 1,
    })),
    {
      id: destWaypoint.id,
      name: destWaypoint.name || 'Destination',
      lat: destWaypoint.lat,
      lon: destWaypoint.lon,
      nodeId: destWaypoint.nodeId || '',
      type: 'destination',
      index: stops.length + 1,
    },
  ];

  return (
    <main className="flex-1 flex overflow-hidden relative">
      {/* Sidebar Route Planning Panel */}
      <RoutePanel
        startWaypoint={startWaypoint}
        setStartWaypoint={setStartWaypoint}
        stops={stops}
        setStops={setStops}
        destWaypoint={destWaypoint}
        setDestWaypoint={setDestWaypoint}
        presetLocations={presetLocations}
        algorithm={algorithm}
        setAlgorithm={setAlgorithm}
        metric={metric}
        setMetric={setMetric}
        clickMode={clickMode}
        setClickMode={setClickMode}
        onCalculateRoute={handleCalculateRoute}
        onCompareAlgorithms={handleCompareAlgorithms}
        onOptimizeOrder={handleOptimizeOrder}
        routeResult={routeResult}
        loading={loading}
        isVisualizing={isVisualizing}
        toggleVisualization={() => setIsVisualizing(!isVisualizing)}
        currentStepIndex={currentStepIndex}
        totalSteps={stepTrace ? stepTrace.length : 0}
        setCurrentStepIndex={setCurrentStepIndex}
      />

      {/* Main Interactive Map */}
      <div className="flex-1 relative h-full">
        <MapComponent
          graphData={graphData}
          waypoints={activeWaypoints}
          routeResult={routeResult}
          stepTrace={isVisualizing ? stepTrace : null}
          currentStepIndex={currentStepIndex}
          clickMode={clickMode}
          setClickMode={setClickMode}
          onMapClick={handleMapClick}
          onRoadClick={(edge) => {
            setSelectedEdge(edge);
          }}
        />

        {/* Selected Road Segment Traffic Editor Bar */}
        <TrafficEditor
          selectedEdge={selectedEdge}
          onUpdateTraffic={handleUpdateTraffic}
          onResetAllTraffic={handleResetAllTraffic}
          onClose={() => setSelectedEdge(null)}
        />
      </div>

      {/* Side-by-Side Algorithm Comparison Modal */}
      <ComparisonModal
        data={comparisonData}
        isOpen={isComparisonOpen}
        onClose={() => setIsComparisonOpen(false)}
      />
    </main>
  );
}

