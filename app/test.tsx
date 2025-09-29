// LiveTrackingMapV2.mapbox.tsx
import { CustomButton } from '@/components/CustomButton';
import useStore from '@/store/useStore';
import { Icon } from '@rneui/base';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAPBOX_ACCESS_TOKEN } from '@/services/api';

type GeoJSONLineString = {
  type: "LineString";
  coordinates: [number, number][];
};

// Assets
const carIcon = require('@/assets/images/driver.png');

type LatLng = { latitude: number; longitude: number; heading?: number };

interface Props {
    height: number;
    drop: LatLng | any;
    pickup: LatLng | any;
    rider: LatLng | Record<string, never>;
    status: string;
    bottomSheetHeight: number;
    routeGeometry?: GeoJSONLineString | null;
    // ⬇️ infos calculées côté backend (optionnelles)
    serverEtaMin?: number | null;
    serverEtaText?: string | null;
    serverDistanceKm?: number | null;
    setDuration: (min: number) => void;
    onArrivedPickup?: () => void;
    onArrivedDrop?: () => void;
    onOffRoute?: (meters: number) => void;
    onStepChange?: ((step: { index: number; instruction: string; distanceMeters: number; distanceText?: string; maneuver?: string; polyline?: string } | null) => void);
}

/* ---------------- constants/utility ---------------- */
const EPS_COORD = 0.000045;
const EPS_HEADING = 5;
const CAMERA_ANIM_MS = 600;
const FOLLOW_PITCH = 45;
const COMPASS_THROTTLE_MS = 180;
const SNAP_MAX_METERS = 30;
const MARKER_LOOKAHEAD_METERS = 70;
const CAR_HEADING_OFFSET_DEG = -5;
const TARGET_SPEED_MPS = 12;
const MIN_ANIM_MS = 180;
const MAX_ANIM_MS = 1400;
const TELEPORT_THRESHOLD_M = 120;
const OFFROUTE_THRESHOLD_M = 60;
const OFFROUTE_GRACE_UPDATES = 3;
const DIRECTIONS_REFRESH_MS = 30000;
const ARRIVAL_DIST_PICKUP_M = 35;
const ARRIVAL_DIST_DROP_M = 45;

const EARTH_R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const isNum = (n: any) => typeof n === 'number' && !Number.isNaN(n);
const isLatLng = (p: any) => isNum(p?.latitude) && isNum(p?.longitude);
const norm180 = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
function haversine(a: LatLng, b: LatLng) {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const la1 = toRad(a.latitude);
    const la2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}
function bearing(a: LatLng, b: LatLng) {
    const φ1 = toRad(a.latitude);
    const φ2 = toRad(b.latitude);
    const λ1 = toRad(a.longitude);
    const λ2 = toRad(b.longitude);
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
}

function projectOnSegment(p: LatLng, a: LatLng, b: LatLng) {
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
    const lng = (sx * 180) / (Math.PI * EARTH_R * Math.cos(toRad(lat || a.latitude)));
    const proj = { latitude: lat, longitude: lng } as LatLng;
    const dist = haversine(p, proj);
    return { proj, t, dist };
}
function pointAlongRoute(route: LatLng[], segIndex: number, tInSeg: number, advanceMeters: number) {
    if (!route.length) return { point: route[0], segIdx: 0, t: 0 } as any;
    let idx = segIndex;
    let t = tInSeg;
    let current = {
        latitude: route[idx].latitude + (route[idx + 1].latitude - route[idx].latitude) * t,
        longitude: route[idx].longitude + (route[idx + 1].longitude - route[idx].longitude) * t,
    } as LatLng;
    let remain = advanceMeters;
    while (remain > 0 && idx < route.length - 1) {
        const segEnd = route[idx + 1];
        const segCurr = current;
        const d = haversine(segCurr, segEnd);
        if (d > remain) {
            const ratio = remain / d;
            current = {
                latitude: segCurr.latitude + (segEnd.latitude - segCurr.latitude) * ratio,
                longitude: segCurr.longitude + (segEnd.longitude - segCurr.longitude) * ratio,
            };
            t = t + (1 - t) * ratio;
            remain = 0;
        } else {
            remain -= d;
            idx += 1;
            t = 0;
            current = { ...route[idx] };
        }
    }
    return { point: current, segIdx: Math.min(idx, route.length - 2), t };
}

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '');

