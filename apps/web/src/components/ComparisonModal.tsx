'use client';

import React from 'react';
import { AlgorithmComparisonResponse } from '@ido/shared';
import { Award, Check, AlertCircle, Clock, Zap, ArrowRight } from 'lucide-react';

interface ComparisonModalProps {
  data: AlgorithmComparisonResponse | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  data,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 rounded-t-2xl">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center space-x-2">
              <Award className="w-5 h-5 text-amber-500" />
              <span>AI Algorithm Performance & Comparison Benchmark</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identical graph, same waypoints, same traffic conditions, objective:{' '}
              <span className="font-semibold capitalize text-blue-700">{data.metric}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 font-bold px-3 py-1 text-sm rounded-lg hover:bg-slate-200 transition"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Comparison Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="p-3">Algorithm</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Total Cost</th>
                  <th className="p-3">Distance</th>
                  <th className="p-3">Travel Time</th>
                  <th className="p-3">Nodes Explored</th>
                  <th className="p-3">Runtime</th>
                  <th className="p-3">Optimality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {data.comparison.map((entry) => (
                  <tr
                    key={entry.algorithm}
                    className={`hover:bg-slate-50/80 transition ${
                      entry.algorithm === 'astar' ? 'bg-blue-50/40 font-medium' : ''
                    }`}
                  >
                    <td className="p-3 font-semibold text-slate-900">
                      {entry.name}
                      {entry.algorithm === 'astar' && (
                        <span className="ml-2 text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                          Optimal
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {entry.success ? (
                        <span className="inline-flex items-center text-emerald-700 space-x-1">
                          <Check className="w-3.5 h-3.5" />
                          <span>Reached Goal</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-red-600 space-x-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Stuck / Failed</span>
                        </span>
                      )}
                    </td>
                    <td className="p-3 font-mono font-semibold">
                      {entry.success ? entry.totalCost.toFixed(1) : 'N/A'}
                    </td>
                    <td className="p-3 font-mono">
                      {entry.success ? `${(entry.totalDistanceMeters / 1000).toFixed(2)} km` : 'N/A'}
                    </td>
                    <td className="p-3 font-mono">
                      {entry.success
                        ? `${Math.floor(entry.totalDurationSeconds / 60)}m ${Math.round(
                            entry.totalDurationSeconds % 60
                          )}s`
                        : 'N/A'}
                    </td>
                    <td className="p-3 font-mono">{entry.nodesExplored}</td>
                    <td className="p-3 font-mono">{entry.executionTimeMs.toFixed(2)} ms</td>
                    <td className="p-3">
                      {entry.optimalityRatio ? (
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            entry.optimalityRatio === 1.0
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.optimalityRatio === 1.0
                            ? '1.00x (Baseline)'
                            : `${entry.optimalityRatio}x Cost`}
                        </span>
                      ) : (
                        <span className="text-slate-400">None</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Academic Analysis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50">
              <div className="flex items-center space-x-2 text-blue-900 font-bold text-xs uppercase tracking-wide mb-1.5">
                <Zap className="w-4 h-4 text-blue-600" />
                <span>A* Search Analysis</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Uses the evaluation function <code className="bg-blue-100 px-1 py-0.5 rounded">f(n) = g(n) + h(n)</code>.
                Because the Haversine heuristic straight-line distance is mathematically guaranteed to never overestimate
                actual road distance, it is strictly <strong>admissible</strong> and <strong>consistent</strong>.
                Guarantees the global lowest-cost trajectory.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50">
              <div className="flex items-center space-x-2 text-amber-900 font-bold text-xs uppercase tracking-wide mb-1.5">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Greedy Best-First Analysis</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Evaluates solely <code className="bg-amber-100 px-1 py-0.5 rounded">f(n) = h(n)</code>.
                Expands the node closest to the goal geographically without factoring in accumulated road edge costs.
                Often traverses fewer nodes in open space, but can produce significantly longer and suboptimal routes.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-red-200 bg-red-50/50">
              <div className="flex items-center space-x-2 text-red-900 font-bold text-xs uppercase tracking-wide mb-1.5">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span>Hill Climbing Analysis</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                Genuine local search that only selects immediate neighbors with strictly lower heuristic values.
                It maintains zero queue or backtracking. If a dead end, one-way street restriction, or road block
                causes all neighbors to have higher heuristic values, it stops immediately at the local minimum.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow transition"
          >
            Close Benchmark
          </button>
        </div>
      </div>
    </div>
  );
};

