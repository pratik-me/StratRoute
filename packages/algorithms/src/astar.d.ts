import { RoadGraph } from '@ido/graph';
import { OptimizationMetric, SearchResult } from '@ido/shared';
export interface SearchOptions {
    metric: OptimizationMetric;
    collectSteps?: boolean;
    maxExploredLimit?: number;
}
export declare function aStarSearch(graph: RoadGraph, startNodeId: string, goalNodeId: string, options: SearchOptions): SearchResult;
//# sourceMappingURL=astar.d.ts.map