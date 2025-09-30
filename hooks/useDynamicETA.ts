import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { LatLng } from "react-native-maps";

/**
 * useDynamicETA
 * - routeCoordsLatLng : tableau de { latitude, longitude } (ordre du tracé)
 * Renvoie { distanceLeftM, etaText } mis à jour en live.
 */
export function useDynamicETA(routeCoordsLatLng: LatLng[]) {
    const [distanceLeftM, setDistanceLeftM] = useState<number>(0);
    const [etaText, setEtaText] = useState<string>("Calcul...");
    const watchRef = useRef<Location.LocationSubscription | null>(null);
    const smoothedSpeedRef = useRef<number | null>(null);

    /* ---------- helpers géo (haversine + projection) ---------- */
    const EARTH_R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const haversine = (a: LatLng, b: LatLng) => {
        const dLat = toRad(b.latitude - a.latitude);
        const dLon = toRad(b.longitude - a.longitude);
        const la1 = toRad(a.latitude);
        const la2 = toRad(b.latitude);
        const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
        return 2 * EARTH_R * Math.asin(Math.sqrt(h));
    };

    // projection orthogonale d'un point p sur le segment a-b (retourne proj, t [0..1], dist)
    function projectOnSegment(p: LatLng, a: LatLng, b: LatLng) {
        // conversion approximative lat/lon -> metres (local)
        const lat2m = (lat: number) => (lat * Math.PI * EARTH_R) / 180;
        const lon2m = (lon: number, atLat: number) => (lon * Math.PI * EARTH_R * Math.cos(toRad(atLat))) / 180;
        const ax = lon2m(a.longitude, a.latitude);
        const ay = lat2m(a.latitude);
        const bx = lon2m(b.longitude, b.latitude);
        const by = lat2m(b.latitude);
        const px = lon2m(p.longitude, p.latitude);
        const py = lat2m(p.latitude);

        const abx = bx - ax;
        const aby = by - ay;
        const apx = px - ax;
        const apy = py - ay;
        const ab2 = abx * abx + aby * aby || 1e-9;
        let t = (apx * abx + apy * aby) / ab2;
        t = Math.max(0, Math.min(1, t));
        const sx = ax + t * abx;
        const sy = ay + t * aby;
        const lat = (sy * 180) / (Math.PI * EARTH_R);
        const lon = (sx * 180) / (Math.PI * EARTH_R * Math.cos(toRad(lat || a.latitude)));
        const proj = { latitude: lat, longitude: lon } as LatLng;
        const dist = haversine(p, proj);
        return { proj, t, dist };
    }

    // trouve la projection la plus proche sur la route (retourne segIdx, t, proj, dist)
    function nearestPointOnRoute(p: LatLng, route: LatLng[]) {
        if (!route || route.length === 0) return null;
        if (route.length === 1) return { segIdx: 0, t: 0, proj: route[0], dist: haversine(p, route[0]) };

        let best: any = null;
        for (let i = 0; i < route.length - 1; i++) {
            const a = route[i];
            const b = route[i + 1];
            const res = projectOnSegment(p, a, b);
            if (!best || res.dist < best.dist) best = { ...res, segIdx: i };
        }
        return best;
    }

    // calcule la distance restante le long de la route depuis (segIdx,t,proj)
    function remainingDistanceAlongRoute(route: LatLng[], segIdx: number, t: number, proj: LatLng) {
        if (!route || route.length === 0) return 0;
        if (segIdx >= route.length - 1) return 0;
        let remaining = 0;
        // distance du point projeté à la fin du segment courant
        remaining += haversine(proj, route[segIdx + 1]);
        // sommer le reste des segments
        for (let j = segIdx + 1; j < route.length - 1; j++) {
            remaining += haversine(route[j], route[j + 1]);
        }
        return remaining;
    }

    /* ---------- effet principal: watchPosition ---------- */
    useEffect(() => {
        let active = true;

        // cleanup prev watcher
        const cleanupWatcher = () => {
            try {
                if (watchRef.current) {
                    watchRef.current.remove();
                    watchRef.current = null;
                }
            } catch { watchRef.current = null; }
        };

        // si pas de route -> on nettoie et on quitte
        if (!routeCoordsLatLng || routeCoordsLatLng.length === 0) {
            cleanupWatcher();
            setDistanceLeftM(0);
            setEtaText("—");
            return () => { active = false; cleanupWatcher(); };
        }

        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (!active) return;

            if (status !== "granted") {
                console.warn("Permission localisation refusée");
                setDistanceLeftM(0);
                setEtaText("Localisation refusée");
                return;
            }

            // ensure old watcher removed
            cleanupWatcher();

            try {
                watchRef.current = await Location.watchPositionAsync(
                    {
                        accuracy: Location.Accuracy.High,
                        timeInterval: 2000,
                        distanceInterval: 5,
                    },
                    (pos) => {
                        if (!active) return;
                        const { latitude, longitude, speed } = pos.coords;
                        const current = { latitude, longitude };

                        // 1) nearest point on route + remaining distance along route
                        const nearest = nearestPointOnRoute(current, routeCoordsLatLng);
                        let remaining = 0;
                        if (nearest) {
                            remaining = remainingDistanceAlongRoute(routeCoordsLatLng, nearest.segIdx, nearest.t, nearest.proj);
                        } else {
                            // fallback : distance to last point
                            const dst = routeCoordsLatLng[routeCoordsLatLng.length - 1];
                            remaining = haversine(current, dst);
                        }
                        remaining = Math.max(0, remaining);
                        setDistanceLeftM(Math.round(remaining));

                        // 2) smooth speed (m/s)
                        const minSpeed = 0.5; // seuil bruit (~1.8 km/h)
                        const defaultSpeed = 8.3; // ~30 km/h fallback raisonnable pour trajets routiers
                        const alpha = 0.4; // smoothing factor

                        const measured = typeof speed === "number" && speed > 0 ? speed : null;
                        const prev = smoothedSpeedRef.current ?? defaultSpeed;

                        // si measured present et > minSpeed -> on lisse dessus
                        let newSmoothed;
                        if (measured && measured > minSpeed) {
                            newSmoothed = alpha * measured + (1 - alpha) * prev;
                        } else {
                            // pas de mesure fiable : décrément léger pour refléter ralentissement/arrêt
                            newSmoothed = prev * 0.98;
                            // si prev est trop petit, fallback au default
                            if (newSmoothed < 0.2) newSmoothed = defaultSpeed;
                        }
                        smoothedSpeedRef.current = newSmoothed;

                        const speedToUse = newSmoothed && newSmoothed > 0 ? newSmoothed : defaultSpeed;
                        const etaSec = remaining / speedToUse;
                        const etaMin = Math.max(1, Math.round(etaSec / 60));
                        setEtaText(`${etaMin} min`);
                    }
                );
            } catch (err) {
                console.warn("watchPositionAsync failed", err);
                setDistanceLeftM(0);
                setEtaText("Erreur localisation");
            }
        })();

        return () => {
            active = false;
            cleanupWatcher();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(routeCoordsLatLng)]); // ré-crée watcher si la route change

    return { distanceLeftM, etaText };
}
