import fs from 'fs';
import path from 'path';

const networkPath = path.resolve('data/processed/new-delhi-network.json');
const backupPath = path.resolve('data/processed/new-delhi-network.backup.json');

const graphData = JSON.parse(fs.readFileSync(networkPath, 'utf8'));
fs.writeFileSync(backupPath, JSON.stringify(graphData, null, 2), 'utf8');
console.log(`[OK] Backup written to ${backupPath}`);

const nodeMap = new Map(graphData.nodes.map(n => [n.id, n]));

// Identify edges that need OSM geometry
const edgesToEnrich = graphData.edges.filter(e => !e.geometry || e.geometry.length <= 2);
console.log(`Total edges: ${graphData.edges.length}, to enrich: ${edgesToEnrich.length}`);

// Cache by `${sourceLat},${sourceLon}->${targetLat},${targetLon}`
const cache = new Map();

async function fetchRoute(u, v, retries = 3) {
  const cacheKey = `${u.lon.toFixed(5)},${u.lat.toFixed(5)}->${v.lon.toFixed(5)},${v.lat.toFixed(5)}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const url = `https://router.project-osrm.org/route/v1/driving/${u.lon},${u.lat};${v.lon},${v.lat}?overview=full&geometries=geojson`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'IntelligentDeliveryRouteOptimizer/1.0 (academic AI research)' }
      });

      if (res.status === 429) {
        console.warn(`[WARN] Rate limited (429). Backing off for 2000ms...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
        continue;
      }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const result = {
          coordinates: route.geometry.coordinates,
          distance: Math.round(route.distance * 10) / 10,
        };
        cache.set(cacheKey, result);
        return result;
      }
      return null;
    } catch (err) {
      if (attempt === retries) {
        console.warn(`[FAIL] ${u.id} -> ${v.id}: ${err.message}`);
        return null;
      }
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  return null;
}

async function main() {
  let enrichedCount = 0;
  let skippedCount = 0;

  for (let i = 0; i < edgesToEnrich.length; i++) {
    const edge = edgesToEnrich[i];
    const u = nodeMap.get(edge.source);
    const v = nodeMap.get(edge.target);

    if (!u || !v) {
      skippedCount++;
      continue;
    }

    const route = await fetchRoute(u, v);
    if (route && route.coordinates && route.coordinates.length >= 2) {
      edge.geometry = route.coordinates;
      // If OSRM distance is plausible (within 3x of straight line), use it
      if (route.distance > 0 && route.distance < edge.distance * 3) {
        edge.distance = route.distance;
      }
      enrichedCount++;
    } else {
      skippedCount++;
    }

    if ((i + 1) % 20 === 0 || i === edgesToEnrich.length - 1) {
      console.log(`[Progress ${i + 1}/${edgesToEnrich.length}] Enriched: ${enrichedCount}, Skipped: ${skippedCount}`);
    }

    // Polite pause of 100ms between requests
    await new Promise(r => setTimeout(r, 100));
  }

  fs.writeFileSync(networkPath, JSON.stringify(graphData, null, 2), 'utf8');
  console.log(`\n[SUCCESS] Enriched ${enrichedCount} edges with real OpenStreetMap curvilinear geometry!`);
  console.log(`Saved to ${networkPath}`);
}

main().catch(console.error);

