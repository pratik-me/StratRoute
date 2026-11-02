import { RoadGraph } from '@ido/graph';
import {
  GraphEdge,
  OptimizationMetric,
  SearchResult,
  SearchNodeTrace,
} from '@ido/shared';
import { MinPriorityQueue } from './priority-queue.js';

export interface SearchOptions {
  metric: OptimizationMetric;
  collectSteps?: boolean;
  maxExploredLimit?: number;
}

export function aStarSearch(
  graph: RoadGraph,
  startNodeId: string,
  goalNodeId: string,
  options: SearchOptions
): SearchResult {
  const startTime = performance.now();
  const metric = options.metric;
  const collectSteps = options.collectSteps ?? false;
  const maxLimit = options.maxExploredLimit ?? 50000;

  const startNode = graph.getNode(startNodeId);
  const goalNode = graph.getNode(goalNodeId);

  if (!startNode || !goalNode) {
    return {
      algorithm: 'astar',
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

  // Trivial case: start is goal
  if (startNodeId === goalNodeId) {
    return {
      algorithm: 'astar',
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

  const openSet = new MinPriorityQueue<string>();
  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { prevNodeId: string; edge: GraphEdge }>();
  const closedSet = new Set<string>();
  const steps: SearchNodeTrace[] = [];
  let stepCounter = 0;

  // Initialize start node
  gScore.set(startNodeId, 0);
  const initialH = graph.getHeuristic(startNodeId, goalNodeId, metric);
  openSet.push(startNodeId, initialH);

  if (collectSteps) {
    steps.push({
      nodeId: startNodeId,
      lat: startNode.lat,
      lon: startNode.lon,
      state: 'frontier',
      cost: 0,
      heuristic: initialH,
      stepNumber: ++stepCounter,
    });
  }

  let nodesExploredCount = 0;
  let reachedGoal = false;

  while (!openSet.isEmpty()) {
    const popped = openSet.pop()!;
    const currentId = popped.item;

    // If node was already closed with a better or equal cost, skip
    if (closedSet.has(currentId)) {
      continue;
    }

    closedSet.add(currentId);
    nodesExploredCount++;

    const currentNode = graph.getNode(currentId)!;

    if (collectSteps) {
      steps.push({
        nodeId: currentId,
        lat: currentNode.lat,
        lon: currentNode.lon,
        state: 'explored',
        cost: gScore.get(currentId),
        heuristic: graph.getHeuristic(currentId, goalNodeId, metric),
        stepNumber: ++stepCounter,
      });
    }

    // Goal reached
    if (currentId === goalNodeId) {
      reachedGoal = true;
      break;
    }

    if (nodesExploredCount > maxLimit) {
      break;
    }

    const currentG = gScore.get(currentId)!;
    const outgoingEdges = graph.getOutgoingEdges(currentId);

    for (const edge of outgoingEdges) {
      // Skip blocked edges or edges with zero traffic
      const edgeCost = graph.getEdgeCost(edge, metric);
      if (!isFinite(edgeCost)) {
        continue;
      }

      const neighborId = edge.target;
      const tentativeG = currentG + edgeCost;
      const recordedNeighborG = gScore.get(neighborId) ?? Infinity;

      if (tentativeG < recordedNeighborG) {
        gScore.set(neighborId, tentativeG);
        cameFrom.set(neighborId, { prevNodeId: currentId, edge });

        const h = graph.getHeuristic(neighborId, goalNodeId, metric);
        const f = tentativeG + h;

        // If neighbor was closed, reopen it since we found a strictly better path
        if (closedSet.has(neighborId)) {
          closedSet.delete(neighborId);
        }

        openSet.push(neighborId, f);

        if (collectSteps) {
          const neighborNode = graph.getNode(neighborId);
          if (neighborNode) {
            steps.push({
              nodeId: neighborId,
              lat: neighborNode.lat,
              lon: neighborNode.lon,
              state: 'frontier',
              cost: tentativeG,
              heuristic: h,
              parentId: currentId,
              stepNumber: ++stepCounter,
            });
          }
        }
      }
    }
  }

  const executionTimeMs = performance.now() - startTime;

  if (!reachedGoal) {
    return {
      algorithm: 'astar',
      routeFound: false,
      stuck: true,
      failureReason: 'No valid path found (destination unreachable or blocked)',
      nodesExplored: nodesExploredCount,
      executionTimeMs,
      totalCost: 0,
      totalDistanceMeters: 0,
      totalDurationSeconds: 0,
      pathNodeIds: [],
      pathEdgeIds: [],
      pathCoordinates: [],
      steps: collectSteps ? steps : undefined,
    };
  }

  // Reconstruct path backwards from goalNodeId
  const pathNodeIds: string[] = [];
  const pathEdgeIds: string[] = [];
  const pathEdges: GraphEdge[] = [];

  let curr = goalNodeId;
  pathNodeIds.unshift(curr);

  while (curr !== startNodeId) {
    const record = cameFrom.get(curr);
    if (!record) break;
    pathEdgeIds.unshift(record.edge.id);
    pathEdges.unshift(record.edge);
    curr = record.prevNodeId;
    pathNodeIds.unshift(curr);
  }

  // Calculate detailed totals
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  const pathCoordinates: [number, number][] = [];

  for (let i = 0; i < pathEdges.length; i++) {
    const edge = pathEdges[i];
    totalDistanceMeters += edge.distance;

    const baseSpeed = edge.speedLimit || 30;
    const effectiveSpeedKmh = baseSpeed * (edge.trafficMultiplier > 0 ? edge.trafficMultiplier : 1.0);
    totalDurationSeconds += ((edge.distance / 1000) / effectiveSpeedKmh) * 3600;

    // Use edge geometry if available; else node coordinates
    if (edge.geometry && edge.geometry.length > 0) {
      for (let g = 0; g < edge.geometry.length; g++) {
        // Prevent duplicate consecutive coordinates
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

  // If path is single node or no edges (start is goal)
  if (pathCoordinates.length === 0 && startNode) {
    pathCoordinates.push([startNode.lon, startNode.lat]);
  }

  const finalCost = gScore.get(goalNodeId) || 0;

  return {
    algorithm: 'astar',
    routeFound: true,
    stuck: false,
    nodesExplored: nodesExploredCount,
    executionTimeMs,
    totalCost: finalCost,
    totalDistanceMeters,
    totalDurationSeconds,
    pathNodeIds,
    pathEdgeIds,
    pathCoordinates,
    steps: collectSteps ? steps : undefined,
  };
}

