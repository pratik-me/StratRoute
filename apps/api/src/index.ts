import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import {
  SnapLocationRequestSchema,
  OptimizeOrderRequestSchema,
  FindRouteRequestSchema,
  CompareRoutesRequestSchema,
  TrafficUpdateRequestSchema,
  SaveScenarioRequestSchema,
  PRESET_DELHI_LOCATIONS,
} from '@ido/shared';
import { getRoadGraph, getRawGraphData } from './graph-loader.js';
import { RouteService } from './route-service.js';
import { DeliveryOrderOptimizer } from '@ido/optimizer';
import { dbService } from './db.js';

const app = new Hono();

// Middlewares
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
);

// Warm up graph at startup
const graph = getRoadGraph();
const optimizer = new DeliveryOrderOptimizer();

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'Intelligent Delivery Route Optimizer API',
    nodes: graph.nodes.size,
    edges: graph.edgesById.size,
    timestamp: new Date().toISOString(),
  });
});

// Map metadata and preset locations
app.get('/api/map/metadata', (c) => {
  return c.json({
    metadata: graph.metadata,
    nodesCount: graph.nodes.size,
    edgesCount: graph.edgesById.size,
    presetLocations: PRESET_DELHI_LOCATIONS,
  });
});

// Full graph data for map visualization
app.get('/api/map/graph', (c) => {
  return c.json(graph.toJSON());
});

// Snap location to nearest road node
app.post('/api/locations/snap', async (c) => {
  const body = await c.req.json();
  const parsed = SnapLocationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid coordinates', details: parsed.error.format() }, 400);
  }

  const snapped = graph.snapToNearestNode(parsed.data.lat, parsed.data.lon, parsed.data.maxDistanceMeters);
  if (!snapped) {
    return c.json({ error: 'No road node found within acceptable distance' }, 404);
  }

  return c.json({
    snappedNode: snapped.node,
    distanceMeters: snapped.distanceMeters,
  });
});

// Optimize delivery visit sequence
app.post('/api/routes/optimize-order', async (c) => {
  const body = await c.req.json();
  const parsed = OptimizeOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid delivery order request', details: parsed.error.format() }, 400);
  }

  const result = optimizer.optimizeOrder(graph, parsed.data);
  return c.json(result);
});

// Find path using specified algorithm
app.post('/api/routes/find', async (c) => {
  const body = await c.req.json();
  const parsed = FindRouteRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid route request', details: parsed.error.format() }, 400);
  }

  const { start, stops, destination, algorithm, metric, autoOptimizeStops, collectSteps } = parsed.data;

  const orderedWaypoints = RouteService.prepareOrderedWaypoints(
    graph,
    start,
    stops,
    destination,
    autoOptimizeStops,
    metric
  );

  const routeResult = RouteService.calculateRoute(
    graph,
    orderedWaypoints,
    algorithm,
    metric,
    collectSteps
  );

  return c.json(routeResult);
});

// Compare all 3 algorithms side-by-side
app.post('/api/routes/compare', async (c) => {
  const body = await c.req.json();
  const parsed = CompareRoutesRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid compare request', details: parsed.error.format() }, 400);
  }

  const { start, stops, destination, metric, autoOptimizeStops } = parsed.data;

  const comparisonResponse = RouteService.compareAlgorithms(
    graph,
    start,
    stops,
    destination,
    metric,
    autoOptimizeStops
  );

  return c.json(comparisonResponse);
});

// Update traffic condition for an edge
app.post('/api/traffic/update', async (c) => {
  const body = await c.req.json();
  const parsed = TrafficUpdateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid traffic update payload', details: parsed.error.format() }, 400);
  }

  const { edgeId, condition } = parsed.data;
  const updated = graph.setEdgeTraffic(edgeId, condition);
  if (!updated) {
    return c.json({ error: `Edge ${edgeId} not found` }, 404);
  }

  // Clear pairwise cost cache on optimizer since edge costs changed
  optimizer.clearCache();

  return c.json({
    success: true,
    edgeId,
    condition,
    edge: graph.getEdge(edgeId),
  });
});

// Reset all traffic modifications back to normal
app.post('/api/traffic/reset', (c) => {
  graph.resetTraffic();
  optimizer.clearCache();
  return c.json({
    success: true,
    message: 'All traffic conditions reset to normal.',
  });
});

// List traffic scenarios from SQLite
app.get('/api/traffic/scenarios', (c) => {
  const scenarios = dbService.getAllScenarios();
  return c.json(scenarios);
});

// Save a traffic scenario to SQLite
app.post('/api/traffic/scenarios', async (c) => {
  const body = await c.req.json();
  const parsed = SaveScenarioRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Invalid scenario payload', details: parsed.error.format() }, 400);
  }

  const scenarioId = `scenario_${Date.now()}`;
  const now = new Date().toISOString();

  dbService.saveScenario(
    {
      id: scenarioId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      createdAt: now,
    },
    parsed.data.edges
  );

  return c.json({
    success: true,
    scenarioId,
    message: 'Traffic scenario persisted successfully.',
  });
});

// Load a specific scenario by ID
app.get('/api/traffic/scenarios/:id', (c) => {
  const id = c.req.param('id');
  const scenario = dbService.getScenarioById(id);
  if (!scenario) {
    return c.json({ error: 'Scenario not found' }, 404);
  }

  const edges = dbService.getScenarioEdges(id);

  // Apply scenario to active road graph
  graph.resetTraffic();
  for (const item of edges) {
    graph.setEdgeTraffic(item.edge_id, item.condition as any);
  }
  optimizer.clearCache();

  return c.json({
    scenario,
    edges,
    applied: true,
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 4000;
console.log(`[START] Intelligent Delivery Route Optimizer API starting on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
  hostname: '0.0.0.0',
});

