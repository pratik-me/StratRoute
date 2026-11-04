import { describe, it, expect, beforeEach } from 'vitest';
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

  let graph: RoadGraph;
  let optimizer: DeliveryOrderOptimizer;

  beforeEach(() => {
    graph = new RoadGraph(testGraphData);
    optimizer = new DeliveryOrderOptimizer();
  });

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
    // All pairs reachable
    expect(response.allPairsReachable).toBe(true);
    expect(response.unreachablePairs).toBeUndefined();
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
    expect(response.allPairsReachable).toBe(true);
  });

  it('detects and flags unreachable pairs — does NOT fall back to straight-line distance', () => {
    // Create a disconnected graph: Island is completely isolated
    const disconnectedGraph = new RoadGraph({
      nodes: [
        { id: 'A', lat: 28.60, lon: 77.20 },
        { id: 'B', lat: 28.61, lon: 77.21 },
        { id: 'Island', lat: 28.65, lon: 77.25 }, // no edges to/from this node
        { id: 'Dest', lat: 28.62, lon: 77.22 },
      ],
      edges: [
        { id: 'e1', source: 'A', target: 'B', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
        { id: 'e2', source: 'B', target: 'Dest', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      ],
    });

    const freshOptimizer = new DeliveryOrderOptimizer();
    const response = freshOptimizer.optimizeOrder(disconnectedGraph, {
      start: { id: 'a', nodeId: 'A', lat: 28.60, lon: 77.20 },
      stops: [
        { id: 'island', nodeId: 'Island', lat: 28.65, lon: 77.25 }, // unreachable
        { id: 'b', nodeId: 'B', lat: 28.61, lon: 77.21 },
      ],
      destination: { id: 'd', nodeId: 'Dest', lat: 28.62, lon: 77.22 },
      metric: 'distance',
    });

    // The stop must NOT be silently removed — it stays in orderedStops
    expect(response.orderedStops.map((s) => s.id)).toContain('island');
    expect(response.orderedStops.length).toBe(2);

    // The unreachable pair must be detected and flagged
    expect(response.allPairsReachable).toBe(false);
    expect(response.unreachablePairs).toBeDefined();
    expect(response.unreachablePairs!.length).toBeGreaterThan(0);
  });

  it('preserves all stops in the 2-opt optimized sequence (no silent removal)', () => {
    const response = optimizer.optimizeOrder(graph, {
      start: { id: 's', nodeId: 'S', lat: 28.60, lon: 77.20 },
      stops: [
        { id: 'b', nodeId: 'StopB', lat: 28.62, lon: 77.22 },
        { id: 'c', nodeId: 'StopC', lat: 28.63, lon: 77.23 },
        { id: 'a', nodeId: 'StopA', lat: 28.61, lon: 77.21 },
      ],
      destination: { id: 'd', nodeId: 'Dest', lat: 28.64, lon: 77.24 },
      metric: 'distance',
    });

    // orderedStops must contain exactly the same stops as input, in any order
    const inputIds = ['a', 'b', 'c'].sort();
    const outputIds = response.orderedStops.map((s) => s.id).sort();
    expect(outputIds).toEqual(inputIds);
  });

  it('handles one-way road correctly (asymmetric distances)', () => {
    // One-way graph: A -> B -> C -> Dest, but no reverse edges
    const oneWayGraph = new RoadGraph({
      nodes: [
        { id: 'A', lat: 28.60, lon: 77.20 },
        { id: 'B', lat: 28.61, lon: 77.21 },
        { id: 'C', lat: 28.62, lon: 77.22 },
        { id: 'Dest', lat: 28.63, lon: 77.23 },
      ],
      edges: [
        // One-way only
        { id: 'e1', source: 'A', target: 'B', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
        { id: 'e2', source: 'B', target: 'C', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
        { id: 'e3', source: 'C', target: 'Dest', distance: 10, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
      ],
    });

    const freshOptimizer = new DeliveryOrderOptimizer();
    const response = freshOptimizer.optimizeOrder(oneWayGraph, {
      start: { id: 'a', nodeId: 'A', lat: 28.60, lon: 77.20 },
      stops: [
        { id: 'c', nodeId: 'C', lat: 28.62, lon: 77.22 },
        { id: 'b', nodeId: 'B', lat: 28.61, lon: 77.21 },
      ],
      destination: { id: 'd', nodeId: 'Dest', lat: 28.63, lon: 77.23 },
      metric: 'distance',
    });

    // With one-way road A->B->C->Dest, the only traversable order is B then C
    // All stops must be preserved
    expect(response.orderedStops.map((s) => s.id)).toContain('b');
    expect(response.orderedStops.map((s) => s.id)).toContain('c');
    expect(response.orderedStops.length).toBe(2);
  });

  it('handles two stops that snap to the same road node', () => {
    const response = optimizer.optimizeOrder(graph, {
      start: { id: 's', nodeId: 'S', lat: 28.60, lon: 77.20 },
      stops: [
        { id: 'b1', nodeId: 'StopB', lat: 28.62, lon: 77.22 }, // same node
        { id: 'b2', nodeId: 'StopB', lat: 28.62, lon: 77.22 }, // same node
      ],
      destination: { id: 'd', nodeId: 'Dest', lat: 28.64, lon: 77.24 },
      metric: 'distance',
    });

    // Both stops must be preserved in output even if they share a node
    expect(response.orderedStops.length).toBe(2);
    expect(response.orderedStops.map((s) => s.id).sort()).toEqual(['b1', 'b2']);
  });
});
