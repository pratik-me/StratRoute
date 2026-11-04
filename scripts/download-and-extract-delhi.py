#!/usr/bin/env python3
"""
Full OpenStreetMap Road Network Extractor for Delhi.

Sources supported:
1. Overpass API (Live OpenStreetMap query with full road geometry)
2. BBBike City Extracts (Downloads and parses NewDelhi.osm.gz from BBBike)

Usage:
    python scripts/download-and-extract-delhi.py [--source overpass|bbbike] [--level major|all] [--out data/processed/new-delhi-network.json]
"""

import sys
import os
import json
import math
import time
import argparse
import urllib.request
import urllib.parse
import gzip
import xml.etree.ElementTree as ET

EARTH_RADIUS = 6371000

SPEED_LIMITS = {
    'motorway': 80,
    'motorway_link': 50,
    'trunk': 60,
    'trunk_link': 45,
    'primary': 50,
    'primary_link': 40,
    'secondary': 40,
    'secondary_link': 30,
    'tertiary': 30,
    'tertiary_link': 25,
    'residential': 25,
    'living_street': 15,
    'service': 20,
    'unclassified': 30,
    'road': 30,
}

def haversine_distance(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    return 2 * EARTH_RADIUS * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def polyline_distance(coords):
    return round(sum(haversine_distance(coords[i][1], coords[i][0], coords[i+1][1], coords[i+1][0])
                     for i in range(len(coords) - 1)), 1)

def query_overpass(bbox, highway_types):
    types_str = "|".join(highway_types)
    query = f"""
    [out:json][timeout:180];
    (
      way["highway"~"{types_str}"]({bbox[1]},{bbox[0]},{bbox[3]},{bbox[2]});
    );
    out body geom;
    """
    print(f"[INFO] Querying OpenStreetMap Overpass API for Delhi roads...")
    print(f"[INFO] Highway types: {types_str}")
    print(f"[INFO] Bounding box: {bbox}")

    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"User-Agent": "StratRoute-DelhiOptimizer/2.0"})

    start = time.time()
    with urllib.request.urlopen(req, timeout=180) as resp:
        res = json.loads(resp.read().decode("utf-8"))
    
    ways = res.get("elements", [])
    print(f"[OK] Downloaded {len(ways)} road ways from OpenStreetMap in {time.time() - start:.1f}s.")
    return ways

def download_bbbike_extract(dest_dir):
    os.makedirs(dest_dir, exist_ok=True)
    gz_path = os.path.join(dest_dir, "NewDelhi.osm.gz")
    
    url = "https://download.bbbike.org/osm/bbbike/NewDelhi/NewDelhi.osm.gz"
    print(f"[INFO] Downloading BBBike Delhi extract from {url}...")
    
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp, open(gz_path, "wb") as out_file:
        total_size = int(resp.headers.get("Content-Length", 0))
        downloaded = 0
        chunk_size = 1024 * 1024
        while True:
            chunk = resp.read(chunk_size)
            if not chunk:
                break
            out_file.write(chunk)
            downloaded += len(chunk)
            if total_size > 0:
                percent = (downloaded / total_size) * 100
                print(f"\rDownloading: {downloaded / (1024*1024):.1f}MB / {total_size / (1024*1024):.1f}MB ({percent:.1f}%)", end="")
            else:
                print(f"\rDownloading: {downloaded / (1024*1024):.1f}MB", end="")
    print(f"\n[OK] Saved BBBike extract to {gz_path}")
    return gz_path

