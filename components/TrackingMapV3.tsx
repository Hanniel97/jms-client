import { CustomButton } from '@/components/CustomButton';
import useStore from '@/store/useStore';
import { Icon } from '@rneui/base';
import MapboxGL from '@rnmapbox/maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Text, useColorScheme, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MAPBOX_ACCESS_TOKEN } from '@/services/api';

type GeoJSONLineString = {
    type: "LineString";
    coordinates: [number, number][];
};

type LatLng = { latitude: number; longitude: number; heading?: number, address?: string };

const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = 0.01;
const INITIAL_ZOOM = 15;

const TARGET_SPEED_MPS = 12;
const MIN_ANIM_MS = 180;
const MAX_ANIM_MS = 1400;
const TELEPORT_THRESHOLD_M = 120;
const SNAP_MAX_METERS = 30;
const MARKER_LOOKAHEAD_METERS = 70;

interface Props {
    height: number;
    drop: LatLng | any;
    pickup: LatLng | any;
    rider: LatLng | Record<string, never>;
    status: string;
    bottomSheetHeight: number;
    routeGeometry?: GeoJSONLineString | null;
    serverEtaMin?: number | null;
    serverEtaText?: string | null;
    serverDistanceKm?: number | null;
    setDuration: (min: number) => void;
    onArrivedPickup?: () => void;
    onArrivedDrop?: () => void;
    onOffRoute?: (meters: number) => void;
    onStepChange?: ((step: { index: number; instruction: string; distanceMeters: number; distanceText?: string; maneuver?: string; polyline?: string } | null) => void);
}

/* ---------------- helpers géo ---------------- */
const EARTH_R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;
const isNum = (n: any) => typeof n === 'number' && !Number.isNaN(n);
const isLatLng = (p: any) => isNum(p?.latitude) && isNum(p?.longitude);
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
const norm180 = (deg: number) => ((deg + 180) % 360 + 360) % 360 - 180;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// projectOnSegment & pointAlongRoute (identiques à ton implémentation)
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
    const lon = (sx * 180) / (Math.PI * EARTH_R * Math.cos(toRad(lat || a.latitude)));
    const proj = { latitude: lat, longitude: lon } as LatLng;
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

const RideStatus = {
    SEARCHING_FOR_RIDER: "SEARCHING_FOR_RIDER",
    ACCEPTED: "ACCEPTED",
    ARRIVED: "ARRIVED",
    VERIFIED: "VERIFIED",
    START: "START",
    COMPLETED: "COMPLETED",
    PAYED: "PAYED",
} as const;

