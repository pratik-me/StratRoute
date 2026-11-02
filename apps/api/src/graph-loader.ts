import fs from 'fs';
import path from 'path';
import { RoadGraph } from '@ido/graph';
import { RoadGraphData } from '@ido/shared';

let roadGraphInstance: RoadGraph | null = null;
let rawGraphData: RoadGraphData | null = null;

export function getRoadGraph(): RoadGraph {
  if (roadGraphInstance) {
    return roadGraphInstance;
  }

  // Look for processed graph JSON in potential paths
  const possiblePaths = [
    path.resolve(process.cwd(), 'data/processed/new-delhi-network.json'),
    path.resolve(process.cwd(), '../../data/processed/new-delhi-network.json'),
    path.resolve(process.cwd(), '../data/processed/new-delhi-network.json'),
  ];

  let loadedData: RoadGraphData | null = null;

  for (const filePath of possiblePaths) {
    if (fs.existsSync(filePath)) {
      try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        loadedData = JSON.parse(fileContent);
        console.log(`[OK] Loaded road network from ${filePath}`);
        break;
      } catch (err) {
        console.error(`[WARN] Failed to parse ${filePath}:`, err);
      }
    }
  }

  if (!loadedData) {
    throw new Error('Could not find or load data/processed/new-delhi-network.json');
  }

  rawGraphData = loadedData;
  roadGraphInstance = new RoadGraph(loadedData);
  return roadGraphInstance;
}

export function getRawGraphData(): RoadGraphData {
  if (!rawGraphData) {
    getRoadGraph();
  }
  return rawGraphData!;
}

