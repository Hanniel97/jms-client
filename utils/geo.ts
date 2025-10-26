// =========================
// File: src/utils/geo.ts
// =========================
export type LatLng = { latitude: number; longitude: number };

export const toRad = (d: number) => (d * Math.PI) / 180;
export const toDeg = (r: number) => (r * 180) / Math.PI;

export const haversineMeters = (a: LatLng, b: LatLng) => {
  const R = 6371000;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  return R * c;
};

export const normalizeAngle = (deg: number) => {
  const d = deg % 360;
  return d < 0 ? d + 360 : d;
};

export const angleDiff = (a: number, b: number) => {
  let d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
  return d > 180 ? 360 - d : d;
};

export const bearingDeg = (a: LatLng, b: LatLng) => {
  const y =
    Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) *
    Math.cos(toRad(b.latitude)) *
    Math.cos(toRad(b.longitude - a.longitude));
  return normalizeAngle(toDeg(Math.atan2(y, x)));
};

/** -------- helpers géo locaux en mètres (approx) -------- */
const metersPerDegLat = 111320;
const metersPerDegLon = (lat: number) => metersPerDegLat * Math.cos(toRad(lat));

export const interpolate = (a: LatLng, b: LatLng, t: number): LatLng => ({
  latitude: a.latitude + (b.latitude - a.latitude) * t,
  longitude: a.longitude + (b.longitude - a.longitude) * t,
});

/**
 * Project point P sur le segment AB; renvoie t [0..1], point projeté, et distance en mètres.
 */
const projectOnSegment = (p: LatLng, a: LatLng, b: LatLng) => {
  const lonScale = metersPerDegLon(a.latitude);
  const ax = 0,
    ay = 0;
  const bx = (b.longitude - a.longitude) * lonScale;
  const by = (b.latitude - a.latitude) * metersPerDegLat;
  const px = (p.longitude - a.longitude) * lonScale;
  const py = (p.latitude - a.latitude) * metersPerDegLat;

  const ab2 = bx * bx + by * by || 1e-9;
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ab2;
  t = Math.max(0, Math.min(1, t));

  const qx = ax + t * (bx - ax);
  const qy = ay + t * (by - ay);
  const dx = px - qx;
  const dy = py - qy;
  const distMeters = Math.sqrt(dx * dx + dy * dy);

  const point: LatLng = {
    latitude: a.latitude + qy / metersPerDegLat,
    longitude: a.longitude + qx / lonScale,
  };

  return { point, t, distMeters };
};

/** Longueur en mètres d’un segment AB */
const segmentLenMeters = (a: LatLng, b: LatLng) => haversineMeters(a, b);

/**
 * Nearest point sur polyline, avec t précis sur le segment.
 * index = index du point A (segment [i → i+1]).
 */
export const nearestPointOnPolylineDetailed = (p: LatLng, coords: LatLng[]) => {
  if (coords.length < 2) {
    return { point: coords[0] ?? p, index: 0, t: 0, distMeters: Infinity };
  }
  let best = { point: coords[0], index: 0, t: 0, distMeters: Infinity };
  for (let i = 0; i < coords.length - 1; i++) {
    const a = coords[i];
    const b = coords[i + 1];
    const res = projectOnSegment(p, a, b);
    if (res.distMeters < best.distMeters) {
      best = {
        point: res.point,
        index: i,
        t: res.t,
        distMeters: res.distMeters,
      };
    }
  }
  return best;
};

/** Backwards compat: renvoie index approché sans t */
export const nearestPointOnPolyline = (p: LatLng, coords: LatLng[]) => {
  const d = nearestPointOnPolylineDetailed(p, coords);
  const progIndex = d.t < 0.5 ? d.index : d.index + 1;
  return { point: d.point, index: progIndex, distMeters: d.distMeters };
};

/**
 * Avance (distanceMeters > 0) ou recule (distanceMeters < 0) le long de la polyline
 * à partir d’un progress (index+t).
 * Retourne { point, index, t } où t ∈ [0,1] relatif au segment [index → index+1].
 */
