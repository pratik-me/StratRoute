import { RoadGraph, haversineDistanceMeters } from '@ido/graph';
import { dijkstraCost } from '@ido/algorithms';
import {
  DeliveryOrderRequest,
  DeliveryOrderResponse,
  DeliveryWaypointInput,
  OptimizationMetric,
} from '@ido/shared';

export class DeliveryOrderOptimizer {
  private costCache = new Map<string, number>();

  /**
   * Optimizes the visiting sequence of intermediate delivery stops
   * using Nearest-Neighbor initialization followed by Hill Climbing with 2-opt local search.
   *
   * The start location and final destination remain strictly fixed.
   */
  public optimizeOrder(
    graph: RoadGraph,
    request: DeliveryOrderRequest,
    maxIterations: number = 100
  ): DeliveryOrderResponse {
    const { start, stops, destination, metric } = request;

    // Resolve node IDs for start, destination, and all intermediate stops
    const resolvedStart = this.resolveNodeId(graph, start);
    const resolvedDest = this.resolveNodeId(graph, destination);
    const resolvedStops = stops.map((s) => this.resolveNodeId(graph, s));

    // Handle trivial cases: 0 or 1 intermediate stop
    if (resolvedStops.length <= 1) {
      const initialCost = this.calculateSequenceCost(
        graph,
        [resolvedStart, ...resolvedStops, resolvedDest],
        metric
      );
      return {
        initialOrder: resolvedStops.map((s) => s.id),
        optimizedOrder: resolvedStops.map((s) => s.id),
        initialCost,
        optimizedCost: initialCost,
        iterations: 0,
        improved: false,
        orderedStops: resolvedStops,
      };
    }

    // Step 1: Nearest-Neighbor heuristic initialization
    const initialStops = this.nearestNeighborSequence(
      graph,
      resolvedStart,
      resolvedStops,
      resolvedDest,
      metric
    );

    const initialSequence = [resolvedStart, ...initialStops, resolvedDest];
    const initialCost = this.calculateSequenceCost(graph, initialSequence, metric);

    // Step 2: Hill Climbing Local Search using 2-opt neighborhood
    // We only permute intermediate stops (indices 1 to n - 2 in the full sequence)
    let currentIntermediate = [...initialStops];
    let currentCost = initialCost;
    let iterations = 0;
    let improvedOverall = false;

    while (iterations < maxIterations) {
      iterations++;
      let bestNeighborStops: (DeliveryWaypointInput & { nodeId: string })[] | null = null;
      let bestNeighborCost = currentCost;

      // Examine all 2-opt moves on intermediate stops
      // Reversing slice [i..j] in currentIntermediate
      const k = currentIntermediate.length;
      for (let i = 0; i < k - 1; i++) {
        for (let j = i + 1; j < k; j++) {
          const candidateIntermediate = this.twoOptSwap(currentIntermediate, i, j);
          const candidateFullSeq = [resolvedStart, ...candidateIntermediate, resolvedDest];
          const candidateCost = this.calculateSequenceCost(graph, candidateFullSeq, metric);

          // Find steepest improvement in neighborhood
          if (candidateCost < bestNeighborCost - 1e-4) {
            bestNeighborCost = candidateCost;
            bestNeighborStops = candidateIntermediate;
          }
        }
      }

      // If an improving neighbor was found, accept it (Hill Climbing step)
      if (bestNeighborStops !== null && bestNeighborCost < currentCost) {
        currentIntermediate = bestNeighborStops;
        currentCost = bestNeighborCost;
        improvedOverall = true;
      } else {
        // Local minimum reached! No neighbor improves the cost.
        break;
      }
    }

    return {
      initialOrder: initialStops.map((s) => s.id),
      optimizedOrder: currentIntermediate.map((s) => s.id),
      initialCost,
      optimizedCost: currentCost,
      iterations,
      improved: improvedOverall,
      orderedStops: currentIntermediate,
    };
  }