/* ---------------- Main component ---------------- */
export const LiveTrackingMapV2: React.FC<Props> = ({
    drop,
    pickup,
    rider,
    status,
    bottomSheetHeight,
    routeGeometry,
    serverEtaMin = null,
    serverEtaText = null,
    serverDistanceKm = null,
    setDuration,
    onArrivedPickup,
    onArrivedDrop,
    onOffRoute,
    onStepChange,
}) => {
    const insets = useSafeAreaInsets();
    const colorScheme = (useColorScheme?.() as 'light' | 'dark' | null) ?? 'light';
    const mapStyleUrl = colorScheme === 'dark' ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Street;
    const { position } = useStore();

    const mapRef = useRef<MapboxGL.MapView | null>(null);
    const cameraRef = useRef<any>(null);

    const [trafficColor, setTrafficColor] = useState('#16B84E');
    const [showsTrafficLayer, setShowsTrafficLayer] = useState(false);
    const [coords, setCoords] = useState<LatLng[]>([]);
    const [steps, setSteps] = useState<any[]>([]);
    const [distanceLeftM, setDistanceLeftM] = useState<number>(0);
    const [etaSeconds, setEtaSeconds] = useState<number>(0);
    const [etaText, setEtaText] = useState<string>('');

    const [isFollowing, setIsFollowing] = useState(false);
    const [isCompassMode, setIsCompassMode] = useState(false);
    const [ttsMuted, setTtsMuted] = useState(false);

    const lastSpokenRef = useRef<{ idx: number | null; ts: number }>({ idx: null, ts: 0 });
    const animatingRef = useRef<boolean>(false);
    const cameraHeadingRef = useRef<number>(0);
    const compassSubRef = useRef<any | null>(null);
    const lastCompassTsRef = useRef(0);

    const decodedStepsRef = useRef<{ step: any; points: LatLng[] }[]>([]);

    const riderMemo = useMemo(
        () => (isLatLng(rider) ? { latitude: rider.latitude, longitude: rider.longitude, heading: isNum(rider.heading) ? rider.heading : 0 } : undefined),
        [rider?.latitude, rider?.longitude, rider?.heading]
    );
    const pickupMemo = useMemo(
        () => (isLatLng(pickup) ? { latitude: pickup.latitude, longitude: pickup.longitude } : { latitude: position.latitude, longitude: position.longitude }),
        [pickup?.latitude, pickup?.longitude, position.latitude, position.longitude]
    );
    const dropMemo = useMemo(
        () => (isLatLng(drop) ? { latitude: drop.latitude, longitude: drop.longitude } : { latitude: position.latitude, longitude: position.longitude }),
        [drop?.latitude, drop?.longitude, position.latitude, position.longitude]
    );

    const initialRegion = useMemo(() => {
        if (pickupMemo && dropMemo) {
            const latitude = (pickupMemo.latitude + dropMemo.latitude) / 2;
            const longitude = (pickupMemo.longitude + dropMemo.longitude) / 2;
            return { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 } as any;
        }
        return { latitude: Number(position.latitude) || 0, longitude: Number(position.longitude) || 0, latitudeDelta: 0.05, longitudeDelta: 0.05 } as any;
    }, [pickupMemo, dropMemo, position.latitude, position.longitude]);

    const edgePadding = useMemo(() => ({ top: 60, right: 40, bottom: bottomSheetHeight + 40, left: 40 }), [bottomSheetHeight]);

    const goingToPickup = status === 'ACCEPTED' || status === 'ARRIVED' || status === 'VERIFIED';
    const onTrip = status === 'START';

    const dirOrigin = useMemo(() => {
        if (goingToPickup || onTrip) return riderMemo ? `${riderMemo.longitude},${riderMemo.latitude}` : undefined;
        return pickupMemo ? `${pickupMemo.longitude},${pickupMemo.latitude}` : undefined;
    }, [goingToPickup, onTrip, riderMemo, pickupMemo]);

    const dirDest = useMemo(() => {
        if (goingToPickup) return pickupMemo ? `${pickupMemo.longitude},${pickupMemo.latitude}` : undefined;
        return dropMemo ? `${dropMemo.longitude},${dropMemo.latitude}` : undefined;
    }, [goingToPickup, pickupMemo, dropMemo]);

    const dirKey = useMemo(() => (dirOrigin && dirDest ? `${dirOrigin}|${dirDest}|${status}` : null), [dirOrigin, dirDest, status]);

    // ✅ Priorité au backend : si une géométrie serveur est fournie, on l'utilise et on n'appelle pas Directions côté client
    const useServerRoute = useMemo(
        () => !!routeGeometry && routeGeometry.type === 'LineString' && Array.isArray(routeGeometry.coordinates) && routeGeometry.coordinates.length > 1,
        [routeGeometry]
    );

    // Hydrate coords depuis le backend
    useEffect(() => {
        if (!useServerRoute) return;
        const geoCoords: LatLng[] = (routeGeometry!.coordinates || []).map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
        setSteps([]);              // pas de steps fournis => on masque la bannière de manœuvres
        decodedStepsRef.current = [];
        setCoords((prev) => {
            const sameLen = prev.length === geoCoords.length;
            if (sameLen && prev.length > 1) {
                const a0 = prev[0], b0 = geoCoords[0];
                const a1 = prev[prev.length - 1], b1 = geoCoords[geoCoords.length - 1];
                const near = (p: LatLng, q: LatLng) => Math.abs(p.latitude - q.latitude) < EPS_COORD && Math.abs(p.longitude - q.longitude) < EPS_COORD;
                if (near(a0, b0) && near(a1, b1)) return prev;
            }
            return geoCoords;
        });
    }, [useServerRoute, routeGeometry]);

    // Directions: fallback uniquement si pas de route serveur
    const fetchDirections = useCallback(async () => {
        if (!dirOrigin || !dirDest) return;
        if (useServerRoute) return; // priorité au backend
        try {
            const url = `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${dirOrigin};${dirDest}?alternatives=true&geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_ACCESS_TOKEN}&language=fr`;
            const response = await fetch(url);
            const json = await response.json();
            if (!json.routes?.length) return;

            const bestRoute = json.routes.reduce((prev: any, curr: any) => (curr.duration < prev.duration ? curr : prev));
            const route = bestRoute;
            const leg = (route.legs && route.legs[0]) || null;

            const trafficDur = Math.round(route.duration || (leg?.duration || 0)); // seconds
            const mins = Math.max(1, Math.round(trafficDur / 60));
            setDuration((prev) => (prev !== mins ? mins : prev));
            setEtaSeconds(trafficDur);
            setEtaText(`${Math.round(trafficDur / 60)} min`);

            setDistanceLeftM(Math.round(route.distance || (leg?.distance || 0)));

            const newColor = '#16B84E';
            setTrafficColor(newColor);

            const rawSteps = leg?.steps ?? [];
            const decoded = rawSteps.map((s: any) => {
                const coordsArr: LatLng[] = (s.geometry?.coordinates || []).map((c: any[]) => ({ latitude: c[1], longitude: c[0] }));
                const instruction = s.maneuver?.instruction || s.name || `${s.maneuver?.type ?? ''} ${s.name ?? ''}` || '';
                return { step: s, points: coordsArr, instruction };
            });
            decodedStepsRef.current = decoded;
            setSteps(rawSteps);

            const geoCoords: LatLng[] = (route.geometry?.coordinates || []).map((c: any[]) => ({ latitude: c[1], longitude: c[0] }));
            const sameLen = geoCoords.length === coords.length;
            const sameEnds =
                sameLen &&
                coords.length > 1 &&
                Math.abs(geoCoords[0].latitude - coords[0].latitude) < EPS_COORD &&
                Math.abs(geoCoords[0].longitude - coords[0].longitude) < EPS_COORD &&
                Math.abs(geoCoords[geoCoords.length - 1].latitude - coords[coords.length - 1].latitude) < EPS_COORD &&
                Math.abs(geoCoords[geoCoords.length - 1].longitude - coords[coords.length - 1].longitude) < EPS_COORD;
            if (!sameLen || !sameEnds) setCoords(geoCoords);
        } catch (err) {
            console.error('Mapbox Directions error', err);
        }
    }, [dirOrigin, dirDest, setDuration, coords.length, coords, useServerRoute]);

    useEffect(() => {
        if (!dirKey || useServerRoute) return;
        fetchDirections();
        const interval = setInterval(fetchDirections, DIRECTIONS_REFRESH_MS);
        return () => clearInterval(interval);
    }, [dirKey, fetchDirections, useServerRoute]);

    // ETA/distance venant du backend
    useEffect(() => {
        if (isNum(serverEtaMin)) {
            const mins = Math.max(1, Math.round(serverEtaMin as number));
            setEtaSeconds(mins * 60);
            setEtaText(serverEtaText || `${mins} min`);
            setDuration((prev) => (prev !== mins ? mins : prev));
        }
        if (isNum(serverDistanceKm)) {
            setDistanceLeftM(Math.max(0, Math.round((serverDistanceKm as number) * 1000)));
        }
    }, [serverEtaMin, serverEtaText, serverDistanceKm, setDuration]);

    // Snap util
    type SnapInfo = { snapped: LatLng; segIdx: number; t: number; distMeters: number } | null;
    const snapToRoute = useCallback((pos?: LatLng): SnapInfo => {
        if (!pos || coords.length < 2) return null;
        let best: { dist: number; segIdx: number; t: number; proj: LatLng } | null = null;
        for (let i = 0; i < coords.length - 1; i++) {
            const a = coords[i] as LatLng;
            const b = coords[i + 1] as LatLng;
            const r = projectOnSegment(pos, a, b);
            if (!best || r.dist < best.dist) best = { dist: r.dist, segIdx: i, t: r.t, proj: r.proj };
        }
        if (!best) return null;
        return { snapped: best.proj, segIdx: best.segIdx, t: best.t, distMeters: best.dist };
    }, [coords]);

    // Camera follow helpers
    const animateCameraSafe = useCallback((p: { center?: LatLng; heading?: number; pitch?: number }) => {
        if (!cameraRef.current) return;
        if (animatingRef.current) return;
        animatingRef.current = true;
        try {
            cameraRef.current.setCamera({
                centerCoordinate: p.center ? [p.center.longitude, p.center.latitude] : undefined,
                heading: p.heading,
                pitch: p.pitch,
                animationDuration: CAMERA_ANIM_MS,
            });
        } catch (e) {
            // fallback
        } finally {
            setTimeout(() => (animatingRef.current = false), CAMERA_ANIM_MS);
        }
    }, []);

    // Compass watch
    const startCompass = useCallback(async () => {
        if (compassSubRef.current) return;
        try {
            const sub = await Location.watchHeadingAsync((h) => {
                const now = Date.now();
                if (now - lastCompassTsRef.current < COMPASS_THROTTLE_MS) return;
                lastCompassTsRef.current = now;
                const heading = h.trueHeading ?? h.magHeading ?? 0;
                cameraHeadingRef.current = heading;
                animateCameraSafe({ heading, pitch: FOLLOW_PITCH });
            });
            compassSubRef.current = sub;
        } catch (e) {
            console.warn('watchHeadingAsync error:', e);
        }
    }, [animateCameraSafe]);
    const stopCompass = useCallback(async () => {
        try {
            const s = compassSubRef.current;
            if (s) {
                if (typeof s.remove === 'function') s.remove();
                else if (typeof s.unsubscribe === 'function') s.unsubscribe();
            }
        } catch { }
        compassSubRef.current = null;
    }, []);

    useEffect(() => () => void stopCompass(), [stopCompass]);

    // Turn-by-turn (uniquement quand on a des steps côté client)
    const currentStepIdxRef = useRef<number | null>(null);
    useEffect(() => {
        if (!decodedStepsRef.current?.length || !riderMemo) {
            if (currentStepIdxRef.current !== null) {
                currentStepIdxRef.current = null;
                try { onStepChange?.(null); } catch { }
            }
            return;
        }
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < decodedStepsRef.current.length; i++) {
            const { step, points } = decodedStepsRef.current[i];
            if (!points?.length) continue;
            for (let j = 0; j < points.length; j++) {
                const p = points[j];
                const d = haversine(riderMemo, p);
                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                }
            }
            if (bestDist < 5) break;
        }
        if (bestIdx === -1) {
            if (currentStepIdxRef.current !== null) {
                currentStepIdxRef.current = null;
                try { onStepChange?.(null); } catch { }
            }
            return;
        }
        const found = decodedStepsRef.current[bestIdx];
        const s = found.step;
        const distanceMeters = (s.distance?.value ?? Math.round(bestDist)) as number;
        const instruction = s.maneuver?.instruction || s.name || '';
        const info = { index: bestIdx, instruction: stripHtml(instruction), distanceMeters, distanceText: s.distance?.text || `${Math.round(distanceMeters)} m`, maneuver: s.maneuver?.type, polyline: undefined };
        const prevIdx = currentStepIdxRef.current;
        if (prevIdx !== bestIdx) {
            currentStepIdxRef.current = bestIdx;
            try { onStepChange?.(info); } catch { }
            if (!ttsMuted) {
                const now = Date.now();
                if (lastSpokenRef.current.idx !== info.index || now - lastSpokenRef.current.ts > 3000) {
                    try { Speech.speak(info.instruction, { language: 'fr-FR' }); } catch { }
                    lastSpokenRef.current = { idx: info.index, ts: now };
                }
            }
        } else {
            try { onStepChange?.(info); } catch { }
        }
    }, [steps, riderMemo?.latitude, riderMemo?.longitude, onStepChange, ttsMuted]);

    // Off-route, arrival detection
    const offRouteCounterRef = useRef(0);
    useEffect(() => {
        if (!riderMemo) return;
        if (coords.length < 2) return;
        const snap = snapToRoute(riderMemo);
        if (goingToPickup && pickupMemo) {
            const dPick = haversine(riderMemo, pickupMemo);
            if (dPick <= ARRIVAL_DIST_PICKUP_M) onArrivedPickup?.();
        }
        if (onTrip && dropMemo) {
            const dDrop = haversine(riderMemo, dropMemo);
            if (dDrop <= ARRIVAL_DIST_DROP_M) onArrivedDrop?.();
        }
        if (!snap) return;
        if (snap.distMeters > OFFROUTE_THRESHOLD_M) {
            offRouteCounterRef.current += 1;
            onOffRoute?.(snap.distMeters);
            // ❌ Ne pas recalculer côté client : le backend s’en charge et émettra `rideUpdate`
            if (offRouteCounterRef.current >= OFFROUTE_GRACE_UPDATES) {
                offRouteCounterRef.current = 0;
            }
        } else offRouteCounterRef.current = 0;
    }, [riderMemo?.latitude, riderMemo?.longitude, coords, goingToPickup, onTrip, pickupMemo, dropMemo, onArrivedPickup, onArrivedDrop, onOffRoute, snapToRoute]);

    // UI actions
    const onUserGesture = useCallback(() => setIsFollowing(false), []);
    const onMapIdle = useCallback(async () => {
        try {
            const center = await cameraRef.current?.getCenter?.();
            if (!center) return;
        } catch { }
    }, []);

    const recenterOnce = useCallback(async () => {
        setIsFollowing(false);
        if (coords.length > 1) {
            try {
                const lats = coords.map((c) => c.latitude);
                const lons = coords.map((c) => c.longitude);
                const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
                await cameraRef.current?.fitBounds?.([minLon, minLat], [maxLon, maxLat], [edgePadding.left, edgePadding.top, edgePadding.right, edgePadding.bottom], 500);
                return;
            } catch { }
        }
        const points: LatLng[] = [];
        if (pickupMemo) points.push(pickupMemo);
        if (dropMemo) points.push(dropMemo);
        if (riderMemo) points.push({ latitude: riderMemo.latitude, longitude: riderMemo.longitude });
        const uniqKey = (p: LatLng) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
        const dedup = Array.from(new Map(points.map((p) => [uniqKey(p), p])).values());
        if (dedup.length >= 2) {
            try {
                const lats = dedup.map((d) => d.latitude), lons = dedup.map((d) => d.longitude);
                const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons);
                await cameraRef.current?.fitBounds?.([minLon, minLat], [maxLon, maxLat], [edgePadding.left, edgePadding.top, edgePadding.right, edgePadding.bottom], 500);
                return;
            } catch { }
        }
        const center = dedup[0] ?? riderMemo ?? pickupMemo ?? dropMemo;
        if (center) animateCameraSafe({ center, heading: cameraHeadingRef.current, pitch: FOLLOW_PITCH });
    }, [coords, pickupMemo, dropMemo, riderMemo, edgePadding, animateCameraSafe]);

    const toggleFollow = useCallback(async () => {
        const willFollow = !isFollowing;
        setIsFollowing(willFollow);
        if (willFollow) {
            try { const cam = await cameraRef.current?.getCamera?.(); cameraHeadingRef.current = cam?.heading ?? 0; } catch { }
            const center = (riderMemo ?? pickupMemo ?? dropMemo);
            if (center) animateCameraSafe({ center, heading: cameraHeadingRef.current, pitch: FOLLOW_PITCH });
            if (isCompassMode) setIsCompassMode(false);
            await stopCompass();
        }
    }, [isFollowing, riderMemo, pickupMemo, dropMemo, animateCameraSafe, isCompassMode, stopCompass]);

    const toggleCompass = useCallback(async () => {
        const will = !isCompassMode;
        setIsCompassMode(will);
        if (will) {
            setIsFollowing(false);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') { setIsCompassMode(false); return; }
            await startCompass();
        } else {
            await stopCompass();
        }
    }, [isCompassMode, startCompass, stopCompass]);

    const toggleTrafficLayer = useCallback(() => setShowsTrafficLayer((s) => !s), []);
    const toggleTtsMute = useCallback(() => setTtsMuted((s) => !s), []);

    // Auto-follow on ACCEPTED
    const prevStatusRef = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (status !== prevStatusRef.current) {
            if (status === 'ACCEPTED') {
                setIsFollowing(true);
                setIsCompassMode(false);
                (async () => {
                    await stopCompass();
                    try { const cam = await cameraRef.current?.getCamera?.(); cameraHeadingRef.current = cam?.heading ?? cameraHeadingRef.current; } catch { }
                    const center = riderMemo ?? pickupMemo ?? (coords[0] as LatLng | undefined);
                    if (center) animateCameraSafe({ center, heading: cameraHeadingRef.current, pitch: FOLLOW_PITCH });
                })();
            }
            prevStatusRef.current = status;
        }
    }, [status, riderMemo, pickupMemo, coords, stopCompass, animateCameraSafe]);

    /* ---------------- Animated Car marker logic ---------------- */
    const [animatedCarPos, setAnimatedCarPos] = useState<LatLng | null>(riderMemo ?? null);
    const animatedHeadingRef = useRef<number>(riderMemo?.heading ?? 0);

    useEffect(() => {
        if (!riderMemo) return;
        const snap = snapToRoute(riderMemo);
        const useSnap = !!snap && (snap as any).dist <= SNAP_MAX_METERS;
        const target = useSnap ? (snap as any).snapped : riderMemo;
        let desiredHeading = riderMemo.heading ?? 0;
        if (useSnap) {
            const ahead = pointAlongRoute(coords, (snap as any).segIdx, (snap as any).t, MARKER_LOOKAHEAD_METERS).point;
            desiredHeading = bearing(target, ahead);
        }
        const from = animatedCarPos ?? target;
        const d = haversine(from, target);
        if (d > TELEPORT_THRESHOLD_M) {
            setAnimatedCarPos(target);
            animatedHeadingRef.current = desiredHeading;
            return;
        }
        const duration = clamp(Math.round((d / TARGET_SPEED_MPS) * 1000), MIN_ANIM_MS, MAX_ANIM_MS);
        const start = Date.now();
        const startLat = from.latitude, startLng = from.longitude;
        const endLat = target.latitude, endLng = target.longitude;
        const startHeading = animatedHeadingRef.current;
        const endHeading = desiredHeading;
        let raf = 0;
        const step = () => {
            const now = Date.now();
            const t = Math.min(1, (now - start) / duration);
            const newLat = startLat + (endLat - startLat) * t;
            const newLng = startLng + (endLng - startLng) * t;
            setAnimatedCarPos({ latitude: newLat, longitude: newLng });
            const delta = norm180(endHeading - startHeading);
            const newHeading = (startHeading + delta * t + 360) % 360;
            animatedHeadingRef.current = newHeading;
            if (t < 1) raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return () => void cancelAnimationFrame(raf);
    }, [riderMemo?.latitude, riderMemo?.longitude, riderMemo?.heading, coords]);

/* ---------------- Render Mapbox map ---------------- */
    return (
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
            <MapboxGL.MapView
                ref={(r) => (mapRef.current = r)}
                style={{ flex: 1 }}
                styleURL={mapStyleUrl}
                logoEnabled={false}
                compassEnabled={false}
                rotateEnabled
                pitchEnabled
                zoomEnabled
                onTouchStart={onUserGesture} // stops follow when user interacts
                onDidFinishRenderingMapFully={onMapIdle}
            >
                <MapboxGL.Camera
                    ref={(r) => (cameraRef.current = r)}
                    centerCoordinate={[initialRegion.longitude, initialRegion.latitude]}
                    zoomLevel={13}
                    animationMode="flyTo"
                />

                <MapboxGL.UserLocation visible={true} androidRenderMode="normal" showsUserHeadingIndicator />

                {/* Route line via ShapeSource + LineLayer */}
                {coords.length > 1 && (
                    <MapboxGL.ShapeSource id="routeSource"
                        shape={{
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: coords.map(c => [c.longitude, c.latitude]) }
                        }}
                    >
                        <MapboxGL.LineLayer
                            id="routeLine"
                            style={{
                                lineWidth: 4,
                                lineJoin: 'round',
                                lineCap: 'round',
                                lineColor: showsTrafficLayer ? trafficColor : trafficColor,
                            }}
                        />
                    </MapboxGL.ShapeSource>
                )}

                {/* Pickup / Drop markers */}
                {dropMemo && (
                    <MapboxGL.PointAnnotation id="drop" coordinate={[dropMemo.longitude, dropMemo.latitude]}>
                        <View style={{ transform: [{ translateY: -8 }] }}>
                            <Icon name="location-pin" type="entypo" size={35} color="red" />
                        </View>
                    </MapboxGL.PointAnnotation>
                )}
                {pickupMemo && (
                    <MapboxGL.PointAnnotation id="pickup" coordinate={[pickupMemo.longitude, pickupMemo.latitude]}>
                        <View style={{ transform: [{ translateY: -8 }] }}>
                            <Icon name="location-pin" type="entypo" size={35} color="green" />
                        </View>
                    </MapboxGL.PointAnnotation>
                )}

                {/* Animated rider marker (PointAnnotation updated by state) */}
                {animatedCarPos && (
                    <MapboxGL.PointAnnotation id="rider" coordinate={[animatedCarPos.longitude, animatedCarPos.latitude]}>
                        <View style={{ transform: [{ rotate: `${(animatedHeadingRef.current + CAR_HEADING_OFFSET_DEG) % 360}deg` }] }}>
                            <Image source={carIcon} style={{ width: 45, height: 45, resizeMode: 'contain' }} />
                        </View>
                    </MapboxGL.PointAnnotation>
                )}
            </MapboxGL.MapView>

            {/* ETA banner */}
            <View style={{ position: 'absolute', top: insets.top + 16, left: 14, right: 14, alignItems: 'center' }}>
                {!!etaText && (
                    <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'white', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2, flexDirection: 'row', gap: 10 }}>
                        <Icon name="clock" type="feather" size={18} />
                        <Text style={{ fontWeight: '600' }}>{etaText}</Text>
                        <Text> • {Math.max(1, Math.round(distanceLeftM / 1000))} km</Text>
                        {showsTrafficLayer ? <Text> • Trafic</Text> : null}
                    </View>
                )}
            </View>

            {/* Floating actions */}
            <View style={{ position: 'absolute', right: 12, bottom: bottomSheetHeight + 16, zIndex: 10, gap: 12 }}>
                <CustomButton icon={<Icon name="layers" type="material-icons" size={22} color={showsTrafficLayer ? '#16B84E' : '#555'} />} buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center" onPress={() => setShowsTrafficLayer(s => !s)} />
                <CustomButton icon={<Icon name={isFollowing ? 'gps-fixed' : 'gps-not-fixed'} type="material-icons" size={22} color={isFollowing ? '#16B84E' : '#ff6d00'} />} buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center" onPress={toggleFollow} />
                <CustomButton icon={<Icon name="explore" type="material-icons" size={22} color={isCompassMode ? '#0ea5e9' : '#555'} />} buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center" onPress={toggleCompass} />
                <CustomButton icon={<Icon name="my-location" type="material-icons" size={22} color="#222" />} buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center" onPress={recenterOnce} />
                <CustomButton icon={<Icon name={ttsMuted ? 'volume-off' : 'volume-up'} type="material-icons" size={22} color={ttsMuted ? '#999' : '#222'} />} buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center" onPress={() => setTtsMuted(s => !s)} />
            </View>

            {/* Instruction banner */}
            {steps.length > 0 && (
                <TurnBanner steps={steps} rider={riderMemo} coords={coords} />
            )}
        </View>
    );
};

