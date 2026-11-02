import { TrafficCondition } from './types.js';

export const EARTH_RADIUS_METERS = 6371000;

/**
 * Upper bound on effective vehicle speed across all road types in km/h.
 * Used for the admissible travel-time heuristic:
 * h(n) = (Haversine(n, goal) / 1000) / MAX_EFFECTIVE_SPEED_KMH * 3600
 * Since no vehicle can exceed this speed, straight-line time at max speed
 * is guaranteed to be <= actual road travel time, ensuring admissibility!
 */
export const MAX_EFFECTIVE_SPEED_KMH = 80;

export const DEFAULT_SPEED_LIMITS_KMH: Record<string, number> = {
  motorway: 80,
  motorway_link: 50,
  trunk: 60,
  trunk_link: 45,
  primary: 50,
  primary_link: 40,
  secondary: 40,
  secondary_link: 30,
  tertiary: 30,
  tertiary_link: 25,
  residential: 25,
  living_street: 15,
  service: 15,
  unclassified: 30,
  road: 30,
};

export const TRAFFIC_MULTIPLIERS: Record<TrafficCondition, number> = {
  normal: 1.0,
  moderate: 0.75,
  heavy: 0.4,
  blocked: 0.0,
};

export const TRAFFIC_COLORS: Record<TrafficCondition, string> = {
  normal: '#10b981',   // Green
  moderate: '#eab308', // Yellow
  heavy: '#f97316',    // Orange
  blocked: '#ef4444',  // Red
};

export const DELHI_CENTER: [number, number] = [77.1600, 28.6300]; // [lon, lat] (Whole Delhi Center)
export const NEW_DELHI_CENTER = DELHI_CENTER; // Backwards compatibility alias

export const PRESET_DELHI_LOCATIONS = [
  { id: 'cp_warehouse', name: 'Connaught Place Central Hub (Central)', lat: 28.6328, lon: 77.2197, type: 'warehouse' },
  { id: 'igi_airport_t3', name: 'IGI Airport Cargo Complex / T3 (South-West)', lat: 28.5560, lon: 77.0990, type: 'warehouse' },
  { id: 'anand_vihar_isbt', name: 'Anand Vihar ISBT Freight Depot (East)', lat: 28.6475, lon: 77.3160, type: 'hub' },
  { id: 'azadpur_mandi', name: 'Azadpur Mandi Logistics Terminal (North)', lat: 28.7130, lon: 77.1760, type: 'hub' },
  { id: 'narela_industrial_hub', name: 'Narela Industrial Logistics Zone (Far North)', lat: 28.8520, lon: 77.0980, type: 'warehouse' },
  { id: 'dwarka_sec21_isbt', name: 'Dwarka Sector 21 Transit Hub (South-West)', lat: 28.5525, lon: 77.0580, type: 'hub' },
  { id: 'nehru_place_it_hub', name: 'Nehru Place Commercial District (South)', lat: 28.5485, lon: 77.2515, type: 'delivery' },
  { id: 'rohini_sec3', name: 'Rohini Madhuban Chowk (North-West)', lat: 28.7040, lon: 77.1235, type: 'delivery' },
  { id: 'okhla_industrial_area_ph3', name: 'Okhla Industrial Phase-3 Depot (South-East)', lat: 28.5360, lon: 77.2720, type: 'warehouse' },
  { id: 'janakpuri_district_centre', name: 'Janakpuri District Centre (West)', lat: 28.6290, lon: 77.0780, type: 'delivery' },
  { id: 'isbt_kashmere_gate', name: 'Kashmere Gate ISBT Transit Hub (North Central)', lat: 28.6675, lon: 77.2285, type: 'hub' },
  { id: 'badarpur_border_terminal', name: 'Badarpur Border Freight Hub (Far South)', lat: 28.4980, lon: 77.3040, type: 'warehouse' },
  { id: 'laxmi_nagar_metro', name: 'Laxmi Nagar Commercial Hub (East)', lat: 28.6310, lon: 77.2770, type: 'delivery' },
  { id: 'saket_district_centre', name: 'Saket District Centre & Healthcare (South)', lat: 28.5280, lon: 77.2185, type: 'delivery' },
  { id: 'najafgarh_terminal', name: 'Najafgarh Regional Freight Hub (Far West)', lat: 28.6120, lon: 76.9850, type: 'warehouse' },
  { id: 'karol_bagh', name: 'Karol Bagh Commercial Zone (West Central)', lat: 28.6517, lon: 77.1906, type: 'delivery' },
  { id: 'ndls_station', name: 'New Delhi Railway Logistics (Central North)', lat: 28.6428, lon: 77.2195, type: 'hub' },
  { id: 'lodhi_colony', name: 'Lodhi Art District Fulfillment (South Central)', lat: 28.5888, lon: 77.2217, type: 'warehouse' },
  { id: 'india_gate', name: 'India Gate War Memorial (Central)', lat: 28.6129, lon: 77.2295, type: 'delivery' },
  { id: 'wazirabad_signature_bridge', name: 'Signature Bridge Transit (North-East)', lat: 28.7180, lon: 77.2320, type: 'delivery' }
];

