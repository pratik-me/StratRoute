import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

function getDataDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data'),
    path.resolve(process.cwd(), '../../data'),
    path.resolve(process.cwd(), '../data'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const defaultDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(defaultDir)) {
    fs.mkdirSync(defaultDir, { recursive: true });
  }
  return defaultDir;
}

const dbDir = getDataDir();
const sqlitePath = path.join(dbDir, 'app.sqlite');
export const sqlite = new DatabaseSync(sqlitePath);

// Initialize SQLite Schema
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS traffic_scenarios (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS traffic_scenario_edges (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL,
    edge_id TEXT NOT NULL,
    condition TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS experiment_logs (
    id TEXT PRIMARY KEY,
    algorithm TEXT NOT NULL,
    metric TEXT NOT NULL,
    start_node TEXT NOT NULL,
    destination_node TEXT NOT NULL,
    stops_count INTEGER NOT NULL,
    total_cost REAL NOT NULL,
    total_distance_meters REAL NOT NULL,
    total_duration_seconds REAL NOT NULL,
    nodes_explored INTEGER NOT NULL,
    execution_time_ms REAL NOT NULL,
    route_found INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
`);

export interface TrafficScenarioRecord {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface TrafficScenarioEdgeRecord {
  id: string;
  scenario_id: string;
  edge_id: string;
  condition: string;
}

export const dbService = {
  getAllScenarios(): TrafficScenarioRecord[] {
    const stmt = sqlite.prepare('SELECT * FROM traffic_scenarios ORDER BY created_at DESC');
    return stmt.all() as unknown as TrafficScenarioRecord[];
  },

  getScenarioById(id: string): TrafficScenarioRecord | undefined {
    const stmt = sqlite.prepare('SELECT * FROM traffic_scenarios WHERE id = ?');
    return stmt.get(id) as unknown as TrafficScenarioRecord | undefined;
  },

  getScenarioEdges(scenarioId: string): TrafficScenarioEdgeRecord[] {
    const stmt = sqlite.prepare('SELECT * FROM traffic_scenario_edges WHERE scenario_id = ?');
    return stmt.all(scenarioId) as unknown as TrafficScenarioEdgeRecord[];
  },

  saveScenario(
    scenario: { id: string; name: string; description?: string | null; createdAt: string },
    edges: { edgeId: string; condition: string }[]
  ): void {
    const insertScenario = sqlite.prepare(`
      INSERT INTO traffic_scenarios (id, name, description, created_at)
      VALUES (?, ?, ?, ?)
    `);
    insertScenario.run(scenario.id, scenario.name, scenario.description || null, scenario.createdAt);

    const insertEdge = sqlite.prepare(`
      INSERT INTO traffic_scenario_edges (id, scenario_id, edge_id, condition)
      VALUES (?, ?, ?, ?)
    `);

    for (const edge of edges) {
      insertEdge.run(`edge_${scenario.id}_${edge.edgeId}`, scenario.id, edge.edgeId, edge.condition);
    }
  },
};
