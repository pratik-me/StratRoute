import { describe, it, expect } from 'vitest';
import { RoadGraph } from '../road-graph.js';
import { haversineDistanceMeters, distanceHeuristic, travelTimeHeuristic } from '../haversine.js';
import { RoadGraphData } from '@ido/shared';

describe('Graph and Heuristics', () => {
  describe('Haversine Formula', () => {
    it('calculates 0 meters for identical points', () => {
      const d = haversineDistanceMeters(28.6139, 77.2090, 28.6139, 77.2090);
      expect(d).toBeCloseTo(0, 4);
    });

    it('calculates accurate distance between known Delhi landmarks', () => {
      // Connaught Place (28.6328, 77.2167) to India Gate (28.6129, 77.2295)
      // Actual straight-line distance is ~2.5 km (2400-2600 meters)
      const d = haversineDistanceMeters(28.6328, 77.2167, 28.6129, 77.2295);
      expect(d).toBeGreaterThan(2400);
      expect(d).toBeLessThan(2600);
    });

    it('distance heuristic is strictly non-negative and symmetric', () => {
      const h1 = distanceHeuristic(28.6328, 77.2167, 28.6129, 77.2295);
      const h2 = distanceHeuristic(28.6129, 77.2295, 28.6328, 77.2167);
      expect(h1).toBeGreaterThan(0);
      expect(h1).toBeCloseTo(h2, 4);
    });

    it('travel time heuristic uses max speed upper bound to remain strictly admissible', () => {
      const distMeters = distanceHeuristic(28.6328, 77.2167, 28.6129, 77.2295);
      const timeSec = travelTimeHeuristic(28.6328, 77.2167, 28.6129, 77.2295, 80);
      // t = (dist / 1000) / 80 * 3600
      const expectedTimeSec = (distMeters / 1000 / 80) * 3600;
      expect(timeSec).toBeCloseTo(expectedTimeSec, 4);
    });
  });

  describe('Road Graph Structure', () => {
    it('preserves directed edges and one-way streets without creating reverse edges', () => {
      const testData: RoadGraphData = {
        nodes: [
          { id: 'A', lat: 28.60, lon: 77.20 },
          { id: 'B', lat: 28.61, lon: 77.21 },
        ],
        edges: [
          {
            id: 'e1',
            source: 'A',
            target: 'B',
            distance: 1000,
            roadType: 'primary',
            trafficMultiplier: 1.0,
            isBlocked: false,
          },
        ],
      };

      const graph = new RoadGraph(testData);
      const outgoingA = graph.getOutgoingEdges('A');
      const outgoingB = graph.getOutgoingEdges('B');

      expect(outgoingA.length).toBe(1);
      expect(outgoingA[0].id).toBe('e1');
      // No automatic reverse edge
      expect(outgoingB.length).toBe(0);
    });

    it('preserves parallel edges between the same pair of nodes', () => {
      const testData: RoadGraphData = {
        nodes: [
          { id: 'A', lat: 28.60, lon: 77.20 },
          { id: 'B', lat: 28.61, lon: 77.21 },
        ],
        edges: [
          {
            id: 'edge_main',
            source: 'A',
            target: 'B',
            distance: 1200,
            roadType: 'primary',
            trafficMultiplier: 1.0,
            isBlocked: false,
          },
          {
            id: 'edge_flyover',
            source: 'A',
            target: 'B',
            distance: 1000,
            roadType: 'trunk',
            trafficMultiplier: 1.0,
            isBlocked: false,
          },
        ],
      };

      const graph = new RoadGraph(testData);
      const outgoingA = graph.getOutgoingEdges('A');
      expect(outgoingA.length).toBe(2);
      expect(outgoingA.map((e) => e.id)).toEqual(['edge_main', 'edge_flyover']);
    });

    it('handles blocked edges and traffic updates without modifying physical distance', () => {
      const testData: RoadGraphData = {
        nodes: [
          { id: 'A', lat: 28.60, lon: 77.20 },
          { id: 'B', lat: 28.61, lon: 77.21 },
        ],
        edges: [
          {
            id: 'e1',
            source: 'A',
            target: 'B',
            distance: 1000,
            roadType: 'secondary',
            speedLimit: 40,
            trafficMultiplier: 1.0,
            isBlocked: false,
          },
        ],
      };

      const graph = new RoadGraph(testData);
      const edge = graph.getEdge('e1')!;

      // Normal cost
      const initialCost = graph.getEdgeCost(edge, 'time');
      // 1 km at 40 km/h = 90 seconds
      expect(initialCost).toBeCloseTo(90, 1);

      // Set heavy traffic (0.4 multiplier)
      graph.setEdgeTraffic('e1', 'heavy');
      expect(edge.trafficMultiplier).toBe(0.4);
      expect(edge.distance).toBe(1000); // Physical length remains untouched!

      const heavyCost = graph.getEdgeCost(edge, 'time');
      // 1 km at 16 km/h = 225 seconds
      expect(heavyCost).toBeCloseTo(225, 1);

      // Block road
      graph.setEdgeTraffic('e1', 'blocked');
      expect(graph.getEdgeCost(edge, 'time')).toBe(Infinity);
      expect(graph.getEdgeCost(edge, 'distance')).toBe(Infinity);

      // Reset traffic
      graph.resetTraffic();
      expect(graph.getEdgeCost(edge, 'time')).toBeCloseTo(90, 1);
    });

    it('spatial index correctly snaps coordinates to nearest road node', () => {
      const testData: RoadGraphData = {
        nodes: [
          { id: 'N1', lat: 28.6300, lon: 77.2100 },
          { id: 'N2', lat: 28.6400, lon: 77.2200 },
          { id: 'N3', lat: 28.6500, lon: 77.2300 },
        ],
        edges: [],
      };

      const graph = new RoadGraph(testData);
      const snapped = graph.snapToNearestNode(28.6302, 77.2101);
      expect(snapped).not.toBeNull();
      expect(snapped?.node.id).toBe('N1');
    });
  });
});

