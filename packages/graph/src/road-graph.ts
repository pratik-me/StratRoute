import {
  GraphNode,
  GraphEdge,
  RoadGraphData,
  TrafficCondition,
  OptimizationMetric,
  TRAFFIC_MULTIPLIERS,
  DEFAULT_SPEED_LIMITS_KMH,
  MAX_EFFECTIVE_SPEED_KMH,
} from '@ido/shared';
import { distanceHeuristic, travelTimeHeuristic } from './haversine.js';
import { SpatialGridIndex } from './spatial-index.js';

export class RoadGraph {
  public nodes: Map<string, GraphNode> = new Map();
  public adjacency: Map<string, GraphEdge[]> = new Map();
  public edgesById: Map<string, GraphEdge> = new Map();
  public spatialIndex: SpatialGridIndex = new SpatialGridIndex();
  public maxSpeedKmh: number = MAX_EFFECTIVE_SPEED_KMH;
  public metadata?: RoadGraphData['metadata'];

  constructor(data?: RoadGraphData) {
    if (data) {
      this.loadFromData(data);
    }
  }

  public loadFromData(data: RoadGraphData): void {
    this.nodes.clear();
    this.adjacency.clear();
    this.edgesById.clear();

    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
      this.adjacency.set(node.id, []);
    }

    let calculatedMaxSpeed = MAX_EFFECTIVE_SPEED_KMH;

    for (const edge of data.edges) {
      // Determine default base speed if not provided
      const defaultSpeed =
        DEFAULT_SPEED_LIMITS_KMH[edge.roadType] || DEFAULT_SPEED_LIMITS_KMH.road || 30;
      const speedLimit = edge.speedLimit && edge.speedLimit > 0 ? edge.speedLimit : defaultSpeed;

      const preparedEdge: GraphEdge = {
        ...edge,
        speedLimit,
        trafficMultiplier: edge.trafficMultiplier ?? 1.0,
        isBlocked: edge.isBlocked ?? false,
      };

      if (speedLimit > calculatedMaxSpeed) {
        calculatedMaxSpeed = speedLimit;
      }

      this.edgesById.set(preparedEdge.id, preparedEdge);

      let outgoing = this.adjacency.get(preparedEdge.source);
      if (!outgoing) {
        outgoing = [];
        this.adjacency.set(preparedEdge.source, outgoing);
      }
      outgoing.push(preparedEdge);
    }

    this.maxSpeedKmh = calculatedMaxSpeed;
    this.metadata = data.metadata;
    this.spatialIndex.build(this.nodes.values());
  }

  public getNode(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  public getEdge(id: string): GraphEdge | undefined {
    return this.edgesById.get(id);
  }

  public getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.adjacency.get(nodeId) || [];
  }

  /**
   * Calculates the traversal cost for an edge according to the selected metric.
   * Returns Infinity if the road is blocked or has 0 speed multiplier.
   */
  public getEdgeCost(edge: GraphEdge, metric: OptimizationMetric): number {
    if (edge.isBlocked || edge.trafficMultiplier <= 0) {
      return Infinity;
    }

    if (metric === 'distance') {
      // Shortest distance: edge cost is physical length in meters
      return edge.distance;
    } else {
      // Fastest travel time: T = (D_km / V_effective) * 3600 (seconds)
      const baseSpeed = edge.speedLimit || 30;
      const effectiveSpeedKmh = baseSpeed * edge.trafficMultiplier;

      if (effectiveSpeedKmh <= 0) {
        return Infinity;
      }

      const distanceKm = edge.distance / 1000;
      return (distanceKm / effectiveSpeedKmh) * 3600;
    }
  }

  /**
   * Calculates admissible heuristic estimate h(u, goal) according to metric.
   */
  public getHeuristic(
    uNodeId: string,
    goalNodeId: string,
    metric: OptimizationMetric
  ): number {
    const u = this.nodes.get(uNodeId);
    const goal = this.nodes.get(goalNodeId);
    if (!u || !goal) return 0;

    if (metric === 'distance') {
      return distanceHeuristic(u.lat, u.lon, goal.lat, goal.lon);
    } else {
      return travelTimeHeuristic(u.lat, u.lon, goal.lat, goal.lon, this.maxSpeedKmh);
    }
  }

  /**
   * Updates traffic condition for a specific edge.
   */
  public setEdgeTraffic(edgeId: string, condition: TrafficCondition): boolean {
    const edge = this.edgesById.get(edgeId);
    if (!edge) return false;

    if (condition === 'blocked') {
      edge.isBlocked = true;
      edge.trafficMultiplier = 0.0;
    } else {
      edge.isBlocked = false;
      edge.trafficMultiplier = TRAFFIC_MULTIPLIERS[condition];
    }
    return true;
  }

  /**
   * Resets all edges back to normal traffic and unblocks them.
   */
  public resetTraffic(): void {
    for (const edge of this.edgesById.values()) {
      edge.isBlocked = false;
      edge.trafficMultiplier = TRAFFIC_MULTIPLIERS.normal;
    }
  }

  /**
   * Snaps a geographic coordinate to the nearest road network node.
   */
  public snapToNearestNode(
    lat: number,
    lon: number,
    maxDistanceMeters: number = 10000
  ): { node: GraphNode; distanceMeters: number } | null {
    return this.spatialIndex.findNearest(lat, lon, maxDistanceMeters);
  }

  /**
   * Exports the current graph data as a JSON-serializable object.
   */
  public toJSON(): RoadGraphData {
    return {
      nodes: Array.from(this.nodes.values()),
      edges: Array.from(this.edgesById.values()),
      metadata: this.metadata,
    };
  }
}

