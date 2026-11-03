'use client';

import React from 'react';
import {
  AlgorithmType,
  OptimizationMetric,
  WaypointInfo,
  FullRouteResult,
  DeliveryWaypointInput,
} from '@ido/shared';
import {
  Play,
  RotateCw,
  Plus,
  Trash2,
  Navigation,
  Compass,
  Zap,
  BarChart2,
  Shuffle,
  AlertCircle,
  Clock,
  Layers,
  MapPin,
} from 'lucide-react';

interface RoutePanelProps {
  startWaypoint: DeliveryWaypointInput;
  setStartWaypoint: (wp: DeliveryWaypointInput) => void;
  stops: DeliveryWaypointInput[];
  setStops: (stops: DeliveryWaypointInput[]) => void;
  destWaypoint: DeliveryWaypointInput;
  setDestWaypoint: (wp: DeliveryWaypointInput) => void;
  presetLocations: { id: string; name: string; lat: number; lon: number; type: string }[];
  algorithm: AlgorithmType;
  setAlgorithm: (alg: AlgorithmType) => void;
  metric: OptimizationMetric;
  setMetric: (m: OptimizationMetric) => void;
  clickMode: 'start' | 'stop' | 'destination' | 'inspect';
  setClickMode: (mode: 'start' | 'stop' | 'destination' | 'inspect') => void;
  onCalculateRoute: () => void;
  onCompareAlgorithms: () => void;
  onOptimizeOrder: () => void;
  routeResult: FullRouteResult | null;
  loading: boolean;
  isVisualizing: boolean;
  toggleVisualization: () => void;
  currentStepIndex: number;
  totalSteps: number;
  setCurrentStepIndex: (idx: number) => void;
}

