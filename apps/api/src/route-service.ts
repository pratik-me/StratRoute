import { RoadGraph } from '@ido/graph';
import { aStarSearch, greedyBestFirstSearch, hillClimbingSearch } from '@ido/algorithms';
import { DeliveryOrderOptimizer } from '@ido/optimizer';
import {
  AlgorithmType,
  OptimizationMetric,
  WaypointInfo,
  RouteLeg,
  FullRouteResult,
  AlgorithmComparisonResponse,
  AlgorithmComparisonEntry,
  DeliveryWaypointInput,
  SearchResult,
} from '@ido/shared';

const optimizer = new DeliveryOrderOptimizer();

export class RouteService {
  /**
   * Resolves and snaps waypoint input to a valid graph node.
   */
  public static resolveWaypoint(
    graph: RoadGraph,
    input: DeliveryWaypointInput,
    type: 'start' | 'stop' | 'destination',
    index: number
  ): WaypointInfo {
    let nodeId = input.nodeId;
    let lat = input.lat;
    let lon = input.lon;
    let name = input.name;

    if (!nodeId || !graph.getNode(nodeId)) {
      const snapped = graph.snapToNearestNode(input.lat, input.lon);
      if (snapped) {
        nodeId = snapped.node.id;
        lat = snapped.node.lat;
        lon = snapped.node.lon;
        name = name || snapped.node.name || `Node ${nodeId}`;
      } else {
        const firstNode = graph.nodes.values().next().value;
        nodeId = firstNode ? firstNode.id : 'unknown';
        lat = firstNode ? firstNode.lat : lat;
        lon = firstNode ? firstNode.lon : lon;
        name = name || `Node ${nodeId}`;
      }
    } else {
      const nodeObj = graph.getNode(nodeId)!;
      name = name || nodeObj.name || `Node ${nodeId}`;
      lat = nodeObj.lat;
      lon = nodeObj.lon;
    }

    return {
      id: input.id,
      name: name || `Waypoint ${index}`,
      lat,
      lon,
      nodeId,
      type,
      index,
    };
  }

  /**
   * Calculates a complete multi-leg route across ordered waypoints using the specified algorithm.
   */
  public static calculateRoute(
    graph: RoadGraph,
    orderedWaypoints: WaypointInfo[],
    algorithm: AlgorithmType,
    metric: OptimizationMetric,
    collectSteps: boolean = false
  ): FullRouteResult {
    const legs: RouteLeg[] = [];
    const fullCoordinates: [number, number][] = [];

    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;
    let totalCost = 0;
    let totalNodesExplored = 0;
    let totalExecutionTimeMs = 0;
    let overallSuccess = true;
    let overallStuck = false;

    for (let i = 0; i < orderedWaypoints.length - 1; i++) {
      const fromWp = orderedWaypoints[i];
      const toWp = orderedWaypoints[i + 1];

      let legResult: SearchResult;
      if (algorithm === 'astar') {
        legResult = aStarSearch(graph, fromWp.nodeId, toWp.nodeId, { metric, collectSteps });
      } else if (algorithm === 'greedy') {
        legResult = greedyBestFirstSearch(graph, fromWp.nodeId, toWp.nodeId, { metric, collectSteps });
      } else {
        legResult = hillClimbingSearch(graph, fromWp.nodeId, toWp.nodeId, { metric, collectSteps });
      }

      totalDistanceMeters += legResult.totalDistanceMeters;
      totalDurationSeconds += legResult.totalDurationSeconds;
      totalCost += legResult.totalCost;
      totalNodesExplored += legResult.nodesExplored;
      totalExecutionTimeMs += legResult.executionTimeMs;

      if (!legResult.routeFound) {
        overallSuccess = false;
      }
      if (legResult.stuck) {
        overallStuck = true;
      }

      // Append leg coordinates
      for (const pt of legResult.pathCoordinates) {
        if (
          fullCoordinates.length === 0 ||
          fullCoordinates[fullCoordinates.length - 1][0] !== pt[0] ||
          fullCoordinates[fullCoordinates.length - 1][1] !== pt[1]
        ) {
          fullCoordinates.push(pt);
        }
      }

      legs.push({
        legIndex: i,
        fromNodeId: fromWp.nodeId,
        toNodeId: toWp.nodeId,
        fromName: fromWp.name,
        toName: toWp.name,
        distanceMeters: legResult.totalDistanceMeters,
        durationSeconds: legResult.totalDurationSeconds,
        cost: legResult.totalCost,
        pathCoordinates: legResult.pathCoordinates,
        pathNodeIds: legResult.pathNodeIds,
        pathEdgeIds: legResult.pathEdgeIds,
        nodesExplored: legResult.nodesExplored,
        executionTimeMs: legResult.executionTimeMs,
        searchResult: legResult,
      });
    }

    return {
      algorithm,
      metric,
      success: overallSuccess,
      stuck: overallStuck,
      totalDistanceMeters,
      totalDurationSeconds,
      totalCost,
      totalNodesExplored,
      totalExecutionTimeMs,
      orderedWaypoints,
      legs,
      fullCoordinates,
    };
  }

