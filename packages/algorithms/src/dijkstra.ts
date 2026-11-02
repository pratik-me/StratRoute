import { RoadGraph } from '@ido/graph';
import { OptimizationMetric } from '@ido/shared';
import { MinPriorityQueue } from './priority-queue.js';

/**
 * Exact shortest-path Dijkstra implementation.
 * Used for computing pairwise distance/time matrices for the delivery order optimizer.
 *
 * @returns Cost of the shortest path, or Infinity if unreachable.
 */
export function dijkstraCost(
  graph: RoadGraph,
  sourceNodeId: string,
  targetNodeId: string,
  metric: OptimizationMetric
): number {
  if (sourceNodeId === targetNodeId) return 0;

  const dist = new Map<string, number>();
  const visited = new Set<string>();
  const pq = new MinPriorityQueue<string>();

  dist.set(sourceNodeId, 0);
  pq.push(sourceNodeId, 0);

  while (!pq.isEmpty()) {
    const { item: u, priority: d } = pq.pop()!;

    if (visited.has(u)) continue;
    visited.add(u);

    if (u === targetNodeId) {
      return d;
    }

    const outgoing = graph.getOutgoingEdges(u);
    for (const edge of outgoing) {
      const edgeCost = graph.getEdgeCost(edge, metric);
      if (!isFinite(edgeCost)) continue;

      const v = edge.target;
      const newDist = d + edgeCost;
      const currentDist = dist.get(v) ?? Infinity;

      if (newDist < currentDist) {
        dist.set(v, newDist);
        pq.push(v, newDist);
      }
    }
  }

  return dist.get(targetNodeId) ?? Infinity;
}