export const RoutePanel: React.FC<RoutePanelProps> = ({
  startWaypoint,
  setStartWaypoint,
  stops,
  setStops,
  destWaypoint,
  setDestWaypoint,
  presetLocations,
  algorithm,
  setAlgorithm,
  metric,
  setMetric,
  clickMode,
  setClickMode,
  onCalculateRoute,
  onCompareAlgorithms,
  onOptimizeOrder,
  routeResult,
  loading,
  isVisualizing,
  toggleVisualization,
  currentStepIndex,
  totalSteps,
  setCurrentStepIndex,
}) => {
  const addStop = () => {
    const nextIdx = stops.length + 1;
    // Pick an unused preset if available
    const usedIds = new Set([startWaypoint.id, destWaypoint.id, ...stops.map((s) => s.id)]);
    const unusedPreset = presetLocations.find((p) => !usedIds.has(p.id));

    if (unusedPreset) {
      setStops([
        ...stops,
        {
          id: unusedPreset.id,
          name: unusedPreset.name,
          lat: unusedPreset.lat,
          lon: unusedPreset.lon,
        },
      ]);
    } else {
      setStops([
        ...stops,
        {
          id: `stop_${Date.now()}`,
          name: `Stop #${nextIdx}`,
          lat: 28.625 + Math.random() * 0.015,
          lon: 77.215 + Math.random() * 0.015,
        },
      ]);
    }
  };

  const removeStop = (index: number) => {
    const newStops = [...stops];
    newStops.splice(index, 1);
    setStops(newStops);
  };

  const handleReturnToStart = () => {
    setDestWaypoint({
      id: `${startWaypoint.id}_return`,
      name: `${startWaypoint.name} (Return)`,
      lat: startWaypoint.lat,
      lon: startWaypoint.lon,
      nodeId: startWaypoint.nodeId,
    });
  };

  return (
    <div className="w-96 h-full bg-white border-r border-slate-200 flex flex-col shadow-sm text-xs select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-slate-800 text-sm flex items-center space-x-1.5">
            <Navigation className="w-4 h-4 text-blue-600" />
            <span>Delivery Route Optimizer</span>
          </h1>
          <p className="text-[11px] text-slate-500">AI Search Benchmark (Whole Delhi NCT)</p>
        </div>
        <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
          Academic Demo
        </span>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {/* Map Click Mode Toolbar */}
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
              Map Interaction Mode
            </label>
            <span className="text-[10px] text-slate-400 font-medium">Click map to place</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => setClickMode('start')}
              className={`py-1.5 px-1 rounded-lg text-center transition font-semibold flex items-center justify-center space-x-1 ${
                clickMode === 'start'
                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Start</span>
            </button>
            <button
              onClick={() => setClickMode('stop')}
              className={`py-1.5 px-1 rounded-lg text-center transition font-semibold flex items-center justify-center space-x-1 ${
                clickMode === 'stop'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              <span>+ Stop</span>
            </button>
            <button
              onClick={() => setClickMode('destination')}
              className={`py-1.5 px-1 rounded-lg text-center transition font-semibold flex items-center justify-center space-x-1 ${
                clickMode === 'destination'
                  ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-red-400 inline-block" />
              <span>Dest</span>
            </button>
            <button
              onClick={() => setClickMode('inspect')}
              className={`py-1.5 px-1 rounded-lg text-center transition font-semibold flex items-center justify-center space-x-1 ${
                clickMode === 'inspect'
                  ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>Traffic</span>
            </button>
          </div>
        </div>

        {/* Start Location Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-700 flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Starting Warehouse</span>
            </label>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setClickMode('start')}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition flex items-center space-x-0.5 ${
                  clickMode === 'start'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                }`}
                title="Click on the map to set the starting location"
              >
                <MapPin className="w-2.5 h-2.5" />
                <span>{clickMode === 'start' ? 'Click Map...' : 'Pick on Map'}</span>
              </button>
              <select
                value={startWaypoint.id}
                onChange={(e) => {
                  const found = presetLocations.find((p) => p.id === e.target.value);
                  if (found) {
                    setStartWaypoint({
                      id: found.id,
                      name: found.name,
                      lat: found.lat,
                      lon: found.lon,
                    });
                  }
                }}
                className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700"
              >
                <option value="">Presets...</option>
                {presetLocations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            onClick={() => setClickMode('start')}
            className={`border rounded-lg p-2 flex items-center justify-between cursor-pointer transition ${
              clickMode === 'start'
                ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-300'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="font-medium text-slate-800 truncate pr-2">
              {startWaypoint.name || 'Selected Warehouse'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {startWaypoint.lat.toFixed(3)}, {startWaypoint.lon.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Intermediate Delivery Locations */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="font-semibold text-slate-700 flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              <span>Intermediate Stops ({stops.length})</span>
            </label>
            <div className="flex items-center space-x-1">
              {stops.length > 1 && (
                <button
                  onClick={onOptimizeOrder}
                  className="bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-100 font-medium px-1.5 py-0.5 rounded text-[10px] flex items-center space-x-1"
                  title="Auto-order intermediate stops using 2-opt Hill Climbing"
                >
                  <Shuffle className="w-2.5 h-2.5" />
                  <span>Auto-Order</span>
                </button>
              )}
              <button
                onClick={() => setClickMode('stop')}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border transition flex items-center space-x-0.5 ${
                  clickMode === 'stop'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                }`}
                title="Click on the map to place an intermediate delivery stop"
              >
                <MapPin className="w-2.5 h-2.5" />
                <span>{clickMode === 'stop' ? 'Click Map...' : '+ Map'}</span>
              </button>
              <button
                onClick={addStop}
                className="bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 font-medium px-1.5 py-0.5 rounded text-[10px] flex items-center space-x-0.5"
                title="Add next preset location"
              >
                <Plus className="w-2.5 h-2.5" />
                <span>Preset</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
            {stops.length === 0 ? (
              <div className="text-center py-3 text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No intermediate stops. Click &quot;+ Stop&quot; or click on the map.
              </div>
            ) : (
              stops.map((stop, idx) => (
                <div
                  key={stop.id || idx}
                  className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between shadow-2xs hover:border-slate-300 transition"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-slate-800 truncate">
                      {stop.name || `Delivery Stop ${idx + 1}`}
                    </span>
                  </div>
                  <button
                    onClick={() => removeStop(idx)}
                    className="text-slate-400 hover:text-red-600 transition p-1"
                    title="Remove stop"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Final Destination Input */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="font-semibold text-slate-700 flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span>Final Destination</span>
            </label>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setClickMode('destination')}
                className={`text-[10px] font-semibold px-2 py-0.5 rounded border transition flex items-center space-x-0.5 ${
                  clickMode === 'destination'
                    ? 'bg-red-600 text-white border-red-600 shadow-xs'
                    : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                }`}
                title="Click on the map to set the destination"
              >
                <MapPin className="w-2.5 h-2.5" />
                <span>{clickMode === 'destination' ? 'Click Map...' : 'Pick on Map'}</span>
              </button>
              <button
                onClick={handleReturnToStart}
                className="text-[10px] text-blue-600 hover:underline px-1"
                title="Set destination to start warehouse"
              >
                Return
              </button>
              <select
                value={destWaypoint.id}
                onChange={(e) => {
                  const found = presetLocations.find((p) => p.id === e.target.value);
                  if (found) {
                    setDestWaypoint({
                      id: found.id,
                      name: found.name,
                      lat: found.lat,
                      lon: found.lon,
                    });
                  }
                }}
                className="text-[11px] border border-slate-200 rounded px-1.5 py-0.5 bg-white text-slate-700"
              >
                <option value="">Presets...</option>
                {presetLocations.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            onClick={() => setClickMode('destination')}
            className={`border rounded-lg p-2 flex items-center justify-between cursor-pointer transition ${
              clickMode === 'destination'
                ? 'bg-red-50/70 border-red-300 ring-1 ring-red-300'
                : 'bg-slate-50 border-slate-200 hover:border-slate-300'
            }`}
          >
            <span className="font-medium text-slate-800 truncate pr-2">
              {destWaypoint.name || 'Selected Destination'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              {destWaypoint.lat.toFixed(3)}, {destWaypoint.lon.toFixed(3)}
            </span>
          </div>
        </div>

        {/* Algorithm Selection */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5 flex items-center justify-between">
            <span>AI Search Algorithm:</span>
            <span className="text-[10px] text-slate-400 font-normal">Self-Implemented TS</span>
          </label>
          <div className="space-y-1.5">
            <label
              className={`flex items-start p-2 rounded-lg border cursor-pointer transition ${
                algorithm === 'astar'
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="algorithm"
                value="astar"
                checked={algorithm === 'astar'}
                onChange={() => setAlgorithm('astar')}
                className="mt-0.5 text-blue-600"
              />
              <div className="ml-2">
                <span className="font-semibold text-slate-900 block">A* Search</span>
                <span className="text-[10px] text-slate-500">
                  Optimal & Complete: f(n) = g(n) + h(n). Min-heap priority queue.
                </span>
              </div>
            </label>

            <label
              className={`flex items-start p-2 rounded-lg border cursor-pointer transition ${
                algorithm === 'greedy'
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="algorithm"
                value="greedy"
                checked={algorithm === 'greedy'}
                onChange={() => setAlgorithm('greedy')}
                className="mt-0.5 text-blue-600"
              />
              <div className="ml-2">
                <span className="font-semibold text-slate-900 block">Greedy Best-First Search</span>
                <span className="text-[10px] text-slate-500">
                  Heuristic only: f(n) = h(n). Fast exploration, suboptimal route cost.
                </span>
              </div>
            </label>

            <label
              className={`flex items-start p-2 rounded-lg border cursor-pointer transition ${
                algorithm === 'hillclimbing'
                  ? 'border-blue-500 bg-blue-50/50'
                  : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="algorithm"
                value="hillclimbing"
                checked={algorithm === 'hillclimbing'}
                onChange={() => setAlgorithm('hillclimbing')}
                className="mt-0.5 text-blue-600"
              />
              <div className="ml-2">
                <span className="font-semibold text-slate-900 block">Hill Climbing</span>
                <span className="text-[10px] text-slate-500">
                  Local search: moves strictly to improving neighbor. Stops at local minima!
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Optimization Metric */}
        <div>
          <label className="font-semibold text-slate-700 block mb-1.5">Optimization Metric:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMetric('distance')}
              className={`py-1.5 px-2 rounded-lg font-medium border text-center transition ${
                metric === 'distance'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Shortest Distance
            </button>
            <button
              onClick={() => setMetric('time')}
              className={`py-1.5 px-2 rounded-lg font-medium border text-center transition ${
                metric === 'time'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Fastest Travel Time
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={onCalculateRoute}
            disabled={loading}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold rounded-xl shadow transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            {loading ? (
              <span>Calculating Route...</span>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Calculate Road Route</span>
              </>
            )}
          </button>

          <button
            onClick={onCompareAlgorithms}
            disabled={loading}
            className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white font-semibold rounded-xl shadow transition flex items-center justify-center space-x-1.5 disabled:opacity-50"
          >
            <BarChart2 className="w-4 h-4" />
            <span>Compare All 3 Algorithms</span>
          </button>
        </div>

        {/* Search Step Visualization */}
        {routeResult && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700 flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Search Exploration Trace</span>
              </span>
              <button
                onClick={toggleVisualization}
                className="text-[10px] text-blue-600 font-semibold hover:underline"
              >
                {isVisualizing ? 'Hide Trace' : 'Show Trace'}
              </button>
            </div>
            {isVisualizing && totalSteps > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>
                    Step {currentStepIndex + 1} of {totalSteps}
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="inline-block w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Frontier</span>
                    <span className="inline-block w-2 h-2 rounded-full bg-blue-600 ml-1" />
                    <span>Explored</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max={totalSteps - 1}
                  value={currentStepIndex}
                  onChange={(e) => setCurrentStepIndex(parseInt(e.target.value))}
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {/* Route Results Section */}
        {routeResult && (
          <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800 text-xs">Route Results</span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  routeResult.success
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {routeResult.success
                  ? `All ${routeResult.legs.length} Leg${routeResult.legs.length !== 1 ? 's' : ''} OK`
                  : `${routeResult.legs.filter((l) => !l.success).length}/${routeResult.legs.length} Failed`}
              </span>
            </div>

            {routeResult.stuck && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded-lg text-[11px] flex items-start space-x-1.5">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <strong className="block">Algorithm Stopped / Stuck:</strong>
                  {routeResult.algorithm === 'hillclimbing'
                    ? 'Hill Climbing terminated at local minimum — no unvisited neighbor improves heuristic.'
                    : 'One or more legs could not be completed (destination unreachable or blocked).'}
                </div>
              </div>
            )}

            {routeResult.legSummary && routeResult.legSummary.some((l) => !l.success) && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-orange-700 uppercase tracking-wide">Failed Legs:</span>
                {routeResult.legSummary
                  .filter((l) => !l.success)
                  .map((l) => (
                    <div
                      key={l.legIndex}
                      className="bg-orange-50 border border-orange-200 text-orange-800 p-1.5 rounded text-[10px] flex items-start space-x-1"
                    >
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5 text-orange-600" />
                      <span>
                        <strong>Leg {l.legIndex + 1}:</strong> {l.fromName} → {l.toName}
                        {l.failureReason && <span className="block text-orange-600">{l.failureReason}</span>}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-slate-700">
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Physical Distance</span>
                <span className="font-semibold text-slate-900">
                  {(routeResult.totalDistanceMeters / 1000).toFixed(2)} km
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Travel Time</span>
                <span className="font-semibold text-slate-900">
                  {Math.floor(routeResult.totalDurationSeconds / 60)}m{' '}
                  {Math.round(routeResult.totalDurationSeconds % 60)}s
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Nodes Explored</span>
                <span className="font-semibold text-slate-900">
                  {routeResult.totalNodesExplored} nodes
                </span>
              </div>
              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                <span className="text-slate-400 block text-[10px]">Execution Time</span>
                <span className="font-semibold text-slate-900">
                  {routeResult.totalExecutionTimeMs.toFixed(2)} ms
                </span>
              </div>
            </div>

            {routeResult.legs.length > 1 && (
              <div className="space-y-1 border-t border-slate-100 pt-2">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Leg Breakdown:</span>
                {routeResult.legs.map((leg) => (
                  <div
                    key={leg.legIndex}
                    className={`flex items-center justify-between p-1.5 rounded text-[10px] ${
                      leg.success
                        ? 'bg-emerald-50 border border-emerald-100'
                        : 'bg-red-50 border border-red-200'
                    }`}
                  >
                    <span className={`font-medium truncate max-w-[160px] ${leg.success ? 'text-emerald-800' : 'text-red-700'}`}>
                      {leg.legIndex + 1}. {leg.fromName} → {leg.toName}
                    </span>
                    <span className={`font-bold shrink-0 ml-1 ${leg.success ? 'text-emerald-700' : 'text-red-600'}`}>
                      {leg.success ? `${(leg.distanceMeters / 1000).toFixed(1)}km` : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
