export type LatLng = { latitude: number; longitude: number };

const toRad = (d: number) => (d * Math.PI) / 180;

export function distanceMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const sin1 = Math.sin(dLat / 2) ** 2;
  const sin2 = Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(sin1 + sin2), Math.sqrt(1 - (sin1 + sin2)));
  return R * c;
}

export function nearestCoordIndex(pos: LatLng, coords: LatLng[]) {
  if (!coords || coords.length === 0) return 0;
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < coords.length; i++) {
    const d = distanceMeters(pos, coords[i]);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

export function computeRemainingDistance(currentPos: LatLng, coords: LatLng[]) {
  if (!coords || coords.length < 2) return 0;
  const idx = nearestCoordIndex(currentPos, coords);
  let rem = distanceMeters(currentPos, coords[Math.min(idx + 1, coords.length - 1)]);
  for (let i = idx + 2; i < coords.length; i++) rem += distanceMeters(coords[i - 1], coords[i]);
  return rem;
}

export function computeEtaMs(remainingMeters: number, totalDistance: number, routeDurationSeconds?: number) {
  if (remainingMeters <= 0) return 0;
  if (totalDistance > 0 && routeDurationSeconds && routeDurationSeconds > 0) {
    const ratio = remainingMeters / totalDistance;
    return Math.max(0, Math.round(ratio * routeDurationSeconds * 1000));
  }
  return 0;
}
