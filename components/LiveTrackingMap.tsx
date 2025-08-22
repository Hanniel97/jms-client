import { GOOGLE_API_KEY } from "@/services/api";
import useStore from "@/store/useStore";
import polyline from "@mapbox/polyline";
import { Icon } from "@rneui/base";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useColorScheme, View, Image } from "react-native";
import MapView, { AnimatedRegion, Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import darkMapStyle from "../services/mapStyleDark.json";
import lightMapStyle from "../services/mapStyleLight.json";
import { CustomButton } from "./CustomButton";

/******************** Types ********************/
type LatLng = { latitude: number; longitude: number; heading?: number };

interface Props {
    height: number;
    drop: LatLng | any;
    pickup: LatLng | any;
    rider: LatLng | Record<string, never>;
    status: string;
    bottomSheetHeight: number;
    setDuration: (min: number) => void;
}

/******************** Constantes ********************/
const EPS_COORD = 0.000045; // ≈ ~5m
const EPS_HEADING = 5; // degrés
const SNAP_MAX_METERS = 30;
const LOOKAHEAD_METERS = 140;
const MARKER_LOOKAHEAD_METERS = 70;

const CAMERA_ANIM_MS = 600;
const FOLLOW_THROTTLE_MS = 700;
const COMPASS_THROTTLE_MS = 180;

const FOLLOW_PITCH = 45;

// Lissage
const CENTER_SMOOTH = 0.35;
const CENTER_MOVE_DEADBAND_M = 2.0;
const HEADING_DEADBAND_DEG = 2.0;
const HEADING_MAX_STEP_DEG = 22.5;

// Décalage “voir devant”
const CENTER_LOOKAHEAD_FACTOR = 0.65;

// Orientation image
const CAR_HEADING_OFFSET_DEG = -5;

// Rotation de la carte pendant le suivi
const ROTATE_WHEN_FOLLOWING = true;

// Limites de zoom utilisateur
const MAX_ZOOM_LEVEL = 18;
const MIN_ZOOM_LEVEL = 13

const carIcon = require("../assets/images/driver.png");

/******************** Utils ********************/
const isNum = (n: any) => typeof n === "number" && !Number.isNaN(n);
const isLatLng = (p: any) => isNum(p?.latitude) && isNum(p?.longitude);
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const EARTH_R = 6371000;

function haversine(a: LatLng, b: LatLng): number {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const la1 = toRad(a.latitude);
    const la2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.sqrt(h));
}

function bearing(a: LatLng, b: LatLng): number {
    const φ1 = toRad(a.latitude);
    const φ2 = toRad(b.latitude);
    const λ1 = toRad(a.longitude);
    const λ2 = toRad(b.longitude);
    const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);
    const θ = Math.atan2(y, x);
    return (toDeg(θ) + 360) % 360;
}

const norm180 = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// projection P sur segment AB
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

// Vitesse "perçue" cible pour l'animation du marqueur
const TARGET_SPEED_MPS = 12; // ≈ 43 km/h
const MIN_ANIM_MS = 180;
const MAX_ANIM_MS = 1400;
const TELEPORT_THRESHOLD_M = 120; // au-delà, on saute sans animer