  /**
   * Prepares ordered waypoints: runs delivery order optimizer on intermediate stops if requested.
   */
  public static prepareOrderedWaypoints(
    graph: RoadGraph,
    startInput: DeliveryWaypointInput,
    stopsInput: DeliveryWaypointInput[],
    destInput: DeliveryWaypointInput,
    autoOptimize: boolean,
    metric: OptimizationMetric
  ): WaypointInfo[] {
    const resolvedStart = this.resolveWaypoint(graph, startInput, 'start', 0);
    const resolvedDest = this.resolveWaypoint(graph, destInput, 'destination', stopsInput.length + 1);

    let intermediateStops: WaypointInfo[] = [];

    if (stopsInput.length === 0) {
      return [resolvedStart, resolvedDest];
    }

    if (autoOptimize && stopsInput.length > 1) {
      const optResult = optimizer.optimizeOrder(
        graph,
        {
          start: resolvedStart,
          stops: stopsInput,
          destination: resolvedDest,
          metric,
        }
      );

      intermediateStops = optResult.orderedStops.map((s, idx) =>
        this.resolveWaypoint(graph, s, 'stop', idx + 1)
      );
    } else {
      intermediateStops = stopsInput.map((s, idx) =>
        this.resolveWaypoint(graph, s, 'stop', idx + 1)
      );
    }

    return [resolvedStart, ...intermediateStops, resolvedDest];
  }

  /**
   * Compares all three algorithms under identical conditions.
   */
  public static compareAlgorithms(
    graph: RoadGraph,
    startInput: DeliveryWaypointInput,
    stopsInput: DeliveryWaypointInput[],
    destInput: DeliveryWaypointInput,
    metric: OptimizationMetric,
    autoOptimize: boolean
  ): AlgorithmComparisonResponse {
    const orderedWaypoints = this.prepareOrderedWaypoints(
      graph,
      startInput,
      stopsInput,
      destInput,
      autoOptimize,
      metric
    );

    const astarResult = this.calculateRoute(graph, orderedWaypoints, 'astar', metric, false);
    const greedyResult = this.calculateRoute(graph, orderedWaypoints, 'greedy', metric, false);
    const hillClimbingResult = this.calculateRoute(graph, orderedWaypoints, 'hillclimbing', metric, false);

    const optimalCost = astarResult.success && astarResult.totalCost > 0 ? astarResult.totalCost : null;

    const comparison: AlgorithmComparisonEntry[] = [
      {
        algorithm: 'astar',
        name: 'A* Search',
        success: astarResult.success,
        stuck: astarResult.stuck,
        totalDistanceMeters: astarResult.totalDistanceMeters,
        totalDurationSeconds: astarResult.totalDurationSeconds,
        totalCost: astarResult.totalCost,
        nodesExplored: astarResult.totalNodesExplored,
        executionTimeMs: astarResult.totalExecutionTimeMs,
        optimalityRatio: 1.0,
        remarks: 'Guaranteed optimal path via admissible Haversine heuristic (f = g + h).',
      },
      {
        algorithm: 'greedy',
        name: 'Greedy Best-First Search',
        success: greedyResult.success,
        stuck: greedyResult.stuck,
        totalDistanceMeters: greedyResult.totalDistanceMeters,
        totalDurationSeconds: greedyResult.totalDurationSeconds,
        totalCost: greedyResult.totalCost,
        nodesExplored: greedyResult.totalNodesExplored,
        executionTimeMs: greedyResult.totalExecutionTimeMs,
        optimalityRatio:
          optimalCost && greedyResult.totalCost > 0
            ? Number((greedyResult.totalCost / optimalCost).toFixed(2))
            : undefined,
        remarks:
          greedyResult.totalCost > (optimalCost || 0)
            ? `Suboptimal path (f = h only, ignores road costs). ${Number(((greedyResult.totalCost / (optimalCost || 1) - 1) * 100).toFixed(1))}% longer than A*.`
            : 'Found destination quickly; ignores accumulated path cost.',
      },
      {
        algorithm: 'hillclimbing',
        name: 'Hill Climbing Local Search',
        success: hillClimbingResult.success,
        stuck: hillClimbingResult.stuck,
        totalDistanceMeters: hillClimbingResult.totalDistanceMeters,
        totalDurationSeconds: hillClimbingResult.totalDurationSeconds,
        totalCost: hillClimbingResult.totalCost,
        nodesExplored: hillClimbingResult.totalNodesExplored,
        executionTimeMs: hillClimbingResult.totalExecutionTimeMs,
        optimalityRatio:
          optimalCost && hillClimbingResult.success && hillClimbingResult.totalCost > 0
            ? Number((hillClimbingResult.totalCost / optimalCost).toFixed(2))
            : undefined,
        remarks: hillClimbingResult.stuck
          ? 'Stuck at local minimum or dead end (no unvisited neighbor improves heuristic distance).'
          : 'Reached goal via steepest local descent.',
      },
    ];

    return {
      metric,
      orderedWaypoints,
      results: {
        astar: astarResult,
        greedy: greedyResult,
        hillclimbing: hillClimbingResult,
      },
      comparison,
    };
  }
}