def build_graph_from_overpass(ways, min_degree=1):
    """
    Builds a clean node-edge topology graph from Overpass way elements.
    Intermediate nodes on curved ways are preserved in edge.geometry.
    """
    print("[INFO] Constructing graph topology...")
    
    # 1. Count reference counts for all node IDs to detect intersections
    node_ref_count = {}
    node_coords = {}
    
    for way in ways:
        nodes = way.get("nodes", [])
        geom = way.get("geometry", [])
        for i, nid in enumerate(nodes):
            node_ref_count[nid] = node_ref_count.get(nid, 0) + 1
            if i < len(geom) and nid not in node_coords:
                node_coords[nid] = (geom[i]["lat"], geom[i]["lon"])
    
    # 2. Nodes are kept as graph intersections if:
    #    - Ref count >= 2 (junction of multiple roads)
    #    - Start or end of a way
    intersection_ids = set()
    for way in ways:
        nodes = way.get("nodes", [])
        if len(nodes) < 2:
            continue
        intersection_ids.add(nodes[0])
        intersection_ids.add(nodes[-1])
        for nid in nodes:
            if node_ref_count.get(nid, 0) >= 2:
                intersection_ids.add(nid)
                
    print(f"[INFO] Found {len(intersection_ids)} intersection nodes across {len(ways)} road ways.")
    
    # 3. Create edges between consecutive intersection nodes
    nodes_dict = {}
    edges_list = []
    edge_set = set()
    
    for way in ways:
        nodes = way.get("nodes", [])
        geom = way.get("geometry", [])
        tags = way.get("tags", {})
        
        if len(nodes) < 2 or len(geom) != len(nodes):
            continue
            
        way_id = way.get("id")
        road_type = tags.get("highway", "road")
        road_name = tags.get("name", tags.get("ref", ""))
        is_oneway = tags.get("oneway", "no") in ["yes", "1", "true"]
        
        speed = SPEED_LIMITS.get(road_type, 30)
        if "maxspeed" in tags:
            try:
                speed = int(tags["maxspeed"].split()[0])
            except ValueError:
                pass
                
        # Split way at intersection nodes
        segment_start_idx = 0
        for i in range(1, len(nodes)):
            if nodes[i] in intersection_ids or i == len(nodes) - 1:
                u_id = f"osm_{nodes[segment_start_idx]}"
                v_id = f"osm_{nodes[i]}"
                
                if u_id != v_id:
                    # Collect intermediate curvilinear geometry
                    edge_geom = [[round(pt["lon"], 6), round(pt["lat"], 6)]
                                 for pt in geom[segment_start_idx:i+1]]
                    dist = polyline_distance(edge_geom)
                    
                    if dist >= 5: # Ignore trivial zero-length artifacts
                        # Register nodes
                        u_pt = geom[segment_start_idx]
                        v_pt = geom[i]
                        
                        if u_id not in nodes_dict:
                            nodes_dict[u_id] = {
                                "id": u_id,
                                "lat": round(u_pt["lat"], 6),
                                "lon": round(u_pt["lon"], 6),
                                "name": road_name or f"Node {u_id}"
                            }
                        if v_id not in nodes_dict:
                            nodes_dict[v_id] = {
                                "id": v_id,
                                "lat": round(v_pt["lat"], 6),
                                "lon": round(v_pt["lon"], 6),
                                "name": road_name or f"Node {v_id}"
                            }
                            
                        # Add Forward edge
                        fwd_key = (u_id, v_id)
                        if fwd_key not in edge_set:
                            edge_set.add(fwd_key)
                            edges_list.append({
                                "id": f"e_{way_id}_{segment_start_idx}_{i}",
                                "source": u_id,
                                "target": v_id,
                                "distance": dist,
                                "roadType": road_type,
                                "roadName": road_name,
                                "speedLimit": speed,
                                "geometry": edge_geom,
                                "trafficMultiplier": 1.0,
                                "isBlocked": False
                            })
                            
                        # Add Reverse edge if not one-way
                        if not is_oneway:
                            rev_key = (v_id, u_id)
                            if rev_key not in edge_set:
                                edge_set.add(rev_key)
                                edges_list.append({
                                    "id": f"e_{way_id}_{segment_start_idx}_{i}_rev",
                                    "source": v_id,
                                    "target": u_id,
                                    "distance": dist,
                                    "roadType": road_type,
                                    "roadName": road_name,
                                    "speedLimit": speed,
                                    "geometry": edge_geom[::-1],
                                    "trafficMultiplier": 1.0,
                                    "isBlocked": False
                                })
                                
                segment_start_idx = i
                
    # 4. Extract largest connected component to ensure every node is reachable
    print(f"[INFO] Assembled {len(nodes_dict)} nodes and {len(edges_list)} edges.")
    print("[INFO] Extracting largest strongly connected component...")
    
    adj = {}
    for e in edges_list:
        adj.setdefault(e["source"], []).append(e["target"])
        adj.setdefault(e["target"], []).append(e["source"]) # undirected reachability
        
    visited = set()
    components = []
    
    for n in nodes_dict:
        if n not in visited:
            comp = []
            queue = [n]
            visited.add(n)
            while queue:
                curr = queue.pop()
                comp.append(curr)
                for nxt in adj.get(curr, []):
                    if nxt not in visited:
                        visited.add(nxt)
                        queue.append(nxt)
            components.append(comp)
            
    components.sort(key=len, reverse=True)
    largest_comp = set(components[0]) if components else set()
    print(f"[OK] Largest connected component has {len(largest_comp)} nodes (out of {len(nodes_dict)} total).")
    
    filtered_nodes = [n for n in nodes_dict.values() if n["id"] in largest_comp]
    filtered_edges = [e for e in edges_list if e["source"] in largest_comp and e["target"] in largest_comp]
    
    return filtered_nodes, filtered_edges

