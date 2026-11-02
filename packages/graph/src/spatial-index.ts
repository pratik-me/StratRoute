import { GraphNode } from '@ido/shared';
import { haversineDistanceMeters } from './haversine.js';

/**
 * Spatial Grid Hash Index for O(1) average-time nearest-road-node lookup.
 * Divides geographic space into cells of roughly ~500m to 1km.
 */
export class SpatialGridIndex {
  private cellSize: number;
  private grid: Map<string, GraphNode[]> = new Map();
  private allNodes: GraphNode[] = [];

  constructor(cellSizeDegrees: number = 0.005) {
    this.cellSize = cellSizeDegrees;
  }

  private getKey(lat: number, lon: number): string {
    const cellX = Math.floor(lat / this.cellSize);
    const cellY = Math.floor(lon / this.cellSize);
    return `${cellX}:${cellY}`;
  }

  public insert(node: GraphNode): void {
    this.allNodes.push(node);
    const key = this.getKey(node.lat, node.lon);
    let bucket = this.grid.get(key);
    if (!bucket) {
      bucket = [];
      this.grid.set(key, bucket);
    }
    bucket.push(node);
  }

  public build(nodes: Iterable<GraphNode>): void {
    this.grid.clear();
    this.allNodes = [];
    for (const node of nodes) {
      this.insert(node);
    }
  }

  /**
   * Finds the nearest graph node to the given coordinates.
   * Searches expanding neighborhood rings around the target cell.
   * If not found within maxDistanceMeters, falls back to best in allNodes or returns null.
   */
  public findNearest(
    lat: number,
    lon: number,
    maxDistanceMeters: number = 100000
  ): { node: GraphNode; distanceMeters: number } | null {
    if (this.allNodes.length === 0) return null;

    const centerCellX = Math.floor(lat / this.cellSize);
    const centerCellY = Math.floor(lon / this.cellSize);

    let bestNode: GraphNode | null = null;
    let bestDist = Infinity;

    // Search concentric rings (radius 0 to 4 cells)
    for (let r = 0; r <= 4; r++) {
      let foundInRing = false;

      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;

          const key = `${centerCellX + dx}:${centerCellY + dy}`;
          const bucket = this.grid.get(key);
          if (!bucket) continue;

          for (const node of bucket) {
            const d = haversineDistanceMeters(lat, lon, node.lat, node.lon);
            if (d < bestDist) {
              bestDist = d;
              bestNode = node;
              foundInRing = true;
            }
          }
        }
      }

      // If we found a candidate node and its distance is smaller than the distance to the next ring,
      // we are guaranteed that no closer node exists in outer rings.
      const distToNextRingMeters = (r + 1) * this.cellSize * 111000;
      if (foundInRing && bestDist < distToNextRingMeters) {
        break;
      }
    }

    if (bestNode && bestDist <= maxDistanceMeters) {
      return { node: bestNode, distanceMeters: bestDist };
    }

    // Fallback: full linear scan if outside standard cell rings but within graph
    for (const node of this.allNodes) {
      const d = haversineDistanceMeters(lat, lon, node.lat, node.lon);
      if (d < bestDist) {
        bestDist = d;
        bestNode = node;
      }
    }

    if (bestNode && bestDist <= maxDistanceMeters) {
      return { node: bestNode, distanceMeters: bestDist };
    }

    return bestNode ? { node: bestNode, distanceMeters: bestDist } : null;
  }
}