export const advanceAlongPolyline = (
  coords: LatLng[],
  startIndex: number,
  startT: number,
  distanceMeters: number
) => {
  if (coords.length < 2) {
    return { point: coords[0], index: 0, t: 0 };
  }
  let i = Math.min(Math.max(0, startIndex), coords.length - 2);
  let t = Math.min(Math.max(0, startT), 1);
  const segLen = segmentLenMeters(coords[i], coords[i + 1]);

  // point courant "a" le long du segment [i,i+1]
  let a = interpolate(coords[i], coords[i + 1], t);

  if (distanceMeters >= 0) {
    // ----- AVANCER -----
    let remaining = distanceMeters;

    // d’abord, fin du segment courant
    const segRest = segmentLenMeters(a, coords[i + 1]);
    if (remaining <= segRest) {
      const tt = (remaining / segLen) * (1 - t) + t;
      return {
        point: interpolate(coords[i], coords[i + 1], tt),
        index: i,
        t: tt,
      };
    }
    remaining -= segRest;
    i++;

    while (i < coords.length - 1) {
      const s = segmentLenMeters(coords[i], coords[i + 1]);
      if (remaining <= s) {
        const tt = remaining / s;
        return {
          point: interpolate(coords[i], coords[i + 1], tt),
          index: i,
          t: tt,
        };
      }
      remaining -= s;
      i++;
    }
    return { point: coords[coords.length - 1], index: coords.length - 2, t: 1 };
  } else {
    // ----- RECULER -----
    let remaining = -distanceMeters; // positif

    // d’abord, retour au début du segment courant
    const segDone = segmentLenMeters(coords[i], a); // portion déjà parcourue dans le segment
    if (remaining <= segDone) {
      const tt = t - (remaining / segLen) * t;
      return {
        point: interpolate(coords[i], coords[i + 1], tt),
        index: i,
        t: tt,
      };
    }
    remaining -= segDone;
    i--;

    while (i >= 0) {
      const s = segmentLenMeters(coords[i], coords[i + 1]);
      if (remaining <= s) {
        const tt = 1 - remaining / s;
        return {
          point: interpolate(coords[i], coords[i + 1], tt),
          index: i,
          t: tt,
        };
      }
      remaining -= s;
      i--;
    }
    return { point: coords[0], index: 0, t: 0 };
  }
};

export function getMarkerRotation(heading: number, imageOrientation: "up" | "right" | "left" | "down" = "up") {
  switch (imageOrientation) {
    case "right":
      return heading - 90;
    case "left":
      return heading + 90;
    case "down":
      return heading + 160;
    case "up":
    default:
      return heading;
  }
}

/** Bearing (0..360) from a -> b */
export function bearing(a: LatLng, b: LatLng): number {
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const br = (toDeg(Math.atan2(y, x)) + 360) % 360;
  return br;
}

// // =========================
// // File: src/utils/geo.ts
// // =========================
// export type LatLng = { latitude: number; longitude: number };

// export const toRad = (d: number) => (d * Math.PI) / 180;
// export const toDeg = (r: number) => (r * 180) / Math.PI;

// export const haversineMeters = (a: LatLng, b: LatLng) => {
//   const R = 6371000;
//   const dLat = toRad(b.latitude - a.latitude);
//   const dLon = toRad(b.longitude - a.longitude);
//   const lat1 = toRad(a.latitude);
//   const lat2 = toRad(b.latitude);
//   const s =
//     Math.sin(dLat / 2) * Math.sin(dLat / 2) +
//     Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
//   const c = 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
//   return R * c;
// };

// export const normalizeAngle = (deg: number) => {
//   const d = deg % 360;
//   return d < 0 ? d + 360 : d;
// };

// export const angleDiff = (a: number, b: number) => {
//   let d = Math.abs(normalizeAngle(a) - normalizeAngle(b));
//   return d > 180 ? 360 - d : d;
// };

// export const bearingDeg = (a: LatLng, b: LatLng) => {
//   const y =
//     Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
//   const x =
//     Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
//     Math.sin(toRad(a.latitude)) *
//       Math.cos(toRad(b.latitude)) *
//       Math.cos(toRad(b.longitude - a.longitude));
//   return normalizeAngle(toDeg(Math.atan2(y, x)));
// };

// /** -------- helpers géo locaux en mètres (approx) -------- */
// const metersPerDegLat = 111320;
// const metersPerDegLon = (lat: number) => metersPerDegLat * Math.cos(toRad(lat));

// export const interpolate = (a: LatLng, b: LatLng, t: number): LatLng => ({
//   latitude: a.latitude + (b.latitude - a.latitude) * t,
//   longitude: a.longitude + (b.longitude - a.longitude) * t,
// });

