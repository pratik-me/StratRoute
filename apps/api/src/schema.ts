import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const trafficScenarios = sqliteTable('traffic_scenarios', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdAt: text('created_at').notNull(),
});

export const trafficScenarioEdges = sqliteTable('traffic_scenario_edges', {
  id: text('id').primaryKey(),
  scenarioId: text('scenario_id')
    .notNull()
    .references(() => trafficScenarios.id, { onDelete: 'cascade' }),
  edgeId: text('edge_id').notNull(),
  condition: text('condition').notNull(), // 'normal' | 'moderate' | 'heavy' | 'blocked'
});

export const experimentLogs = sqliteTable('experiment_logs', {
  id: text('id').primaryKey(),
  algorithm: text('algorithm').notNull(),
  metric: text('metric').notNull(),
  startNode: text('start_node').notNull(),
  destinationNode: text('destination_node').notNull(),
  stopsCount: integer('stops_count').notNull(),
  totalCost: integer('total_cost').notNull(),
  totalDistanceMeters: integer('total_distance_meters').notNull(),
  totalDurationSeconds: integer('total_duration_seconds').notNull(),
  nodesExplored: integer('nodes_explored').notNull(),
  executionTimeMs: integer('execution_time_ms').notNull(),
  routeFound: integer('route_found', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull(),
});

