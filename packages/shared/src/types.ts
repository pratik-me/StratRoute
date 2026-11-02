export type TrafficCondition = 'normal' | 'moderate' | 'heavy' | 'blocked';

export type OptimizationMetric = 'distance' | 'time';

export type AlgorithmType = 'astar' | 'greedy' | 'hillclimbing';

export interface GraphNode {
  id: string;
  lat: number;
  lon: number;
  name?: string;
  highway?: string;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  distance: number; // meters (OSM calculated length)
  roadType: string; // e.g. motorway, primary, secondary, residential
  roadName?: string;
  speedLimit?: number; // km/h
  geometry?: [number, number][]; // [lon, lat] pairs
  trafficMultiplier: number; // 1.0 (normal), 0.75 (moderate), 0.4 (heavy), 0.0 (blocked)
  isBlocked: boolean;
}

export interface RoadGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: {
    name: string;
    city: string;
    nodeCount: number;
    edgeCount: number;
    bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
    center: [number, number]; // [lon, lat]
    maxSpeedKmh: number;
  };
}

export interface SearchNodeTrace {
  nodeId: string;
  lat: number;
  lon: number;
  state: 'frontier' | 'explored' | 'current' | 'stuck';
  cost?: number;
  heuristic?: number;
  parentId?: string;
  stepNumber: number;
}

export interface SearchResult {
  algorithm: AlgorithmType;
  routeFound: boolean;
  stuck: boolean;
  failureReason?: string;
  nodesExplored: number;
  executionTimeMs: number;
  totalCost: number;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  pathNodeIds: string[];
  pathEdgeIds: string[];
  pathCoordinates: [number, number][]; // [lon, lat]
  steps?: SearchNodeTrace[];
}

export interface RouteLeg {
  legIndex: number;
  fromNodeId: string;
  toNodeId: string;
  fromName: string;
  toName: string;
  distanceMeters: number;
  durationSeconds: number;
  cost: number;
  pathCoordinates: [number, number][];
  pathNodeIds: string[];
  pathEdgeIds: string[];
  nodesExplored: number;
  executionTimeMs: number;
  searchResult: SearchResult;
}

export interface WaypointInfo {
  id: string;
  name: string;
  lat: number;
  lon: number;
  nodeId: string;
  type: 'start' | 'stop' | 'destination';
  index: number;
}

export interface FullRouteResult {
  algorithm: AlgorithmType;
  metric: OptimizationMetric;
  success: boolean;
  stuck: boolean;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalCost: number;
  totalNodesExplored: number;
  totalExecutionTimeMs: number;
  orderedWaypoints: WaypointInfo[];
  legs: RouteLeg[];
  fullCoordinates: [number, number][];
}

export interface AlgorithmComparisonEntry {
  algorithm: AlgorithmType;
  name: string;
  success: boolean;
  stuck: boolean;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  totalCost: number;
  nodesExplored: number;
  executionTimeMs: number;
  optimalityRatio?: number;
  remarks: string;
}

export interface AlgorithmComparisonResponse {
  metric: OptimizationMetric;
  orderedWaypoints: WaypointInfo[];
  results: Record<AlgorithmType, FullRouteResult>;
  comparison: AlgorithmComparisonEntry[];
}

export interface DeliveryWaypointInput {
  id: string;
  name?: string;
  lat: number;
  lon: number;
  nodeId?: string;
}

export interface DeliveryOrderRequest {
  start: DeliveryWaypointInput;
  stops: DeliveryWaypointInput[];
  destination: DeliveryWaypointInput;
  metric: OptimizationMetric;
}

export interface DeliveryOrderResponse {
  initialOrder: string[];
  optimizedOrder: string[];
  initialCost: number;
  optimizedCost: number;
  iterations: number;
  improved: boolean;
  orderedStops: DeliveryWaypointInput[];
}

export interface TrafficUpdateItem {
  edgeId: string;
  condition: TrafficCondition;
}

export interface TrafficScenario {
  id: string;
  name: string;
  description?: string;
  edges: TrafficUpdateItem[];
  createdAt: string;
}

