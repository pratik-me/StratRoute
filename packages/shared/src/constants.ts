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

export const NEW_DELHI_CENTER: [number, number] = [77.2167, 28.6328]; // [lon, lat] (Connaught Place)

export const PRESET_DELHI_LOCATIONS = [
  { id: 'cp_warehouse', name: 'Connaught Place Central Hub', lat: 28.6328, lon: 77.2167, type: 'warehouse' },
  { id: 'ndls_station', name: 'New Delhi Railway Logistics', lat: 28.6428, lon: 77.2195, type: 'hub' },
  { id: 'india_gate', name: 'India Gate Delivery Point', lat: 28.6129, lon: 77.2295, type: 'delivery' },
  { id: 'khan_market', name: 'Khan Market Retail Stop', lat: 28.6003, lon: 77.2270, type: 'delivery' },
  { id: 'karol_bagh', name: 'Karol Bagh Commercial Zone', lat: 28.6517, lon: 77.1906, type: 'delivery' },
  { id: 'pragati_maidan', name: 'Pragati Maidan Expo Center', lat: 28.6186, lon: 77.2415, type: 'delivery' },
  { id: 'barakhamba', name: 'Barakhamba Corporate Towers', lat: 28.6295, lon: 77.2280, type: 'delivery' },
  { id: 'lodhi_colony', name: 'Lodhi Art District Fulfillment', lat: 28.5888, lon: 77.2217, type: 'warehouse' },
  { id: 'chanakyapuri', name: 'Chanakyapuri Embassy Area', lat: 28.5983, lon: 77.1892, type: 'delivery' }
];

