// DriverMap.tsx
// React Native (Expo) navigation simulation page with controls
// Added controls:
// - Toggle traffic overlay on the map
// - Recenter map on user's current GPS location (expo-location)
// - Toggle voice instructions (expo-speech)
// Improvements applied in this version:
// - Platform-aware car marker: uses native `image` on iOS (supports rotation) and a rotated <Image> child on Android for correct rotation
// - Improve speech toggle behavior (stop/resume & reset spoken index)
// - Better visual feedback for control buttons (active states)
// - Small safety checks and error handling for location

import { Icon } from '@rneui/base';
import * as Location from 'expo-location';
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import { Alert, Dimensions, Platform, StyleSheet, Text, TouchableOpacity, Vibration, View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import useStore from "../store/useStore";
// import rideData from "../services/rideData.json";

// Helpers
function toCoords(routeGeometry: number[][]) {
    return routeGeometry.map(([lat, lng]) => ({ latitude: lat, longitude: lng }));
}

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function distanceMeters(a: { latitude: number, longitude: number }, b: { latitude: number, longitude: number }) {
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

function bearingBetween(start: { latitude: number, longitude: number }, end: { latitude: number, longitude: number }) {
    const lat1 = toRad(start.latitude);
    const lat2 = toRad(end.latitude);
    const dLng = toRad(end.longitude - start.longitude);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function interpolateLatLng(a: { latitude: number, longitude: number }, b: { latitude: number, longitude: number }, t: number) { return { latitude: lerp(a.latitude, b.latitude, t), longitude: lerp(a.longitude, b.longitude, t) }; }

function getInitialRegion(coords: { latitude: number, longitude: number }[]) {
    const lats = coords.map(c => c.latitude);
    const lngs = coords.map(c => c.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = (maxLat - minLat) * 1.6 || 0.02;
    const lngDelta = (maxLng - minLng) * 1.6 || 0.02;
    return { latitude: midLat, longitude: midLng, latitudeDelta: latDelta, longitudeDelta: lngDelta };
}

// Shortest angular difference (in degrees)
function shortestAngleDiff(a: number, b: number) {
    let diff = (b - a + 540) % 360 - 180;
    return diff;
}

// utils couleur (hex <-> rgb et interpolation)
function hexToRgb(hex: string) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}
function rgbToHex({ r, g, b }: { r: number, g: number, b: number }) {
    const toHex = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
function interpolateColor(startHex: string, endHex: string, t: number) {
    const a = hexToRgb(startHex);
    const b = hexToRgb(endHex);
    return rgbToHex({ r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t });
}

/**
 * Crée des segments polylines avec couleurs interpolées
 * - coords: array of {latitude, longitude}
 * - startColor / endColor: hex strings (#rrggbb)
 * - segmentStep: group points per polyline. 1 => one Polyline per segment between consecutive points.
 *   > augmenter segmentStep réduit nombre de Polyline (moins fin mais plus perf).
 */
function buildGradientSegments(
    coords: { latitude: number, longitude: number }[],
    startColor = '#2b8aef',
    endColor = '#8b5cf6',
    segmentStep = 1
) {
    if (!coords || coords.length < 2) return [];
    const segments = [] as { coords: { latitude: number, longitude: number }[]; color: string }[];
    const N = coords.length - 1; // number of elementary segments
    // precompute cumulative distances once (O(N))
    const cum: number[] = [0];
    for (let k = 1; k < coords.length; k++) {
        cum[k] = cum[k - 1] + distanceMeters(coords[k - 1], coords[k]);
    }
    const total = cum[cum.length - 1] || 1;
    // iterate over elementary segments, but group them by segmentStep
    for (let i = 0; i < N; i += segmentStep) {
        const segmentCoords: { latitude: number, longitude: number }[] = [];
        const startIndex = i;
        const endIndex = Math.min(i + segmentStep, N);
        for (let j = startIndex; j <= endIndex; j++) segmentCoords.push(coords[j]);
        // color based on the middle position of the segment (normalized 0..1)
        const midDistance = (cum[startIndex] + cum[endIndex]) / 2;
        const t = midDistance / total;
        const color = interpolateColor(startColor, endColor, t);
        segments.push({ coords: segmentCoords, color });
    }
    return segments;
}

export default function DriverMap({ rideData, rider }: { rideData: any, rider: { latitude: number, longitude: number, heading: number } }) {
    const insets = useSafeAreaInsets();
    const { position, setPosition, setRideProgress, clearRideProgress } = useStore()

    function selectRouteByStatus(ride: any) {
        const status = ride?.status;
        const routes = ride?.routes || {};
        if (status === 'ACCEPTED') return routes.driverToPickup || routes.initial || {};
        if (status === 'ARRIVED' || status === 'VERIFIED' || status === 'START' || status === 'STARTED') return routes.initial || {};
        if (status === 'SEARCHING_FOR_RIDER') return routes.initial || {};
        return routes.initial || {};
    }

    const activeRoute = selectRouteByStatus(rideData);
    const routeGeometry = (activeRoute?.geometry || rideData.routeGeometry || rideData.routes?.initial?.geometry) || [];
    const coords = toCoords(routeGeometry.length ? routeGeometry : [[rideData.pickup.latitude, rideData.pickup.longitude], [rideData.drop.latitude, rideData.drop.longitude]]);

    const pickup = { latitude: rideData.pickup.latitude, longitude: rideData.pickup.longitude };
    const drop = { latitude: rideData.drop.latitude, longitude: rideData.drop.longitude };

    const mapRef = useRef<any>(null);
    const animRef = useRef<number | null>(null);
    const liveAnimRef = useRef<number | null>(null);
    const cameraHeadingRef = useRef<number>(0); // current camera heading (degrees)| null>(null);

    // Simulation params
    const baseEstimatedMinutes = rideData.estimatedDuration || 2; // minutes
    const speedMultiplier = 5.0; // increased speed (configurable). Higher -> faster
    const minSegmentMs = 100; // minimum ms per small segment
    const IMAGE_HEADING_OFFSET = 180; // degrees, common correction if PNG's 0° points right

    const spokenStepRef = useRef<number | null>(null); // index of last spoken step
    const [speechEnabled, setSpeechEnabled] = useState(true);

    // Map/UI controls
    const [showTraffic, setShowTraffic] = useState(false);
    const [tracks, setTracks] = useState(true);

    useEffect(() => {
        const t = setTimeout(() => setTracks(false), 2000); // stop tracking après 2s
        return () => clearTimeout(t);
    }, []);

    // wrap speaking to avoid rapid repeats
    const speakInstruction = (instr: string, idx: number) => {
        if (!speechEnabled || !instr) return;
        // prevent repeating same instruction quickly
        if (spokenStepRef.current === idx) return;
        try {
            Speech.speak(instr, { rate: 1.05 });
            spokenStepRef.current = idx;
        } catch (e) {
            console.warn('Speech failed', e);
        }
    };

    // Precompute segment distances and total
    const segmentDistances = Array(coords.length - 1).fill(0);
    let totalDistance = 0;
    for (let i = 1; i < coords.length; i++) {
        const d = distanceMeters(coords[i - 1], coords[i]);
        segmentDistances[i - 1] = d;
        totalDistance += d;
    }

    // Use route-provided duration for ETA (fallback to baseEstimatedMinutes)
    const routeDurationSeconds = (
        (activeRoute?.legs?.[0]?.duration?.value) ??
        (Number.isFinite(activeRoute?.duration) ? (activeRoute as any).duration * 60 : undefined) ??
        (baseEstimatedMinutes * 60)
    );
    const routeDistanceMeters = (
        (activeRoute?.legs?.[0]?.distance?.value) ??
        (Number.isFinite(activeRoute?.distance) ? (activeRoute as any).distance * 1000 : undefined) ??
        totalDistance
    );
    const avgSpeedMps = (routeDistanceMeters > 0 && routeDurationSeconds > 0)
        ? (routeDistanceMeters / routeDurationSeconds)
        : undefined;
    const estimatedTotalMs = Math.max(1000, routeDurationSeconds * 1000);

    // State
    const [markerPosition, setMarkerPosition] = useState(coords[0]);
    const markerPosRef = useRef(coords[0]);
    const [rotation, setRotation] = useState(0);
    const rotationRef = useRef(0);
    const [remainingMeters, setRemainingMeters] = useState(totalDistance);
    const [remainingMs, setRemainingMs] = useState(estimatedTotalMs);
    const [nextInstruction, setNextInstruction] = useState(((activeRoute?.legs?.[0]?.steps?.[0]?.html_instructions) || "Suivre la route").replace(/<[^>]*>/g, ""));

    // Vibration trigger flags (avoid repeated vibrations at thresholds)
    const vib900Ref = useRef(false);
    const vib500Ref = useRef(false);
    const vibArriveRef = useRef(false);

    // Vibration helpers
    const vibrateOnce = () => {
        try { Vibration.vibrate(300); } catch { }
    };
    const vibrateTwice = () => {
        try { Vibration.vibrate([0, 250, 150, 250]); } catch { }
    };
    const vibrateArrival = () => {
        try {
            if (Platform.OS === 'android') {
                Vibration.vibrate(5000);
            } else {
                const pattern = [0, 500, 200, 500, 200, 500, 200, 500, 200, 500];
                Vibration.vibrate(pattern);
                setTimeout(() => Vibration.cancel(), 5000);
            }
        } catch { }
    };

    // store indexes in refs for animation loop
    const currentSegmentIndexRef = useRef(0);
    const segmentStartTimeRef = useRef(0);

    // Steps for instructions (if present)
    const steps = activeRoute?.legs?.[0]?.steps || activeRoute?.steps || [];

    // Utility: compute remaining distance from current marker pos to destination along route
    function computeRemainingDistance(currentPos: { latitude: number, longitude: number }, segIndex: number) {
        let rem = 0;
        // distance from currentPos to end of current segment
        const nextIdx = Math.min(segIndex + 1, coords.length - 1);
        rem += distanceMeters(currentPos, coords[nextIdx]);
        // add remaining full segments after nextIdx
        for (let i = nextIdx + 1; i < coords.length; i++) rem += distanceMeters(coords[i - 1], coords[i]);
        return rem;
    }

    // find nearest coord index to a given position
    function nearestCoordIndex(pos: { latitude: number, longitude: number }) {
        let best = 0; let bestD = Infinity;
        for (let i = 0; i < coords.length; i++) {
            const d = distanceMeters(pos, coords[i]);
            if (d < bestD) { bestD = d; best = i; }
        }
        return best;
    }

    // Find instruction index by choosing step whose end_location is nearest to current position.
    function computeNearestStepInstruction(pos: { latitude: number, longitude: number }) {
        if (!steps || steps.length === 0) return null;
        let best = 0; let bestD = Infinity;
        for (let i = 0; i < steps.length; i++) {
            const end = steps[i].end_location || steps[i].end_location || steps[i].end_location?.lat ? { latitude: steps[i].end_location.lat, longitude: steps[i].end_location.lng } : null;
            if (!end) continue;
            const d = distanceMeters(pos, end);
            if (d < bestD) { bestD = d; best = i; }
        }
        return { index: best, dist: bestD };
    }

    // Simulation disabled in live mode
    /*
    useEffect(() => {
        if (!coords || coords.length < 2) return;
        let cancelled = false;
        markerPosRef.current = coords[0];
        setMarkerPosition(coords[0]);
        rotationRef.current = bearingBetween(coords[0], coords[1]);
        setRotation(rotationRef.current);
        currentSegmentIndexRef.current = 0;
        const initialRemaining = computeRemainingDistance(coords[0], 0);
        setRemainingMeters(initialRemaining);
        setRemainingMs((initialRemaining / totalDistance) * estimatedTotalMs);
        const startAnimation = () => {};
        startAnimation();
        return () => {
            cancelled = true;
            if (animRef.current) cancelAnimationFrame(animRef.current);
        };
    }, [coords?.length]);
    */

    // Live tracking: smoothly interpolate to latest rider coordinate and heading
    useEffect(() => {
        if (!rider || !isFinite(rider.latitude) || !isFinite(rider.longitude)) return;

        const from = markerPosRef.current || coords[0] || { latitude: rider.latitude, longitude: rider.longitude };
        const to = { latitude: rider.latitude, longitude: rider.longitude };
        const startBearing = rotationRef.current || 0;
        const targetBearing = ((rider.heading % 360) + 360) % 360;

        const duration = 400; // ms
        const startTs = Date.now();

        if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);

        const frame = () => {
            const now = Date.now();
            const t = Math.min(1, (now - startTs) / duration);
            const pos = interpolateLatLng(from, to, t);
            markerPosRef.current = pos;
            setMarkerPosition(pos);

            const diff = shortestAngleDiff(startBearing, targetBearing);
            const curBearing = (startBearing + diff * t + 360) % 360;
            rotationRef.current = curBearing;
            setRotation(curBearing);

            if (mapRef.current && mapRef.current.animateCamera) {
                try {
                    mapRef.current.animateCamera({ center: pos, heading: curBearing, pitch: 55 }, { duration: 180 });
                    cameraHeadingRef.current = curBearing;
                } catch (e) { }
            }

            // update remaining distance/time respecting route duration
            let rem = 0;
            if (coords && coords.length > 1 && totalDistance > 0) {
                rem = computeRemainingDistance(pos, nearestCoordIndex(pos));
            } else {
                // fallback to straight-line target: pickup for ACCEPTED, else drop
                const target = (rideData?.status === 'ACCEPTED') ? pickup : drop;
                rem = distanceMeters(pos, target);
            }
            setRemainingMeters(rem);
            const remMs = (avgSpeedMps && rem > 0) ? (rem / avgSpeedMps) * 1000 : ((totalDistance > 0) ? (rem / totalDistance) * estimatedTotalMs : 0);
            setRemainingMs(remMs);

            // vibration thresholds in live mode
            if (!vib900Ref.current && rem <= 900 && rem > 500) {
                vibrateOnce();
                vib900Ref.current = true;
            }
            if (!vib500Ref.current && rem <= 500 && rem > 10) {
                vibrateTwice();
                vib500Ref.current = true;
            }
            if (!vibArriveRef.current && rem <= 10) {
                vibrateArrival();
                vibArriveRef.current = true;
            }

            // update next instruction and speak when near maneuver (<= 40m)
            const nearest = computeNearestStepInstruction(pos);
            if (nearest) {
                const instr = (steps[nearest.index]?.html_instructions || steps[nearest.index]?.instruction || "Suivre la route").replace(/<[^>]*>/g, "");
                setNextInstruction(instr);
                if (speechEnabled && nearest.dist <= 40) {
                    speakInstruction(instr, nearest.index);
                }
            }

            if (t < 1) {
                liveAnimRef.current = requestAnimationFrame(frame);
            }
        };

        liveAnimRef.current = requestAnimationFrame(frame);

        return () => {
            if (liveAnimRef.current) cancelAnimationFrame(liveAnimRef.current);
        };
    }, [rider?.latitude, rider?.longitude, rider?.heading]);

    // Persist ETA and remaining distance in global store for Home page card
    useEffect(() => {
        if (Number.isFinite(remainingMs) && Number.isFinite(remainingMeters)) {
            try { setRideProgress(remainingMs, remainingMeters); } catch {}
        }
    }, [remainingMs, remainingMeters]);

    // format helpers
    function formatDistance(m: number) {
        if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
        return `${Math.round(m)} m`;
    }
    function formatTime(ms: number) {
        if (ms <= 0) return "0:00";
        const sec = Math.round(ms / 1000);
        const minutes = Math.floor(sec / 60);
        const seconds = sec % 60;
        return `${minutes}:${seconds.toString().padStart(2, "0")}`;
    }

    const initialRegion = getInitialRegion(coords);

    const cameraHeading = cameraHeadingRef.current || 0;
    const displayRotation = ((rotation - cameraHeading) + 360) % 360;

    // Recenter on user's location using expo-location
    const recenterToUser = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', "Autorisez la localisation pour recentrer la carte.");
                return;
            }
            const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
            const userCoord = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
            if (mapRef.current && mapRef.current.animateCamera) {
                try {
                    setPosition({ longitude: userCoord.longitude, latitude: userCoord.latitude, heading: pos.coords.heading || 0, address: position.address })
                    mapRef.current.animateCamera({ center: userCoord, heading: 0, pitch: 45 }, { duration: 600 });
                    cameraHeadingRef.current = 0;
                } catch (e) {
                    mapRef.current.animateToRegion({ ...userCoord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
                }
            }
        } catch (e) {
            console.warn('Recenter failed', e);
            Alert.alert('Erreur', 'Impossible de récupérer la position.');
        }
    };

    console.log("rider dvdvd ", rideData.routeGeometry)

    // Toggle speech and ensure state is consistent
    const toggleSpeech = () => {
        setSpeechEnabled(s => {
            const next = !s;
            if (!next) {
                // stop current speech and reset spoken index
                try { Speech.stop(); } catch (e) { }
                spokenStepRef.current = null;
            } else {
                // allow speaking again
                spokenStepRef.current = null;
            }
            return next;
        });
    };

    return (
        <View style={{ flex: 1 }}>
            {/* Top banner */}
            <View style={[styles.topBanner, { top: insets.top + 26 }]}>
                <Text className="font-['RubikMedium']" style={{ fontSize: 12, color: '#6b7280' }}>Distance restante</Text>
                <Text className="font-['RubikBold']" style={{ fontSize: 14 }}>{formatDistance(remainingMeters)}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <View>
                        <Text className="font-['RubikMedium']" style={{ fontSize: 12, color: '#6b7280' }}>Temps restant</Text>
                        <Text className="font-['RubikBold']">{formatTime(remainingMs)}</Text>
                    </View>
                    {/* <View style={{ alignItems: 'flex-end' }}>
                        <Text style={{ fontSize: 12, color: '#6b7280' }}>Temps restant</Text>
                        <Text style={{ fontWeight: '700', fontSize: 16 }}>{formatTime(remainingMs)}</Text>
                    </View> */}
                </View>
                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 }}>
                    <Text className="font-['RubikMedium']" style={{ fontSize: 12, color: '#374151' }}>Prochaine instruction</Text>
                    <Text className="font-['RubikMedium']">{nextInstruction}</Text>
                </View>
            </View>

            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                initialRegion={initialRegion}
                showsUserLocation={false}
                showsMyLocationButton={false}
                rotateEnabled={true}
                pitchEnabled={true}
                showsTraffic={showTraffic}
                maxZoomLevel={16}
                cameraZoomRange={{
                    minCenterCoordinateDistance: 80, // plus petit = zoom plus fort possible
                    maxCenterCoordinateDistance: 1500000,
                }}
            >
                {/* route polyline */}
                {/* <Polyline coordinates={coords} strokeColor="#2b8aef" strokeWidth={5} /> */}

                {/* route polyline gradient */}
                {(() => {
                    // params: startColor, endColor, segmentStep (1 = finest, larger = fewer segments)
                    const startColor = '#22c55e';
                    const endColor = '#ef4444';
                    const segmentStep = 2; // ajuste : 1 = très fin (beaucoup de polylines), 2 = medium
                    const gradientSegments = buildGradientSegments(coords, startColor, endColor, segmentStep);
                    return gradientSegments.map((s, idx) => (
                        <Polyline
                            key={`seg-${idx}`}
                            coordinates={s.coords}
                            strokeColor={s.color}
                            strokeWidth={5}
                            lineCap="round"
                            lineJoin="round"
                            zIndex={100 - idx} // optionnel : garantir order rendu
                        />
                    ));
                })()}

                {/* pickup */}
                <Marker coordinate={pickup} anchor={{ x: 0.5, y: 1 }}>
                    <View className='bg-green-500' style={{ padding: 6, borderRadius: 8 }}>
                        <Text className="font-['RubikMedium'] text-white">D</Text>
                    </View>
                </Marker>

                {/* drop */}
                <Marker coordinate={drop} anchor={{ x: 0.5, y: 1 }}>
                    <View className='bg-red-500' style={{ padding: 6, borderRadius: 8 }}>
                        <Text className="font-['RubikMedium'] text-white">A</Text>
                    </View>
                </Marker>

                {/* moving car: use flat marker and rotate relative to map */}
                {/* <Marker
                    image={require('../assets/images/driver.png')}
                    coordinate={markerPosition}
                    anchor={{ x: 0.5, y: 0.5 }}
                    rotation={(displayRotation + IMAGE_HEADING_OFFSET + 360) % 360}
                    flat={true}
                    tracksViewChanges={tracks}
                /> */}

                <Marker
                    image={require("../assets/images/driver.png")}
                    coordinate={markerPosition}
                    anchor={{ x: 0.5, y: 0.5 }}
                    tracksViewChanges={tracks}
                >
                    {/* <View className="bg-[#2b8aef]" style={{ width: 52, height: 52, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: `${rotation}deg` }] }}>
                        Replace with your top-down car image pointing up
                        <Image source={require('../assets/images/driver.png')} style={{ width: 48, height: 48 }} resizeMode="contain" />
                    </View> */}
                </Marker>
            </MapView>

            {/* Controls (top-right) */}
            <View style={[styles.controlsContainer, { top: insets.top + 26 }]} pointerEvents="box-none">
                <TouchableOpacity style={[styles.controlButton]} onPress={() => setShowTraffic(s => !s)}>
                    {/* <Image source={require('../assets/icons/traffic.png')} style={styles.controlIcon} /> */}
                    {/* <Text style={styles.controlLabel}>{showTraffic ? 'Trafic ON' : 'Trafic'}</Text> */}
                    <Icon
                        name="layers"
                        type="material-icons"
                        size={22}
                        color={showTraffic ? "#16B84E" : "#555"}
                    />
                </TouchableOpacity>

                <TouchableOpacity style={styles.controlButton} onPress={recenterToUser}>
                    {/* <Image source={require('../assets/icons/locate.png')} style={styles.controlIcon} /> */}
                    {/* <Text style={styles.controlLabel}>Recentrer</Text> */}
                    <Icon
                        name="my-location"
                        type="material-icons"
                        size={22}
                        color="#222"
                    />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.controlButton, speechEnabled ? null : { opacity: 0.6 }]} onPress={toggleSpeech}>
                    {/* <Image source={require('../assets/icons/sound.png')} style={[styles.controlIcon, { opacity: speechEnabled ? 1 : 0.5 }]} /> */}
                    {/* <Text style={styles.controlLabel}>{speechEnabled ? 'Voix ON' : 'Voix OFF'}</Text> */}
                    <Icon
                        name={speechEnabled ? "volume-off" : "volume-up"}
                        type="material-icons"
                        size={22}
                        color={speechEnabled ? "#999" : "#222"}
                    />
                </TouchableOpacity>
            </View>

            {/* Bottom footer: remaining distance & ETA */}
            {/* <View style={[styles.bottomFooter, { top: insets.top + 200 }]}>
                <View style={{ justifyContent: 'space-between' }}>
                    <View className='mb-2'>
                        <Text className="font-['RubikMedium']" style={{ fontSize: 12, color: '#6b7280' }}>Distance restante</Text>
                        <Text className="font-['RubikBold']">{formatDistance(remainingMeters)}</Text>
                    </View>
                    <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 }}>
                        <Text className="font-['RubikMedium']" style={{ fontSize: 12, color: '#6b7280' }}>Temps restant</Text>
                        <Text className="font-['RubikBold']">{formatTime(remainingMs)}</Text>
                    </View>
                </View>
                <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600' }}>{nextInstruction}</Text>
                </View>
            </View> */}
        </View>
    );
}

const styles = StyleSheet.create({
    topBanner: { position: 'absolute', width: Dimensions.get('window').width * 0.78, left: 12, right: 12, zIndex: 50, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)', padding: 12 },
    controlsContainer: { position: 'absolute', right: 12, zIndex: 60, alignItems: 'flex-end', gap: 10 },
    controlButton: { backgroundColor: 'white', borderRadius: 10, padding: 8, marginBottom: 8, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4 },
    controlIcon: { width: 28, height: 28, marginBottom: 4 },
    controlLabel: { fontSize: 11 },
    bottomFooter: { position: 'absolute', width: Dimensions.get('window').width * 0.35, left: 12, right: 12, zIndex: 50, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.98)', padding: 12 }
});