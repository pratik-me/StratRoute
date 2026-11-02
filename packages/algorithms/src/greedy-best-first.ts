import { RoadGraph } from '@ido/graph';
import {
  GraphEdge,
  OptimizationMetric,
  SearchResult,
  SearchNodeTrace,
} from '@ido/shared';
import { MinPriorityQueue } from './priority-queue.js';
import { SearchOptions } from './astar.js';

export function greedyBestFirstSearch(
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
      algorithm: 'greedy',
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
      algorithm: 'greedy',
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
  const visited = new Set<string>();
  const inOpenSet = new Set<string>();
  const cameFrom = new Map<string, { prevNodeId: string; edge: GraphEdge }>();
  const steps: SearchNodeTrace[] = [];
  let stepCounter = 0;

  const initialH = graph.getHeuristic(startNodeId, goalNodeId, metric);
  openSet.push(startNodeId, initialH);
  inOpenSet.add(startNodeId);

  if (collectSteps) {
    steps.push({
      nodeId: startNodeId,
      lat: startNode.lat,
      lon: startNode.lon,
      state: 'frontier',
      heuristic: initialH,
      stepNumber: ++stepCounter,
    });
  }

  let nodesExploredCount = 0;
  let reachedGoal = false;

  while (!openSet.isEmpty()) {
    const popped = openSet.pop()!;
    const currentId = popped.item;
    inOpenSet.delete(currentId);

    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    nodesExploredCount++;

    const currentNode = graph.getNode(currentId)!;

    if (collectSteps) {
      steps.push({
        nodeId: currentId,
        lat: currentNode.lat,
        lon: currentNode.lon,
        state: 'explored',
        heuristic: graph.getHeuristic(currentId, goalNodeId, metric),
        stepNumber: ++stepCounter,
      });
    }

    if (currentId === goalNodeId) {
      reachedGoal = true;
      break;
    }

    if (nodesExploredCount > maxLimit) {
      break;
    }

    const outgoingEdges = graph.getOutgoingEdges(currentId);

    for (const edge of outgoingEdges) {
      const edgeCost = graph.getEdgeCost(edge, metric);
      if (!isFinite(edgeCost)) {
        continue;
      }

      const neighborId = edge.target;
      if (visited.has(neighborId)) {
        continue;
      }

      if (!inOpenSet.has(neighborId)) {
        cameFrom.set(neighborId, { prevNodeId: currentId, edge });
        const h = graph.getHeuristic(neighborId, goalNodeId, metric);
        openSet.push(neighborId, h);
        inOpenSet.add(neighborId);

        if (collectSteps) {
          const neighborNode = graph.getNode(neighborId);
          if (neighborNode) {
            steps.push({
              nodeId: neighborId,
              lat: neighborNode.lat,
              lon: neighborNode.lon,
              state: 'frontier',
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
      algorithm: 'greedy',
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

  // Reconstruct path
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
    algorithm: 'greedy',
    routeFound: true,
    stuck: false,
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