/* ---------------- TurnBanner component adapted to Mapbox step geometry ---------------- */
const TurnBanner: React.FC<{ steps: any[]; rider?: LatLng; coords: LatLng[] }> = ({ steps, rider, coords }) => {
    const insets = useSafeAreaInsets();
    const current = useMemo(() => {
        if (!rider || !steps?.length) return null;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            const pts = (s.geometry?.coordinates || []).map((c: any[]) => ({ latitude: c[1], longitude: c[0] }));
            for (let j = 0; j < pts.length; j++) {
                const p = pts[j];
                const d = haversine(rider, p);
                if (d < bestDist) {
                    bestDist = d;
                    bestIdx = i;
                }
            }
        }
        const step = steps[bestIdx];
        if (!step) return null;
        const instruction = step.maneuver?.instruction || step.name || '';
        return { instruction: stripHtml(instruction), distanceText: step.distance ? `${Math.round(step.distance / 1000)} km` : '' };
    }, [steps, rider, coords]);
    if (!current) return null;
    return (
        <View style={{ position: 'absolute', bottom: insets.bottom + 120, left: 16, right: 16, alignItems: 'center' }}>
            <View style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: 'white', borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 6, elevation: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Icon name="navigation" type="feather" size={18} />
                <Text style={{ fontWeight: '600' }}>{current.instruction}</Text>
                {!!current.distanceText && <Text>• {current.distanceText}</Text>}
            </View>
        </View>
    );
};

/* ---------------- memo comparator (same logic) ---------------- */
const near = (a?: number, b?: number) => (isNum(a) && isNum(b) ? Math.abs((a as number) - (b as number)) < EPS_COORD : a === b);
const riderNearEq = (p?: LatLng, n?: LatLng) => near(p?.latitude, n?.latitude) && near(p?.longitude, n?.longitude) && (isNum(p?.heading) && isNum(n?.heading) ? Math.abs((p!.heading as number) - (n!.heading as number)) < EPS_HEADING : p?.heading === n?.heading);
const propsAreEqual = (prev: Props, next: Props) => {
    if (prev.status !== next.status) return false;
    if (prev.bottomSheetHeight !== next.bottomSheetHeight) return false;
    if (!riderNearEq(prev.rider as any, next.rider as any)) return false;
    if (!near(prev.drop?.latitude, next.drop?.latitude) || !near(prev.drop?.longitude, next.drop?.longitude)) return false;
    if (!near(prev.pickup?.latitude, next.pickup?.latitude) || !near(prev.pickup?.longitude, next.pickup?.longitude)) return false;
    return true;
};

export default memo(LiveTrackingMapV2, propsAreEqual);