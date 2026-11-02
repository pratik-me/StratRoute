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
  });
});

