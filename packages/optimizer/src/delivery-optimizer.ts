import { RoadGraph, haversineDistanceMeters } from '@ido/graph';
import { dijkstraCost } from '@ido/algorithms';
import {
  DeliveryOrderRequest,
  DeliveryOrderResponse,
  DeliveryWaypointInput,
  OptimizationMetric,
} from '@ido/shared';

/**
 * Sentinel cost used to represent an explicitly unreachable road-network pair.
 *
 * IMPORTANT: We do NOT fall back to straight-line distance here because:
 *  1. The road graph may have disconnected components.
 *  2. Using a plausible haversine estimate would allow the Nearest-Neighbor and
 *     2-opt routines to select a sequence that includes an unreachable segment.
 *  3. The actual route calculation would then silently fail on that leg.
 *
 * By using a very large finite sentinel (rather than Infinity) we can still let
 * the optimizer produce a ranked sequence while flagging the pair as unreachable.
 * A large but finite value ensures the optimizer always prefers any reachable
 * alternative over an unreachable one.
 */
const UNREACHABLE_COST_SENTINEL = 1e9;

export class DeliveryOrderOptimizer {
  private costCache = new Map<string, number>();
  // Track which pairs are truly unreachable (road-network disconnected).
  private unreachablePairs = new Set<string>();

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

    console.debug('[Optimizer] optimizeOrder called', {
      startId: start.id,
      stopCount: stops.length,
      destId: destination.id,
      metric,
    });

    // Resolve node IDs for start, destination, and all intermediate stops
    const resolvedStart = this.resolveNodeId(graph, start);
    const resolvedDest = this.resolveNodeId(graph, destination);
    const resolvedStops = stops.map((s) => this.resolveNodeId(graph, s));

    console.debug('[Optimizer] Resolved nodeIds', {
      startNodeId: resolvedStart.nodeId,
      destNodeId: resolvedDest.nodeId,
      stopNodeIds: resolvedStops.map((s) => s.nodeId),
    });

    // Validate that every stop is actually in the graph
    const validStops = resolvedStops.filter((s) => {
      if (!graph.getNode(s.nodeId)) {
        console.warn(`[Optimizer] Stop ${s.id} resolved to unknown node ${s.nodeId} – keeping in sequence with sentinel cost`);
      }
      return true; // Keep all stops; never silently remove a mandatory waypoint
    });

    // Handle trivial cases: 0 or 1 intermediate stop
    if (validStops.length <= 1) {
      const sequenceForCost = [resolvedStart, ...validStops, resolvedDest];
      const initialCost = this.calculateSequenceCost(graph, sequenceForCost, metric);
      const unreachable = this.getUnreachablePairsInSequence(sequenceForCost);
      const result: DeliveryOrderResponse = {
        initialOrder: validStops.map((s) => s.id),
        optimizedOrder: validStops.map((s) => s.id),
        initialCost,
        optimizedCost: initialCost,
        iterations: 0,
        improved: false,
        orderedStops: validStops,
        allPairsReachable: unreachable.length === 0,
        unreachablePairs: unreachable.length > 0 ? unreachable : undefined,
      };
      if (unreachable.length > 0) {
        console.warn('[Optimizer] Unreachable pairs detected:', unreachable);
      }
      return result;
    }

    // Step 1: Nearest-Neighbor heuristic initialization
    const initialStops = this.nearestNeighborSequence(
      graph,
      resolvedStart,
      validStops,
      resolvedDest,
      metric
    );

    const initialSequence = [resolvedStart, ...initialStops, resolvedDest];
    const initialCost = this.calculateSequenceCost(graph, initialSequence, metric);

    console.debug('[Optimizer] Nearest-Neighbor initialCost:', initialCost, 'sequence:', initialStops.map((s) => s.id));

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
      const k = currentIntermediate.length;
      for (let i = 0; i < k - 1; i++) {
        for (let j = i + 1; j < k; j++) {
          const candidateIntermediate = this.twoOptSwap(currentIntermediate, i, j);
          const candidateFullSeq = [resolvedStart, ...candidateIntermediate, resolvedDest];
          const candidateCost = this.calculateSequenceCost(graph, candidateFullSeq, metric);

          if (candidateCost < bestNeighborCost - 1e-4) {
            bestNeighborCost = candidateCost;
            bestNeighborStops = candidateIntermediate;
          }
        }
      }

