import { EARTH_RADIUS_METERS, MAX_EFFECTIVE_SPEED_KMH } from '@ido/shared';

/**
 * Calculates straight-line geographic distance between two points using the Haversine formula.
 *
 * a = sin²(Δφ / 2) + cos(φ₁) * cos(φ₂) * sin²(Δλ / 2)
 * c = 2 * arcsin(√a)
 * d = R * c
 *
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Great-circle distance in meters
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const sinDeltaPhi2 = Math.sin(deltaPhi / 2);
  const sinDeltaLambda2 = Math.sin(deltaLambda / 2);

  const a =
    sinDeltaPhi2 * sinDeltaPhi2 +
    Math.cos(phi1) * Math.cos(phi2) * sinDeltaLambda2 * sinDeltaLambda2;

  // Clamp 'a' to [0, 1] to prevent floating point inaccuracies causing NaN in sqrt
  const clampedA = Math.max(0, Math.min(1, a));
  const c = 2 * Math.atan2(Math.sqrt(clampedA), Math.sqrt(1 - clampedA));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Admissible heuristic for Shortest Distance mode.
 * Straight-line Haversine distance in meters.
 * Always <= actual road distance due to the triangle inequality.
 */
export function distanceHeuristic(
  currLat: number,
  currLon: number,
  goalLat: number,
  goalLon: number
): number {
  return haversineDistanceMeters(currLat, currLon, goalLat, goalLon);
}

/**
 * Admissible heuristic for Fastest Travel Time mode.
 *
 * Formula: h(n) = (Haversine(n, goal) / 1000) / V_max * 3600 (seconds)
 *
 * Where V_max is an upper bound on effective vehicle speed across all road types.
 * Because no vehicle can travel faster than V_max, the minimum travel time across
 * straight-line space is an absolute lower bound on the actual road travel time.
 * This guarantees the heuristic remains strictly admissible.
 */
export function travelTimeHeuristic(
  currLat: number,
  currLon: number,
  goalLat: number,
  goalLon: number,
  maxSpeedKmh: number = MAX_EFFECTIVE_SPEED_KMH
): number {
  const distanceMeters = haversineDistanceMeters(currLat, currLon, goalLat, goalLon);
  const distanceKm = distanceMeters / 1000;
  return (distanceKm / maxSpeedKmh) * 3600;
}