export const TrackingMapV3: React.FC<Props> = ({
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
    const theme = useColorScheme();
    const { position } = useStore();

    const [showsTrafficLayer, setShowsTrafficLayer] = useState(false);
    const [isFollowing, setIsFollowing] = useState(false);
    const [distanceLeftM, setDistanceLeftM] = useState<number>(0);
    const [etaText, setEtaText] = useState<string>('');
    const [ttsMuted, setTtsMuted] = useState(false);

    const mapRef = useRef<MapboxGL.MapView | null>(null);
    const cameraRef = useRef<any>(null);

    const styleURL = theme === 'dark' ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Street;

    const riderLocationMemo = useMemo(
        () => (isLatLng(rider) ? { latitude: rider.latitude, longitude: rider.longitude, heading: isNum(rider.heading) ? rider.heading : 0 } : undefined),
        [rider]
    );
    const pickupLocationMemo = useMemo(
        () => (isLatLng(pickup) ? { latitude: pickup.latitude, longitude: pickup.longitude } : { latitude: position.latitude, longitude: position.longitude }),
        [pickup, position.latitude, position.longitude]
    );
    const dropLocationMemo = useMemo(
        () => (isLatLng(drop) ? { latitude: drop.latitude, longitude: drop.longitude } : { latitude: position.latitude, longitude: position.longitude }),
        [drop, position.latitude, position.longitude]
    );

    /* ---------- initialRegion (sans moyenne) ---------- */
    const initialRegion = useMemo(() => {
        const regionFromPoint = (lat?: number, lon?: number) => ({
            latitude: Number(lat) || 0,
            longitude: Number(lon) || 0,
            latitudeDelta: LATITUDE_DELTA,
            longitudeDelta: LONGITUDE_DELTA,
        } as any);

        if (status === RideStatus.SEARCHING_FOR_RIDER) {
            if (pickupLocationMemo) return regionFromPoint(pickupLocationMemo.latitude, pickupLocationMemo.longitude);
            return regionFromPoint(position.latitude, position.longitude);
        }
        if (status === RideStatus.ACCEPTED) {
            if (riderLocationMemo) return regionFromPoint(riderLocationMemo.latitude, riderLocationMemo.longitude);
            if (pickupLocationMemo) return regionFromPoint(pickupLocationMemo.latitude, pickupLocationMemo.longitude);
            return regionFromPoint(position.latitude, position.longitude);
        }
        if (status === RideStatus.ARRIVED || status === RideStatus.VERIFIED || status === RideStatus.START) {
            if (riderLocationMemo) return regionFromPoint(riderLocationMemo.latitude, riderLocationMemo.longitude);
            if (dropLocationMemo) return regionFromPoint(dropLocationMemo.latitude, dropLocationMemo.longitude);
            return regionFromPoint(position.latitude, position.longitude);
        }
        return regionFromPoint(position.latitude, position.longitude);
    }, [
        status,
        riderLocationMemo,
        pickupLocationMemo,
        dropLocationMemo,
        position.latitude,
        position.longitude,
    ]);

    useEffect(() => {
        if (ttsMuted){
            Speech.stop();
            return;
        };
        // Speech.VoiceQuality.Enhanced;
        if (status === "ACCEPTED") {
            Speech.speak("Votre chauffeur est en route. Veuillez patienter jusqu'à ce qu'il soit à votre destination. Nous vous remercions pour votre confiance.", { language: "fr-FR", pitch: 1, rate: 1, volume: 1, voice: "fr-FR" });
        } else if (status === "ARRIVED") {
            Speech.speak("Votre chauffeur est arrivé.", { language: "fr-FR", pitch: 1, rate: 1, volume: 1, voice: "fr-FR" });
        } else if (status === "START") {
            Speech.speak("JMS Transport film votre trajet pour garantir votre sécurité. Merci et bon trajet à vous.", { language: "fr-FR", pitch: 1, rate: 1, volume: 1, voice: "fr-FR" });
        } else if (status === "COMPLETED") {
            Speech.speak("Merci d'avoir choisi JMS Transport. Nous vous remercions pour votre confiance.", { language: "fr-FR", pitch: 1, rate: 1, volume: 1, voice: "fr-FR" });
        }
    }, [status, ttsMuted])

    // ETA/distance venant du backend
    useEffect(() => {
        if (isNum(serverEtaMin)) {
            const mins = Math.max(1, Math.round(serverEtaMin as number));
            // setEtaSeconds(mins * 60);
            setEtaText(serverEtaText || `${mins} min`);
            setDuration((prev) => (prev !== mins ? mins : prev));
        }
        if (isNum(serverDistanceKm)) {
            setDistanceLeftM(Math.max(0, Math.round((serverDistanceKm as number) * 1000)));
        }
    }, [serverEtaMin, serverEtaText, serverDistanceKm, setDuration]);

    // push server ETA -> setDuration (optionnel)
    useEffect(() => {
        if (isNum(serverEtaMin) && setDuration) {
            setDuration(serverEtaMin as number);
        }
    }, [serverEtaMin, setDuration]);

    const onMapIdle = useCallback(async () => {
        try {
            const center = await cameraRef.current?.getCenter?.();
            if (!center) return;
        } catch { }
    }, []);

    const goToMyLocation = () => {
        cameraRef.current?.flyTo([Number(position.longitude), Number(position.latitude)], 1000);
    };

    /* ---------------- Route handling ---------------- */
    const routeCoordsLatLng = useMemo(() => {
        if (!routeGeometry || !Array.isArray(routeGeometry.coordinates)) return [] as LatLng[];
        return routeGeometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
    }, [routeGeometry]);

    const routeLineCoordinates = useMemo(() => {
        if (!routeCoordsLatLng.length) return [] as [number, number][];
        return routeCoordsLatLng.map((c) => [c.longitude, c.latitude]);
    }, [routeCoordsLatLng]);

    /* ---------------- Rider animation (ta logique) ---------------- */
    const [animatedPos, setAnimatedPos] = useState<LatLng | null>(riderLocationMemo ?? null);
    const animatedPosRef = useRef<LatLng | null>(animatedPos);
    useEffect(() => { animatedPosRef.current = animatedPos; }, [animatedPos]);

    const animatedHeadingRef = useRef<number>(riderLocationMemo?.heading ?? 0);
    const [riderFeature, setRiderFeature] = useState<any>(() => {
        const p = riderLocationMemo;
        if (!p) return null;
        return {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [p.longitude, p.latitude] },
                    properties: { bearing: p.heading ?? 0 },
                },
            ],
        };
    });

    const rafRef = useRef<number | null>(null);

    const nearestOnRoute = useCallback((pos: LatLng) => {
        if (!routeCoordsLatLng || routeCoordsLatLng.length < 2) return null;
        let best = null as any;
        for (let i = 0; i < routeCoordsLatLng.length - 1; i++) {
            const a = routeCoordsLatLng[i];
            const b = routeCoordsLatLng[i + 1];
            const res = projectOnSegment(pos, a, b);
            if (!best || res.dist < best.dist) best = { ...res, segIdx: i };
        }
        return best;
    }, [routeCoordsLatLng]);

    // animate marker (ton code existant)
    useEffect(() => {
        if (!riderLocationMemo) return;
        const from = animatedPosRef.current ?? riderLocationMemo;
        const newRawTarget = { latitude: riderLocationMemo.latitude, longitude: riderLocationMemo.longitude };
        let target = newRawTarget;
        let targetSegIdx = -1;
        let targetT = 0;
        const near = nearestOnRoute(newRawTarget);
        if (near && near.dist <= SNAP_MAX_METERS) {
            target = near.proj;
            targetSegIdx = near.segIdx;
            targetT = near.t;
        }
        let desiredHeading = isNum(riderLocationMemo.heading) ? riderLocationMemo.heading! : undefined;
        if (!isNum(desiredHeading)) {
            if (targetSegIdx >= 0 && routeCoordsLatLng.length > 1) {
                const ahead = pointAlongRoute(routeCoordsLatLng, targetSegIdx, targetT, MARKER_LOOKAHEAD_METERS).point;
                desiredHeading = bearing(target, ahead);
            } else {
                desiredHeading = bearing(from, target);
            }
        }
        const d = haversine(from, target);
        if (d > TELEPORT_THRESHOLD_M) {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            animatedHeadingRef.current = desiredHeading!;
            setAnimatedPos(target);
            setRiderFeature({
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [target.longitude, target.latitude] },
                        properties: { bearing: desiredHeading ?? 0 },
                    },
                ],
            });
            // if following, center camera on teleport target
            if (isFollowing) {
                try {
                    cameraRef.current?.setCamera?.({
                        centerCoordinate: [target.longitude, target.latitude],
                        animationDuration: 300,
                        heading: desiredHeading,
                        pitch: 45,
                    });
                } catch { }
            }
            return;
        }
        const duration = clamp(Math.round((d / TARGET_SPEED_MPS) * 1000), MIN_ANIM_MS, MAX_ANIM_MS);
        const startTs = Date.now();
        const startLat = from.latitude, startLng = from.longitude;
        const endLat = target.latitude, endLng = target.longitude;
        const startHeading = animatedHeadingRef.current ?? (riderLocationMemo.heading ?? 0);
        const endHeading = desiredHeading ?? startHeading;
        let cancelled = false;
        const step = () => {
            const now = Date.now();
            const t = Math.min(1, (now - startTs) / duration);
            const newLat = startLat + (endLat - startLat) * t;
            const newLng = startLng + (endLng - startLng) * t;
            const delta = norm180(endHeading - startHeading);
            const newHeading = (startHeading + delta * t + 360) % 360;
            animatedHeadingRef.current = newHeading;
            const newPos = { latitude: newLat, longitude: newLng };
            setAnimatedPos(newPos);
            setRiderFeature({
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        geometry: { type: "Point", coordinates: [newLng, newLat] },
                        properties: { bearing: newHeading },
                    },
                ],
            });
            // si le suivi est activé on recentre la caméra à chaque frame
            if (isFollowing) {
                try {
                    cameraRef.current?.setCamera?.({
                        centerCoordinate: [newLng, newLat],
                        animationDuration: 250,
                        heading: newHeading,
                        pitch: 45,
                    });
                } catch { }
            }
            if (t < 1 && !cancelled) {
                rafRef.current = requestAnimationFrame(step);
            } else {
                rafRef.current = null;
            }
        };
        if (rafRef.current) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        rafRef.current = requestAnimationFrame(step);
        return () => {
            cancelled = true;
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [riderLocationMemo?.latitude, riderLocationMemo?.longitude, riderLocationMemo?.heading, routeGeometry, nearestOnRoute, isFollowing]);

    useEffect(() => {
        return () => {
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };
    }, []);

    /* ---------------- Follow target logic (selon status) ---------------- */
    const getFollowTarget = useCallback((): LatLng | null => {
        if (status === RideStatus.SEARCHING_FOR_RIDER) {
            return pickupLocationMemo ?? { latitude: position.latitude, longitude: position.longitude };
        }
        if (status === RideStatus.ACCEPTED) {
            return riderLocationMemo ?? pickupLocationMemo ?? { latitude: position.latitude, longitude: position.longitude };
        }
        if (status === RideStatus.ARRIVED || status === RideStatus.VERIFIED || status === RideStatus.START) {
            return riderLocationMemo ?? dropLocationMemo ?? { latitude: position.latitude, longitude: position.longitude };
        }
        return { latitude: position.latitude, longitude: position.longitude };
    }, [status, riderLocationMemo, pickupLocationMemo, dropLocationMemo, position.latitude, position.longitude]);

    // when user toggles follow on, immediately center on correct target
    useEffect(() => {
        if (!isFollowing) return;
        const t = getFollowTarget();
        if (!t) return;
        try {
            cameraRef.current?.setCamera?.({
                centerCoordinate: [t.longitude, t.latitude],
                animationDuration: 350,
                pitch: 45,
                heading: animatedHeadingRef.current,
            });
        } catch { }
    }, [isFollowing, getFollowTarget]);

    /* ---------------- UI: route color (toggle traffic) ---------------- */
    const routeColor = showsTrafficLayer ? '#ff6d00' : '#16B84E';
    const routeWidth = showsTrafficLayer ? 5 : 3;
    

    /* ---------------- Render Map ---------------- */
    return (
        <View style={{ flex: 1 }}>
            <MapboxGL.MapView
                ref={(r) => (mapRef.current = r)}
                style={{ flex: 1 }}
                // styleURL={styleURL}
                styleURL={styleURL}
                logoEnabled={false}
                compassEnabled={true}
                rotateEnabled
                pitchEnabled
                zoomEnabled
                onTouchStart={() => {
                    if (isFollowing) setIsFollowing(false);
                }}
                initialRegion={initialRegion}
                onMapIdle={onMapIdle}
                compassPosition={{ top: insets.top, right: 12 }}
            >
                <MapboxGL.Camera
                    ref={(r) => (cameraRef.current = r)}
                    centerCoordinate={[initialRegion.longitude, initialRegion.latitude]}
                    zoomLevel={INITIAL_ZOOM}
                    maxZoomLevel={17}
                    minZoomLevel={10}
                    animationMode="flyTo"
                />

                {/* registre l'icône voiture */}
                <MapboxGL.Images images={{ car: require('@/assets/images/driver.png') }} />

                <MapboxGL.UserLocation visible={true} androidRenderMode="compass" showsUserHeadingIndicator={true} />

                {/* Route full (couleur variant selon traffic toggle) */}
                {routeLineCoordinates.length > 1 && (
                    <MapboxGL.ShapeSource
                        id="route_full_source"
                        shape={{
                            type: 'Feature',
                            geometry: { type: 'LineString', coordinates: routeLineCoordinates },
                        }}
                    >
                        <MapboxGL.LineLayer
                            id="route_full_line"
                            style={{
                                lineWidth: routeWidth,
                                lineJoin: 'round',
                                lineCap: 'round',
                                lineColor: routeColor,
                                lineOpacity: 0.95,
                            }}
                        />
                    </MapboxGL.ShapeSource>
                )}

                {/* Pickup / Drop markers */}
                {dropLocationMemo && (
                    <MapboxGL.PointAnnotation id="drop" coordinate={[dropLocationMemo.longitude, dropLocationMemo.latitude]}>
                        <MapboxGL.Callout title={drop.address} />
                        <View style={{ transform: [{ translateY: -8 }] }}>
                            <Icon name="flag" type="material-icons" size={35} color="red" />
                            {/* <Icon name="location-pin" type="entypo" size={35} color="red" /> */}
                        </View>
                    </MapboxGL.PointAnnotation>
                )}
                {pickupLocationMemo && (
                    <MapboxGL.PointAnnotation id="pickup" coordinate={[pickupLocationMemo.longitude, pickupLocationMemo.latitude]}>
                        <MapboxGL.Callout title={pickup.address} />
                        <View style={{ transform: [{ translateY: -8 }] }}>
                            <Icon name="location-pin" type="entypo" size={35} color="green" />
                        </View>
                    </MapboxGL.PointAnnotation>
                )}

                {/* Rider: ShapeSource + SymbolLayer (updated by animation) */}
                {riderFeature && (
                    <MapboxGL.ShapeSource id="rider_source" shape={riderFeature}>
                        <MapboxGL.SymbolLayer
                            id="rider_symbol"
                            style={{
                                iconImage: 'car',
                                iconSize: 0.085,
                                iconAllowOverlap: true,
                                iconIgnorePlacement: true,
                                iconRotate: ['get', 'bearing'],
                                iconRotationAlignment: 'map',
                            }}
                        />
                    </MapboxGL.ShapeSource>
                )}
            </MapboxGL.MapView>

            {/* Floating actions: trafic + follow + my-location */}
            <View style={{ position: 'absolute', right: 12, top: insets.top + 55, zIndex: 10, gap: 12 }}>
                <CustomButton
                    icon={<Icon name="layers" type="material-icons" size={22} color={showsTrafficLayer ? '#16B84E' : '#555'} />}
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={() => setShowsTrafficLayer(s => !s)}
                />
                <CustomButton
                    icon={<Icon name={isFollowing ? 'gps-fixed' : 'gps-not-fixed'} type="material-icons" size={22} color={isFollowing ? '#16B84E' : '#ff6d00'} />}
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={() => setIsFollowing(s => !s)}
                />
                <CustomButton
                    icon={<Icon name="my-location" type="material-icons" size={22} color="#222" />}
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={goToMyLocation}
                />

                <CustomButton icon={<Icon name={ttsMuted ? 'volume-off' : 'volume-up'} type="material-icons" size={22} color={ttsMuted ? '#999' : '#222'} />} buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center" onPress={() => setTtsMuted(s => !s)} />
            </View>

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
        </View>
    );
};

export default memo(TrackingMapV3);