      if (bestNeighborStops !== null && bestNeighborCost < currentCost) {
        currentIntermediate = bestNeighborStops;
        currentCost = bestNeighborCost;
        improvedOverall = true;
        console.debug(`[Optimizer] 2-opt improvement at iteration ${iterations}: cost ${currentCost}`);
      } else {
        // Local minimum reached
        break;
      }
    }

    const finalSequence = [resolvedStart, ...currentIntermediate, resolvedDest];
    const unreachable = this.getUnreachablePairsInSequence(finalSequence);

    if (unreachable.length > 0) {
      console.warn('[Optimizer] Final sequence contains unreachable pairs:', unreachable);
    }

    console.debug('[Optimizer] Final optimizedCost:', currentCost, 'iterations:', iterations, 'improved:', improvedOverall);

    return {
      initialOrder: initialStops.map((s) => s.id),
      optimizedOrder: currentIntermediate.map((s) => s.id),
      initialCost,
      optimizedCost: currentCost,
      iterations,
      improved: improvedOverall,
      orderedStops: currentIntermediate,
      allPairsReachable: unreachable.length === 0,
      unreachablePairs: unreachable.length > 0 ? unreachable : undefined,
    };
  }

  /**
   * Returns the list of consecutive pairs in the given sequence that are
   * unreachable via road network (i.e. were assigned the sentinel cost).
   */
  private getUnreachablePairsInSequence(
    sequence: (DeliveryWaypointInput & { nodeId: string })[]
  ): { from: string; to: string }[] {
    const pairs: { from: string; to: string }[] = [];
    for (let i = 0; i < sequence.length - 1; i++) {
      const key = `${sequence[i].nodeId}->${sequence[i + 1].nodeId}`;
      if (this.unreachablePairs.has(key)) {
        pairs.push({ from: sequence[i].nodeId, to: sequence[i + 1].nodeId });
      }
    }
    return pairs;
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
      console.debug(`[Optimizer] Snapped waypoint ${waypoint.id} to node ${snapped.node.id} (${snapped.distanceMeters.toFixed(0)}m away)`);
      return {
        ...waypoint,
        nodeId: snapped.node.id,
      };
    }

    // Last resort: pick any node. This should not happen on a valid graph.
    const firstNodeId = graph.nodes.keys().next().value ?? 'default';
    console.warn(`[Optimizer] Could not snap waypoint ${waypoint.id} – falling back to node ${firstNodeId}`);
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
   * Retrieves pairwise shortest road-network path cost, with caching.
   *
   * If the pair is unreachable (Dijkstra returns Infinity), we store the
   * UNREACHABLE_COST_SENTINEL — a very large but finite value.
   *
   * We do NOT fall back to straight-line distance, because that would allow the
   * optimizer to pick a sequence with unreachable segments, which would then
   * silently fail during actual route calculation.
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

    const roadCost = dijkstraCost(graph, sourceNodeId, targetNodeId, metric);

    let cost: number;
    if (isFinite(roadCost)) {
      cost = roadCost;
    } else {
      // Road-network disconnected pair: mark as unreachable and assign sentinel cost
      const pairKey = `${sourceNodeId}->${targetNodeId}`;
      this.unreachablePairs.add(pairKey);
      cost = UNREACHABLE_COST_SENTINEL;
      console.warn(
        `[Optimizer] No road-network path from ${sourceNodeId} to ${targetNodeId}. ` +
        `Assigning sentinel cost ${UNREACHABLE_COST_SENTINEL} (NOT straight-line distance). ` +
        `This pair will be flagged as unreachable in the response.`
      );
    }

    this.costCache.set(cacheKey, cost);
    return cost;
  }

  public clearCache(): void {
    this.costCache.clear();
    this.unreachablePairs.clear();
  }
}