// /**
//  * Project point P sur le segment AB; renvoie t [0..1], point projeté, et distance en mètres.
//  */
// const projectOnSegment = (p: LatLng, a: LatLng, b: LatLng) => {
//   const lonScale = metersPerDegLon(a.latitude);
//   const ax = 0,
//     ay = 0;
//   const bx = (b.longitude - a.longitude) * lonScale;
//   const by = (b.latitude - a.latitude) * metersPerDegLat;
//   const px = (p.longitude - a.longitude) * lonScale;
//   const py = (p.latitude - a.latitude) * metersPerDegLat;

//   const ab2 = bx * bx + by * by || 1e-9;
//   let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / ab2;
//   t = Math.max(0, Math.min(1, t));

//   const qx = ax + t * (bx - ax);
//   const qy = ay + t * (by - ay);
//   const dx = px - qx;
//   const dy = py - qy;
//   const distMeters = Math.sqrt(dx * dx + dy * dy);

//   const point: LatLng = {
//     latitude: a.latitude + qy / metersPerDegLat,
//     longitude: a.longitude + qx / lonScale,
//   };

//   return { point, t, distMeters };
// };

// /** Longueur en mètres d’un segment AB */
// const segmentLenMeters = (a: LatLng, b: LatLng) => haversineMeters(a, b);

// /**
//  * Nearest point sur polyline, avec t précis sur le segment.
//  * index = index du point A (segment [i → i+1]).
//  */
// export const nearestPointOnPolylineDetailed = (p: LatLng, coords: LatLng[]) => {
//   if (coords.length < 2) {
//     return { point: coords[0] ?? p, index: 0, t: 0, distMeters: Infinity };
//   }
//   let best = { point: coords[0], index: 0, t: 0, distMeters: Infinity };
//   for (let i = 0; i < coords.length - 1; i++) {
//     const a = coords[i];
//     const b = coords[i + 1];
//     const res = projectOnSegment(p, a, b);
//     if (res.distMeters < best.distMeters) {
//       best = {
//         point: res.point,
//         index: i,
//         t: res.t,
//         distMeters: res.distMeters,
//       };
//     }
//   }
//   return best;
// };

// /** Backwards compat: renvoie index approché sans t (si jamais tu l’utilisais ailleurs) */
// export const nearestPointOnPolyline = (p: LatLng, coords: LatLng[]) => {
//   const d = nearestPointOnPolylineDetailed(p, coords);
//   const progIndex = d.t < 0.5 ? d.index : d.index + 1;
//   return { point: d.point, index: progIndex, distMeters: d.distMeters };
// };

// /**
//  * Avance le long de la polyline d’une distance (m) à partir d’un progress (index+t).
//  * Retourne { point, index, t } où t ∈ [0,1] relatif au segment [index → index+1].
//  */
// export const advanceAlongPolyline = (
//   coords: LatLng[],
//   startIndex: number,
//   startT: number,
//   distanceMeters: number
// ) => {
//   if (coords.length < 2) {
//     return { point: coords[0], index: 0, t: 0 };
//   }
//   let i = Math.min(Math.max(0, startIndex), coords.length - 2);
//   let t = Math.min(Math.max(0, startT), 1);
//   let a = interpolate(coords[i], coords[i + 1], t);
//   let remaining = distanceMeters;

//   // d’abord, fin du segment courant
//   let segRest = segmentLenMeters(a, coords[i + 1]);
//   if (remaining <= segRest) {
//     const tt = (remaining / segRest) * (1 - t) + t;
//     return {
//       point: interpolate(coords[i], coords[i + 1], tt),
//       index: i,
//       t: tt,
//     };
//   }
//   remaining -= segRest;
//   i++;

//   while (i < coords.length - 1) {
//     const segLen = segmentLenMeters(coords[i], coords[i + 1]);
//     if (remaining <= segLen) {
//       const tt = remaining / segLen;
//       return {
//         point: interpolate(coords[i], coords[i + 1], tt),
//         index: i,
//         t: tt,
//       };
//     }
//     remaining -= segLen;
//     i++;
//   }

//   // au-delà de la fin -> dernier point
//   return { point: coords[coords.length - 1], index: coords.length - 2, t: 1 };
// };