  private resolveNodeId(
    graph: RoadGraph,
    waypoint: DeliveryWaypointInput
  ): DeliveryWaypointInput & { nodeId: string } {
    if (waypoint.nodeId && graph.getNode(waypoint.nodeId)) {
      return waypoint as DeliveryWaypointInput & { nodeId: string };
    }

    const snapped = graph.snapToNearestNode(waypoint.lat, waypoint.lon);
    if (snapped) {
      return {
        ...waypoint,
        nodeId: snapped.node.id,
      };
    }

    // Fallback: pick any node if snap fails (should not happen on valid graph)
    const firstNodeId = graph.nodes.keys().next().value ?? 'default';
    return {
      ...waypoint,
      nodeId: firstNodeId,
    };
  }

  /**
   * Initial construction heuristic: Nearest-Neighbor.
   * From start, greedily selects the closest unvisited stop next.
   */
  private nearestNeighborSequence(
    graph: RoadGraph,
    start: DeliveryWaypointInput & { nodeId: string },
    stops: (DeliveryWaypointInput & { nodeId: string })[],
    _dest: DeliveryWaypointInput & { nodeId: string },
    metric: OptimizationMetric
  ): (DeliveryWaypointInput & { nodeId: string })[] {
    const unvisited = [...stops];
    const sequence: (DeliveryWaypointInput & { nodeId: string })[] = [];
    let current = start;

    while (unvisited.length > 0) {
      let nearestIdx = 0;
      let nearestCost = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const candidate = unvisited[i];
        const cost = this.getPairwiseCost(graph, current.nodeId, candidate.nodeId, metric);
        if (cost < nearestCost) {
          nearestCost = cost;
          nearestIdx = i;
        }
      }

      const nextStop = unvisited.splice(nearestIdx, 1)[0];
      sequence.push(nextStop);
      current = nextStop;
    }

    return sequence;
  }

  /**
   * 2-opt swap: reverses the subsequence between indices i and j.
   */
  private twoOptSwap<T>(array: T[], i: number, j: number): T[] {
    const result = array.slice(0, i);
    const reversedSegment = array.slice(i, j + 1).reverse();
    result.push(...reversedSegment);
    result.push(...array.slice(j + 1));
    return result;
  }

  /**
   * Evaluates the objective function: C(pi) = sum_{i=0}^k d(pi_i, pi_{i+1})
   */
  private calculateSequenceCost(
    graph: RoadGraph,
    sequence: (DeliveryWaypointInput & { nodeId: string })[],
    metric: OptimizationMetric
  ): number {
    let total = 0;
    for (let i = 0; i < sequence.length - 1; i++) {
      const from = sequence[i];
      const to = sequence[i + 1];
      const cost = this.getPairwiseCost(graph, from.nodeId, to.nodeId, metric);
      total += cost;
    }
    return total;
  }

  /**
   * Retrieves pairwise shortest road path cost, with caching to prevent redundant calculations.
   */
  private getPairwiseCost(
    graph: RoadGraph,
    sourceNodeId: string,
    targetNodeId: string,
    metric: OptimizationMetric
  ): number {
    if (sourceNodeId === targetNodeId) return 0;

    const cacheKey = `${metric}:${sourceNodeId}->${targetNodeId}`;
    if (this.costCache.has(cacheKey)) {
      return this.costCache.get(cacheKey)!;
    }

    let cost = dijkstraCost(graph, sourceNodeId, targetNodeId, metric);

    // If disconnected or infinite in road graph, fallback to geometric distance estimate
    if (!isFinite(cost)) {
      const u = graph.getNode(sourceNodeId);
      const v = graph.getNode(targetNodeId);
      if (u && v) {
        const straightMeters = haversineDistanceMeters(u.lat, u.lon, v.lat, v.lon);
        cost = metric === 'distance' ? straightMeters * 1.5 : (straightMeters / 1000 / 30) * 3600;
      } else {
        cost = 1e6;
      }
    }

    this.costCache.set(cacheKey, cost);
    return cost;
  }

  public clearCache(): void {
    this.costCache.clear();
  }
}

