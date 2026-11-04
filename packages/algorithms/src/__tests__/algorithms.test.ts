import { describe, it, expect } from 'vitest';
import { RoadGraph } from '@ido/graph';
import { RoadGraphData } from '@ido/shared';
import { MinPriorityQueue } from '../priority-queue.js';
import { aStarSearch } from '../astar.js';
import { greedyBestFirstSearch } from '../greedy-best-first.js';
import { hillClimbingSearch } from '../hill-climbing.js';

describe('Search Algorithms', () => {
  describe('MinPriorityQueue', () => {
    it('pops elements in ascending order of priority', () => {
      const pq = new MinPriorityQueue<string>();
      pq.push('high', 100);
      pq.push('low', 10);
      pq.push('medium', 50);

      expect(pq.pop()?.item).toBe('low');
      expect(pq.pop()?.item).toBe('medium');
      expect(pq.pop()?.item).toBe('high');
      expect(pq.isEmpty()).toBe(true);
    });
  });

  /**
   * Test Graph:
   *
   *       (Upper path: geographically closer to Goal initially, but very long road)
   *          B (lat: 28.62, lon: 77.21) --- edge_B_G (dist: 10000m) ---> Goal (28.63, 77.23)
   *        /
   *      / edge_A_B (dist: 1000m)
   * Start A (lat: 28.60, lon: 77.20)
   *      \
   *      \ edge_A_C (dist: 500m)
   *        \
   *          C (lat: 28.59, lon: 77.21) --- edge_C_G (dist: 600m) ------> Goal (28.63, 77.23)
   *       (Lower path: slightly counter-intuitive heuristic start, but much shorter total road: 1100m vs 11000m)
   */
  const trapGraphData: RoadGraphData = {
    nodes: [
      { id: 'Start', lat: 28.60, lon: 77.20 },
      { id: 'B', lat: 28.62, lon: 77.21 }, // Closer to goal in straight line
      { id: 'C', lat: 28.59, lon: 77.21 }, // Further from goal in straight line
      { id: 'Goal', lat: 28.63, lon: 77.23 },
    ],
    edges: [
      {
        id: 'e_AB',
        source: 'Start',
        target: 'B',
        distance: 1000,
        roadType: 'primary',
        trafficMultiplier: 1.0,
        isBlocked: false,
      },
      {
        id: 'e_BG',
        source: 'B',
        target: 'Goal',
        distance: 10000, // Very long road!
        roadType: 'primary',
        trafficMultiplier: 1.0,
        isBlocked: false,
      },
      {
        id: 'e_AC',
        source: 'Start',
        target: 'C',
        distance: 500,
        roadType: 'primary',
        trafficMultiplier: 1.0,
        isBlocked: false,
      },
      {
        id: 'e_CG',
        source: 'C',
        target: 'Goal',
        distance: 600, // Short road: Total A->C->Goal = 1100m
        roadType: 'primary',
        trafficMultiplier: 1.0,
        isBlocked: false,
      },
    ],
  };

  describe('A* Search', () => {
    it('finds the mathematically optimal path on weighted graphs', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = aStarSearch(graph, 'Start', 'Goal', { metric: 'distance' });

      expect(result.routeFound).toBe(true);
      expect(result.stuck).toBe(false);
      // Optimal path is Start -> C -> Goal (total cost 1100)
      expect(result.pathNodeIds).toEqual(['Start', 'C', 'Goal']);
      expect(result.totalCost).toBe(1100);
      expect(result.totalDistanceMeters).toBe(1100);
    });

    it('reroutes when an edge along the preferred path is blocked', () => {
      const graph = new RoadGraph(trapGraphData);
      // Block the optimal edge e_CG
      graph.setEdgeTraffic('e_CG', 'blocked');

      const result = aStarSearch(graph, 'Start', 'Goal', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      // Must take alternate path through B
      expect(result.pathNodeIds).toEqual(['Start', 'B', 'Goal']);
      expect(result.totalCost).toBe(11000);
    });

    it('returns failure when destination is completely unreachable', () => {
      const graph = new RoadGraph(trapGraphData);
      graph.setEdgeTraffic('e_BG', 'blocked');
      graph.setEdgeTraffic('e_CG', 'blocked');

      const result = aStarSearch(graph, 'Start', 'Goal', { metric: 'distance' });
      expect(result.routeFound).toBe(false);
      expect(result.stuck).toBe(true);
      expect(result.pathNodeIds.length).toBe(0);
    });

    it('handles one-way edges correctly', () => {
      // One-way graph: A->B->Goal, B->A does not exist
      const oneWayGraph = new RoadGraph({
        nodes: [
          { id: 'A', lat: 28.60, lon: 77.20 },
          { id: 'B', lat: 28.61, lon: 77.21 },
          { id: 'Goal', lat: 28.62, lon: 77.22 },
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
          { id: 'e2', source: 'B', target: 'Goal', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
          // No B->A edge
        ],
      });

      // Forward: A->Goal should work
      const fwd = aStarSearch(oneWayGraph, 'A', 'Goal', { metric: 'distance' });
      expect(fwd.routeFound).toBe(true);
      expect(fwd.pathNodeIds).toEqual(['A', 'B', 'Goal']);

      // Reverse: Goal->A should fail (one-way)
      const rev = aStarSearch(oneWayGraph, 'Goal', 'A', { metric: 'distance' });
      expect(rev.routeFound).toBe(false);
    });

    it('returns trivial result when start equals goal', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = aStarSearch(graph, 'Start', 'Start', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      expect(result.pathNodeIds).toEqual(['Start']);
      expect(result.totalCost).toBe(0);
    });

    it('reconstructs full path (no missing intermediate nodes)', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = aStarSearch(graph, 'Start', 'Goal', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      // Path must start at Start and end at Goal
      expect(result.pathNodeIds[0]).toBe('Start');
      expect(result.pathNodeIds[result.pathNodeIds.length - 1]).toBe('Goal');
      // Every edge's source/target must match consecutive nodes
      expect(result.pathEdgeIds.length).toBe(result.pathNodeIds.length - 1);
    });
  });

  describe('Greedy Best-First Search', () => {
    it('prioritizes solely by heuristic and demonstrates suboptimality on the trap graph', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = greedyBestFirstSearch(graph, 'Start', 'Goal', { metric: 'distance' });

      expect(result.routeFound).toBe(true);
      // Greedy looks at B vs C. B is closer to Goal in straight line, so Greedy picks B!
      expect(result.pathNodeIds).toEqual(['Start', 'B', 'Goal']);
      // Cost is 11000 (suboptimal compared to A*'s 1100)
      expect(result.totalCost).toBe(11000);
    });

    it('returns failure when all outgoing paths are blocked (no path exists)', () => {
      const graph = new RoadGraph(trapGraphData);
      graph.setEdgeTraffic('e_BG', 'blocked');
      graph.setEdgeTraffic('e_CG', 'blocked');

      const result = greedyBestFirstSearch(graph, 'Start', 'Goal', { metric: 'distance' });
      expect(result.routeFound).toBe(false);
      expect(result.stuck).toBe(true);
      expect(result.pathNodeIds.length).toBe(0);
      expect(result.failureReason).toBeDefined();
    });

    it('correctly handles one-way edges (reverse direction fails)', () => {
      const oneWayGraph = new RoadGraph({
        nodes: [
          { id: 'A', lat: 28.60, lon: 77.20 },
          { id: 'B', lat: 28.61, lon: 77.21 },
          { id: 'Goal', lat: 28.62, lon: 77.22 },
        ],
        edges: [
          { id: 'e1', source: 'A', target: 'B', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
          { id: 'e2', source: 'B', target: 'Goal', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
        ],
      });

      const fwd = greedyBestFirstSearch(oneWayGraph, 'A', 'Goal', { metric: 'distance' });
      expect(fwd.routeFound).toBe(true);

      const rev = greedyBestFirstSearch(oneWayGraph, 'Goal', 'A', { metric: 'distance' });
      expect(rev.routeFound).toBe(false);
    });

    it('does not visit the same node twice (prevents infinite loops)', () => {
      // Graph with a cycle: A -> B -> A -> ... but Goal is reachable via C
      const cycleGraph = new RoadGraph({
        nodes: [
          { id: 'A', lat: 28.60, lon: 77.20 },
          { id: 'B', lat: 28.61, lon: 77.21 },
          { id: 'Goal', lat: 28.63, lon: 77.23 },
        ],
        edges: [
          { id: 'eAB', source: 'A', target: 'B', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
          { id: 'eBA', source: 'B', target: 'A', distance: 100, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
          { id: 'eBG', source: 'B', target: 'Goal', distance: 200, roadType: 'primary', trafficMultiplier: 1, isBlocked: false },
        ],
      });

      const result = greedyBestFirstSearch(cycleGraph, 'A', 'Goal', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      // Must terminate without infinite loop
      expect(result.nodesExplored).toBeLessThan(1000);
    });
  });

  describe('Hill Climbing Local Search', () => {
    it('takes strictly improving steps towards goal', () => {
      // Linear graph where each step gets closer
      const linearGraph: RoadGraphData = {
        nodes: [
          { id: '1', lat: 28.60, lon: 77.20 },
          { id: '2', lat: 28.61, lon: 77.21 },
          { id: '3', lat: 28.62, lon: 77.22 },
        ],
        edges: [
          { id: 'e12', source: '1', target: '2', distance: 100, roadType: 'residential', trafficMultiplier: 1, isBlocked: false },
          { id: 'e23', source: '2', target: '3', distance: 100, roadType: 'residential', trafficMultiplier: 1, isBlocked: false },
        ],
      };

      const graph = new RoadGraph(linearGraph);
      const result = hillClimbingSearch(graph, '1', '3', { metric: 'distance' });

      expect(result.routeFound).toBe(true);
      expect(result.stuck).toBe(false);
      expect(result.pathNodeIds).toEqual(['1', '2', '3']);
    });

    it('gets stuck and reports failure at local minima (does NOT fake A* or BFS)', () => {
      // Graph with a dead-end or local minimum:
      // Start is at 28.60, 77.20
      // Goal is at 28.63, 77.23
      // Outgoing edges lead to node X (which is geographically further away: 28.58, 77.19)
      // Because h(X) > h(Start), Hill Climbing refuses to step backwards and gets stuck!
      const culDeSacGraph: RoadGraphData = {
        nodes: [
          { id: 'Start', lat: 28.60, lon: 77.20 },
          { id: 'Detour', lat: 28.58, lon: 77.18 }, // Further from Goal!
          { id: 'Goal', lat: 28.63, lon: 77.23 },
        ],
        edges: [
          { id: 'e1', source: 'Start', target: 'Detour', distance: 500, roadType: 'residential', trafficMultiplier: 1, isBlocked: false },
          { id: 'e2', source: 'Detour', target: 'Goal', distance: 800, roadType: 'residential', trafficMultiplier: 1, isBlocked: false },
        ],
      };

      const graph = new RoadGraph(culDeSacGraph);
      const result = hillClimbingSearch(graph, 'Start', 'Goal', { metric: 'distance' });

      expect(result.routeFound).toBe(false);
      expect(result.stuck).toBe(true);
      expect(result.failureReason).toBeDefined();
      expect(result.failureReason).toContain('Local minimum');
    });

    it('reports dead-end when no traversable neighbors exist', () => {
      const deadEndGraph: RoadGraphData = {
        nodes: [
          { id: 'Start', lat: 28.60, lon: 77.20 },
          { id: 'Dead', lat: 28.61, lon: 77.21 }, // no outgoing edges
          { id: 'Goal', lat: 28.62, lon: 77.22 },
        ],
        edges: [
          { id: 'e1', source: 'Start', target: 'Dead', distance: 100, roadType: 'residential', trafficMultiplier: 1, isBlocked: false },
          // Dead has no outgoing edges!
        ],
      };

      const graph = new RoadGraph(deadEndGraph);
      const result = hillClimbingSearch(graph, 'Start', 'Goal', { metric: 'distance' });

      expect(result.routeFound).toBe(false);
      expect(result.stuck).toBe(true);
      expect(result.failureReason).toBeDefined();
    });

    it('does not falsely report success when goal was never reached', () => {
      // Ensure routeFound and stuck are always consistent
      const disconnectedGraph = new RoadGraph({
        nodes: [
          { id: 'A', lat: 28.60, lon: 77.20 },
          { id: 'B', lat: 28.61, lon: 77.21 }, // isolated
        ],
        edges: [], // no edges at all
      });

      const result = hillClimbingSearch(disconnectedGraph, 'A', 'B', { metric: 'distance' });
      expect(result.routeFound).toBe(false);
      // routeFound=false implies stuck=true
      expect(result.stuck).toBe(true);
    });

    it('returns trivial success when start equals goal', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = hillClimbingSearch(graph, 'Start', 'Start', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      expect(result.stuck).toBe(false);
      expect(result.pathNodeIds).toEqual(['Start']);
    });

    it('correctly reports failure when all neighbors are blocked (dead-end via traffic)', () => {
      const graph = new RoadGraph(trapGraphData);
      // Block all edges from Start
      graph.setEdgeTraffic('e_AB', 'blocked');
      graph.setEdgeTraffic('e_AC', 'blocked');

      const result = hillClimbingSearch(graph, 'Start', 'Goal', { metric: 'distance' });
      expect(result.routeFound).toBe(false);
      expect(result.stuck).toBe(true);
      expect(result.failureReason).toBeDefined();
      expect(result.failureReason).toContain('Dead end');
    });
  });

  describe('Multi-leg route correctness (all algorithms)', () => {
    /**
     * Verifies that each algorithm handles the case where two waypoints snap to the same node.
     * The leg should report success with distance 0 and a single-node path.
     */
    it('A*: trivial leg (start node = goal node) has cost 0', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = aStarSearch(graph, 'Start', 'Start', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      expect(result.totalCost).toBe(0);
      expect(result.totalDistanceMeters).toBe(0);
    });

    it('Greedy: trivial leg (start node = goal node) has cost 0', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = greedyBestFirstSearch(graph, 'Start', 'Start', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      expect(result.totalCost).toBe(0);
    });

    it('Hill Climbing: trivial leg (start node = goal node) has cost 0', () => {
      const graph = new RoadGraph(trapGraphData);
      const result = hillClimbingSearch(graph, 'Start', 'Start', { metric: 'distance' });
      expect(result.routeFound).toBe(true);
      expect(result.totalCost).toBe(0);
    });
  });
});
