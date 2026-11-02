import { describe, it, expect } from 'vitest';
import { RoadGraph } from '@ido/graph';
import { RoadGraphData } from '@ido/shared';
import { DeliveryOrderOptimizer } from '../delivery-optimizer.js';

describe('Delivery Order Optimizer', () => {
  /**
   * Linear metric space:
   * S (0) -> StopA (10) -> StopB (20) -> StopC (30) -> Dest (40)
   * If stops are provided out of order: [StopC, StopA, StopB]
   * Initial out-of-order sequence cost: S(0) -> C(30) -> A(10) -> B(20) -> D(40) = 30 + 20 + 10 + 20 = 80
   * Optimal sequence: S(0) -> A(10) -> B(20) -> C(30) -> D(40) = 40
   */
  const testGraphData: RoadGraphData = {
    nodes: [
      { id: 'S', lat: 28.60, lon: 77.20 },
      { id: 'StopA', lat: 28.61, lon: 77.21 },
      { id: 'StopB', lat: 28.62, lon: 77.22 },
      { id: 'StopC', lat: 28.63, lon: 77.23 },
      { id: 'Dest', lat: 28.64, lon: 77.24 },
    ],
    edges: [
      // Bidirectional edges along the chain
      { id: 'e1', source: 'S', target: 'StopA', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      { id: 'e1r', source: 'StopA', target: 'S', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      { id: 'e2', source: 'StopA', target: 'StopB', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      { id: 'e2r', source: 'StopB', target: 'StopA', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      { id: 'e3', source: 'StopB', target: 'StopC', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      { id: 'e3r', source: 'StopC', target: 'StopB', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      { id: 'e4', source: 'StopC', target: 'Dest', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      { id: 'e4r', source: 'Dest', target: 'StopC', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
    ],
  };

  const graph = new RoadGraph(testGraphData);
  const optimizer = new DeliveryOrderOptimizer();

  it('keeps start and final destination fixed while reordering intermediate stops', () => {
    const response = optimizer.optimizeOrder(graph, {
      start: { id: 's', nodeId: 'S', lat: 28.60, lon: 77.20 },
      stops: [
        { id: 'c', nodeId: 'StopC', lat: 28.63, lon: 77.23 },
        { id: 'a', nodeId: 'StopA', lat: 28.61, lon: 77.21 },
        { id: 'b', nodeId: 'StopB', lat: 28.62, lon: 77.22 },
      ],
      destination: { id: 'd', nodeId: 'Dest', lat: 28.64, lon: 77.24 },
      metric: 'distance',
    });

    // Output order should be a -> b -> c
    expect(response.optimizedOrder).toEqual(['a', 'b', 'c']);
    // Optimal cost is 10 + 10 + 10 + 10 = 40
    expect(response.optimizedCost).toBe(40);
    // Never duplicates or drops any stop
    expect(response.orderedStops.map((s) => s.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('handles single stop without error', () => {
    const response = optimizer.optimizeOrder(graph, {
      start: { id: 's', nodeId: 'S', lat: 28.60, lon: 77.20 },
      stops: [{ id: 'b', nodeId: 'StopB', lat: 28.62, lon: 77.22 }],
      destination: { id: 'd', nodeId: 'Dest', lat: 28.64, lon: 77.24 },
      metric: 'distance',
    });

    expect(response.optimizedOrder).toEqual(['b']);
    expect(response.optimizedCost).toBe(40);
  });
});