// point le long de la polyline
function pointAlongRoute(
    route: LatLng[],
    segIndex: number,
    tInSeg: number,
    advanceMeters: number
): { point: LatLng; segIdx: number; t: number } {
    if (!route.length) return { point: route[0], segIdx: 0, t: 0 } as any;
    let idx = segIndex;
    let t = tInSeg;
    let current = {
        latitude: route[idx].latitude + (route[idx + 1].latitude - route[idx].latitude) * t,
        longitude: route[idx].longitude + (route[idx + 1].longitude - route[idx].longitude) * t
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
                longitude: segCurr.longitude + (segEnd.longitude - segCurr.longitude) * ratio
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

/******************** Composant ********************/
export const LiveTrackingMap: React.FC<Props> = ({
    drop,
    status,
    pickup,
    rider,
    bottomSheetHeight,
    setDuration
}) => {
    const theme = useColorScheme();
    const mapStyle = theme === "dark" ? darkMapStyle : lightMapStyle;
    const { position } = useStore();

    const mapRef = useRef<MapView | null>(null);

    const [trafficColor, setTrafficColor] = useState("#16B84E");
    const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);

    // Modes
    const [isFollowing, setIsFollowing] = useState(false);
    const [isCompassMode, setIsCompassMode] = useState(false);

    // Lissages / états caméra
    const smoothCenterRef = useRef<LatLng | null>(null);
    const smoothHeadingRef = useRef<number | null>(null);
    const animatingRef = useRef<boolean>(false);
    const lastAnimTsRef = useRef<number>(0);

    // Camera heading
    const cameraHeadingRef = useRef<number>(0);

    // Subscription boussole (Promise ou Subscription suivant le timing)
    const compassSubRef = useRef<Promise<Location.LocationSubscription> | Location.LocationSubscription | null>(null);
    const lastCompassTsRef = useRef(0);

    // ---- Mémos entrée ----
    const riderMemo = useMemo(
        () =>
            isLatLng(rider)
                ? {
                    latitude: rider.latitude,
                    longitude: rider.longitude,
                    heading: isNum(rider.heading) ? rider.heading : 0
                }
                : undefined,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [rider?.latitude, rider?.longitude, rider?.heading]
    );

    const pickupMemo = useMemo(
        () => (isLatLng(pickup) ? { latitude: pickup.latitude, longitude: pickup.longitude } : undefined),
        [pickup?.latitude, pickup?.longitude]
    );

    const dropMemo = useMemo(
        () => (isLatLng(drop) ? { latitude: drop.latitude, longitude: drop.longitude } : undefined),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [drop?.latitude, drop?.longitude]
    );

    const initialRegion = useMemo(() => {
        if (pickupMemo && dropMemo) {
            const latitude = (pickupMemo.latitude + dropMemo.latitude) / 2;
            const longitude = (pickupMemo.longitude + dropMemo.longitude) / 2;
            return { latitude, longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 };
        }
        return {
            latitude: Number(position.latitude) || 0,
            longitude: Number(position.longitude) || 0,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        pickupMemo?.latitude,
        pickupMemo?.longitude,
        dropMemo?.latitude,
        dropMemo?.longitude,
        position.latitude,
        position.longitude
    ]);

    // ---- Padding pour fitToCoordinates (prend en compte le bottom sheet)
    const edgePadding = useMemo(
        () => ({ top: 60, right: 40, bottom: bottomSheetHeight + 40, left: 40 }),
        [bottomSheetHeight]
    );

    // ---- États course ----
    const goingToPickup = status === "ACCEPTED" || status === "ARRIVED" || status === "VERIFIED";
    const onTrip = status === "START";

    const dirOrigin = useMemo(() => {
        if (goingToPickup || onTrip) {
            return riderMemo ? `${riderMemo.latitude},${riderMemo.longitude}` : undefined;
        }
        return pickupMemo ? `${pickupMemo.latitude},${pickupMemo.longitude}` : undefined;
    }, [goingToPickup, onTrip, riderMemo, pickupMemo]);

    const dirDest = useMemo(() => {
        if (goingToPickup) {
            return pickupMemo ? `${pickupMemo.latitude},${pickupMemo.longitude}` : undefined;
        }
        return dropMemo ? `${dropMemo.latitude},${dropMemo.longitude}` : undefined;
    }, [goingToPickup, pickupMemo, dropMemo]);

    const dirKey = useMemo(
        () => (dirOrigin && dirDest ? `${dirOrigin}|${dirDest}|${status}` : null),
        [dirOrigin, dirDest, status]
    );

    /******************** Directions ********************/
    const fetchDirections = useCallback(async () => {
        if (!dirOrigin || !dirDest) return;
        try {
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${dirOrigin}&destination=${dirDest}&key=${GOOGLE_API_KEY}&departure_time=now&traffic_model=best_guess&mode=driving&alternatives=true`;
            const response = await fetch(url);
            const json = await response.json();
            if (!json.routes?.length) return;

            const bestRoute = json.routes.reduce((prev: any, curr: any) => {
                const prevTime = prev.legs[0].duration_in_traffic?.value || prev.legs[0].duration.value;
                const currTime = curr.legs[0].duration_in_traffic?.value || curr.legs[0].duration.value;
                return currTime < prevTime ? curr : prev;
            });

            const points = polyline.decode(bestRoute.overview_polyline.points);
            const mapped: LatLng[] = points.map(([latitude, longitude]: [number, number]) => ({
                latitude,
                longitude
            }));

            // Met à jour si ça a vraiment changé
            const sameLen = mapped.length === coords.length;
            const sameEnds =
                sameLen &&
                coords.length > 1 &&
                Math.abs(mapped[0].latitude - coords[0].latitude) < EPS_COORD &&
                Math.abs(mapped[0].longitude - coords[0].longitude) < EPS_COORD &&
                Math.abs(mapped[mapped.length - 1].latitude - coords[coords.length - 1].latitude) < EPS_COORD &&
                Math.abs(mapped[mapped.length - 1].longitude - coords[coords.length - 1].longitude) < EPS_COORD;

            if (!sameLen || !sameEnds) setCoords(mapped);

            const leg = bestRoute.legs[0];
            const baseDur = leg.duration.value;
            const trafficDur = leg.duration_in_traffic?.value || baseDur;
            const mins = Math.round(trafficDur / 60);
            setDuration((prev) => (prev !== mins ? mins : prev));

            const newColor = trafficDur > baseDur * 1.5 ? "#DE2916" : trafficDur > baseDur * 1.2 ? "#FFA500" : "#16B84E";
            if (newColor !== trafficColor) setTrafficColor(newColor);
        } catch (err) {
            console.error("Erreur Directions API:", err);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        dirOrigin,
        dirDest,
        status,
        coords.length,
        coords[0]?.latitude,
        coords[0]?.longitude,
        coords[coords.length - 1]?.latitude,
        coords[coords.length - 1]?.longitude,
        trafficColor
    ]);

    useEffect(() => {
        if (!dirKey) return;
        fetchDirections();
        const interval = setInterval(fetchDirections, 15000);
        return () => clearInterval(interval);
    }, [dirKey, fetchDirections]);

    /******************** Camera helpers (sans zoom direct) ********************/
    const animateCameraSafe = useCallback(
        (
            p: Partial<
                Pick<Parameters<NonNullable<MapView["animateCamera"]>>[0], "center" | "heading" | "pitch">
            >
        ) => {
            if (!mapRef.current) return;
            if (animatingRef.current) return;
            animatingRef.current = true;
            lastAnimTsRef.current = Date.now();
            mapRef.current.animateCamera(
                {
                    center: p.center,
                    heading: p.heading,
                    pitch: p.pitch
                },
                { duration: CAMERA_ANIM_MS }
            );
            setTimeout(() => {
                animatingRef.current = false;
            }, CAMERA_ANIM_MS);
        },
        []
    );

    /******************** Suivi caméra ********************/
    useEffect(() => {
        if (!isFollowing) return;
        if (!mapRef.current) return;
        if (status === "SEARCHING_FOR_RIDER") return;
        if (!riderMemo) return;

        const snap = snapToRoute(riderMemo);
        const useSnap = snap && snap.distMeters <= SNAP_MAX_METERS;
        const carPos = useSnap ? snap!.snapped : riderMemo;

        // Heading idéal
        let desiredHeading = riderMemo.heading ?? 0;
        let ahead: LatLng | null = null;
        if (useSnap) {
            ahead = pointAlongRoute(coords as LatLng[], snap!.segIdx, snap!.t, LOOKAHEAD_METERS).point;
            desiredHeading = bearing(carPos, ahead);
        } else if (dropMemo) {
            desiredHeading = bearing(carPos, dropMemo);
            ahead = dropMemo;
        }

        // Centre anticipé
        const centerTarget = ahead
            ? {
                latitude: carPos.latitude + (ahead.latitude - carPos.latitude) * CENTER_LOOKAHEAD_FACTOR,
                longitude: carPos.longitude + (ahead.longitude - carPos.longitude) * CENTER_LOOKAHEAD_FACTOR
            }
            : carPos;

        // Lissage du centre
        const prevCenter = smoothCenterRef.current ?? centerTarget;
        const distCenter = haversine(prevCenter, centerTarget);
        const smoothedCenter =
            distCenter < CENTER_MOVE_DEADBAND_M
                ? prevCenter
                : {
                    latitude: prevCenter.latitude + (centerTarget.latitude - prevCenter.latitude) * CENTER_SMOOTH,
                    longitude: prevCenter.longitude + (centerTarget.longitude - prevCenter.longitude) * CENTER_SMOOTH
                };
        smoothCenterRef.current = smoothedCenter;

        // Lissage heading
        const prevHeading = smoothHeadingRef.current ?? desiredHeading;
        const delta = norm180(desiredHeading - prevHeading);
        const nextHeading =
            Math.abs(delta) < HEADING_DEADBAND_DEG
                ? prevHeading
                : prevHeading + clamp(delta, -HEADING_MAX_STEP_DEG, HEADING_MAX_STEP_DEG);
        smoothHeadingRef.current = (nextHeading + 360) % 360;

        const finalHeading = ROTATE_WHEN_FOLLOWING ? smoothHeadingRef.current! : cameraHeadingRef.current;

        animateCameraSafe({
            center: smoothedCenter,
            heading: finalHeading,
            pitch: FOLLOW_PITCH
        });
    }, [isFollowing, status, riderMemo, coords, dropMemo, animateCameraSafe]);

    /******************** Boussole ********************/
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
            console.warn("watchHeadingAsync error:", e);
        }
    }, [animateCameraSafe]);

    const stopCompass = useCallback(async () => {
        try {
            const maybeSub = await Promise.resolve(compassSubRef.current as any);
            if (maybeSub) {
                if (typeof maybeSub.remove === "function") {
                    maybeSub.remove();
                } else if (typeof maybeSub.unsubscribe === "function") {
                    maybeSub.unsubscribe();
                }
            }
        } catch { }
        compassSubRef.current = null;
    }, []);

    useEffect(() => {
        return () => {
            void stopCompass();
        };
    }, [stopCompass]);

    /******************** Actions ********************/
    // Recentrer: on centre/fit le TRAJET dans l’aire visible (tient compte du bottom sheet)
    const recenterOnce = useCallback(async () => {
        if (!mapRef.current) return;
        setIsFollowing(false);

        // 1) Si on a une polyline de trajet, on la fit entièrement avec padding
        if (coords.length > 1) {
            mapRef.current.fitToCoordinates(coords as LatLng[], {
                edgePadding,
                animated: true
            });
            return;
        }

        // 2) Sinon, si on a au moins deux points parmi pickup / drop / rider, on fit ces points
        const points: LatLng[] = [];
        if (pickupMemo) points.push(pickupMemo);
        if (dropMemo) points.push(dropMemo);
        if (riderMemo) points.push({ latitude: riderMemo.latitude, longitude: riderMemo.longitude });

        const uniqPoints = points.filter(Boolean) as LatLng[];
        const uniqKey = (p: LatLng) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`;
        const dedup = Array.from(new Map(uniqPoints.map((p) => [uniqKey(p), p])).values());

        if (dedup.length >= 2) {
            mapRef.current.fitToCoordinates(dedup, {
                edgePadding,
                animated: true
            });
            return;
        }

        // 3) Dernier recours: on recentre sur le point disponible, sans zoomer/dézoomer
        const center = dedup[0] ?? riderMemo ?? pickupMemo ?? dropMemo;
        if (center) {
            try {
                const cam = await mapRef.current.getCamera?.();
                cameraHeadingRef.current = cam?.heading ?? cameraHeadingRef.current;
            } catch { }
            animateCameraSafe({ center, heading: cameraHeadingRef.current, pitch: FOLLOW_PITCH });
        }
    }, [coords, pickupMemo, dropMemo, riderMemo, edgePadding, animateCameraSafe]);

    // Toggle Suivi
    const toggleFollow = useCallback(async () => {
        if (!mapRef.current) return;
        const willFollow = !isFollowing;
        setIsFollowing(willFollow);
        if (willFollow) {
            try {
                const cam = await mapRef.current.getCamera?.();
                cameraHeadingRef.current = cam?.heading ?? 0;
            } catch { }
            const center = riderMemo ?? pickupMemo ?? dropMemo;
            if (center) animateCameraSafe({ center, heading: cameraHeadingRef.current, pitch: FOLLOW_PITCH });
            if (isCompassMode) setIsCompassMode(false);
            await stopCompass();
        }
    }, [isFollowing, riderMemo, pickupMemo, dropMemo, animateCameraSafe, isCompassMode, stopCompass]);

    // Toggle Boussole
    const toggleCompass = useCallback(async () => {
        const willUseCompass = !isCompassMode;
        setIsCompassMode(willUseCompass);
        if (willUseCompass) {
            setIsFollowing(false);
            try {
                const { status: perm } = await Location.requestForegroundPermissionsAsync();
                if (perm !== "granted") {
                    setIsCompassMode(false);
                    return;
                }
            } catch {
                setIsCompassMode(false);
                return;
            }
            await startCompass();
        } else {
            await stopCompass();
        }
    }, [isCompassMode, startCompass, stopCompass]);

    /******************** Map events ********************/
    const onUserGesture = useCallback(() => {
        setIsFollowing(false);
    }, []);

    const onRegionChangeComplete = useCallback(async () => {
        if (!mapRef.current) return;
        if (animatingRef.current) return;
        try {
            const cam = await mapRef.current.getCamera?.();
            cameraHeadingRef.current = cam?.heading ?? cameraHeadingRef.current;
        } catch { }
    }, []);

    /******************** Snap util ********************/
    type SnapInfo = { snapped: LatLng; segIdx: number; t: number; distMeters: number } | null;
    const snapToRoute = useCallback((pos: LatLng | undefined): SnapInfo => {
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

    /******************** Render ********************/
    return (
        <View className="flex-1 bg-white">
            <MapView
                style={{ flex: 1 }}
                ref={mapRef}
                customMapStyle={mapStyle}
                showsUserLocation={true}
                showsCompass={false}
                showsIndoors={true}
                zoomEnabled={true}
                initialRegion={initialRegion}
                showsBuildings={false}
                showsScale={false}
                showsTraffic={false}
                provider="google"
                rotateEnabled={true}
                maxZoomLevel={MAX_ZOOM_LEVEL}
                onPanDrag={onUserGesture}
                onRegionChangeComplete={onRegionChangeComplete}
                mapPadding={{ top: 20, right: 5, bottom: bottomSheetHeight + 20, left: 20 }}
            >
                {dropMemo && (
                    <Marker anchor={{ x: 0.3, y: 0.6 }} coordinate={dropMemo} zIndex={1} title="Destination" pinColor="red">
                        <Icon name="location-pin" type="entypo" size={35} color="red" />
                    </Marker>
                )}

                {pickupMemo && (
                    <Marker anchor={{ x: 0.3, y: 0.6 }} coordinate={pickupMemo} zIndex={2} title="Départ" pinColor="green">
                        <Icon name="location-pin" type="entypo" size={35} color="green" />
                    </Marker>
                )}

                {coords.length > 1 && <Polyline coordinates={coords} strokeColor={trafficColor} strokeWidth={2} />}

                {/* {riderMemo && <SnappedCarMarker rider={riderMemo} coords={coords as LatLng[]} />} */}

                {riderMemo && <AnimatedCarMarker rider={riderMemo} coords={coords as LatLng[]} />}

            </MapView>

            {/* Actions */}
            <View style={{ position: "absolute", right: 16, bottom: bottomSheetHeight + 16, zIndex: 10, gap: 12 }}>
                {/* <CustomButton
                    icon={<Icon name="my-location" type="material-icons" size={22} color="#222" />}
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={recenterOnce}
                /> */}
                <CustomButton
                    icon={
                        <Icon
                            name={isFollowing ? "gps-fixed" : "gps-not-fixed"}
                            type="material-icons"
                            size={22}
                            color={isFollowing ? "#16B84E" : "#ff6d00"}
                        />
                    }
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={toggleFollow}
                />
                <CustomButton
                    icon={<Icon name="explore" type="material-icons" size={22} color={isCompassMode ? "#0ea5e9" : "#555"} />}
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={toggleCompass}
                />
            </View>
        </View>
    );
};

/******************** Marker snappé (orientation) ********************/
const AnimatedCarMarker: React.FC<{ rider: LatLng; coords: LatLng[] }> = ({ rider, coords }) => {
    // --- Snap à la route (identique à ta logique) ---
    const snap = useMemo(() => {
        if (!coords || coords.length < 2) return null;
        let best: { dist: number; segIdx: number; t: number; proj: LatLng } | null = null;
        for (let i = 0; i < coords.length - 1; i++) {
            const a = coords[i] as LatLng;
            const b = coords[i + 1] as LatLng;
            const r = projectOnSegment(rider, a, b);
            if (!best || r.dist < best.dist) best = { dist: r.dist, segIdx: i, t: r.t, proj: r.proj };
        }
        return best;
    }, [coords, rider]);

    const useSnap = !!snap && (snap as any).dist <= SNAP_MAX_METERS;
    const basePos: LatLng = useSnap ? ((snap as any).proj as LatLng) : rider;

    // --- Direction (heading) avec lookahead sur la polyline ---
    let desiredHeading = rider.heading ?? 0;
    if (useSnap) {
        const ahead = pointAlongRoute(coords as LatLng[], (snap as any).segIdx, (snap as any).t, MARKER_LOOKAHEAD_METERS).point;
        desiredHeading = bearing(basePos, ahead);
    }

    // --- AnimatedRegion pour lisser la position ---
    const coordinateRef = useRef(
        new AnimatedRegion({
            latitude: basePos.latitude,
            longitude: basePos.longitude,
            latitudeDelta: 0,
            longitudeDelta: 0
        })
    ).current;

    const lastPosRef = useRef<LatLng>(basePos);

    // --- Lissage du heading (même logique que chez toi) ---
    const headingRef = useRef<number>(desiredHeading);
    {
        const prev = headingRef.current;
        const delta = norm180(desiredHeading - prev);
        const next =
            Math.abs(delta) < HEADING_DEADBAND_DEG
                ? prev
                : prev + clamp(delta, -HEADING_MAX_STEP_DEG, HEADING_MAX_STEP_DEG);
        headingRef.current = (next + 360) % 360;
    }

    // --- À chaque update de basePos : animer vers la nouvelle coordonnée ---
    useEffect(() => {
        const prev = lastPosRef.current;
        const next = basePos;
        const d = haversine(prev, next);

        // Téléport si trop loin (perte GPS / changement brutal)
        if (d > TELEPORT_THRESHOLD_M) {
            coordinateRef.setValue({
                latitude: next.latitude,
                longitude: next.longitude,
                latitudeDelta: 0,
                longitudeDelta: 0
            });
            lastPosRef.current = next;
            return;
        }

        // Durée proportionnelle à la distance pour vitesse “constante perçue”
        const duration = clamp(Math.round((d / TARGET_SPEED_MPS) * 1000), MIN_ANIM_MS, MAX_ANIM_MS);

        coordinateRef.timing(
            {
                latitude: next.latitude,
                longitude: next.longitude,
                duration,
                useNativeDriver: false
            } as any
        ).start(() => {
            // fin d'anim : on fige la référence
            lastPosRef.current = next;
        });
    }, [basePos.latitude, basePos.longitude, coordinateRef]);

    return (
        <Marker.Animated
            coordinate={coordinateRef as any}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            rotation={(headingRef.current + CAR_HEADING_OFFSET_DEG + 360) % 360}
            zIndex={3}
        >
            <Image
                source={carIcon}
                style={{ width: 45, height: 45, resizeMode: "contain" }}
            />
        </Marker.Animated>
    );
};

// const SnappedCarMarker: React.FC<{ rider: LatLng; coords: LatLng[] }> = ({ rider, coords }) => {
//     const snap = useMemo(() => {
//         if (!coords || coords.length < 2) return null;
//         let best: { dist: number; segIdx: number; t: number; proj: LatLng } | null = null;
//         for (let i = 0; i < coords.length - 1; i++) {
//             const a = coords[i] as LatLng;
//             const b = coords[i + 1] as LatLng;
//             const r = projectOnSegment(rider, a, b);
//             if (!best || r.dist < best.dist) best = { dist: r.dist, segIdx: i, t: r.t, proj: r.proj };
//         }
//         return best;
//     }, [coords, rider]);

//     const useSnap = !!snap && (snap as any).dist <= SNAP_MAX_METERS;
//     const basePos = useSnap ? ((snap as any).proj as LatLng) : rider;

//     let desiredHeading = rider.heading ?? 0;
//     if (useSnap) {
//         const ahead = pointAlongRoute(
//             coords as LatLng[],
//             (snap as any).segIdx,
//             (snap as any).t,
//             MARKER_LOOKAHEAD_METERS
//         ).point;
//         desiredHeading = bearing(basePos, ahead);
//     }

//     const headingRef = useRef<number>(desiredHeading);
//     const prev = headingRef.current;
//     const delta = norm180(desiredHeading - prev);
//     const next =
//         Math.abs(delta) < HEADING_DEADBAND_DEG
//             ? prev
//             : prev + clamp(delta, -HEADING_MAX_STEP_DEG, HEADING_MAX_STEP_DEG);
//     headingRef.current = (next + 360) % 360;

//     return (
//         <Marker
//             anchor={{ x: 0.5, y: 0.5 }}
//             coordinate={{ latitude: basePos.latitude, longitude: basePos.longitude }}
//             zIndex={3}
//             flat
//             rotation={(headingRef.current + CAR_HEADING_OFFSET_DEG + 360) % 360}
//             image={carIcon}
//             tracksViewChanges={false}
//         />
//     );
// };

/******************** Comparateur de props ********************/
const near = (a?: number, b?: number) =>
    isNum(a) && isNum(b) ? Math.abs((a as number) - (b as number)) < EPS_COORD : a === b;

const riderNearEq = (p?: LatLng, n?: LatLng) =>
    near(p?.latitude, n?.latitude) &&
    near(p?.longitude, n?.longitude) &&
    (isNum(p?.heading) && isNum(n?.heading)
        ? Math.abs((p!.heading as number) - (n!.heading as number)) < EPS_HEADING
        : p?.heading === n?.heading);

const propsAreEqual = (prev: Props, next: Props) => {
    if (prev.status !== next.status) return false;
    if (prev.bottomSheetHeight !== next.bottomSheetHeight) return false;
    if (!riderNearEq(prev.rider as any, next.rider as any)) return false;
    if (!near(prev.drop?.latitude, next.drop?.latitude) || !near(prev.drop?.longitude, next.drop?.longitude)) return false;
    if (!near(prev.pickup?.latitude, next.pickup?.latitude) || !near(prev.pickup?.longitude, next.pickup?.longitude)) return false;
    return true;
};

export default memo(LiveTrackingMap, propsAreEqual);












// import { GOOGLE_API_KEY } from "@/services/api";
// import useStore from "@/store/useStore";
// import polyline from "@mapbox/polyline";
// import { Icon } from "@rneui/base";
// import React, { memo, useCallback, useEffect, useRef, useState } from "react";
// import { Image, useColorScheme, View } from "react-native";
// import MapView, { Marker, Polyline } from "react-native-maps";
// import darkMapStyle from "../services/mapStyleDark.json";
// import lightMapStyle from "../services/mapStyleLight.json";
// import { CustomButton } from "./CustomButton";

// export const LiveTrackingMap: React.FC<{
//     height: number;
//     drop: any;
//     pickup: any;
//     rider: any;
//     status: string;
//     bottomSheetHeight: number;
//     setDuration: any;
// }> = ({ drop, status, pickup, rider, bottomSheetHeight, setDuration }) => {
//     const theme = useColorScheme();
//     const mapStyle = theme === "dark" ? darkMapStyle : lightMapStyle;

//     const { position } = useStore();
//     const mapRef = useRef<MapView | null>(null);

//     const [isUserInteracting, setIsUserInteracting] = useState(false);
//     const [trafficColor, setTrafficColor] = useState("#16B84E");
//     const [coords, setCoords] = useState<
//         { latitude: number; longitude: number }[]
//     >([]);
//     const [isFollowing, setIsFollowing] = useState(true); // Suivi automatique actif par défaut

//     /** Recentre la carte sur le chauffeur */
//     useEffect(() => {
//         if (
//             isFollowing &&
//             rider?.latitude &&
//             rider?.longitude &&
//             mapRef.current &&
//             status !== "SEARCHING_FOR_RIDER"
//         ) {
//             mapRef.current.animateCamera(
//                 {
//                     center: {
//                         latitude: rider.latitude,
//                         longitude: rider.longitude,
//                     },
//                     pitch: 0,
//                     heading: rider.heading || 0,
//                     zoom: 18,
//                 },
//                 { duration: 800 }
//             );
//         }
//     }, [rider.latitude, rider.longitude, rider.heading, isFollowing]);

//     /** Ajuste la vue pour montrer les marqueurs pertinents */
//     const fitToMarkers = async () => {
//         if (!mapRef.current) return;

//         const coordinates = [];

//         if (
//             pickup?.latitude &&
//             pickup?.longitude &&
//             (status === "START" || status === "SEARCHING_FOR_RIDER")
//         ) {
//             coordinates.push({
//                 latitude: pickup.latitude,
//                 longitude: pickup.longitude,
//             });
//         }

//         if (
//             drop?.latitude &&
//             drop?.longitude &&
//             (status === "ARRIVED" || status === "STARTED")
//         ) {
//             coordinates.push({
//                 latitude: drop.latitude,
//                 longitude: drop.longitude,
//             });
//         }

//         if (rider?.latitude && rider?.longitude) {
//             coordinates.push({
//                 latitude: rider.latitude,
//                 longitude: rider.longitude,
//             });
//         }

//         if (coordinates.length > 0) {
//             mapRef.current.fitToCoordinates(coordinates, {
//                 edgePadding: { top: 50, left: 50, bottom: 20, right: 50 },
//                 animated: true,
//             });
//         }
//     };

//     /** Calcule la région initiale */
//     const calculateInitialRegion = () => {
//         if (pickup?.latitude && drop?.latitude) {
//             const latitude = (pickup.latitude + drop.latitude) / 2;
//             const longitude = (pickup.longitude + drop.longitude) / 2;
//             return {
//                 latitude,
//                 longitude,
//                 latitudeDelta: 0.05,
//                 longitudeDelta: 0.05,
//             };
//         }
//         return {
//             latitude: Number(position.latitude),
//             longitude: Number(position.longitude),
//             latitudeDelta: 0.05,
//             longitudeDelta: 0.05,
//         };
//     };

//     /** Récupère l’itinéraire Google Maps */
//     const fetchDirections = useCallback(async () => {
//         try {
//             const origin =
//                 status === "ACCEPTED" || status === "STARTED"
//                     ? `${rider.latitude},${rider.longitude}`
//                     : `${pickup.latitude},${pickup.longitude}`;
//             const destination =
//                 status === "ACCEPTED" ? `${pickup.latitude},${pickup.longitude}` : `${drop.latitude},${drop.longitude}`;

//             const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}&departure_time=now&traffic_model=best_guess&mode=driving&alternatives=true`;

//             const response = await fetch(url);
//             const json = await response.json();

//             if (!json.routes.length) return;

//             // Choisir la route la plus rapide
//             const bestRoute = json.routes.reduce((prev, curr) => {
//                 const prevTime = prev.legs[0].duration_in_traffic?.value || prev.legs[0].duration.value;
//                 const currTime = curr.legs[0].duration_in_traffic?.value || curr.legs[0].duration.value;
//                 return currTime < prevTime ? curr : prev;
//             });

//             const points = polyline.decode(bestRoute.overview_polyline.points);
//             const mapped = points.map(([latitude, longitude]) => ({
//                 latitude,
//                 longitude,
//             }));
//             setCoords(mapped);

//             const leg = bestRoute.legs[0];
//             const duration = leg.duration.value;
//             const trafficDuration = leg.duration_in_traffic?.value || duration;

//             setDuration(Math.round(trafficDuration / 60));

//             if (trafficDuration > duration * 1.5) setTrafficColor("#DE2916");
//             else if (trafficDuration > duration * 1.2) setTrafficColor("#FFA500");
//             else setTrafficColor("#16B84E");
//         } catch (err) {
//             console.error("Erreur Directions API:", err);
//         }
//     }, [
//         drop.latitude,
//         drop.longitude,
//         pickup.latitude,
//         pickup.longitude,
//         rider.latitude,
//         rider.longitude,
//         status,
//     ]);

//     /** Lancer le calcul initial + intervalle */
//     useEffect(() => {
//         fetchDirections();
//         const interval = setInterval(fetchDirections, 30000);
//         return () => clearInterval(interval);
//     }, [fetchDirections]);

//     return (
//         <View className="flex-1 bg-white">
//             <MapView
//                 style={{ flex: 1 }}
//                 ref={mapRef}
//                 customMapStyle={mapStyle}
//                 showsUserLocation={false}
//                 showsCompass={false}
//                 showsIndoors={false}
//                 zoomEnabled={true}
//                 initialRegion={calculateInitialRegion()}
//                 provider="google"
//                 onPanDrag={() => {
//                     setIsFollowing(false); // L’utilisateur a bougé la carte → stop auto-follow
//                     setIsUserInteracting(true);
//                 }}
//                 onRegionChangeComplete={() => setIsUserInteracting(false)}
//             >
//                 {drop?.latitude && (
//                     <Marker
//                         anchor={{ x: 0.3, y: 0.6 }}
//                         coordinate={{
//                             latitude: drop.latitude,
//                             longitude: drop.longitude,
//                         }}
//                         zIndex={1}
//                         title="Destination"
//                         pinColor="red"
//                     >
//                         <Icon name="location-pin" type="entypo" size={35} color="red" />
//                     </Marker>
//                 )}

//                 {pickup?.latitude && (
//                     <Marker
//                         anchor={{ x: 0.3, y: 0.6 }}
//                         coordinate={{
//                             latitude: pickup.latitude,
//                             longitude: pickup.longitude,
//                         }}
//                         zIndex={2}
//                         title="Départ"
//                         pinColor="green"
//                     >
//                         <Icon name="location-pin" type="entypo" size={35} color="green" />
//                     </Marker>
//                 )}

//                 {rider?.latitude && (
//                     <Marker
//                         anchor={{ x: 0.3, y: 0.6 }}
//                         coordinate={{
//                             latitude: rider.latitude,
//                             longitude: rider.longitude,
//                         }}
//                         zIndex={1}
//                     >
//                         <Image
//                             source={require("../assets/images/driver.png")}
//                             style={{
//                                 height: 50,
//                                 width: 50,
//                                 resizeMode: "contain",
//                                 transform: [{ rotate: `${rider.heading || 0}deg` }],
//                             }}
//                         />
//                     </Marker>
//                 )}

//                 <Polyline
//                     coordinates={coords}
//                     strokeColor={trafficColor}
//                     strokeWidth={5}
//                 />
//             </MapView>

//             {/* Bouton recentrage */}
//             <View
//                 style={{
//                     position: "absolute",
//                     right: 16,
//                     bottom: bottomSheetHeight + 16,
//                     zIndex: 10,
//                 }}
//             >
//                 <CustomButton
//                     icon={
//                         <Icon
//                             name="my-location"
//                             type="material-icon"
//                             size={24}
//                             color="#ff6d00"
//                         />
//                     }
//                     buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
//                     onPress={() => {
//                         setIsFollowing(true); // Active le mode suivi
//                         fitToMarkers();
//                     }}
//                 />
//             </View>
//         </View>
//     );
// };

// export default memo(LiveTrackingMap);

















// import { GOOGLE_API_KEY } from "@/services/api";
// import useStore from "@/store/useStore";
// import polyline from "@mapbox/polyline";
// import { Icon } from "@rneui/base";
// import React, { memo, useCallback, useEffect, useRef, useState } from "react";
// import {
//     Image,
//     useColorScheme,
//     View
// } from "react-native";
// import MapView, { Marker, Polyline } from "react-native-maps";
// import darkMapStyle from "../services/mapStyleDark.json";
// import lightMapStyle from '../services/mapStyleLight.json';
// import { CustomButton } from "./CustomButton";

// // const androidHeights = [ScreenHeight * 0.12, ScreenHeight * 0.42]
// // const iosHeights = [ScreenHeight * 0.2, ScreenHeight * 0.5]

// export const LiveTrackingMap: React.FC<{
//     height: number;
//     drop: any;
//     pickup: any;
//     rider: any;
//     status: string
//     bottomSheetHeight: number,
//     setDuration: any
// }> = ({ drop, status, pickup, rider, bottomSheetHeight, setDuration }) => {
//     const theme = useColorScheme();
//     const mapStyle = theme === 'dark' ? darkMapStyle : lightMapStyle;

//     const { position } = useStore();
//     const mapRef = useRef<MapView | null>(null);
//     const [isUserInteracting, setIsUserInteracting] = useState(false);
//     const [trafficColor, setTrafficColor] = useState("#16B84E");
//     const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);

//     const fitToMarkers = async () => {
//         if (isUserInteracting) return;

//         const coordinates = [];

//         if (pickup?.latitude && pickup?.longitude && status === "START" || "SEARCHING_FOR_RIDER") {
//             coordinates.push({
//                 latitude: pickup.latitude,
//                 longitude: pickup.longitude,
//             });
//         }

//         if (drop?.latitude && drop?.longitude && status === "ARRIVED") {
//             coordinates.push({ latitude: drop.latitude, longitude: drop.longitude });
//         }

//         if (rider?.latitude && rider?.longitude) {
//             coordinates.push({
//                 latitude: rider.latitude,
//                 longitude: rider.longitude,
//             })
//         }

//         if (coordinates.length === 0) return;

//         try {
//             mapRef.current?.fitToCoordinates(coordinates, {
//                 edgePadding: { top: 50, left: 50, bottom: 20, right: 50, },
//                 animated: true,
//             });
//         } catch (error) {
//             console.log(error)
//         }
//     }

//     const calculateInitialRegion = () => {
//         if (pickup?.latitude && drop?.latitude) {
//             const latitude = (pickup.latitude + drop.latitude) / 2;
//             const longitude = (pickup.longitude + drop.longitude) / 2;
//             return {
//                 latitude,
//                 longitude,
//                 latitudeDelta: 0.05,
//                 longitudeDelta: 0.05,
//             }
//         }
//         return {
//             latitude: Number(position.latitude),
//             longitude: Number(position.longitude),
//             latitudeDelta: 0.05,
//             longitudeDelta: 0.05,
//         } //initial map région à revoir
//     }

//     useEffect(() => {
//         if (pickup?.latitude && drop?.latitude) fitToMarkers();
//     }, [drop?.latitude, pickup?.latitude, rider.latitude])

//     const fetchDirections = useCallback(async () => {
//         try {
//             const origin = status === "ACCEPTED" ? `${rider.latitude},${rider.longitude}` : `${pickup.latitude},${pickup.longitude}`;
//             // `${pickup.latitude},${pickup.longitude}`;
//             const destination = status === "ACCEPTED" ? `${pickup.latitude},${pickup.longitude}` : `${drop.latitude},${drop.longitude}`;
//             // `${drop.latitude},${drop.longitude}`;
//             // const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}&departure_time=now&mode=driving`;
//             const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}&departure_time=now&traffic_model=best_guess&mode=driving&alternatives=true`;

//             const response = await fetch(url);
//             const json = await response.json();

//             if (!json.routes.length) return;

//             const points = polyline.decode(json.routes[0].overview_polyline.points);
//             const mapped = points.map(([latitude, longitude]) => ({ latitude, longitude }));
//             setCoords(mapped);

//             const leg = json.routes[0].legs[0];
//             const duration = leg.duration.value;
//             const trafficDuration = leg.duration_in_traffic?.value || duration;

//             setDuration(Math.round(trafficDuration / 60));

//             if (trafficDuration > duration * 1.5) setTrafficColor("#DE2916");
//             else if (trafficDuration > duration * 1.2) setTrafficColor("#FFA500");
//             else setTrafficColor("#16B84E");
//         } catch (err) {
//             console.error("Erreur Directions API:", err);
//         }
//     }, [drop.latitude, drop.longitude, pickup.latitude, pickup.longitude]);

//     useEffect(() => {
//         fetchDirections();
//     }, [fetchDirections]);

//     // useEffect(() => {
//     //     const interval = setInterval(() => {
//     //         fetchDirections();
//     //     }, 1000);
//     //     return () => clearInterval(interval);
//     // }, [fetchDirections]);

//     useEffect(() => {
//         const interval = setInterval(fetchDirections, 30000); // toutes les 30 sec
//         return () => clearInterval(interval);
//     }, [fetchDirections]);

//     return (
//         <View className="flex-1 bg-white">
//             <MapView
//                 style={{ flex: 1 }}
//                 ref={mapRef}
//                 customMapStyle={mapStyle}
//                 showsUserLocation={false}
//                 // showsMyLocationButton={false}
//                 showsCompass={false}
//                 showsIndoors={false}
//                 zoomEnabled={true}
//                 initialRegion={calculateInitialRegion()}
//                 followsUserLocation
//                 onRegionChange={() => setIsUserInteracting(true)}
//                 onRegionChangeComplete={() => setIsUserInteracting(false)}
//                 provider="google"
//             >
//                 {/* {rider?.latitude && pickup?.latitude && (
//                     <MapViewDirections
//                         // origin={rider}
//                         origin={status === "ACCEPTED" ? rider : pickup}
//                         destination={status === "ACCEPTED" ? pickup : drop}
//                         onReady={(result) => {
//                             setDuration(result.duration); // durée estimée en minutes
//                             fitToMarkers();
//                         }}
//                         apikey={GOOGLE_API_KEY}
//                         strokeColor="red"
//                         strokeWidth={5}
//                         precision="high"
//                         onError={(error) => console.log("Directions error:", error)}
//                     />
//                 )} */}

//                 {drop?.latitude && (
//                     <Marker
//                         anchor={{ x: 0.3, y: 0.6 }}
//                         coordinate={{
//                             latitude: drop.latitude,
//                             longitude: drop.longitude
//                         }}
//                         zIndex={1}
//                         title="Destination"
//                         pinColor="red"
//                     >
//                         <View>
//                             {/* <Image
//                                 source={require('../assets/images/customer.png')}
//                                 style={{ height: 40, width: 40, resizeMode: "contain" }}
//                             /> */}
//                             <Icon name="location-pin" type="entypo" size={35} color="red" />
//                         </View>
//                     </Marker>
//                 )}

//                 {pickup?.latitude && (
//                     <Marker
//                         anchor={{ x: 0.3, y: 0.6 }}
//                         coordinate={{
//                             latitude: pickup.latitude,
//                             longitude: pickup.longitude
//                         }}
//                         zIndex={2}
//                         title="Départ"
//                         pinColor="green"
//                     >
//                         <View>
//                             {/* <Image
//                                 source={require('../assets/images/car2.png')}
//                                 style={{ height: 50, width: 50, resizeMode: "contain" }}
//                             /> */}
//                             <Icon name="location-pin" type="entypo" size={35} color="green" />
//                         </View>
//                     </Marker>
//                 )}

//                 {rider?.latitude && (
//                     <Marker
//                         anchor={{ x: 0.3, y: 0.6 }}
//                         coordinate={{
//                             latitude: rider.latitude,
//                             longitude: rider.longitude
//                         }}
//                         zIndex={1}
//                     >
//                         <View>
//                             <Image
//                                 source={require('../assets/images/driver.png')}
//                                 style={{ height: 50, width: 50, resizeMode: "contain", transform: [{ rotate: `${rider.heading || 0}deg` }], }}
//                             />
//                         </View>
//                     </Marker>
//                 )}

//                 {/* {drop && pickup && (
//                     <Polyline
//                         coordinates={getPoints([drop, pickup])}
//                         strokeColor={theme === "dark" ? "#FFFFFF" : "#000000"}
//                         strokeWidth={2}
//                         geodesic={true}
//                         lineDashPattern={[12, 5]}
//                     />
//                 )} */}
//                 <Polyline coordinates={coords} strokeColor={trafficColor} strokeWidth={5} />
//             </MapView>

//             {/* <CustomButton
//                 icon={<Icon name="my-location" type="material-icon" size={24} color="#ff6d00" />}
//                 // buttonText="Commander une course"
//                 buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
//                 textClassNames="text-white text-lg"
//                 onPress={() => { fitToMarkers() }}
//             /> */}

//             <View
//                 style={{
//                     position: "absolute",
//                     right: 16,
//                     bottom: bottomSheetHeight + 16,
//                     zIndex: 10,
//                 }}
//             >
//                 <CustomButton
//                     icon={
//                         <Icon
//                             name="my-location"
//                             type="material-icon"
//                             size={24}
//                             color="#ff6d00"
//                         />
//                     }
//                     buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
//                     onPress={fitToMarkers}
//                 />
//             </View>
//         </View>
//     )
// }

// export default memo(LiveTrackingMap);