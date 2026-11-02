import { RoadGraph } from '@ido/graph';
import {
  GraphEdge,
  OptimizationMetric,
  SearchResult,
  SearchNodeTrace,
} from '@ido/shared';
import { SearchOptions } from './astar.js';

/**
 * Genuine Local Search: Hill Climbing.
 *
 * At each step, evaluates all valid traversable outgoing neighbors of the current node.
 * Picks the neighbor that strictly minimizes the heuristic distance to the goal.
 * If the best neighbor's heuristic is not strictly better than the current node's heuristic,
 * or if no unvisited neighbor exists, the algorithm gets stuck in a local minimum/plateau
 * and terminates immediately, reporting failure.
 */
export function hillClimbingSearch(
  graph: RoadGraph,
  startNodeId: string,
  goalNodeId: string,
  options: SearchOptions
): SearchResult {
  const startTime = performance.now();
  const metric = options.metric;
  const collectSteps = options.collectSteps ?? false;
  const maxLimit = options.maxExploredLimit ?? 5000;

  const startNode = graph.getNode(startNodeId);
  const goalNode = graph.getNode(goalNodeId);

  if (!startNode || !goalNode) {
    return {
      algorithm: 'hillclimbing',
      routeFound: false,
      stuck: true,
      failureReason: `Invalid start (${startNodeId}) or goal (${goalNodeId}) node`,
      nodesExplored: 0,
      executionTimeMs: performance.now() - startTime,
      totalCost: 0,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      pathNodeIds: [],
      pathEdgeIds: [],
      pathCoordinates: [],
    };
  }

  if (startNodeId === goalNodeId) {
    return {
      algorithm: 'hillclimbing',
      routeFound: true,
      stuck: false,
      nodesExplored: 1,
      executionTimeMs: performance.now() - startTime,
      totalCost: 0,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      pathNodeIds: [startNodeId],
      pathEdgeIds: [],
      pathCoordinates: [[startNode.lon, startNode.lat]],
    };
  }

  const visitedNodes = new Set<string>();
  const pathNodeIds: string[] = [startNodeId];
  const pathEdgeIds: string[] = [];
  const pathEdges: GraphEdge[] = [];
  const steps: SearchNodeTrace[] = [];
  let stepCounter = 0;

  let currentNodeId = startNodeId;
  visitedNodes.add(currentNodeId);

  let currentH = graph.getHeuristic(currentNodeId, goalNodeId, metric);

  if (collectSteps) {
    steps.push({
      nodeId: currentNodeId,
      lat: startNode.lat,
      lon: startNode.lon,
      state: 'explored',
      heuristic: currentH,
      stepNumber: ++stepCounter,
    });
  }

  let nodesExploredCount = 1;
  let stuck = false;
  let failureReason = '';
  let reachedGoal = false;

  while (currentNodeId !== goalNodeId && nodesExploredCount < maxLimit) {
    const outgoingEdges = graph.getOutgoingEdges(currentNodeId);

    let bestNeighborNodeId: string | null = null;
    let bestNeighborEdge: GraphEdge | null = null;
    let bestNeighborH = Infinity;

    // Evaluate all valid outgoing neighbors
    for (const edge of outgoingEdges) {
      const edgeCost = graph.getEdgeCost(edge, metric);
      if (!isFinite(edgeCost)) {
        // Blocked or zero traffic
        continue;
      }

      const neighborId = edge.target;
      // Prevent cycles in the local trajectory
      if (visitedNodes.has(neighborId)) {
        continue;
      }

      const h = graph.getHeuristic(neighborId, goalNodeId, metric);

      if (collectSteps) {
        const neighborNode = graph.getNode(neighborId);
        if (neighborNode) {
          steps.push({
            nodeId: neighborId,
            lat: neighborNode.lat,
            lon: neighborNode.lon,
            state: 'frontier',
            heuristic: h,
            parentId: currentNodeId,
            stepNumber: ++stepCounter,
          });
        }
      }

      if (h < bestNeighborH) {
        bestNeighborH = h;
        bestNeighborNodeId = neighborId;
        bestNeighborEdge = edge;
      }
    }

    // Check if best neighbor strictly improves the heuristic
    if (bestNeighborNodeId && bestNeighborEdge && bestNeighborH < currentH) {
      // Successful downhill step towards the goal
      currentNodeId = bestNeighborNodeId;
      currentH = bestNeighborH;
      visitedNodes.add(currentNodeId);
      pathNodeIds.push(currentNodeId);
      pathEdgeIds.push(bestNeighborEdge.id);
      pathEdges.push(bestNeighborEdge);
      nodesExploredCount++;

      const currNodeObj = graph.getNode(currentNodeId)!;
      if (collectSteps) {
        steps.push({
          nodeId: currentNodeId,
          lat: currNodeObj.lat,
          lon: currNodeObj.lon,
          state: 'explored',
          heuristic: currentH,
          stepNumber: ++stepCounter,
        });
      }

      if (currentNodeId === goalNodeId) {
        reachedGoal = true;
        break;
      }
    } else {
      // Local minimum, plateau, or dead end reached
      stuck = true;
      failureReason =
        bestNeighborNodeId === null
          ? 'Dead end: No unvisited traversable neighbors from current node'
          : `Local minimum: Best neighbor heuristic (${bestNeighborH.toFixed(
              1
            )}) does not improve current heuristic (${currentH.toFixed(1)})`;

      if (collectSteps) {
        const currNodeObj = graph.getNode(currentNodeId)!;
        steps.push({
          nodeId: currentNodeId,
          lat: currNodeObj.lat,
          lon: currNodeObj.lon,
          state: 'stuck',
          heuristic: currentH,
          stepNumber: ++stepCounter,
        });
      }
      break;
    }
  }

  const executionTimeMs = performance.now() - startTime;

  // Build route metrics (even for partial route when stuck)
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let totalCost = 0;
  const pathCoordinates: [number, number][] = [];

  for (let i = 0; i < pathEdges.length; i++) {
    const edge = pathEdges[i];
    totalDistanceMeters += edge.distance;
    totalCost += graph.getEdgeCost(edge, metric);

    const baseSpeed = edge.speedLimit || 30;
    const effectiveSpeedKmh = baseSpeed * (edge.trafficMultiplier > 0 ? edge.trafficMultiplier : 1.0);
    totalDurationSeconds += ((edge.distance / 1000) / effectiveSpeedKmh) * 3600;

    if (edge.geometry && edge.geometry.length > 0) {
      for (let g = 0; g < edge.geometry.length; g++) {
        const pt = edge.geometry[g];
        if (
          pathCoordinates.length === 0 ||
          pathCoordinates[pathCoordinates.length - 1][0] !== pt[0] ||
          pathCoordinates[pathCoordinates.length - 1][1] !== pt[1]
        ) {
          pathCoordinates.push(pt);
        }
      }
    } else {
      const u = graph.getNode(edge.source);
      const v = graph.getNode(edge.target);
      if (u && (pathCoordinates.length === 0 || pathCoordinates[pathCoordinates.length - 1][0] !== u.lon)) {
        pathCoordinates.push([u.lon, u.lat]);
      }
      if (v) {
        pathCoordinates.push([v.lon, v.lat]);
      }
    }
  }

  if (pathCoordinates.length === 0 && startNode) {
    pathCoordinates.push([startNode.lon, startNode.lat]);
  }

  return {
    algorithm: 'hillclimbing',
    routeFound: reachedGoal,
    stuck: stuck || !reachedGoal,
    failureReason: reachedGoal ? undefined : (failureReason || 'Failed to reach destination'),
    nodesExplored: nodesExploredCount,
    executionTimeMs,
    totalCost,
    totalDistanceMeters,
    totalDurationSeconds,
    pathNodeIds,
    pathEdgeIds,
    pathCoordinates,
    steps: collectSteps ? steps : undefined,
  };
}

