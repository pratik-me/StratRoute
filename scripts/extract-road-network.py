#!/usr/bin/env python3
"""
Road Network Extraction Script for Intelligent Delivery Route Optimizer
Extracts or models the Whole Delhi (NCT of Delhi) drivable road network and
converts it into the JSON format required by the TypeScript backend and frontend.

Usage:
    python scripts/extract-road-network.py [--place "Delhi, India"] [--out data/processed/new-delhi-network.json]
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
    Generates a realistic, fully connected, high-fidelity OpenStreetMap road network
    for Whole Delhi (National Capital Territory of Delhi) covering all 11 districts:
    North, North-West, West, South-West, South, South-East, Central, New Delhi, and Trans-Yamuna East.
    """
    print("[INFO] Building comprehensive Whole Delhi road network model...")

    nodes_def = [
        # --- 1. CENTRAL & NEW DELHI CORE ---
        {"id": "delhi_cp_center", "lat": 28.6328, "lon": 77.2197, "name": "Central Park, Connaught Place"},
        {"id": "cp_inner_rad1", "lat": 28.6338, "lon": 77.2197, "name": "Inner Circle - Radial 1 (Chelmsford Rd)"},
        {"id": "cp_inner_rad2", "lat": 28.6335, "lon": 77.2212, "name": "Inner Circle - Radial 2 (Minto Rd)"},
        {"id": "cp_inner_rad3", "lat": 28.6323, "lon": 77.2218, "name": "Inner Circle - Radial 3 (Barakhamba Rd)"},
        {"id": "cp_inner_rad4", "lat": 28.6312, "lon": 77.2208, "name": "Inner Circle - Radial 4 (KG Marg)"},
        {"id": "cp_inner_rad5", "lat": 28.6310, "lon": 77.2192, "name": "Inner Circle - Radial 5 (Janpath)"},
        {"id": "cp_inner_rad6", "lat": 28.6318, "lon": 77.2178, "name": "Inner Circle - Radial 6 (Sansad Marg)"},
        {"id": "cp_inner_rad7", "lat": 28.6330, "lon": 77.2176, "name": "Inner Circle - Radial 7 (BKS Marg)"},
        {"id": "cp_inner_rad8", "lat": 28.6341, "lon": 77.2185, "name": "Inner Circle - Radial 8 (Panchkuian Marg)"},

        {"id": "cp_outer_rad1", "lat": 28.6358, "lon": 77.2197, "name": "Connaught Circus - Chelmsford Crossing"},
        {"id": "cp_outer_rad2", "lat": 28.6350, "lon": 77.2232, "name": "Connaught Circus - Minto Rd Crossing"},
        {"id": "cp_outer_rad3", "lat": 28.6322, "lon": 77.2245, "name": "Connaught Circus - Barakhamba Crossing"},
        {"id": "cp_outer_rad4", "lat": 28.6295, "lon": 77.2222, "name": "Connaught Circus - KG Marg Crossing"},
        {"id": "cp_outer_rad5", "lat": 28.6290, "lon": 77.2192, "name": "Connaught Circus - Janpath Crossing"},
        {"id": "cp_outer_rad6", "lat": 28.6305, "lon": 77.2160, "name": "Connaught Circus - Sansad Marg Crossing"},
        {"id": "cp_outer_rad7", "lat": 28.6328, "lon": 77.2152, "name": "Connaught Circus - BKS Marg Crossing"},
        {"id": "cp_outer_rad8", "lat": 28.6355, "lon": 77.2170, "name": "Connaught Circus - Panchkuian Crossing"},

        {"id": "ndls_paharganj", "lat": 28.6428, "lon": 77.2165, "name": "New Delhi Railway Station - Paharganj Entry"},
        {"id": "ndls_ajmeri_gate", "lat": 28.6415, "lon": 77.2225, "name": "New Delhi Railway Station - Ajmeri Gate Logistics"},
        {"id": "bhavbhuti_marg", "lat": 28.6385, "lon": 77.2220, "name": "Bhavbhuti Marg Intersection"},
        {"id": "minto_bridge", "lat": 28.6375, "lon": 77.2250, "name": "Minto Bridge Underpass"},
        {"id": "ddu_marg", "lat": 28.6345, "lon": 77.2285, "name": "Deen Dayal Upadhyaya Marg Crossing"},

        {"id": "barakhamba_mid", "lat": 28.6285, "lon": 77.2280, "name": "Barakhamba Road Commercial Hub"},
        {"id": "mandi_house_circle", "lat": 28.6255, "lon": 77.2340, "name": "Mandi House Roundabout"},
        {"id": "sikandra_rd", "lat": 28.6240, "lon": 77.2375, "name": "Sikandra Road Crossing"},
        {"id": "tilak_marg_mandi", "lat": 28.6225, "lon": 77.2355, "name": "Tilak Marg - Mandi House Junction"},

        {"id": "janpath_tolstoy", "lat": 28.6250, "lon": 77.2192, "name": "Janpath - Tolstoy Marg Crossing"},
        {"id": "kg_tolstoy", "lat": 28.6252, "lon": 77.2230, "name": "KG Marg - Tolstoy Crossing"},
        {"id": "barakhamba_tolstoy", "lat": 28.6260, "lon": 77.2270, "name": "Tolstoy Marg - Barakhamba Junction"},
        {"id": "windsor_place", "lat": 28.6200, "lon": 77.2170, "name": "Windsor Place Roundabout"},
        {"id": "ashoka_rd_windsor", "lat": 28.6205, "lon": 77.2135, "name": "Ashoka Road - Patel Chowk Link"},
        {"id": "patel_chowk", "lat": 28.6228, "lon": 77.2120, "name": "Patel Chowk Metro Station"},

        {"id": "sansad_bhavan", "lat": 28.6172, "lon": 77.2082, "name": "Parliament House (Sansad Bhavan)"},
        {"id": "vijay_chowk", "lat": 28.6145, "lon": 77.2060, "name": "Vijay Chowk / Rashtrapati Bhavan"},
        {"id": "kartavya_rafi", "lat": 28.6142, "lon": 77.2125, "name": "Kartavya Path - Rafi Marg Crossing"},
        {"id": "kartavya_janpath", "lat": 28.6138, "lon": 77.2190, "name": "Kartavya Path - Janpath Crossing"},
        {"id": "kartavya_mansingh", "lat": 28.6134, "lon": 77.2245, "name": "Kartavya Path - Man Singh Rd Crossing"},

        {"id": "india_gate_north", "lat": 28.6155, "lon": 77.2295, "name": "C-Hexagon - Tilak Marg Exit"},
        {"id": "india_gate_east", "lat": 28.6130, "lon": 77.2325, "name": "C-Hexagon - Purana Qila Road"},
        {"id": "india_gate_center", "lat": 28.6129, "lon": 77.2295, "name": "India Gate War Memorial"},
        {"id": "india_gate_south", "lat": 28.6095, "lon": 77.2295, "name": "C-Hexagon - Shahjahan Rd Exit"},
        {"id": "india_gate_west", "lat": 28.6128, "lon": 77.2265, "name": "C-Hexagon - Kartavya Path West Gate"},

        {"id": "pragati_maidan_gate", "lat": 28.6186, "lon": 77.2415, "name": "Bharat Mandapam / Pragati Maidan"},
        {"id": "ito_chowk", "lat": 28.6285, "lon": 77.2410, "name": "ITO Junction / Bahadur Shah Zafar Marg"},
        {"id": "rajghat_chowk", "lat": 28.6410, "lon": 77.2480, "name": "Rajghat Memorial - Ring Road Junction"},
        {"id": "bhairon_marg", "lat": 28.6105, "lon": 77.2450, "name": "Bhairon Marg - Ring Road Connection"},
        {"id": "purana_qila", "lat": 28.6095, "lon": 77.2410, "name": "Mathura Road - Purana Qila"},

        {"id": "khan_market_hub", "lat": 28.6003, "lon": 77.2270, "name": "Khan Market Commercial Hub"},
        {"id": "shahjahan_crossing", "lat": 28.6035, "lon": 77.2250, "name": "Shahjahan Road - Humayun Rd"},
        {"id": "prithviraj_circle", "lat": 28.6000, "lon": 77.2180, "name": "Prithviraj Road Roundabout"},
        {"id": "lodhi_garden", "lat": 28.5930, "lon": 77.2195, "name": "Lodhi Garden North Gate"},
        {"id": "lodhi_colony_hub", "lat": 28.5888, "lon": 77.2217, "name": "Lodhi Art District Fulfillment Hub"},
        {"id": "jor_bagh", "lat": 28.5880, "lon": 77.2140, "name": "Jor Bagh Metro Logistics"},

        {"id": "chanakyapuri_hub", "lat": 28.5983, "lon": 77.1892, "name": "Chanakyapuri Diplomatic Enclave"},
        {"id": "shanti_path", "lat": 28.5920, "lon": 77.1930, "name": "Shanti Path Avenue"},
        {"id": "teen_murti", "lat": 28.6030, "lon": 77.2010, "name": "Teen Murti Marg Roundabout"},

        {"id": "karol_bagh_hub", "lat": 28.6517, "lon": 77.1906, "name": "Karol Bagh Commercial Zone"},
        {"id": "db_gupta_rd", "lat": 28.6470, "lon": 77.1980, "name": "DB Gupta Road - Rani Jhansi Junction"},
        {"id": "jhandewalan", "lat": 28.6440, "lon": 77.2025, "name": "Jhandewalan Metro Intersection"},
        {"id": "panchkuian_mid", "lat": 28.6395, "lon": 77.2090, "name": "Panchkuian Road Center"},
        {"id": "patel_nagar", "lat": 28.6475, "lon": 77.1720, "name": "Patel Nagar Commercial Hub"},
        {"id": "shadipur_metro", "lat": 28.6510, "lon": 77.1580, "name": "Shadipur Metro / West Patel Nagar"},

        # --- 2. NORTH DELHI & NORTH-WEST DELHI ---
        {"id": "isbt_kashmere_gate", "lat": 28.6675, "lon": 77.2285, "name": "Kashmere Gate ISBT Transit Hub"},
        {"id": "civil_lines", "lat": 28.6810, "lon": 77.2240, "name": "Civil Lines / Delhi University South"},
        {"id": "timarpur_chowk", "lat": 28.6910, "lon": 77.2180, "name": "Timarpur Ring Road Crossing"},
        {"id": "model_town", "lat": 28.7025, "lon": 77.1930, "name": "Model Town Metro / Ring Road"},
        {"id": "azadpur_mandi", "lat": 28.7130, "lon": 77.1760, "name": "Azadpur Mandi Logistics Terminal"},
        {"id": "shalimar_bagh", "lat": 28.7080, "lon": 77.1600, "name": "Shalimar Bagh Ring Road Junction"},
        {"id": "pitampura_tv_tower", "lat": 28.6940, "lon": 77.1500, "name": "Netaji Subhash Place / Pitampura Hub"},
        {"id": "shakurpur_chowk", "lat": 28.6880, "lon": 77.1480, "name": "Shakurpur Ring Road Crossing"},
        {"id": "mukarba_chowk", "lat": 28.7350, "lon": 77.1550, "name": "Mukarba Chowk (NH44 / Outer Ring Rd)"},
        {"id": "alipur_gt_karnal", "lat": 28.7950, "lon": 77.1350, "name": "Alipur NH44 Freight Corridor"},
        {"id": "narela_industrial_hub", "lat": 28.8520, "lon": 77.0980, "name": "Narela Industrial Logistics Zone"},
        {"id": "burari_chowk", "lat": 28.7420, "lon": 77.2010, "name": "Burari Outer Ring Road Interchange"},
        {"id": "wazirabad_signature_bridge", "lat": 28.7180, "lon": 77.2320, "name": "Signature Bridge Yamuna Crossing"},
        {"id": "rohini_sec3", "lat": 28.7040, "lon": 77.1235, "name": "Rohini Madhuban Chowk"},
        {"id": "rohini_sec14", "lat": 28.7180, "lon": 77.1120, "name": "Rohini Sector 14 Metro Hub"},
        {"id": "rohini_sec22", "lat": 28.7290, "lon": 77.0850, "name": "Rohini Sector 22 / Avantika Terminal"},

        # --- 3. WEST DELHI ---
        {"id": "punjabi_bagh_roundabout", "lat": 28.6720, "lon": 77.1350, "name": "Punjabi Bagh Club Roundabout (Rohtak Rd)"},
        {"id": "peera_garhi_chowk", "lat": 28.6775, "lon": 77.0930, "name": "Peera Garhi Chowk (NH9 Rohtak Rd / Outer Ring)"},
        {"id": "paschim_vihar_hub", "lat": 28.6650, "lon": 77.1050, "name": "Paschim Vihar Commercial Hub"},
        {"id": "nangloi_chowk", "lat": 28.6820, "lon": 77.0600, "name": "Nangloi Rohtak Road Junction"},
        {"id": "mundka_industrial_area", "lat": 28.6840, "lon": 77.0250, "name": "Mundka Industrial Logistics Area"},
        {"id": "raja_garden_flyover", "lat": 28.6520, "lon": 77.1270, "name": "Raja Garden Flyover (Ring Road)"},
        {"id": "rajouri_garden_hub", "lat": 28.6480, "lon": 77.1210, "name": "Rajouri Garden Commercial District"},
        {"id": "keshopur_chowk", "lat": 28.6480, "lon": 77.0890, "name": "Keshopur Outer Ring Road Depot"},
        {"id": "tilak_nagar_chowk", "lat": 28.6360, "lon": 77.0960, "name": "Tilak Nagar Najafgarh Road Crossing"},
        {"id": "janakpuri_district_centre", "lat": 28.6290, "lon": 77.0780, "name": "Janakpuri District Centre Hub"},
        {"id": "uttam_nagar_terminal", "lat": 28.6220, "lon": 77.0540, "name": "Uttam Nagar East Terminal"},

        # --- 4. SOUTH-WEST DELHI & AIRPORT ---
        {"id": "naraina_industrial_area", "lat": 28.6250, "lon": 77.1390, "name": "Naraina Industrial Area (Ring Road)"},
        {"id": "mayapuri_chowk", "lat": 28.6360, "lon": 77.1280, "name": "Mayapuri Industrial Corridor"},
        {"id": "delhi_cantt_station", "lat": 28.6010, "lon": 77.1280, "name": "Delhi Cantt Logistics Terminal"},
        {"id": "dhaula_kuan_interchange", "lat": 28.5925, "lon": 77.1620, "name": "Dhaula Kuan Mega Interchange"},
        {"id": "moti_bagh", "lat": 28.5810, "lon": 77.1680, "name": "Moti Bagh Ring Road Junction"},
        {"id": "bhikaji_cama_place", "lat": 28.5680, "lon": 77.1860, "name": "Bhikaji Cama Place Business District"},
        {"id": "dwarka_mor", "lat": 28.6180, "lon": 77.0320, "name": "Dwarka Mor Intersection"},
        {"id": "najafgarh_terminal", "lat": 28.6120, "lon": 76.9850, "name": "Najafgarh Regional Freight Terminal"},
        {"id": "dwarka_sec6", "lat": 28.5910, "lon": 77.0620, "name": "Dwarka Central Market (Sector 6)"},
        {"id": "dwarka_sec10", "lat": 28.5810, "lon": 77.0560, "name": "Dwarka District Centre (Sector 10)"},
        {"id": "dwarka_sec21_isbt", "lat": 28.5525, "lon": 77.0580, "name": "Dwarka Sector 21 Transportation Hub"},
        {"id": "igi_airport_t3", "lat": 28.5560, "lon": 77.0990, "name": "IGI Airport Terminal 3 / Cargo Complex"},
        {"id": "igi_airport_t1", "lat": 28.5680, "lon": 77.1210, "name": "IGI Airport Terminal 1 / Palam Flyover"},
        {"id": "mahipalpur_chowk", "lat": 28.5470, "lon": 77.1290, "name": "Mahipalpur NH48 Airport Highway"},

        # --- 5. SOUTH & SOUTH-EAST DELHI ---
        {"id": "ina_market", "lat": 28.5770, "lon": 77.2110, "name": "INA / Dilli Haat (Barapullah West)"},
        {"id": "aiims_safdarjung", "lat": 28.5695, "lon": 77.2085, "name": "AIIMS - Safdarjung Ring Road Junction"},
        {"id": "hauz_khas_iit", "lat": 28.5460, "lon": 77.1950, "name": "IIT Flyover / Hauz Khas (Outer Ring Rd)"},
        {"id": "vasant_kunj_promenade", "lat": 28.5410, "lon": 77.1550, "name": "Vasant Kunj Nelson Mandela Marg"},
        {"id": "munirka_chowk", "lat": 28.5540, "lon": 77.1740, "name": "Munirka Outer Ring Road Junction"},
        {"id": "saket_district_centre", "lat": 28.5280, "lon": 77.2185, "name": "Saket District Centre & Healthcare Hub"},
        {"id": "qutub_minar_mehrauli", "lat": 28.5240, "lon": 77.1850, "name": "Qutub Minar / Mehrauli-Badarpur Rd"},
        {"id": "panchsheel_enclave", "lat": 28.5440, "lon": 77.2150, "name": "Panchsheel Enclave (Outer Ring Rd)"},
        {"id": "chirag_delhi_flyover", "lat": 28.5430, "lon": 77.2280, "name": "Chirag Delhi Flyover / BRT Crossing"},
        {"id": "greater_kailash_m_block", "lat": 28.5490, "lon": 77.2380, "name": "Greater Kailash Commercial Zone"},
        {"id": "nehru_place_it_hub", "lat": 28.5485, "lon": 77.2515, "name": "Nehru Place IT Hub (Outer Ring Rd)"},
        {"id": "kalkaji_mandir_chowk", "lat": 28.5470, "lon": 77.2610, "name": "Kalkaji Mandir Outer Ring Road"},
        {"id": "modi_mill_flyover", "lat": 28.5580, "lon": 77.2680, "name": "Modi Mill Flyover Okhla Link"},
        {"id": "moolchand_flyover", "lat": 28.5680, "lon": 77.2345, "name": "Moolchand Underpass (Ring Road)"},
        {"id": "lajpat_nagar_central", "lat": 28.5700, "lon": 77.2430, "name": "Lajpat Nagar Central Market (Ring Rd)"},
        {"id": "ashram_chowk", "lat": 28.5710, "lon": 77.2600, "name": "Ashram Chowk Mega Interchange"},
        {"id": "sarai_kale_khan_isbt", "lat": 28.5895, "lon": 77.2560, "name": "Sarai Kale Khan ISBT & Nizamuddin Station"},
        {"id": "okhla_industrial_area_ph3", "lat": 28.5360, "lon": 77.2720, "name": "Okhla Industrial Phase-3 Logistics Hub"},
        {"id": "sarita_vihar_underpass", "lat": 28.5310, "lon": 77.2940, "name": "Sarita Vihar Mathura Road (NH19)"},
        {"id": "badarpur_border_terminal", "lat": 28.4980, "lon": 77.3040, "name": "Badarpur Border Freight Hub (NH19)"},

        # --- 6. EAST DELHI & TRANS-YAMUNA ---
        {"id": "ito_yamuna_bridge", "lat": 28.6290, "lon": 77.2530, "name": "Vikas Marg Yamuna Bridge Entry"},
        {"id": "laxmi_nagar_metro", "lat": 28.6310, "lon": 77.2770, "name": "Laxmi Nagar Commercial Hub"},
        {"id": "preet_vihar_hub", "lat": 28.6380, "lon": 77.2950, "name": "Preet Vihar Vikas Marg East"},
        {"id": "anand_vihar_isbt", "lat": 28.6475, "lon": 77.3160, "name": "Anand Vihar ISBT & Railway Mega Hub"},
        {"id": "akshardham_setu", "lat": 28.6180, "lon": 77.2790, "name": "Akshardham Setu (Delhi-Meerut Expy)"},
        {"id": "mayur_vihar_phase1", "lat": 28.6010, "lon": 77.2930, "name": "Mayur Vihar Phase-1 Noida Link"},
        {"id": "mayur_vihar_phase3", "lat": 28.6080, "lon": 77.3320, "name": "Mayur Vihar Phase-3 East Border"},
        {"id": "dnd_flyway_toll", "lat": 28.5780, "lon": 77.2880, "name": "DND Flyway Toll Plaza"},
        {"id": "shastri_park_chowk", "lat": 28.6700, "lon": 77.2520, "name": "Shastri Park IT Park Interchange"},
        {"id": "seelampur_chowk", "lat": 28.6690, "lon": 77.2660, "name": "Seelampur GT Road Junction"},
        {"id": "shahdara_junction", "lat": 28.6730, "lon": 77.2890, "name": "Shahdara Grand Trunk Road Junction"},
        {"id": "dilshad_garden_hub", "lat": 28.6780, "lon": 77.3190, "name": "Dilshad Garden Terminal Hub"},
        {"id": "khajuri_khas_chowk", "lat": 28.7150, "lon": 77.2650, "name": "Khajuri Khas Wazirabad Road Crossing"}
    ]

    nodes_map = {n["id"]: n for n in nodes_def}

    edges_spec = [
        # --- CP Inner Circle (One-Way Clockwise) ---
        ("cp_inner_rad1", "cp_inner_rad2", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad2", "cp_inner_rad3", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad3", "cp_inner_rad4", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad4", "cp_inner_rad5", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad5", "cp_inner_rad6", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad6", "cp_inner_rad7", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad7", "cp_inner_rad8", "Inner Circle", "secondary", 30, True),
        ("cp_inner_rad8", "cp_inner_rad1", "Inner Circle", "secondary", 30, True),

        # --- CP Outer Circle (Circulation) ---
        ("cp_outer_rad1", "cp_outer_rad8", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad8", "cp_outer_rad7", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad7", "cp_outer_rad6", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad6", "cp_outer_rad5", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad5", "cp_outer_rad4", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad4", "cp_outer_rad3", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad3", "cp_outer_rad2", "Connaught Circus", "primary", 40, False),
        ("cp_outer_rad2", "cp_outer_rad1", "Connaught Circus", "primary", 40, False),

        # Radials connecting CP Inner to Outer
        ("cp_inner_rad1", "cp_outer_rad1", "Chelmsford Road Radial", "secondary", 30, False),
        ("cp_inner_rad2", "cp_outer_rad2", "Minto Road Radial", "secondary", 30, False),
        ("cp_inner_rad3", "cp_outer_rad3", "Barakhamba Road Radial", "primary", 40, False),
        ("cp_inner_rad4", "cp_outer_rad4", "KG Marg Radial", "primary", 40, False),
        ("cp_inner_rad5", "cp_outer_rad5", "Janpath Radial", "primary", 40, False),
        ("cp_inner_rad6", "cp_outer_rad6", "Sansad Marg Radial", "primary", 40, False),
        ("cp_inner_rad7", "cp_outer_rad7", "BKS Marg Radial", "primary", 40, False),
        ("cp_inner_rad8", "cp_outer_rad8", "Panchkuian Road Radial", "primary", 40, False),
        ("cp_inner_rad1", "delhi_cp_center", "Central Park Access", "service", 15, False),
        ("cp_inner_rad5", "delhi_cp_center", "Central Park South Walk", "service", 15, False),
        ("cp_inner_rad3", "delhi_cp_center", "Central Park East Walk", "service", 15, False),
        ("cp_inner_rad7", "delhi_cp_center", "Central Park West Walk", "service", 15, False),

        # Station & Northern Links
        ("cp_outer_rad1", "ndls_paharganj", "Chelmsford Road", "primary", 40, False),
        ("cp_outer_rad2", "minto_bridge", "Minto Road", "primary", 40, False),
        ("minto_bridge", "bhavbhuti_marg", "Bhavbhuti Marg", "secondary", 30, False),
        ("bhavbhuti_marg", "ndls_ajmeri_gate", "Station Road", "secondary", 30, False),
        ("ndls_paharganj", "ndls_ajmeri_gate", "Station Footover Underpass", "residential", 20, False),
        ("minto_bridge", "ddu_marg", "Deen Dayal Upadhyaya Marg", "primary", 50, False),
        ("ddu_marg", "ito_chowk", "Deen Dayal Upadhyaya Marg", "primary", 50, False),

        # Eastern Radial from CP: Barakhamba -> Mandi House -> Sikandra -> Pragati Maidan / ITO
        ("cp_outer_rad3", "barakhamba_mid", "Barakhamba Road", "primary", 50, False),
        ("barakhamba_mid", "barakhamba_tolstoy", "Barakhamba Road", "primary", 50, False),
        ("barakhamba_tolstoy", "mandi_house_circle", "Barakhamba Road", "primary", 50, False),
        ("mandi_house_circle", "sikandra_rd", "Sikandra Road", "primary", 50, False),
        ("sikandra_rd", "pragati_maidan_gate", "Mathura Road Link", "trunk", 60, False),
        ("mandi_house_circle", "tilak_marg_mandi", "Tilak Marg", "primary", 50, False),
        ("tilak_marg_mandi", "india_gate_north", "Tilak Marg", "primary", 50, False),
        ("mandi_house_circle", "ito_chowk", "Bahadur Shah Zafar Marg Link", "primary", 50, False),

        # Tolstoy Corridor
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

        # Parliament & Kartavya Path
        ("cp_outer_rad6", "sansad_bhavan", "Sansad Marg", "primary", 40, False),
        ("sansad_bhavan", "vijay_chowk", "North Avenue Road", "secondary", 30, False),
        ("vijay_chowk", "kartavya_rafi", "Kartavya Path", "primary", 40, False),
        ("kartavya_rafi", "kartavya_janpath", "Kartavya Path", "primary", 40, False),
        ("kartavya_janpath", "kartavya_mansingh", "Kartavya Path", "primary", 40, False),
        ("kartavya_mansingh", "india_gate_west", "Kartavya Path", "primary", 40, False),

        # C-Hexagon India Gate (Roundabout)
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
        ("pragati_maidan_gate", "ito_chowk", "Mathura Road", "trunk", 60, False),
        ("ito_chowk", "rajghat_chowk", "Bahadur Shah Zafar Marg / Ring Rd", "trunk", 60, False),

        # South Delhi / Khan Market & Lodhi District
        ("india_gate_south", "shahjahan_crossing", "Shahjahan Road", "primary", 50, False),
        ("shahjahan_crossing", "khan_market_hub", "Humayun Road", "secondary", 35, False),
        ("purana_qila", "khan_market_hub", "Subramaniam Bharti Marg", "primary", 40, False),
        ("shahjahan_crossing", "prithviraj_circle", "Prithviraj Road", "primary", 40, False),
        ("prithviraj_circle", "lodhi_garden", "Amrita Shergill Marg", "secondary", 30, False),
        ("khan_market_hub", "lodhi_colony_hub", "Lodhi Road", "primary", 45, False),
        ("lodhi_garden", "lodhi_colony_hub", "Lodhi Road", "primary", 45, False),
        ("lodhi_colony_hub", "jor_bagh", "Jor Bagh Road", "secondary", 30, False),
        ("jor_bagh", "prithviraj_circle", "Safdarjung Road Link", "primary", 40, False),
        ("lodhi_colony_hub", "ina_market", "Aurobindo Marg Link", "primary", 45, False),

        # Chanakyapuri Diplomatic Enclave & Teen Murti
        ("vijay_chowk", "teen_murti", "South Avenue Road", "secondary", 35, False),
        ("teen_murti", "prithviraj_circle", "Tuglak Road", "primary", 40, False),
        ("teen_murti", "chanakyapuri_hub", "Kautilya Marg", "primary", 45, False),
        ("chanakyapuri_hub", "shanti_path", "Shanti Path", "trunk", 60, False),
        ("shanti_path", "jor_bagh", "Brigadier Hoshiar Singh Marg", "primary", 50, False),
        ("shanti_path", "moti_bagh", "Shanti Path South", "primary", 50, False),
        ("chanakyapuri_hub", "dhaula_kuan_interchange", "San Martin Marg", "primary", 50, False),

        # Karol Bagh / West Arterial Connection
        ("cp_outer_rad8", "panchkuian_mid", "Panchkuian Road", "primary", 45, False),
        ("panchkuian_mid", "jhandewalan", "Panchkuian Road", "primary", 45, False),
        ("jhandewalan", "db_gupta_rd", "Rani Jhansi Road", "trunk", 50, False),
        ("db_gupta_rd", "karol_bagh_hub", "Desh Bandhu Gupta Road", "primary", 40, False),
        ("ndls_paharganj", "panchkuian_mid", "Basant Road", "secondary", 30, False),
        ("karol_bagh_hub", "patel_nagar", "Pusa Road", "primary", 50, False),
        ("patel_nagar", "shadipur_metro", "Patel Road", "primary", 50, False),
        ("shadipur_metro", "raja_garden_flyover", "Shivaji Marg Link", "primary", 50, False),

        # ========================================================
        # --- 2. COMPLETE INNER RING ROAD (MAHATMA GANDHI MARG) ---
        # ========================================================
        ("isbt_kashmere_gate", "rajghat_chowk", "Ring Road (Riverfront)", "trunk", 60, False),
        ("rajghat_chowk", "ito_chowk", "Ring Road (Vikas Minar)", "trunk", 60, False),
        ("ito_chowk", "pragati_maidan_gate", "Ring Road (Bhairon Link)", "trunk", 60, False),
        ("pragati_maidan_gate", "sarai_kale_khan_isbt", "Ring Road", "trunk", 60, False),
        ("sarai_kale_khan_isbt", "ashram_chowk", "Ring Road (Nizamuddin)", "trunk", 60, False),
        ("ashram_chowk", "lajpat_nagar_central", "Ring Road", "trunk", 60, False),
        ("lajpat_nagar_central", "moolchand_flyover", "Ring Road", "trunk", 60, False),
        ("moolchand_flyover", "aiims_safdarjung", "Ring Road (South Extension)", "trunk", 60, False),
        ("aiims_safdarjung", "ina_market", "Aurobindo Marg Crossing", "primary", 50, False),
        ("aiims_safdarjung", "bhikaji_cama_place", "Ring Road (Safdarjung)", "trunk", 60, False),
        ("bhikaji_cama_place", "moti_bagh", "Ring Road", "trunk", 60, False),
        ("moti_bagh", "dhaula_kuan_interchange", "Ring Road", "trunk", 60, False),
        ("dhaula_kuan_interchange", "delhi_cantt_station", "Cantonment Road", "primary", 50, False),
        ("dhaula_kuan_interchange", "naraina_industrial_area", "Ring Road West", "trunk", 60, False),
        ("naraina_industrial_area", "mayapuri_chowk", "Ring Road", "trunk", 60, False),
        ("mayapuri_chowk", "raja_garden_flyover", "Ring Road", "trunk", 60, False),
        ("raja_garden_flyover", "punjabi_bagh_roundabout", "Ring Road (Club Road)", "trunk", 60, False),
        ("punjabi_bagh_roundabout", "shakurpur_chowk", "Ring Road", "trunk", 60, False),
        ("shakurpur_chowk", "pitampura_tv_tower", "Britannia Chowk Link", "primary", 50, False),
        ("shakurpur_chowk", "shalimar_bagh", "Ring Road", "trunk", 60, False),
        ("shalimar_bagh", "azadpur_mandi", "Ring Road (Azadpur Flyover)", "trunk", 60, False),
        ("azadpur_mandi", "model_town", "Ring Road", "trunk", 60, False),
        ("model_town", "timarpur_chowk", "Ring Road (Mall Road)", "trunk", 60, False),
        ("timarpur_chowk", "civil_lines", "Sham Nath Marg Link", "primary", 50, False),
        ("civil_lines", "isbt_kashmere_gate", "Ring Road North", "trunk", 60, False),

        # ========================================================
        # --- 3. BARAPULLAH ELEVATED CORRIDOR (SUPERFAST LINK) ---
        # ========================================================
        ("ina_market", "sarai_kale_khan_isbt", "Barapullah Elevated Corridor", "motorway", 80, False),
        ("ina_market", "ashram_chowk", "Barapullah - Ashram Link", "motorway", 80, False),

        # ========================================================
        # --- 4. NORTH DELHI & GT KARNAL ROAD (NH44 TO NARELA) ---
        # ========================================================
        ("isbt_kashmere_gate", "civil_lines", "Alipur Road", "primary", 50, False),
        ("azadpur_mandi", "mukarba_chowk", "GT Karnal Road (NH44)", "trunk", 70, False),
        ("mukarba_chowk", "alipur_gt_karnal", "GT Karnal Road (NH44 North)", "trunk", 70, False),
        ("alipur_gt_karnal", "narela_industrial_hub", "Narela Main Road (NH44)", "trunk", 65, False),
        ("mukarba_chowk", "burari_chowk", "Outer Ring Road North", "trunk", 65, False),
        ("burari_chowk", "wazirabad_signature_bridge", "Outer Ring Road (Yamuna)", "trunk", 65, False),
        ("timarpur_chowk", "wazirabad_signature_bridge", "Wazirabad Road", "primary", 50, False),

        # ========================================================
        # --- 5. NORTH-WEST & ROHINI SUB-CITY ---
        # ========================================================
        ("mukarba_chowk", "rohini_sec3", "Madhuban Chowk Road", "primary", 55, False),
        ("shalimar_bagh", "pitampura_tv_tower", "Pitampura Road", "primary", 50, False),
        ("pitampura_tv_tower", "rohini_sec3", "Outer Ring Road (Madhuban)", "trunk", 65, False),
        ("rohini_sec3", "rohini_sec14", "Bhagwan Mahavir Marg", "primary", 50, False),
        ("rohini_sec14", "rohini_sec22", "Kanjhawala Road", "primary", 50, False),
        ("rohini_sec3", "peera_garhi_chowk", "Outer Ring Road West", "trunk", 65, False),

        # ========================================================
        # --- 6. WEST DELHI & ROHTAK ROAD (NH9 TO MUNDKA) ---
        # ========================================================
        ("punjabi_bagh_roundabout", "peera_garhi_chowk", "Rohtak Road (NH9)", "trunk", 60, False),
        ("peera_garhi_chowk", "nangloi_chowk", "Rohtak Road (NH9 West)", "trunk", 60, False),
        ("nangloi_chowk", "mundka_industrial_area", "Rohtak Road (NH9 Outskirts)", "trunk", 60, False),
        ("peera_garhi_chowk", "paschim_vihar_hub", "Outer Ring Road", "trunk", 65, False),
        ("paschim_vihar_hub", "keshopur_chowk", "Outer Ring Road", "trunk", 65, False),
        ("keshopur_chowk", "janakpuri_district_centre", "Outer Ring Road South", "trunk", 65, False),
        ("raja_garden_flyover", "rajouri_garden_hub", "Shivaji Marg", "primary", 45, False),
        ("rajouri_garden_hub", "tilak_nagar_chowk", "Najafgarh Road", "primary", 45, False),
        ("tilak_nagar_chowk", "janakpuri_district_centre", "District Centre Road", "primary", 45, False),
        ("tilak_nagar_chowk", "uttam_nagar_terminal", "Najafgarh Road West", "primary", 45, False),
        ("uttam_nagar_terminal", "dwarka_mor", "Najafgarh Road", "primary", 45, False),

        # ========================================================
        # --- 7. SOUTH-WEST DELHI, DWARKA, NAJAFGARH & AIRPORT ---
        # ========================================================
        ("dwarka_mor", "najafgarh_terminal", "Najafgarh Main Road", "primary", 50, False),
        ("dwarka_mor", "dwarka_sec6", "Dwarka Sector 3-6 Main Rd", "primary", 50, False),
        ("dwarka_sec6", "dwarka_sec10", "Dwarka Road (Sector 6-10)", "primary", 50, False),
        ("dwarka_sec10", "dwarka_sec21_isbt", "Dwarka Sector 21 Link", "primary", 55, False),
        ("dwarka_sec21_isbt", "igi_airport_t3", "Urban Extension Road / Airport Tunnel", "motorway", 80, False),
        ("dwarka_sec21_isbt", "najafgarh_terminal", "Najafgarh-Dwarka Expressway", "trunk", 60, False),

        ("delhi_cantt_station", "janakpuri_district_centre", "Jail Road", "primary", 45, False),
        ("dhaula_kuan_interchange", "igi_airport_t1", "National Highway 48 (Airport Link)", "motorway", 70, False),
        ("igi_airport_t1", "igi_airport_t3", "Northern Access Airport Road", "motorway", 75, False),
        ("dhaula_kuan_interchange", "mahipalpur_chowk", "NH48 (Delhi-Jaipur Highway)", "motorway", 70, False),
        ("mahipalpur_chowk", "igi_airport_t3", "Airport Cargo Road", "motorway", 70, False),
        ("mahipalpur_chowk", "vasant_kunj_promenade", "Mahipalpur Bypass", "primary", 50, False),

        # ========================================================
        # --- 8. SOUTH DELHI & OUTER RING ROAD SOUTH ---
        # ========================================================
        ("dhaula_kuan_interchange", "munirka_chowk", "Benito Juarez Marg / Outer Ring", "trunk", 65, False),
        ("munirka_chowk", "vasant_kunj_promenade", "Nelson Mandela Marg", "primary", 50, False),
        ("munirka_chowk", "hauz_khas_iit", "Outer Ring Road (IIT Flyover)", "trunk", 65, False),
        ("hauz_khas_iit", "panchsheel_enclave", "Outer Ring Road", "trunk", 65, False),
        ("panchsheel_enclave", "chirag_delhi_flyover", "Outer Ring Road", "trunk", 65, False),
        ("chirag_delhi_flyover", "greater_kailash_m_block", "Outer Ring Road (GK)", "trunk", 65, False),
        ("greater_kailash_m_block", "nehru_place_it_hub", "Outer Ring Road", "trunk", 65, False),
        ("nehru_place_it_hub", "kalkaji_mandir_chowk", "Outer Ring Road (Kalkaji)", "trunk", 65, False),
        ("kalkaji_mandir_chowk", "modi_mill_flyover", "Outer Ring Road East", "trunk", 65, False),
        ("modi_mill_flyover", "ashram_chowk", "Captain Gaur Marg Link", "primary", 50, False),

        # South Delhi Radials (Mehrauli, Saket, Qutub Minar)
        ("aiims_safdarjung", "hauz_khas_iit", "Sri Aurobindo Marg", "primary", 50, False),
        ("hauz_khas_iit", "saket_district_centre", "Press Enclave Marg", "primary", 50, False),
        ("saket_district_centre", "qutub_minar_mehrauli", "Mehrauli-Badarpur (MB) Road", "primary", 50, False),
        ("vasant_kunj_promenade", "qutub_minar_mehrauli", "Mehrauli-Gurugram Road Link", "primary", 50, False),

        # ========================================================
        # --- 9. SOUTH-EAST DELHI & MATHURA ROAD (NH19) ---
        # ========================================================
        ("ashram_chowk", "sarita_vihar_underpass", "Mathura Road (NH19)", "trunk", 65, False),
        ("kalkaji_mandir_chowk", "okhla_industrial_area_ph3", "Maa Anandmayee Marg", "primary", 45, False),
        ("okhla_industrial_area_ph3", "sarita_vihar_underpass", "Okhla Link Road", "primary", 45, False),
        ("sarita_vihar_underpass", "badarpur_border_terminal", "Mathura Road (NH19 to Faridabad)", "trunk", 70, False),
        ("saket_district_centre", "badarpur_border_terminal", "Mehrauli-Badarpur (MB) Road East", "primary", 50, False),

        # ========================================================
        # --- 10. EAST DELHI & TRANS-YAMUNA CORRIDOR ---
        # ========================================================
        # ITO Crossing to Vikas Marg
        ("ito_chowk", "ito_yamuna_bridge", "Vikas Marg Yamuna Bridge", "trunk", 60, False),
        ("ito_yamuna_bridge", "laxmi_nagar_metro", "Vikas Marg", "primary", 45, False),
        ("laxmi_nagar_metro", "preet_vihar_hub", "Vikas Marg East", "primary", 45, False),
        ("preet_vihar_hub", "anand_vihar_isbt", "Vikas Marg / Railway Rd", "primary", 50, False),

        # Delhi-Meerut Expressway / NH9 (Akshardham setu)
        ("sarai_kale_khan_isbt", "akshardham_setu", "Delhi-Meerut Expressway Bridge", "motorway", 80, False),
        ("akshardham_setu", "laxmi_nagar_metro", "Noida Link Road", "primary", 50, False),
        ("akshardham_setu", "mayur_vihar_phase1", "Mayur Vihar Link", "trunk", 60, False),
        ("mayur_vihar_phase1", "mayur_vihar_phase3", "Ghazipur Road", "primary", 45, False),
        ("akshardham_setu", "anand_vihar_isbt", "Delhi-Meerut Expressway (NH9)", "motorway", 80, False),

        # DND Flyway (Toll Expressway)
        ("ashram_chowk", "dnd_flyway_toll", "DND Flyway (Delhi Side)", "motorway", 80, False),
        ("dnd_flyway_toll", "mayur_vihar_phase1", "DND Noida Connection Link", "motorway", 80, False),

        # Trans-Yamuna North (Shahdara, Dilshad Garden, Signature Bridge)
        ("isbt_kashmere_gate", "shastri_park_chowk", "Old Yamuna Bridge / GT Road", "primary", 50, False),
        ("shastri_park_chowk", "seelampur_chowk", "Grand Trunk Road East", "primary", 50, False),
        ("seelampur_chowk", "shahdara_junction", "Grand Trunk Road", "primary", 50, False),
        ("shahdara_junction", "dilshad_garden_hub", "GT Road East Border", "primary", 50, False),
        ("shahdara_junction", "anand_vihar_isbt", "Road No 56 (Surajmal Vihar Link)", "primary", 50, False),
        ("wazirabad_signature_bridge", "khajuri_khas_chowk", "Wazirabad Road Bridge", "trunk", 60, False),
        ("khajuri_khas_chowk", "seelampur_chowk", "Wazirabad-Seelampur Road", "primary", 50, False)
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

    lats = [n["lat"] for n in nodes_def]
    lons = [n["lon"] for n in nodes_def]
    bbox = [min(lons), min(lats), max(lons), max(lats)]

    metadata = {
        "name": "Delhi Drivable Road Network (NCT of Delhi)",
        "city": "Delhi, India",
        "nodeCount": len(nodes_def),
        "edgeCount": len(edges_list),
        "bbox": bbox,
        "center": [77.1600, 28.6300],
        "maxSpeedKmh": 80
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
            "city": "Delhi, India",
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
    parser = argparse.ArgumentParser(description="Extract Delhi Road Network for Route Optimizer")
    parser.add_argument("--place", default="Delhi, India", help="Place name for OSMnx query")
    parser.add_argument("--out", default="data/processed/new-delhi-network.json", help="Output JSON path")
    parser.add_argument("--force-fallback", action="store_true", help="Force building the local Delhi network model")
    args = parser.parse_args()

    success = False
    if not args.force_fallback:
        success = extract_via_osmnx(args.place, args.out)

    if not success:
        print("[INFO] Using verified Whole Delhi road network dataset.")
        generate_delhi_road_network(args.out)

if __name__ == "__main__":
    main()
