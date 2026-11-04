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

/** Maximum snapping distance in meters. Beyond this the waypoint is considered dangerously far. */
const MAX_SNAP_WARNING_METERS = 500;

const optimizer = new DeliveryOrderOptimizer();

/**
 * Deduplicates consecutive identical coordinate pairs.
 */
function appendCoord(arr: [number, number][], pt: [number, number]): void {
  if (arr.length === 0 || arr[arr.length - 1][0] !== pt[0] || arr[arr.length - 1][1] !== pt[1]) {
    arr.push(pt);
  }
}

export class RouteService {
  /**
   * Resolves and snaps a waypoint input to a valid graph node.
   * Logs a warning when the snap distance exceeds MAX_SNAP_WARNING_METERS.
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
    let snapDistanceMeters = 0;

    if (!nodeId || !graph.getNode(nodeId)) {
      const snapped = graph.snapToNearestNode(input.lat, input.lon, 100000);
      if (snapped) {
        nodeId = snapped.node.id;
        snapDistanceMeters = snapped.distanceMeters;
        name = name || snapped.node.name || `Node ${nodeId}`;
        if (snapDistanceMeters > MAX_SNAP_WARNING_METERS) {
          console.warn(
            `[RouteService] Waypoint "${name ?? input.id}" (${type} #${index}) ` +
            `snapped to road node ${nodeId} which is ${snapDistanceMeters.toFixed(0)}m away ` +
            `(> ${MAX_SNAP_WARNING_METERS}m warning threshold). ` +
            `This may produce long access-connector segments on the map.`
          );
        } else {
          console.debug(
            `[RouteService] Waypoint "${name ?? input.id}" (${type} #${index}) ` +
            `snapped to road node ${nodeId} (${snapDistanceMeters.toFixed(0)}m).`
          );
        }
      } else {
        // Absolute fallback – graph is empty or spatial index is broken
        const firstNode = graph.nodes.values().next().value;
        nodeId = firstNode ? firstNode.id : 'unknown';
        name = name || `Node ${nodeId}`;
        console.error(
          `[RouteService] Could not snap waypoint "${name}" to any road node. ` +
          `Falling back to first graph node "${nodeId}". Route results will be unreliable.`
        );
      }
    } else {
      const nodeObj = graph.getNode(nodeId)!;
      name = name || nodeObj.name || `Node ${nodeId}`;
    }

    // Keep user-supplied coordinates for the marker position; only use node coords as fallback
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      const fallbackNode = graph.getNode(nodeId);
      if (fallbackNode) {
        lat = fallbackNode.lat;
        lon = fallbackNode.lon;
      }
    }

    console.debug(`[RouteService] Resolved waypoint "${name}" (${type} #${index})`, {
      userCoords: { lat: input.lat, lon: input.lon },
      nodeId,
      snapDistanceMeters: snapDistanceMeters.toFixed(0),
    });

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

  public static calculateRoute(
    graph: RoadGraph,
    orderedWaypoints: WaypointInfo[],
    algorithm: AlgorithmType,
    metric: OptimizationMetric,
    collectSteps: boolean = false
  ): FullRouteResult {
    console.debug(`[RouteService] calculateRoute: algorithm=${algorithm}, metric=${metric}, waypoints=${orderedWaypoints.length}`);
    console.debug('[RouteService] Ordered waypoints:', orderedWaypoints.map((w, i) => `[${i}] ${w.name} (nodeId=${w.nodeId}, lat=${w.lat.toFixed(5)}, lon=${w.lon.toFixed(5)})`));

    const legs: RouteLeg[] = [];
    // Only successful leg coordinates get appended here
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

      console.debug(`[RouteService] Leg ${i}: "${fromWp.name}" (${fromWp.nodeId}) → "${toWp.name}" (${toWp.nodeId})`);

      // Validate both nodes exist before calling pathfinder
      if (!graph.getNode(fromWp.nodeId) || !graph.getNode(toWp.nodeId)) {
        const reason =
          !graph.getNode(fromWp.nodeId)
            ? `Start node "${fromWp.nodeId}" not found in road graph`
            : `End node "${toWp.nodeId}" not found in road graph`;
        console.error(`[RouteService] Leg ${i} aborted: ${reason}`);

        const failedLeg: RouteLeg = {
          legIndex: i,
          fromNodeId: fromWp.nodeId,
          toNodeId: toWp.nodeId,
          fromName: fromWp.name,
          toName: toWp.name,
          distanceMeters: 0,
          durationSeconds: 0,
          cost: 0,
          pathCoordinates: [],
          legCoordinates: [],
          pathNodeIds: [],
          pathEdgeIds: [],
          nodesExplored: 0,
          executionTimeMs: 0,
          searchResult: {
            algorithm,
            routeFound: false,
            stuck: true,
            failureReason: reason,
            nodesExplored: 0,
            executionTimeMs: 0,
            totalCost: 0,
            totalDistanceMeters: 0,
            totalDurationSeconds: 0,
            pathNodeIds: [],
            pathEdgeIds: [],
            pathCoordinates: [],
          },
        };
        legs.push(failedLeg);
        overallSuccess = false;
        overallStuck = true;
        continue; // Do NOT stop — process remaining legs
      }

      // Run the pathfinding algorithm
      let legResult: SearchResult;
      if (algorithm === 'astar') {
        legResult = aStarSearch(graph, fromWp.nodeId, toWp.nodeId, { metric, collectSteps });
      } else if (algorithm === 'greedy') {
        legResult = greedyBestFirstSearch(graph, fromWp.nodeId, toWp.nodeId, { metric, collectSteps });
      } else {
        legResult = hillClimbingSearch(graph, fromWp.nodeId, toWp.nodeId, { metric, collectSteps });
      }

      console.debug(`[RouteService] Leg ${i} result: routeFound=${legResult.routeFound}, stuck=${legResult.stuck}, nodesExplored=${legResult.nodesExplored}, distanceMeters=${legResult.totalDistanceMeters.toFixed(0)}`);

      if (!legResult.routeFound) {
        // Explicit failure — do NOT merge partial coordinates into fullCoordinates
        console.warn(
          `[RouteService] Leg ${i} FAILED (${algorithm}): "${fromWp.name}" → "${toWp.name}". ` +
          `Reason: ${legResult.failureReason ?? 'unknown'}`
        );
        overallSuccess = false;
      }
      if (legResult.stuck) {
        overallStuck = true;
      }

      // Accumulate metrics for successful legs only for overall totals
      if (legResult.routeFound) {
        totalDistanceMeters += legResult.totalDistanceMeters;
        totalDurationSeconds += legResult.totalDurationSeconds;
        totalCost += legResult.totalCost;
      }
      totalNodesExplored += legResult.nodesExplored;
      totalExecutionTimeMs += legResult.executionTimeMs;

      // Build per-leg rendering coordinates:
      //   [fromWaypoint exact position] → snapped-start → road path → snapped-end → [toWaypoint exact position]
      // This structure is applied to every leg (not just first/last) so every intermediate
      // delivery marker is visually connected to the road network.
      const legCoordinates: [number, number][] = [];

      if (legResult.routeFound && legResult.pathCoordinates.length > 0) {
        const roadPath = legResult.pathCoordinates; // [lon, lat] pairs

        // 1. Access connector: fromWaypoint user position → first road node
        const fromWpCoord: [number, number] = [fromWp.lon, fromWp.lat];
        const roadStart = roadPath[0];
        if (roadStart[0] !== fromWpCoord[0] || roadStart[1] !== fromWpCoord[1]) {
          appendCoord(legCoordinates, fromWpCoord); // exact marker position
        }

        // 2. Road network path
        for (const pt of roadPath) {
          appendCoord(legCoordinates, pt);
        }

        // 3. Access connector: last road node → toWaypoint user position
        const toWpCoord: [number, number] = [toWp.lon, toWp.lat];
        const roadEnd = roadPath[roadPath.length - 1];
        if (roadEnd[0] !== toWpCoord[0] || roadEnd[1] !== toWpCoord[1]) {
          appendCoord(legCoordinates, toWpCoord); // exact marker position
        }

        // Append successful leg to fullCoordinates (no duplicates at junctions)
        for (const pt of legCoordinates) {
          appendCoord(fullCoordinates, pt);
        }
      }
      // If leg failed: legCoordinates stays empty — no visual connection is drawn

      // Compute snapping distances for debugging
      const fromNode = graph.getNode(fromWp.nodeId);
      const toNode = graph.getNode(toWp.nodeId);
      let fromSnapDist = 0;
      let toSnapDist = 0;
      if (fromNode) {
        const dLat = fromWp.lat - fromNode.lat;
        const dLon = fromWp.lon - fromNode.lon;
        fromSnapDist = Math.sqrt(dLat * dLat + dLon * dLon) * 111000;
      }
      if (toNode) {
        const dLat = toWp.lat - toNode.lat;
        const dLon = toWp.lon - toNode.lon;
        toSnapDist = Math.sqrt(dLat * dLat + dLon * dLon) * 111000;
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
        legCoordinates,
        pathNodeIds: legResult.pathNodeIds,
        pathEdgeIds: legResult.pathEdgeIds,
        nodesExplored: legResult.nodesExplored,
        executionTimeMs: legResult.executionTimeMs,
        searchResult: legResult,
        snapInfo: {
          fromSnapDistanceMeters: fromSnapDist,
          toSnapDistanceMeters: toSnapDist,
        },
      });
    }

    // Validation: verify all mandatory waypoints were processed
    const totalWaypoints = orderedWaypoints.length;
    const totalLegs = legs.length;
    const successfulLegs = legs.filter((l) => l.searchResult.routeFound).length;
    const failedLegs = legs.filter((l) => !l.searchResult.routeFound);

    console.debug(
      `[RouteService] Route complete: ${totalWaypoints} waypoints, ${totalLegs} legs, ` +
      `${successfulLegs} successful, ${failedLegs.length} failed.`
    );

    if (failedLegs.length > 0) {
      console.warn('[RouteService] Failed legs:',
        failedLegs.map((l) => `Leg ${l.legIndex}: "${l.fromName}" → "${l.toName}" — ${l.searchResult.failureReason}`)
      );
    }

    const legSummary = legs.map((l) => ({
      legIndex: l.legIndex,
      success: l.searchResult.routeFound,
      failureReason: l.searchResult.failureReason,
      fromName: l.fromName,
      toName: l.toName,
    }));

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
      legSummary,
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

    if (stopsInput.length === 0) {
      return [resolvedStart, resolvedDest];
    }

    let intermediateStops: WaypointInfo[];

    if (autoOptimize && stopsInput.length > 1) {
      console.debug('[RouteService] Running delivery order optimizer for', stopsInput.length, 'stops...');
      const optResult = optimizer.optimizeOrder(
        graph,
        {
          start: resolvedStart,
          stops: stopsInput,
          destination: resolvedDest,
          metric,
        }
      );

      if (!optResult.allPairsReachable && optResult.unreachablePairs) {
        console.warn(
          '[RouteService] Optimizer found unreachable pairs:',
          optResult.unreachablePairs
        );
      }

      // Use the optimized stop order but resolve each to WaypointInfo
      intermediateStops = optResult.orderedStops.map((s, idx) =>
        this.resolveWaypoint(graph, s, 'stop', idx + 1)
      );

      // Verify count integrity — optimizer must never drop stops silently
      if (intermediateStops.length !== stopsInput.length) {
        console.error(
          `[RouteService] INTEGRITY ERROR: Optimizer returned ${intermediateStops.length} stops ` +
          `but input had ${stopsInput.length}. Falling back to original order.`
        );
        intermediateStops = stopsInput.map((s, idx) =>
          this.resolveWaypoint(graph, s, 'stop', idx + 1)
        );
      }
    } else {
      intermediateStops = stopsInput.map((s, idx) =>
        this.resolveWaypoint(graph, s, 'stop', idx + 1)
      );
    }

    const orderedWaypoints = [resolvedStart, ...intermediateStops, resolvedDest];

    console.debug(
      '[RouteService] Final waypoint sequence:',
      orderedWaypoints.map((w) => `"${w.name}" (${w.nodeId})`)
    );

    return orderedWaypoints;
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

    console.debug('[RouteService] compareAlgorithms: running all three algorithms...');

    const astarResult = this.calculateRoute(graph, orderedWaypoints, 'astar', metric, false);
    const greedyResult = this.calculateRoute(graph, orderedWaypoints, 'greedy', metric, false);
    const hillClimbingResult = this.calculateRoute(graph, orderedWaypoints, 'hillclimbing', metric, false);

    const optimalCost = astarResult.success && astarResult.totalCost > 0 ? astarResult.totalCost : null;

    const astarSuccessLegs = astarResult.legs.filter((l) => l.searchResult.routeFound).length;
    const greedySuccessLegs = greedyResult.legs.filter((l) => l.searchResult.routeFound).length;
    const hcSuccessLegs = hillClimbingResult.legs.filter((l) => l.searchResult.routeFound).length;
    const totalLegs = orderedWaypoints.length - 1;

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
        remarks: astarResult.success
          ? `Guaranteed optimal path via admissible Haversine heuristic (f = g + h). All ${astarSuccessLegs}/${totalLegs} legs succeeded.`
          : `Partial route: ${astarSuccessLegs}/${totalLegs} legs succeeded. ` +
            astarResult.legSummary.filter((l) => !l.success).map((l) => `Leg ${l.legIndex}: ${l.failureReason}`).join('; '),
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
        remarks: greedyResult.success
          ? greedyResult.totalCost > (optimalCost || 0)
            ? `Suboptimal path (f = h only). ${greedySuccessLegs}/${totalLegs} legs succeeded. ${Number(((greedyResult.totalCost / (optimalCost || 1) - 1) * 100).toFixed(1))}% longer than A*.`
            : `Found destination quickly (f = h only). ${greedySuccessLegs}/${totalLegs} legs succeeded.`
          : `Partial route: ${greedySuccessLegs}/${totalLegs} legs succeeded. ` +
            greedyResult.legSummary.filter((l) => !l.success).map((l) => `Leg ${l.legIndex}: ${l.failureReason}`).join('; '),
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
        remarks: hillClimbingResult.success
          ? `Reached all ${hcSuccessLegs}/${totalLegs} legs via steepest local descent.`
          : `Hill Climbing stuck or failed on ${totalLegs - hcSuccessLegs}/${totalLegs} legs (local minimum / dead end). ` +
            hillClimbingResult.legSummary.filter((l) => !l.success).map((l) => `Leg ${l.legIndex}: "${l.fromName}" → "${l.toName}" — ${l.failureReason}`).join('; '),
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
