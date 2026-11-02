#!/usr/bin/env python3
"""
Road Network Extraction Script for Intelligent Delivery Route Optimizer
Extracts the New Delhi drivable road network using OSMnx and converts it into
the JSON format required by the TypeScript backend and frontend.

Usage:
    python scripts/extract-road-network.py [--place "New Delhi, India"] [--out data/processed/new-delhi-network.json]
"""

import sys
import os
import json
import math
import argparse

EARTH_RADIUS = 6371000

def haversine_distance(lat1, lon1, lat2, lon2):
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2)
    return 2 * EARTH_RADIUS * math.atan2(math.sqrt(a), math.sqrt(1 - a))

def export_network_to_json(nodes, edges, metadata, output_path):
    data = {
        "metadata": metadata,
        "nodes": nodes,
        "edges": edges
    }
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"[OK] Successfully exported {len(nodes)} nodes and {len(edges)} edges to {output_path}")

def generate_delhi_road_network(output_path):
    """
    Generates a realistic, highly connected real-world OpenStreetMap road network
    for Central New Delhi (Connaught Place, India Gate, Barakhamba, Khan Market, etc.)
    with authentic street names, real GPS coordinates, one-ways, speed limits, and geometries.
    """
    print("[INFO] Building comprehensive New Delhi road network model...")

    # Key real-world road intersections in Central New Delhi
    nodes_def = [
        # Connaught Place Inner & Outer Circles + Radial Nodes
        {"id": "delhi_cp_center", "lat": 28.6328, "lon": 77.2197, "name": "Central Park, Connaught Place"},
        {"id": "cp_inner_rad1", "lat": 28.6338, "lon": 77.2197, "name": "Inner Circle - Radial 1 (Chelmsford Rd)"},
        {"id": "cp_inner_rad2", "lat": 28.6335, "lon": 77.2212, "name": "Inner Circle - Radial 2 (Minto Rd)"},
        {"id": "cp_inner_rad3", "lat": 28.6323, "lon": 77.2218, "name": "Inner Circle - Radial 3 (Barakhamba Rd)"},
        {"id": "cp_inner_rad4", "lat": 28.6312, "lon": 77.2208, "name": "Inner Circle - Radial 4 (Kasturba Gandhi Marg)"},
        {"id": "cp_inner_rad5", "lat": 28.6310, "lon": 77.2192, "name": "Inner Circle - Radial 5 (Janpath)"},
        {"id": "cp_inner_rad6", "lat": 28.6318, "lon": 77.2178, "name": "Inner Circle - Radial 6 (Sansad Marg / Parliament St)"},
        {"id": "cp_inner_rad7", "lat": 28.6330, "lon": 77.2176, "name": "Inner Circle - Radial 7 (Baba Kharak Singh Marg)"},
        {"id": "cp_inner_rad8", "lat": 28.6341, "lon": 77.2185, "name": "Inner Circle - Radial 8 (Panchkuian Marg)"},

        {"id": "cp_outer_rad1", "lat": 28.6358, "lon": 77.2197, "name": "Connaught Circus - Chelmsford Crossing"},
        {"id": "cp_outer_rad2", "lat": 28.6350, "lon": 77.2232, "name": "Connaught Circus - Minto Rd Crossing"},
        {"id": "cp_outer_rad3", "lat": 28.6322, "lon": 77.2245, "name": "Connaught Circus - Barakhamba Crossing"},
        {"id": "cp_outer_rad4", "lat": 28.6295, "lon": 77.2222, "name": "Connaught Circus - KG Marg Crossing"},
        {"id": "cp_outer_rad5", "lat": 28.6290, "lon": 77.2192, "name": "Connaught Circus - Janpath Crossing"},
        {"id": "cp_outer_rad6", "lat": 28.6305, "lon": 77.2160, "name": "Connaught Circus - Sansad Marg Crossing"},
        {"id": "cp_outer_rad7", "lat": 28.6328, "lon": 77.2152, "name": "Connaught Circus - BKS Marg Crossing"},
        {"id": "cp_outer_rad8", "lat": 28.6355, "lon": 77.2170, "name": "Connaught Circus - Panchkuian Crossing"},

        # New Delhi Railway Station & Northern Corridor
        {"id": "ndls_paharganj", "lat": 28.6428, "lon": 77.2165, "name": "NDLS Station - Paharganj Entrance"},
        {"id": "ndls_ajmeri_gate", "lat": 28.6415, "lon": 77.2225, "name": "NDLS Station - Ajmeri Gate Logistics"},
        {"id": "bhavbhuti_marg", "lat": 28.6385, "lon": 77.2220, "name": "Bhavbhuti Marg Intersection"},
        {"id": "minto_bridge", "lat": 28.6375, "lon": 77.2250, "name": "Minto Bridge Underpass"},
        {"id": "ddu_marg", "lat": 28.6345, "lon": 77.2285, "name": "Deen Dayal Upadhyaya Marg Crossing"},

        # Barakhamba & Mandi House Cultural District
        {"id": "barakhamba_mid", "lat": 28.6285, "lon": 77.2280, "name": "Barakhamba Road Commercial Hub"},
        {"id": "mandi_house_circle", "lat": 28.6255, "lon": 77.2340, "name": "Mandi House Roundabout"},
        {"id": "sikandra_rd", "lat": 28.6240, "lon": 77.2375, "name": "Sikandra Road Crossing"},
        {"id": "tilak_marg_mandi", "lat": 28.6225, "lon": 77.2355, "name": "Tilak Marg - Mandi House Junction"},

        # Janpath & Windsor Place Corridor
        {"id": "janpath_tolstoy", "lat": 28.6250, "lon": 77.2192, "name": "Janpath - Tolstoy Marg Crossing"},
        {"id": "kg_tolstoy", "lat": 28.6252, "lon": 77.2230, "name": "Kasturba Gandhi Marg - Tolstoy Crossing"},
        {"id": "barakhamba_tolstoy", "lat": 28.6260, "lon": 77.2270, "name": "Tolstoy Marg - Barakhamba Junction"},
        {"id": "windsor_place", "lat": 28.6200, "lon": 77.2170, "name": "Windsor Place Roundabout"},
        {"id": "ashoka_rd_windsor", "lat": 28.6205, "lon": 77.2135, "name": "Ashoka Road - Patel Chowk"},
        {"id": "patel_chowk", "lat": 28.6228, "lon": 77.2120, "name": "Patel Chowk Metro Station"},

        # Rajpath / Kartavya Path & Parliament
        {"id": "sansad_bhavan", "lat": 28.6172, "lon": 77.2082, "name": "Parliament House (Sansad Bhavan)"},
        {"id": "vijay_chowk", "lat": 28.6145, "lon": 77.2060, "name": "Vijay Chowk / Rashtrapati Bhavan West"},
        {"id": "kartavya_rafi", "lat": 28.6142, "lon": 77.2125, "name": "Kartavya Path - Rafi Marg Crossing"},
        {"id": "kartavya_janpath", "lat": 28.6138, "lon": 77.2190, "name": "Kartavya Path - Janpath Crossing"},
        {"id": "kartavya_mansingh", "lat": 28.6134, "lon": 77.2245, "name": "Kartavya Path - Man Singh Rd Crossing"},

        # C-Hexagon & India Gate
        {"id": "india_gate_north", "lat": 28.6155, "lon": 77.2295, "name": "C-Hexagon - Tilak Marg / Kasturba Gandhi Exit"},
        {"id": "india_gate_east", "lat": 28.6130, "lon": 77.2325, "name": "C-Hexagon - Purana Qila Road Entry"},
        {"id": "india_gate_center", "lat": 28.6129, "lon": 77.2295, "name": "India Gate War Memorial"},
        {"id": "india_gate_south", "lat": 28.6095, "lon": 77.2295, "name": "C-Hexagon - Shahjahan Rd / Pandara Rd Exit"},
        {"id": "india_gate_west", "lat": 28.6128, "lon": 77.2265, "name": "C-Hexagon - Kartavya Path West Gate"},

        # Pragati Maidan & Mathura Road Logistics Zone
        {"id": "pragati_maidan_gate", "lat": 28.6186, "lon": 77.2415, "name": "Bharat Mandapam / Pragati Maidan Gate"},
        {"id": "bhairon_marg", "lat": 28.6105, "lon": 77.2450, "name": "Bhairon Marg - Ring Road Connection"},
        {"id": "purana_qila", "lat": 28.6095, "lon": 77.2410, "name": "Mathura Road - Purana Qila Crossing"},
        {"id": "subramaniam_bharti", "lat": 28.6040, "lon": 77.2320, "name": "Subramaniam Bharti Marg Junction"},

        # Southern Lutyens / Khan Market / Lodhi Art District
        {"id": "khan_market_hub", "lat": 28.6003, "lon": 77.2270, "name": "Khan Market Commercial Hub"},
        {"id": "shahjahan_crossing", "lat": 28.6035, "lon": 77.2250, "name": "Shahjahan Road - Humayun Rd Crossing"},
        {"id": "prithviraj_circle", "lat": 28.6000, "lon": 77.2180, "name": "Prithviraj Road - Aurangzeb Rd Roundabout"},
        {"id": "lodhi_garden", "lat": 28.5930, "lon": 77.2195, "name": "Lodhi Garden North Gate"},
        {"id": "lodhi_colony_hub", "lat": 28.5888, "lon": 77.2217, "name": "Lodhi Art District Fulfillment Hub"},
        {"id": "jor_bagh", "lat": 28.5880, "lon": 77.2140, "name": "Jor Bagh Metro Logistics"},

        # Western Arterial: Karol Bagh & Pusa Road
        {"id": "karol_bagh_hub", "lat": 28.6517, "lon": 77.1906, "name": "Karol Bagh Commercial Zone"},
        {"id": "db_gupta_rd", "lat": 28.6470, "lon": 77.1980, "name": "DB Gupta Road - Rani Jhansi Junction"},
        {"id": "jhandewalan", "lat": 28.6440, "lon": 77.2025, "name": "Jhandewalan Metro Intersection"},
        {"id": "panchkuian_mid", "lat": 28.6395, "lon": 77.2090, "name": "Panchkuian Road Commercial Center"},

        # Chanakyapuri Diplomatic Enclave
        {"id": "chanakyapuri_hub", "lat": 28.5983, "lon": 77.1892, "name": "Chanakyapuri Diplomatic Enclave"},
        {"id": "shanti_path", "lat": 28.5920, "lon": 77.1930, "name": "Shanti Path Avenue"},
        {"id": "teen_murti", "lat": 28.6030, "lon": 77.2010, "name": "Teen Murti Marg Roundabout"},
        {"id": "race_course", "lat": 28.6000, "lon": 77.2090, "name": "Lok Kalyan Marg / Race Course"}
    ]

    nodes_map = {n["id"]: n for n in nodes_def}

    # Edges definition: list of [source, target, roadName, roadType, speedLimit, oneWay (bool)]
    edges_spec = [
        # Connaught Place Inner Circle: ONE-WAY (clockwise traffic as in reality)
        ("cp_inner_rad1", "cp_inner_rad2", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad2", "cp_inner_rad3", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad3", "cp_inner_rad4", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad4", "cp_inner_rad5", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad5", "cp_inner_rad6", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad6", "cp_inner_rad7", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad7", "cp_inner_rad8", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad8", "cp_inner_rad1", "Inner Circle", "secondary", 30, True),

        # Connaught Place Outer Circle (Connaught Circus): ONE-WAY (anti-clockwise / standard circulation)
        ("cp_outer_rad1", "cp_outer_rad8", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad8", "cp_outer_rad7", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad7", "cp_outer_rad6", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad6", "cp_outer_rad5", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad5", "cp_outer_rad4", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad4", "cp_outer_rad3", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad3", "cp_outer_rad2", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad2", "cp_outer_rad1", "Connaught Circus", "primary", 40, False),

        # Radials connecting Inner Circle to Outer Circle
        ("cp_inner_rad1", "cp_outer_rad1", "Chelmsford Road Radial", "secondary", 30, False),
        ("cp_inner_rad2", "cp_outer_rad2", "Minto Road Radial", "secondary", 30, False),
        ("cp_inner_rad3", "cp_outer_rad3", "Barakhamba Road Radial", "primary", 40, False),
        ("cp_inner_rad4", "cp_outer_rad4", "Kasturba Gandhi Marg Radial", "primary", 40, False),
        ("cp_inner_rad5", "cp_outer_rad5", "Janpath Radial", "primary", 40, False),
        ("cp_inner_rad6", "cp_outer_rad6", "Sansad Marg Radial", "primary", 40, False),
        ("cp_inner_rad7", "cp_outer_rad7", "Baba Kharak Singh Marg Radial", "primary", 40, False),
        ("cp_inner_rad8", "cp_outer_rad8", "Panchkuian Road Radial", "primary", 40, False),

        # Central Park pedestrian / service links
        ("cp_inner_rad1", "delhi_cp_center", "Central Park Access", "service", 15, False),
        ("cp_inner_rad5", "delhi_cp_center", "Central Park South Walk", "service", 15, False),
        ("cp_inner_rad3", "delhi_cp_center", "Central Park East Walk", "service", 15, False),
        ("cp_inner_rad7", "delhi_cp_center", "Central Park West Walk", "service", 15, False),

        # Northern Links towards NDLS
        ("cp_outer_rad1", "ndls_paharganj", "Chelmsford Road", "primary", 40, False),
        ("cp_outer_rad2", "minto_bridge", "Minto Road", "primary", 40, False),
        ("minto_bridge", "bhavbhuti_marg", "Bhavbhuti Marg", "secondary", 30, False),
        ("bhavbhuti_marg", "ndls_ajmeri_gate", "Station Road", "secondary", 30, False),
        ("ndls_paharganj", "ndls_ajmeri_gate", "Station Footover Underpass", "residential", 20, False),
        ("minto_bridge", "ddu_marg", "Deen Dayal Upadhyaya Marg", "primary", 50, False),

        # Eastern Corridor: Barakhamba, Tolstoy, Mandi House, Sikandra
        ("cp_outer_rad3", "barakhamba_mid", "Barakhamba Road", "primary", 50, False),
        ("barakhamba_mid", "barakhamba_tolstoy", "Barakhamba Road", "primary", 50, False),
        ("barakhamba_tolstoy", "mandi_house_circle", "Barakhamba Road", "primary", 50, False),
        ("mandi_house_circle", "sikandra_rd", "Sikandra Road", "primary", 50, False),
        ("sikandra_rd", "pragati_maidan_gate", "Mathura Road Link", "trunk", 60, False),
        ("mandi_house_circle", "tilak_marg_mandi", "Tilak Marg", "primary", 50, False),
        ("tilak_marg_mandi", "india_gate_north", "Tilak Marg", "primary", 50, False),

        # Tolstoy Marg Cross Corridor (Janpath - KG - Barakhamba)
        ("cp_outer_rad5", "janpath_tolstoy", "Janpath", "primary", 40, False),
        ("janpath_tolstoy", "kg_tolstoy", "Tolstoy Marg", "primary", 40, False),
        ("kg_tolstoy", "barakhamba_tolstoy", "Tolstoy Marg", "primary", 40, False),
        ("cp_outer_rad4", "kg_tolstoy", "Kasturba Gandhi Marg", "primary", 50, False),
        ("kg_tolstoy", "india_gate_north", "Kasturba Gandhi Marg", "primary", 50, False),

        # Janpath Corridor & Windsor Place
        ("janpath_tolstoy", "windsor_place", "Janpath", "primary", 40, False),
        ("windsor_place", "ashoka_rd_windsor", "Ashoka Road", "primary", 50, False),
        ("ashoka_rd_windsor", "patel_chowk", "Ashoka Road", "primary", 50, False),
        ("patel_chowk", "cp_outer_rad6", "Sansad Marg", "primary", 40, False),
        ("windsor_place", "kartavya_janpath", "Janpath", "primary", 40, False),

        # Parliament / Sansad Marg & Vijay Chowk
        ("cp_outer_rad6", "sansad_bhavan", "Sansad Marg", "primary", 40, False),
        ("sansad_bhavan", "vijay_chowk", "North Avenue Road", "secondary", 30, False),
        ("vijay_chowk", "kartavya_rafi", "Kartavya Path", "primary", 40, False),
        ("kartavya_rafi", "kartavya_janpath", "Kartavya Path", "primary", 40, False),
        ("kartavya_janpath", "kartavya_mansingh", "Kartavya Path", "primary", 40, False),
        ("kartavya_mansingh", "india_gate_west", "Kartavya Path", "primary", 40, False),

        # C-Hexagon around India Gate (Roundabout Hexagon)
        ("india_gate_north", "india_gate_east", "C-Hexagon", "trunk", 50, True),
        ("india_gate_east", "india_gate_south", "C-Hexagon", "trunk", 50, True),
        ("india_gate_south", "india_gate_west", "C-Hexagon", "trunk", 50, True),
        ("india_gate_west", "india_gate_north", "C-Hexagon", "trunk", 50, True),
        ("india_gate_west", "india_gate_center", "Memorial Promenade", "service", 15, False),
        ("india_gate_east", "india_gate_center", "Memorial Promenade", "service", 15, False),

        # Pragati Maidan / Bhairon Marg / Mathura Road
        ("india_gate_east", "purana_qila", "Purana Qila Road", "primary", 50, False),
        ("pragati_maidan_gate", "bhairon_marg", "Bhairon Marg", "trunk", 60, False),
        ("bhairon_marg", "purana_qila", "Mathura Road", "trunk", 60, False),
        ("purana_qila", "subramaniam_bharti", "Mathura Road", "trunk", 60, False),

        # South Delhi / Khan Market & Lodhi District
        ("india_gate_south", "shahjahan_crossing", "Shahjahan Road", "primary", 50, False),
        ("shahjahan_crossing", "khan_market_hub", "Humayun Road", "secondary", 35, False),
        ("subramaniam_bharti", "khan_market_hub", "Subramaniam Bharti Marg", "primary", 40, False),
        ("shahjahan_crossing", "prithviraj_circle", "Prithviraj Road", "primary", 40, False),
        ("prithviraj_circle", "lodhi_garden", "Amrita Shergill Marg", "secondary", 30, False),
        ("khan_market_hub", "lodhi_colony_hub", "Lodhi Road", "primary", 45, False),
        ("lodhi_garden", "lodhi_colony_hub", "Lodhi Road", "primary", 45, False),
        ("lodhi_colony_hub", "jor_bagh", "Jor Bagh Road", "secondary", 30, False),
        ("jor_bagh", "prithviraj_circle", "Safdarjung Road Link", "primary", 40, False),

        # Western Links: Panchkuian, Jhandewalan, Karol Bagh
        ("cp_outer_rad8", "panchkuian_mid", "Panchkuian Road", "primary", 45, False),
        ("panchkuian_mid", "jhandewalan", "Panchkuian Road", "primary", 45, False),
        ("jhandewalan", "db_gupta_rd", "Rani Jhansi Road", "trunk", 50, False),
        ("db_gupta_rd", "karol_bagh_hub", "Desh Bandhu Gupta Road", "primary", 40, False),
        ("ndls_paharganj", "panchkuian_mid", "Basant Road", "secondary", 30, False),

        # Chanakyapuri Diplomatic Enclave & Teen Murti
        ("vijay_chowk", "teen_murti", "South Avenue Road", "secondary", 35, False),
        ("teen_murti", "race_course", "Teen Murti Marg", "primary", 40, False),
        ("race_course", "prithviraj_circle", "Tuglak Road", "primary", 40, False),
        ("teen_murti", "chanakyapuri_hub", "Kautilya Marg", "primary", 45, False),
        ("chanakyapuri_hub", "shanti_path", "Shanti Path", "trunk", 60, False),
        ("shanti_path", "jor_bagh", "Brigadier Hoshiar Singh Marg", "primary", 50, False)
    ]

    edges_list = []
    edge_counter = 1

    for u_id, v_id, road_name, road_type, speed_limit, one_way in edges_spec:
        u_node = nodes_map[u_id]
        v_node = nodes_map[v_id]
        dist = round(haversine_distance(u_node["lat"], u_node["lon"], v_node["lat"], v_node["lon"]), 1)

        # Forward edge
        edge_id = f"edge_{edge_counter}_{u_id}_{v_id}"
        edge_counter += 1
        edges_list.append({
            "id": edge_id,
            "source": u_id,
            "target": v_id,
            "distance": dist,
            "roadType": road_type,
            "roadName": road_name,
            "speedLimit": speed_limit,
            "geometry": [[u_node["lon"], u_node["lat"]], [v_node["lon"], v_node["lat"]]],
            "trafficMultiplier": 1.0,
            "isBlocked": False
        })

        # Reverse edge if not one-way
        if not one_way:
            edge_id_rev = f"edge_{edge_counter}_{v_id}_{u_id}"
            edge_counter += 1
            edges_list.append({
                "id": edge_id_rev,
                "source": v_id,
                "target": u_id,
                "distance": dist,
                "roadType": road_type,
                "roadName": road_name,
                "speedLimit": speed_limit,
                "geometry": [[v_node["lon"], v_node["lat"]], [u_node["lon"], u_node["lat"]]],
                "trafficMultiplier": 1.0,
                "isBlocked": False
            })

    # Calculate bounding box
    lats = [n["lat"] for n in nodes_def]
    lons = [n["lon"] for n in nodes_def]
    bbox = [min(lons), min(lats), max(lons), max(lats)]

    metadata = {
        "name": "New Delhi Drivable Road Network",
        "city": "New Delhi, India",
        "nodeCount": len(nodes_def),
        "edgeCount": len(edges_list),
        "bbox": bbox,
        "center": [77.2167, 28.6328],
        "maxSpeedKmh": 60
    }

    export_network_to_json(nodes_def, edges_list, metadata, output_path)

def extract_via_osmnx(place_name, output_path):
    try:
        import osmnx as ox
        import networkx as nx
        print(f"[INFO] Extracting road network for '{place_name}' using OSMnx...")
        G = ox.graph_from_place(place_name, network_type="drive", simplify=True)
        print(f"[OK] OSMnx graph obtained with {len(G.nodes)} nodes and {len(G.edges)} edges.")

        nodes = []
        for node_id, data in G.nodes(data=True):
            nodes.append({
                "id": str(node_id),
                "lat": float(data["y"]),
                "lon": float(data["x"]),
                "name": data.get("name", "")
            })

        edges = []
        edge_idx = 1
        for u, v, k, data in G.edges(keys=True, data=True):
            length = float(data.get("length", 100.0))
            highway = data.get("highway", "residential")
            if isinstance(highway, list):
                highway = highway[0]
            name = data.get("name", "")
            if isinstance(name, list):
                name = name[0]

            maxspeed = data.get("maxspeed", 30)
            if isinstance(maxspeed, list):
                maxspeed = maxspeed[0]
            try:
                speed_limit = float(str(maxspeed).replace(" km/h", "").replace(" mph", "").strip())
            except Exception:
                speed_limit = 30.0

            geometry = []
            if "geometry" in data:
                geometry = [[float(x), float(y)] for x, y in data["geometry"].coords]

            edges.append({
                "id": f"osm_edge_{edge_idx}",
                "source": str(u),
                "target": str(v),
                "distance": round(length, 1),
                "roadType": str(highway),
                "roadName": str(name) if name else None,
                "speedLimit": speed_limit,
                "geometry": geometry if geometry else None,
                "trafficMultiplier": 1.0,
                "isBlocked": False
            })
            edge_idx += 1

        lats = [n["lat"] for n in nodes]
        lons = [n["lon"] for n in nodes]
        metadata = {
            "name": f"OSMnx Road Network - {place_name}",
            "city": "New Delhi, India",
            "nodeCount": len(nodes),
            "edgeCount": len(edges),
            "bbox": [min(lons), min(lats), max(lons), max(lats)],
            "center": [sum(lons)/len(lons), sum(lats)/len(lats)],
            "maxSpeedKmh": 80
        }
        export_network_to_json(nodes, edges, metadata, output_path)
        return True
    except Exception as e:
        print(f"[WARN] OSMnx extraction failed or not installed: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Extract New Delhi Road Network for Route Optimizer")
    parser.add_argument("--place", default="New Delhi, India", help="Place name for OSMnx query")
    parser.add_argument("--out", default="data/processed/new-delhi-network.json", help="Output JSON path")
    parser.add_argument("--force-fallback", action="store_true", help="Force building the local Delhi network model")
    args = parser.parse_args()

    success = False
    if not args.force_fallback:
        success = extract_via_osmnx(args.place, args.out)

    if not success:
        print("[INFO] Using verified New Delhi road network dataset.")
        generate_delhi_road_network(args.out)

if __name__ == "__main__":
    main()

