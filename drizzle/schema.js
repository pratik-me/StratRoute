"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.experimentLogs = exports.trafficScenarioEdges = exports.trafficScenarios = void 0;
const sqlite_core_1 = require("drizzle-orm/sqlite-core");
exports.trafficScenarios = (0, sqlite_core_1.sqliteTable)('traffic_scenarios', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    name: (0, sqlite_core_1.text)('name').notNull(),
    description: (0, sqlite_core_1.text)('description'),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
});
exports.trafficScenarioEdges = (0, sqlite_core_1.sqliteTable)('traffic_scenario_edges', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    scenarioId: (0, sqlite_core_1.text)('scenario_id')
        .notNull()
        .references(() => exports.trafficScenarios.id, { onDelete: 'cascade' }),
    edgeId: (0, sqlite_core_1.text)('edge_id').notNull(),
    condition: (0, sqlite_core_1.text)('condition').notNull(), // 'normal' | 'moderate' | 'heavy' | 'blocked'
});
exports.experimentLogs = (0, sqlite_core_1.sqliteTable)('experiment_logs', {
    id: (0, sqlite_core_1.text)('id').primaryKey(),
    algorithm: (0, sqlite_core_1.text)('algorithm').notNull(),
    metric: (0, sqlite_core_1.text)('metric').notNull(),
    startNode: (0, sqlite_core_1.text)('start_node').notNull(),
    destinationNode: (0, sqlite_core_1.text)('destination_node').notNull(),
    stopsCount: (0, sqlite_core_1.integer)('stops_count').notNull(),
    totalCost: (0, sqlite_core_1.integer)('total_cost').notNull(),
    totalDistanceMeters: (0, sqlite_core_1.integer)('total_distance_meters').notNull(),
    totalDurationSeconds: (0, sqlite_core_1.integer)('total_duration_seconds').notNull(),
    nodesExplored: (0, sqlite_core_1.integer)('nodes_explored').notNull(),
    executionTimeMs: (0, sqlite_core_1.integer)('execution_time_ms').notNull(),
    routeFound: (0, sqlite_core_1.integer)('route_found', { mode: 'boolean' }).notNull(),
    createdAt: (0, sqlite_core_1.text)('created_at').notNull(),
});
//# sourceMappingURL=schema.js.map