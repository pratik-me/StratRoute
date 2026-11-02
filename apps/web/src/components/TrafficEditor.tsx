'use client';

import React from 'react';
import { GraphEdge, TrafficCondition } from '@ido/shared';
import { AlertTriangle, CheckCircle, ShieldAlert, XCircle, RotateCcw } from 'lucide-react';

interface TrafficEditorProps {
  selectedEdge: GraphEdge | null;
  onUpdateTraffic: (edgeId: string, condition: TrafficCondition) => void;
  onResetAllTraffic: () => void;
  onClose: () => void;
}

export const TrafficEditor: React.FC<TrafficEditorProps> = ({
  selectedEdge,
  onUpdateTraffic,
  onResetAllTraffic,
  onClose,
}) => {
  if (!selectedEdge) return null;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-md shadow-2xl rounded-xl border border-slate-200 p-4 z-20 w-[95%] max-w-xl">
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <h3 className="font-semibold text-slate-800 text-sm">
            Road Traffic Simulation: <span className="text-blue-700">{selectedEdge.roadName || 'Road Segment'}</span>
          </h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-sm font-bold px-2 py-0.5 rounded"
        >
          ✕
        </button>
      </div>

      <div className="text-xs text-slate-600 mb-3 grid grid-cols-4 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
        <div>
          <span className="text-slate-400 block">Road Type</span>
          <span className="font-medium capitalize">{selectedEdge.roadType}</span>
        </div>
        <div>
          <span className="text-slate-400 block">Length</span>
          <span className="font-medium">{selectedEdge.distance} m</span>
        </div>
        <div>
          <span className="text-slate-400 block">Base Speed</span>
          <span className="font-medium">{selectedEdge.speedLimit || 30} km/h</span>
        </div>
        <div>
          <span className="text-slate-400 block">Current Status</span>
          <span
            className={`font-semibold capitalize ${
              selectedEdge.isBlocked
                ? 'text-red-600'
                : selectedEdge.trafficMultiplier === 0.4
                ? 'text-orange-600'
                : selectedEdge.trafficMultiplier === 0.75
                ? 'text-yellow-600'
                : 'text-emerald-600'
            }`}
          >
            {selectedEdge.isBlocked ? 'Blocked' : selectedEdge.trafficMultiplier === 0.4 ? 'Heavy' : selectedEdge.trafficMultiplier === 0.75 ? 'Moderate' : 'Normal'}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-1.5 flex-1">
          <button
            onClick={() => onUpdateTraffic(selectedEdge.id, 'normal')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${
              !selectedEdge.isBlocked && selectedEdge.trafficMultiplier === 1.0
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Normal (1.0x)</span>
          </button>

          <button
            onClick={() => onUpdateTraffic(selectedEdge.id, 'moderate')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${
              !selectedEdge.isBlocked && selectedEdge.trafficMultiplier === 0.75
                ? 'bg-yellow-500 text-white border-yellow-500 shadow-sm'
                : 'bg-yellow-50 text-yellow-800 border-yellow-200 hover:bg-yellow-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Moderate (0.75x)</span>
          </button>

          <button
            onClick={() => onUpdateTraffic(selectedEdge.id, 'heavy')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${
              !selectedEdge.isBlocked && selectedEdge.trafficMultiplier === 0.4
                ? 'bg-orange-500 text-white border-orange-500 shadow-sm'
                : 'bg-orange-50 text-orange-800 border-orange-200 hover:bg-orange-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Heavy (0.4x)</span>
          </button>

          <button
            onClick={() => onUpdateTraffic(selectedEdge.id, 'blocked')}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1 transition-all ${
              selectedEdge.isBlocked
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-red-50 text-red-800 border-red-200 hover:bg-red-100'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Block Road</span>
          </button>
        </div>

        <button
          onClick={onResetAllTraffic}
          className="py-1.5 px-2.5 rounded-lg text-xs font-medium border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 flex items-center space-x-1"
          title="Reset all modified road traffic to normal"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset All</span>
        </button>
      </div>
    </div>
  );
};