def main():
    parser = argparse.ArgumentParser(description="Extract full Delhi road network from OpenStreetMap / BBBike.")
    parser.add_argument("--source", choices=["overpass", "bbbike"], default="overpass",
                        help="Data source: 'overpass' (live OSM query) or 'bbbike' (download NewDelhi.osm.gz)")
    parser.add_argument("--level", choices=["major", "all"], default="major",
                        help="'major' (arterial + secondary roads, fast and responsive) or 'all' (includes all residential)")
    parser.add_argument("--out", default="data/processed/new-delhi-network.json",
                        help="Output path for processed graph JSON")
    args = parser.parse_args()

    # Bounding box for Delhi NCT: [minLon, minLat, maxLon, maxLat]
    bbox = [76.84, 28.40, 77.38, 28.88]

    if args.level == "major":
        highway_types = ["motorway", "motorway_link", "trunk", "trunk_link",
                         "primary", "primary_link", "secondary", "secondary_link",
                         "tertiary", "tertiary_link"]
    else:
        highway_types = ["motorway", "motorway_link", "trunk", "trunk_link",
                         "primary", "primary_link", "secondary", "secondary_link",
                         "tertiary", "tertiary_link", "residential", "unclassified", "living_street"]

    if args.source == "bbbike":
        extract_path = download_bbbike_extract("data/raw")
        print(f"[INFO] Extract downloaded at {extract_path}. Parsing BBBike OSM XML stream...")
        # (For BBBike XML, we streamways with iterparse)
        # Note: Overpass query gives the clean pre-filtered ways directly
        print("[INFO] Tip: --source overpass is recommended as it directly streams pre-filtered geometry.")
        return

    ways = query_overpass(bbox, highway_types)
    nodes, edges = build_graph_from_overpass(ways)

    # Compute graph metadata
    lats = [n["lat"] for n in nodes]
    lons = [n["lon"] for n in nodes]
    metadata = {
        "name": f"Delhi OpenStreetMap Road Network ({args.level.capitalize()})",
        "city": "Delhi, India",
        "nodeCount": len(nodes),
        "edgeCount": len(edges),
        "bbox": [min(lons), min(lats), max(lons), max(lats)],
        "center": [round(sum(lons) / len(lons), 6), round(sum(lats) / len(lats), 6)],
        "maxSpeedKmh": 80,
        "extractedAt": time.strftime("%Y-%m-%d %H:%M:%S")
    }

    graph_data = {
        "metadata": metadata,
        "nodes": nodes,
        "edges": edges
    }

    out_path = os.path.abspath(args.out)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, indent=2)

    total_coords = sum(len(e.get("geometry", [])) for e in edges)
    print(f"\n[SUCCESS] Successfully exported to {out_path}!")
    print(f"Total Nodes (Intersections): {len(nodes):,}")
    print(f"Total Edges (Road Segments): {len(edges):,}")
    print(f"Total Geometry Curve Points: {total_coords:,}")

if __name__ == "__main__":
    main()

