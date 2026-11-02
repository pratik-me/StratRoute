import { z } from 'zod';

export const TrafficConditionSchema = z.enum(['normal', 'moderate', 'heavy', 'blocked']);
export const OptimizationMetricSchema = z.enum(['distance', 'time']);
export const AlgorithmTypeSchema = z.enum(['astar', 'greedy', 'hillclimbing']);

export const WaypointInputSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  nodeId: z.string().optional(),
});

export const SnapLocationRequestSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  maxDistanceMeters: z.number().optional().default(5000),
});

export const OptimizeOrderRequestSchema = z.object({
  start: WaypointInputSchema,
  stops: z.array(WaypointInputSchema).min(1),
  destination: WaypointInputSchema,
  metric: OptimizationMetricSchema.default('distance'),
});

export const FindRouteRequestSchema = z.object({
  start: WaypointInputSchema,
  stops: z.array(WaypointInputSchema).default([]),
  destination: WaypointInputSchema,
  algorithm: AlgorithmTypeSchema.default('astar'),
  metric: OptimizationMetricSchema.default('distance'),
  autoOptimizeStops: z.boolean().default(true),
  collectSteps: z.boolean().default(false),
});

export const CompareRoutesRequestSchema = z.object({
  start: WaypointInputSchema,
  stops: z.array(WaypointInputSchema).default([]),
  destination: WaypointInputSchema,
  metric: OptimizationMetricSchema.default('distance'),
  autoOptimizeStops: z.boolean().default(true),
});

export const TrafficUpdateRequestSchema = z.object({
  edgeId: z.string().min(1),
  condition: TrafficConditionSchema,
});

export const SaveScenarioRequestSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  edges: z.array(z.object({
    edgeId: z.string(),
    condition: TrafficConditionSchema,
  })),
});

