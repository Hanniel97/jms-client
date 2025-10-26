// hooks/useDriverTracking.client.ts (remplace ton fichier)
import { IRide } from "@/types";
import * as Speech from "expo-speech";
import { useEffect, useMemo, useRef, useState } from "react";
import { LatLng, bearing, haversineMeters } from "../../utils/geo";

export type RiderCoord = {
    latitude: number;
    longitude: number;
    heading?: number;
};

type Step = {
    maneuver: { instruction: string; location: [number, number] };
    distance: number;
};

export type UseDriverTrackingArgs = {
    routeKey: string;
    routeCoords: LatLng[];
    routeSteps?: any[]; // <-- nouvelle prop: steps provenant de Google (html_instructions...)
    ride?: IRide;
    rider?: RiderCoord | null;
    simulate?: boolean;
    ttsLanguage?: string;
    frameMs?: number;
    minStepMs?: number;
    displayThreshold?: number;
    speakThreshold?: number;
    fallbackSpeedMetersPerSec?: number;
    markerRotationOffsetDeg?: number;
};

export default function useDriverTracking({
    routeKey,
    routeCoords,
    routeSteps = [],
    ride,
    rider = undefined,
    simulate = false,
    ttsLanguage = "fr-FR",
    frameMs = 100,
    minStepMs = 80,
    displayThreshold = 80,
    speakThreshold = 30,
    fallbackSpeedMetersPerSec = 10,
    markerRotationOffsetDeg = 0,
}: UseDriverTrackingArgs) {
    // states
    const [isFollowing, setIsFollowing] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [showTraffic, setShowTraffic] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);

    const [heading, setHeading] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [currentCoord, setCurrentCoord] = useState<LatLng | null>(routeCoords?.[0] ?? null);

    const [currentInstruction, setCurrentInstruction] = useState<string | null>(null);
    const [nextStepDistance, setNextStepDistance] = useState<number | null>(null);
    const [remainingDistance, setRemainingDistance] = useState<number>(0);
    const [remainingDuration, setRemainingDuration] = useState<number>(0);

    // refs
    const stopRef = useRef(false);
    const lastIncomingTsRef = useRef<number | null>(null);
    const recentPositionsRef = useRef<{ latitude: number; longitude: number; ts: number }[]>([]);
    const spokenStepsRef = useRef<Set<number>>(new Set());
    const liveInterpTokenRef = useRef(0);

    // --- prepare steps array normalized ---
    const steps = useMemo(() => {
        // routeSteps expected to have instructionText (already stripped) and location
        return (routeSteps || []).map((s: any, i: number) => ({
            id: s.id ?? i,
            instructionText: (s.instructionText ?? s.instruction ?? s.instructionHtml ?? "").toString().replace(/<[^>]*>?/gm, ""),
            location: s.location ?? null,
            distance: s.distance ?? null,
            duration: s.duration ?? null,
            raw: s,
        }));
    }, [routeSteps]);

    // console.debug("NewTracking     routeSteps:", routeSteps);

    const { segmentDistances, totalRouteDist } = useMemo(() => {
        const segs: number[] = [];
        for (let i = 1; i < routeCoords.length; i++) {
            segs.push(haversineMeters(routeCoords[i - 1], routeCoords[i]));
        }
        const total = segs.reduce((a, b) => a + b, 0) || 1;
        return { segmentDistances: segs, totalRouteDist: total };
    }, [routeCoords]);

    const totalRouteDurationSec = useMemo(() => {
        return (ride as any)?.duration ?? 0;
    }, [ride]);

    const markerRegion = useMemo(() => {
        if (!currentCoord) return null;
        return {
            latitude: currentCoord.latitude,
            longitude: currentCoord.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
        };
    }, [currentCoord]);

    // smoothing helper (unchanged)
    const addFilteredPosition = (pos: { latitude: number; longitude: number; ts: number }) => {
        const arr = recentPositionsRef.current;
        let speed = 0;
        if (arr.length > 0) {
            const last = arr[arr.length - 1];
            const d = haversineMeters(last, pos);
            const dt = Math.max(0.001, (pos.ts - last.ts) / 1000);
            speed = d / dt;
        }
        const fastThreshold = 3.0;
        const mediumThreshold = 1.0;
        let maxLen = 5;
        if (speed > fastThreshold) maxLen = 1;
        else if (speed > mediumThreshold) maxLen = 2;
        else maxLen = 4;
        arr.push(pos);
        if (arr.length > maxLen) arr.shift();
        let wsum = 0;
        let lat = 0;
        let lng = 0;
        for (let i = 0; i < arr.length; i++) {
            const w = i + 1;
            lat += arr[i].latitude * w;
            lng += arr[i].longitude * w;
            wsum += w;
        }
        return { latitude: lat / wsum, longitude: lng / wsum } as LatLng;
    };

    // angle helpers (same as before)
    const normalizeAngle = (ang: number) => {
        let a = ang % 360;
        if (a < 0) a += 360;
        return a;
    };
    const angleDiff = (from: number, to: number) => {
        const diff = normalizeAngle(to) - normalizeAngle(from);
        if (diff > 180) return diff - 360;
        if (diff < -180) return diff + 360;
        return diff;
    };
    const lerpAngle = (from: number, to: number, t: number) => {
        const d = angleDiff(from, to);
        return normalizeAngle(from + d * t);
    };

    // heading smoothing
    const prevSmoothedHeadingRef = useRef<number | null>(null);
    const quickRotateUntilRef = useRef<number>(0);
    const smoothHeading = (newH: number, speed = 0) => {
        newH = normalizeAngle(newH);
        const now = Date.now();
        if (prevSmoothedHeadingRef.current === null) {
            prevSmoothedHeadingRef.current = newH;
            return newH;
        }
        const prev = prevSmoothedHeadingRef.current;
        const delta = Math.abs(angleDiff(prev, newH));
        const minAlpha = 0.25;
        const maxAlpha = 0.95;
        const angFactor = Math.min(1, delta / 90);
        const speedFactor = Math.min(1, speed / 5);
        if (delta > 25) quickRotateUntilRef.current = now + 420;
        const inQuick = now < quickRotateUntilRef.current ? 1 : 0;
        const alpha = Math.max(
            minAlpha,
            Math.min(maxAlpha, minAlpha + (maxAlpha - minAlpha) * Math.max(angFactor, speedFactor) * (0.6 + 0.4 * inQuick))
        );
        const out = lerpAngle(prev, newH, alpha);
        prevSmoothedHeadingRef.current = out;
        return out;
    };

    // helper: compute remaining & nearest seg index (unchanged)
    function computeRemainingDistanceFromPoint(coord: LatLng | null) {
        if (!coord || routeCoords.length < 2) return { remaining: 0, segIndex: 0 };

        let best = { idx: 0, dist: Infinity, closest: routeCoords[0], t: 0 };
        for (let i = 0; i < routeCoords.length - 1; i++) {
            const a = routeCoords[i];
            const b = routeCoords[i + 1];
            const vx = b.longitude - a.longitude;
            const vy = b.latitude - a.latitude;
            const wx = coord.longitude - a.longitude;
            const wy = coord.latitude - a.latitude;
            const vv = vx * vx + vy * vy;
            let t = 0;
            if (vv > 0) t = (wx * vx + wy * vy) / vv;
            if (t < 0) t = 0;
            if (t > 1) t = 1;
            const closest = { latitude: a.latitude + vy * t, longitude: a.longitude + vx * t };
            const d = haversineMeters(coord, closest);
            if (d < best.dist) best = { idx: i, dist: d, closest, t };
        }

        let rem = 0;
        const nSeg = segmentDistances.length;
        if (best.idx < routeCoords.length - 1) {
            rem += haversineMeters(best.closest, routeCoords[best.idx + 1]);
            for (let j = best.idx + 1; j < nSeg; j++) rem += segmentDistances[j];
        }
        return { remaining: rem, segIndex: best.idx, closest: best.closest };
    }

    function findClosestStepIndex(coord: LatLng | null) {
        if (!coord || steps.length === 0) return -1;
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let i = 0; i < steps.length; i++) {
            const s = steps[i];
            if (!s.location) continue;
            const d = haversineMeters(coord, s.location);
            if (d < bestDist) {
                bestDist = d;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    // interpolate (unchanged concept) but also update instruction every frame
    async function interpolateLiveSegment(start: LatLng, end: LatLng, durationMs: number, token: number) {
        const frames = Math.max(1, Math.floor(durationMs / frameMs));
        let prevPoint = start;
        for (let f = 1; f <= frames; f++) {
            if (stopRef.current) break;
            if (liveInterpTokenRef.current !== token) break;
            const t = f / frames;
            const nextPoint = {
                latitude: start.latitude + (end.latitude - start.latitude) * t,
                longitude: start.longitude + (end.longitude - start.longitude) * t,
            };

            // speed & heading
            const segDist = haversineMeters(prevPoint, nextPoint);
            const instantSpeed = Math.min(60, segDist / Math.max(0.001, frameMs / 1000));
            const brg = bearing(prevPoint, nextPoint);
            const smoothBrg = smoothHeading(brg, instantSpeed);
            setHeading(smoothBrg);

            // update current coord (this will move the marker)
            setCurrentCoord(nextPoint);

            // remaining distance
            const remObj = computeRemainingDistanceFromPoint(nextPoint);
            setRemainingDistance(remObj.remaining);
            setCurrentIndex(remObj.segIndex);

            if (totalRouteDurationSec && totalRouteDist > 0) {
                const ratio = remObj.remaining / totalRouteDist;
                setRemainingDuration(Math.round(totalRouteDurationSec * ratio));
            } else {
                setRemainingDuration(Math.round(remObj.remaining / fallbackSpeedMetersPerSec));
            }

            // --- Update closest step / current instruction continuously ---
            const closestStepIdx = findClosestStepIndex(nextPoint);
            if (closestStepIdx >= 0) {
                const s = steps[closestStepIdx];
                const dToStep = haversineMeters(nextPoint, s.location);
                setNextStepDistance(Math.round(dToStep));
                // display instruction if within displayThreshold
                if (dToStep < displayThreshold) setCurrentInstruction(s.instructionText ?? null);
                // speak if within speakThreshold and not already spoken
                if (dToStep < speakThreshold && !spokenStepsRef.current.has(closestStepIdx)) {
                    if (!isMuted && s.instructionText) {
                        try {
                            Speech.speak(s.instructionText, { language: ttsLanguage, rate: 1.02, pitch: 1.0 });
                        } catch { }
                    }
                    spokenStepsRef.current.add(closestStepIdx);
                }
            } else {
                setNextStepDistance(null);
            }

            prevPoint = nextPoint;
            await new Promise((r) => setTimeout(r, frameMs));
        }
    }

    // handle incoming rider update
    const handleRiderUpdate = async (r: RiderCoord) => {
        if (!r) return;
        const ts = Date.now();
        const posWithTs = { latitude: r.latitude, longitude: r.longitude, ts };
        const filtered = addFilteredPosition(posWithTs);

        // if we had no coord yet, set immediately so marker appears
        const prev = currentCoord ?? filtered;
        if (!currentCoord) {
            setCurrentCoord(filtered);
        }

        const dist = haversineMeters(prev, filtered);

        // cancel previous
        const token = ++liveInterpTokenRef.current;

        if (dist < 0.5) {
            setCurrentCoord(filtered);
            if (typeof r.heading === "number") setHeading(smoothHeading(r.heading, 0));
            lastIncomingTsRef.current = ts;
            return;
        }

        const prevTs = lastIncomingTsRef.current ?? ts - 1000;
        const dtSec = Math.max(0.05, (ts - prevTs) / 1000);
        lastIncomingTsRef.current = ts;
        const speedEstimate = dist / dtSec;
        const mps = Math.max(0.1, Math.min(60, speedEstimate)) || fallbackSpeedMetersPerSec;
        const durationMs = Math.max(120, Math.min(1200, Math.round((dist / Math.max(0.1, mps)) * 1000)));

        await interpolateLiveSegment(prev, filtered, durationMs, token);

        const newHeading = typeof r.heading === "number" ? r.heading : bearing(prev, filtered);
        setHeading(smoothHeading(newHeading, mps));

        if (rider) {
            setCurrentCoord({
                latitude: rider.latitude,
                longitude: rider.longitude,
            });
        }
    };

    // Simulation functions (unchanged except ensuring instruction update)
    async function interpolateSegmentSim(start: LatLng, end: LatLng, segDurationMs: number) {
        const stepMs = frameMs;
        const frames = Math.max(1, Math.floor(segDurationMs / stepMs));
        let prevPoint: LatLng = start;
        for (let f = 1; f <= frames; f++) {
            if (stopRef.current) break;
            const t = f / frames;
            const nextPoint = {
                latitude: start.latitude + (end.latitude - start.latitude) * t,
                longitude: start.longitude + (end.longitude - start.longitude) * t,
            };

            const segDist = haversineMeters(prevPoint, nextPoint);
            const approxSpeed = Math.min(30, segDist / Math.max(0.05, stepMs / 1000));
            const brg = bearing(prevPoint, nextPoint);
            const smoothBrg = smoothHeading(brg, approxSpeed);
            setHeading(smoothBrg);

            setCurrentCoord(nextPoint);

            const remObj = computeRemainingDistanceFromPoint(nextPoint);
            setRemainingDistance(remObj.remaining);
            setCurrentIndex(remObj.segIndex);

            if (totalRouteDurationSec && totalRouteDist > 0) {
                const ratio = remObj.remaining / totalRouteDist;
                setRemainingDuration(Math.round(totalRouteDurationSec * ratio));
            } else {
                setRemainingDuration(Math.round(remObj.remaining / fallbackSpeedMetersPerSec));
            }

            // update instruction while simulating
            const closestStepIdx = findClosestStepIndex(nextPoint);
            if (closestStepIdx >= 0) {
                const s = steps[closestStepIdx];
                const dToStep = haversineMeters(nextPoint, s.location);
                setNextStepDistance(Math.round(dToStep));
                if (dToStep < displayThreshold) setCurrentInstruction(s.instructionText ?? null);
                if (dToStep < speakThreshold && !spokenStepsRef.current.has(closestStepIdx)) {
                    if (!isMuted && s.instructionText) {
                        try {
                            Speech.speak(s.instructionText, { language: ttsLanguage, rate: 1.02, pitch: 1.0 });
                        } catch { }
                    }
                    spokenStepsRef.current.add(closestStepIdx);
                }
            } else {
                setNextStepDistance(null);
            }

            prevPoint = nextPoint;
            await new Promise((r) => setTimeout(r, stepMs));
        }
    }

    async function startSimulation(fromIndex = 0) {
        if (!routeCoords || routeCoords.length < 2) return;
        if (isPlaying) return;
        stopRef.current = false;
        setIsPlaying(true);
        spokenStepsRef.current = new Set();

        const startPos = routeCoords[fromIndex] ?? routeCoords[0];
        setCurrentCoord(startPos);
        setCurrentIndex(fromIndex);

        for (let i = fromIndex + 1; i < routeCoords.length; i++) {
            if (stopRef.current) break;
            const segDist = segmentDistances[i - 1] ?? haversineMeters(routeCoords[i - 1], routeCoords[i]);
            const segDurationSec = totalRouteDurationSec
                ? Math.max(0.3, totalRouteDurationSec * (segDist / totalRouteDist))
                : Math.max(0.3, segDist / fallbackSpeedMetersPerSec);
            const segDurationMs = Math.max(300, Math.round(segDurationSec * 1000));

            await interpolateSegmentSim(routeCoords[i - 1], routeCoords[i], segDurationMs);
            setCurrentIndex(i);
        }

        setIsPlaying(false);
    }

    function stopSimulation() {
        stopRef.current = true;
        setIsPlaying(false);
    }

    // rider prop watcher
    useEffect(() => {
        if (simulate) return;
        if (rider === null) {
            liveInterpTokenRef.current++;
            setCurrentCoord(null);
            setNextStepDistance(null);
            setCurrentInstruction(null);
            spokenStepsRef.current = new Set();
            lastIncomingTsRef.current = null;
            return;
        }
        if (!rider) return;
        handleRiderUpdate(rider).catch((e) => console.error("handleRiderUpdate error", e));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rider, simulate]);

    // simulate flag and route change watchers (unchanged logic)
    useEffect(() => {
        if (simulate) {
            liveInterpTokenRef.current++;
            startSimulation(0).catch(() => { });
        } else {
            stopSimulation();
        }
        return () => stopSimulation();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [simulate, routeCoords.length, routeKey]);

    useEffect(() => {
        const first = routeCoords?.[0];
        if (first) setCurrentCoord(first);
        spokenStepsRef.current = new Set();
        setCurrentInstruction(null);
        setNextStepDistance(null);
        const remObj = computeRemainingDistanceFromPoint(first ?? null);
        setRemainingDistance(remObj.remaining);
        if (totalRouteDurationSec && totalRouteDist > 0) {
            setRemainingDuration(Math.round(totalRouteDurationSec * (remObj.remaining / totalRouteDist)));
        } else {
            setRemainingDuration(Math.round(remObj.remaining / fallbackSpeedMetersPerSec));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeCoords, routeKey]);

    // marker rotation
    const markerRotation = useMemo(() => normalizeAngle((heading ?? 0) + (markerRotationOffsetDeg || 0)), [heading, markerRotationOffsetDeg]);

    // cleanup
    useEffect(() => () => {
        stopRef.current = true;
        liveInterpTokenRef.current++;
    }, []);

    return {
        markerRegion,
        currentCoord,
        heading,
        markerRotation,
        isFollowing,
        setIsFollowing,
        isMuted,
        setIsMuted,
        showTraffic,
        setShowTraffic,
        isPlaying,
        startSimulation,
        stopSimulation,
        startLiveLocation: () => startSimulation(),
        stopLiveLocation: () => stopSimulation(),
        steps,
        routeCoords,
        currentIndex,
        setCurrentIndex,
        currentInstruction,
        nextStepDistance,
        remainingDistance,
        remainingDuration,
    };
}










// // hooks/useDriverTracking.ts
// import { RideData } from "@/types";
// import * as Location from "expo-location";
// import * as Speech from "expo-speech";
// import { useEffect, useMemo, useRef, useState } from "react";
// import { LatLng, bearing, haversineMeters } from "../../utils/geo";

// type UseDriverTrackingArgs = {
//     routeKey: string;
//     routeCoords: LatLng[];
//     ride?: RideData;
//     simulate?: boolean;
//     ttsLanguage?: string;
//     frameMs?: number;
//     minStepMs?: number;
//     displayThreshold?: number;
//     speakThreshold?: number;
//     fallbackSpeedMetersPerSec?: number;
// };

// export default function useDriverTracking({
//     routeKey,
//     routeCoords,
//     ride,
//     simulate = false,
//     ttsLanguage = "fr-FR",
//     frameMs = 100,
//     minStepMs = 80,
//     displayThreshold = 80,
//     speakThreshold = 30,
//     fallbackSpeedMetersPerSec = 10,
// }: UseDriverTrackingArgs) {
//     // --- States ---
//     const [isFollowing, setIsFollowing] = useState(true);
//     const [isMuted, setIsMuted] = useState(false);
//     const [showTraffic, setShowTraffic] = useState(false);
//     const [isPlaying, setIsPlaying] = useState(false);
//     // ...existing code...
//     const [heading, setHeading] = useState(0);
//     const [currentIndex, setCurrentIndex] = useState(0);
//     const [currentCoord, setCurrentCoord] = useState<LatLng | null>(
//         routeCoords?.[0] ?? null
//     );

//     const [currentInstruction, setCurrentInstruction] = useState<string | null>(
//         null
//     );
//     const [nextStepDistance, setNextStepDistance] = useState<number | null>(null);
//     const [remainingDistance, setRemainingDistance] = useState<number>(0);
//     const [remainingDuration, setRemainingDuration] = useState<number>(0);

//     // spoken steps
//     const spokenStepsRef = useRef<Set<number>>(new Set());

//     // refs
//     const stopRef = useRef(false);
//     const locSubRef = useRef<any>(null);

//     // smoothing buffers
//     const recentPositionsRef = useRef<LatLng[]>([]);
//     const recentHeadingsRef = useRef<number[]>([]);

//     // --- Select route object ---
//     const selectedRouteObj = useMemo(() => {
//         if (!ride) return null;
//         const routes = (ride as any)?.routes ?? null;
//         if (!routes) return null;
//         if (routeKey && routes[routeKey]) return routes[routeKey];
//         return routes.initial ?? routes.driverToPickup ?? null;
//     }, [ride, routeKey]);

//     const steps = useMemo(() => {
//         const s = (selectedRouteObj?.legs?.[0]?.steps ?? []) as any[];
//         return s.map((st, i) => ({
//             id: i,
//             instruction: st.maneuver?.instruction ?? st.maneuver?.type ?? "Continue",
//             location:
//                 st.maneuver?.location && st.maneuver.location.length >= 2
//                     ? {
//                         latitude: st.maneuver.location[1],
//                         longitude: st.maneuver.location[0],
//                     }
//                     : null,
//             distance: st.distance,
//             duration: st.duration,
//         }));
//     }, [selectedRouteObj]);

//     const { segmentDistances, totalRouteDist } = useMemo(() => {
//         const segs: number[] = [];
//         for (let i = 1; i < routeCoords.length; i++) {
//             segs.push(haversineMeters(routeCoords[i - 1], routeCoords[i]));
//         }
//         const total = segs.reduce((a, b) => a + b, 0) || 1;
//         return { segmentDistances: segs, totalRouteDist: total };
//     }, [routeCoords]);

//     const totalRouteDurationSec = useMemo(() => {
//         return (selectedRouteObj?.duration as number) ?? 0;
//     }, [selectedRouteObj]);

//     // --- smoothing helpers ---
//     const addFilteredPosition = (pos: LatLng) => {
//     // Smoothing plus réactif : fenêtre plus courte
//     const maxLen = 2;
//     const arr = recentPositionsRef.current;
//     arr.push(pos);
//     if (arr.length > maxLen) arr.shift();
//     const avgLat = arr.reduce((sum, p) => sum + p.latitude, 0) / arr.length;
//     const avgLng = arr.reduce((sum, p) => sum + p.longitude, 0) / arr.length;
//     return { latitude: avgLat, longitude: avgLng };
//     };

//     const smoothHeading = (newH: number) => {
//         // Smoothing heading plus sensible : fenêtre plus courte
//         const maxLen = 2;
//         const arr = recentHeadingsRef.current;
//         arr.push(newH);
//         if (arr.length > maxLen) arr.shift();

//         let sumSin = 0;
//         let sumCos = 0;
//         for (let h of arr) {
//             const r = (h * Math.PI) / 180;
//             sumSin += Math.sin(r);
//             sumCos += Math.cos(r);
//         }
//         const avgRad = Math.atan2(sumSin / arr.length, sumCos / arr.length);
//         // Ajout d'une interpolation pour plus de fluidité
//         const prev = arr.length > 1 ? arr[arr.length - 2] : newH;
//         const alpha = 0.7; // plus sensible
//         const interpolated = prev + alpha * ((avgRad * 180) / Math.PI - prev);
//         return interpolated;
//     };

//     // --- utils ---
//     const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

//     function computeRemainingDistanceFrom(coord: LatLng | null, currIdx: number) {
//         if (!coord || routeCoords.length === 0) return 0;
//         let dist = 0;
//         if (currIdx < routeCoords.length - 1) {
//             dist += haversineMeters(coord, routeCoords[currIdx + 1]);
//             for (let i = currIdx + 1; i < routeCoords.length - 1; i++) {
//                 dist += haversineMeters(routeCoords[i], routeCoords[i + 1]);
//             }
//         }
//         return dist;
//     }

//     function findNextStepIndex(coord: LatLng | null) {
//         if (!coord) return -1;
//         let bestIdx = -1;
//         let bestDist = Infinity;
//         steps.forEach((s, idx) => {
//             if (!s.location) return;
//             if (spokenStepsRef.current.has(idx)) return;
//             const d = haversineMeters(coord, s.location);
//             if (d < bestDist) {
//                 bestDist = d;
//                 bestIdx = idx;
//             }
//         });
//         return bestIdx;
//     }

//     // --- Live GPS tracking ---
//     async function startLiveLocation() {
//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== "granted") {
//             console.warn("Location permission denied");
//             return;
//         }

//         let prevCoord: LatLng | null = null;
//         recentPositionsRef.current = [];

//         locSubRef.current = await Location.watchPositionAsync(
//             {
//                 accuracy: Location.Accuracy.Highest,
//                 timeInterval: 1000,
//                 distanceInterval: 2,
//             },
//             async (pos) => {
//                 const raw = {
//                     latitude: pos.coords.latitude,
//                     longitude: pos.coords.longitude,
//                 };
//                 const filtered = addFilteredPosition(raw);

//                 if (prevCoord) {
//                     const d = haversineMeters(prevCoord, filtered);
//                     if (d > 0.5) {
//                         const brg = bearing(prevCoord, filtered);
//                         const smoothBrg = smoothHeading(brg);
//                         setHeading(smoothBrg);
//                         setCurrentCoord(filtered);
//                     }
//                 } else {
//                     setCurrentCoord(filtered);
//                 }
//                 prevCoord = filtered;

//                 // handle steps & TTS
//                 const nextIdx = findNextStepIndex(filtered);
//                 if (nextIdx >= 0) {
//                     const step = steps[nextIdx];
//                     const dToStep = haversineMeters(filtered, step.location!);
//                     setNextStepDistance(dToStep);
//                     if (dToStep < displayThreshold) setCurrentInstruction(step.instruction);
//                     if (dToStep < speakThreshold && !spokenStepsRef.current.has(nextIdx)) {
//                         if (!isMuted) {
//                             try {
//                                 Speech.speak(step.instruction, {
//                                     language: ttsLanguage,
//                                     rate: 1.02,
//                                     pitch: 1.0,
//                                 });
//                             } catch { }
//                         }
//                         spokenStepsRef.current.add(nextIdx);
//                     }
//                 } else {
//                     setNextStepDistance(null);
//                 }

//                 // remaining distance/duration
//                 const rem = computeRemainingDistanceFrom(filtered, currentIndex);
//                 setRemainingDistance(rem);
//                 if (totalRouteDurationSec && totalRouteDist > 0) {
//                     const ratio = rem / totalRouteDist;
//                     setRemainingDuration(Math.round(totalRouteDurationSec * ratio));
//                 } else {
//                     setRemainingDuration(Math.round(rem / fallbackSpeedMetersPerSec));
//                 }
//             }
//         );

//         setIsPlaying(true);
//     }

//     async function stopLiveLocation() {
//         if (locSubRef.current) {
//             locSubRef.current.remove();
//             locSubRef.current = null;
//         }
//         setIsPlaying(false);
//     }

//     // --- Simulation mode ---
//     async function startSimulation() {
//         if (!routeCoords.length) return;
//         stopRef.current = false;
//         setIsPlaying(true);

//         let idx = 0;
//         let tPrev = Date.now();

//         while (!stopRef.current && idx < routeCoords.length - 1) {
//             const now = Date.now();
//             const dt = (now - tPrev) / 1000;
//             tPrev = now;

//             const segDist = segmentDistances[idx];
//             if (segDist === 0) {
//                 idx++;
//                 continue;
//             }
//             const sec = totalRouteDurationSec || segDist / fallbackSpeedMetersPerSec;
//             const speed = segDist / sec;

//             const move = Math.min(dt * speed, segDist);

//             const start = routeCoords[idx];
//             const end = routeCoords[idx + 1];

//             const brg = bearing(start, end);
//             const smoothBrg = smoothHeading(brg);

//             setHeading(smoothBrg);

//             setCurrentCoord(end);
//             setCurrentIndex(idx + 1);

//             // Steps
//             const nextIdx = findNextStepIndex(end);
//             if (nextIdx >= 0) {
//                 const step = steps[nextIdx];
//                 const dToStep = haversineMeters(end, step.location!);
//                 setNextStepDistance(dToStep);
//                 if (dToStep < displayThreshold) setCurrentInstruction(step.instruction);
//                 if (dToStep < speakThreshold && !spokenStepsRef.current.has(nextIdx)) {
//                     if (!isMuted) {
//                         try {
//                             Speech.speak(step.instruction, {
//                                 language: ttsLanguage,
//                                 rate: 1.02,
//                                 pitch: 1.0,
//                             });
//                         } catch { }
//                     }
//                     spokenStepsRef.current.add(nextIdx);
//                 }
//             }

//             const rem = computeRemainingDistanceFrom(end, idx + 1);
//             setRemainingDistance(rem);
//             if (totalRouteDurationSec && totalRouteDist > 0) {
//                 const ratio = rem / totalRouteDist;
//                 setRemainingDuration(Math.round(totalRouteDurationSec * ratio));
//             } else {
//                 setRemainingDuration(Math.round(rem / fallbackSpeedMetersPerSec));
//             }

//             await wait(frameMs);
//             idx++;
//         }

//         setIsPlaying(false);
//     }

//     function stopSimulation() {
//         stopRef.current = true;
//         setIsPlaying(false);
//     }

//     // --- reset when route changes ---
//     useEffect(() => {
//         const first = routeCoords?.[0];
//         if (first) {
//             setCurrentCoord(first);
//             setCurrentIndex(0);
//         }
//         spokenStepsRef.current = new Set();
//         setCurrentInstruction(null);
//         setNextStepDistance(null);

//         const rem = computeRemainingDistanceFrom(first ?? null, 0);
//         setRemainingDistance(rem);
//         if (totalRouteDurationSec && totalRouteDist > 0) {
//             setRemainingDuration(
//                 Math.round(totalRouteDurationSec * (rem / totalRouteDist))
//             );
//         } else {
//             setRemainingDuration(Math.round(rem / fallbackSpeedMetersPerSec));
//         }
//     }, [routeCoords, routeKey]);

//     // cleanup
//     useEffect(() => {
//         return () => {
//             stopRef.current = true;
//             if (locSubRef.current) locSubRef.current.remove?.();
//         };
//     }, []);

//     return {
//         // position & orientation
//         currentCoord,
//         heading,
//         markerRotation: heading, // rotation pour Mapbox
//         // follow toggle
//         isFollowing,
//         setIsFollowing,
//         // audio toggle
//         isMuted,
//         setIsMuted,
//         // traffic toggle
//         showTraffic,
//         setShowTraffic,
//         // play state + control
//         isPlaying,
//         startLiveLocation,
//         stopLiveLocation,
//         startSimulation,
//         stopSimulation,
//         // route info
//         steps,
//         routeCoords,
//         currentIndex,
//         setCurrentIndex,
//         // instruction & progress
//         currentInstruction,
//         nextStepDistance,
//         remainingDistance,
//         remainingDuration,
//     };
// }













// // hooks/useDriverTracking.ts
// import { RideData } from "@/types";
// import * as Location from "expo-location";
// import * as Speech from "expo-speech";
// import { useEffect, useMemo, useRef, useState } from "react";
// import { AnimatedRegion } from "react-native-maps";
// import { LatLng, bearing, haversineMeters } from "../../utils/geo";

// /**
//  * useDriverTracking
//  * - routeKey: "initial" | "driverToPickup" | other (string)
//  * - routeCoords: coordinates already converted to { latitude, longitude } (do not invert here)
//  */
// type UseDriverTrackingArgs = {
//     routeKey: string;
//     routeCoords: LatLng[];
//     ride?: RideData;
//     simulate?: boolean;
//     ttsLanguage?: string;
//     frameMs?: number;
//     minStepMs?: number;
//     displayThreshold?: number; // en mètres pour afficher bannière (ex: 80)
//     speakThreshold?: number;   // en mètres pour déclencher TTS (ex: 30)
//     fallbackSpeedMetersPerSec?: number; // si pas de duration fournie
// };

// export default function useDriverTracking({
//     routeKey,
//     routeCoords,
//     ride,
//     simulate = false,
//     ttsLanguage = "fr-FR",
//     frameMs = 100,
//     minStepMs = 80,
//     displayThreshold = 80,
//     speakThreshold = 30,
//     fallbackSpeedMetersPerSec = 10,
// }: UseDriverTrackingArgs) {
//     // --- UI / runtime states ---
//     const [isFollowing, setIsFollowing] = useState(true);
//     const [isMuted, setIsMuted] = useState(false);
//     const [showTraffic, setShowTraffic] = useState(false);
//     const [isPlaying, setIsPlaying] = useState(false);
//     const [heading, setHeading] = useState(0);
//     const [currentIndex, setCurrentIndex] = useState(0);
//     const [currentCoord, setCurrentCoord] = useState<LatLng | null>(routeCoords?.[0] ?? null);

//     // Instruction & progress
//     const [currentInstruction, setCurrentInstruction] = useState<string | null>(null);
//     const [nextStepDistance, setNextStepDistance] = useState<number | null>(null);
//     const [remainingDistance, setRemainingDistance] = useState<number>(0);
//     const [remainingDuration, setRemainingDuration] = useState<number>(0);

//     // Animated marker (one instance)
//     const markerRegionRef = useRef<any>(
//         new AnimatedRegion({
//             latitude: routeCoords?.[0]?.latitude ?? 0,
//             longitude: routeCoords?.[0]?.longitude ?? 0,
//             latitudeDelta: 0,
//             longitudeDelta: 0,
//         })
//     );

//     // --- compute selectedRouteObj from ride & routeKey (used for steps & duration) ---
//     const selectedRouteObj = useMemo(() => {
//         if (!ride) return null;
//         // prefer routeKey if present on ride.routes
//         const routes = (ride as any)?.routes ?? null;
//         if (!routes) return null;
//         if (routeKey && routes[routeKey]) return routes[routeKey];
//         // fallback common logic
//         return routes.initial ?? routes.driverToPickup ?? null;
//     }, [ride, routeKey]);

//     // --- extract steps from selectedRouteObj (if any) ---
//     const steps = useMemo(() => {
//         const s = (selectedRouteObj?.legs?.[0]?.steps ?? []) as any[];
//         return s.map((st, i) => ({
//             id: i,
//             instruction: st.maneuver?.instruction ?? st.maneuver?.type ?? "Continue",
//             location:
//                 st.maneuver?.location && st.maneuver.location.length >= 2
//                     ? { latitude: st.maneuver.location[1], longitude: st.maneuver.location[0] }
//                     : null,
//             distance: st.distance,
//             duration: st.duration,
//         }));
//     }, [selectedRouteObj]);

//     // --- compute seg distances & totalRouteDist from routeCoords ---
//     const { segmentDistances, totalRouteDist } = useMemo(() => {
//         const segs: number[] = [];
//         for (let i = 1; i < routeCoords.length; i++) {
//             segs.push(haversineMeters(routeCoords[i - 1], routeCoords[i]));
//         }
//         const total = segs.reduce((a, b) => a + b, 0) || 1;
//         return { segmentDistances: segs, totalRouteDist: total };
//     }, [routeCoords]);

//     const totalRouteDurationSec = useMemo(() => {
//         return (selectedRouteObj?.duration as number) ?? 0;
//     }, [selectedRouteObj]);

//     // --- spoken tracking (avoid duplicates) ---
//     const spokenStepsRef = useRef<Set<number>>(new Set());

//     // --- cancellation refs & subs ---
//     const stopRef = useRef(false);
//     const locSubRef = useRef<any>(null);

//     // --- smoothing utils (positions + heading) ---
//     const recentPositionsRef = useRef<LatLng[]>([]);
//     const addFilteredPosition = (pos: LatLng) => {
//         const maxLen = 5;
//         const arr = recentPositionsRef.current;
//         arr.push(pos);
//         if (arr.length > maxLen) arr.shift();
//         const avgLat = arr.reduce((sum, p) => sum + p.latitude, 0) / arr.length;
//         const avgLng = arr.reduce((sum, p) => sum + p.longitude, 0) / arr.length;
//         return { latitude: avgLat, longitude: avgLng };
//     };

//     // --- helpers pour angles (normalize / diff / lerp) ---
//     const normalizeAngle = (ang: number) => {
//         let a = ang % 360;
//         if (a < 0) a += 360;
//         return a;
//     };

//     const angleDiff = (from: number, to: number) => {
//         // différence signed in [-180, 180]
//         const diff = normalizeAngle(to) - normalizeAngle(from);
//         if (diff > 180) return diff - 360;
//         if (diff < -180) return diff + 360;
//         return diff;
//     };

//     const lerpAngle = (from: number, to: number, t: number) => {
//         const d = angleDiff(from, to);
//         return normalizeAngle(from + d * t);
//     };

//     // --- heading smoothing adaptatif (amelioré) ---
//     // Important: on pousse la valeur *lissée* dans le buffer => pas d'oscillation brusque.
//     const recentHeadingsRef = useRef<number[]>([]);
//     const smoothHeading = (newH: number) => {
//         const maxLen = 5;
//         const arr = recentHeadingsRef.current;

//         // init buffer if vide
//         if (arr.length === 0) {
//             arr.push(normalizeAngle(newH));
//             return normalizeAngle(newH);
//         }

//         // compute circular average of existing smoothed headings
//         let sumSin = 0;
//         let sumCos = 0;
//         for (let h of arr) {
//             const r = (h * Math.PI) / 180;
//             sumSin += Math.sin(r);
//             sumCos += Math.cos(r);
//         }
//         const avgRad = Math.atan2(sumSin / arr.length, sumCos / arr.length);
//         const avgDeg = (avgRad * 180) / Math.PI;
//         const avg = normalizeAngle(avgDeg);

//         // how big is the change?
//         const delta = Math.abs(angleDiff(avg, newH)); // 0..180

//         // adaptivity: small changes -> keep smoothing, big changes -> allow fast response
//         const minAlpha = 0.35; // plus bas = plus lisse en ligne droite
//         const maxAlpha = 0.95; // proche de 1 => suit quasiment instantanément en virage
//         const factor = Math.min(1, delta / 90); // map 0..90 -> 0..1
//         const alpha = minAlpha + (maxAlpha - minAlpha) * factor;

//         // compute smoothed output
//         const out = lerpAngle(avg, normalizeAngle(newH), alpha);

//         // push smoothed value to buffer (helps stabilité future)
//         arr.push(out);
//         if (arr.length > maxLen) arr.shift();

//         return out;
//     };

//     // --- helpers ---
//     const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

//     const animateRegionTo = (coord: LatLng, durationMs = 100) =>
//         new Promise<void>((resolve) => {
//             try {
//                 markerRegionRef.current.timing({
//                     latitude: coord.latitude,
//                     longitude: coord.longitude,
//                     duration: Math.max(minStepMs, Math.round(durationMs)),
//                 }).start(() => resolve());
//             } catch {
//                 try {
//                     markerRegionRef.current.setValue(coord);
//                 } catch { }
//                 resolve();
//             }
//         });

//     // --- projection-based remaining distance (plus lisse) ---
//     // retourne { remaining: meters, segIndex: indexStartSegmentContainingProjection }
//     function computeRemainingDistanceFromPoint(coord: LatLng | null) {
//         if (!coord || routeCoords.length < 2) return { remaining: 0, segIndex: 0 };

//         // find closest point on any segment
//         let best = {
//             idx: 0,
//             dist: Infinity,
//             closest: routeCoords[0],
//             t: 0,
//         };

//         for (let i = 0; i < routeCoords.length - 1; i++) {
//             const a = routeCoords[i];
//             const b = routeCoords[i + 1];
//             // vector in lon/lat space (sufficient for local projection)
//             const vx = b.longitude - a.longitude;
//             const vy = b.latitude - a.latitude;
//             const wx = coord.longitude - a.longitude;
//             const wy = coord.latitude - a.latitude;
//             const vv = vx * vx + vy * vy;
//             let t = 0;
//             if (vv > 0) {
//                 t = (wx * vx + wy * vy) / vv;
//             }
//             if (t < 0) t = 0;
//             if (t > 1) t = 1;
//             const closest = { latitude: a.latitude + vy * t, longitude: a.longitude + vx * t };
//             const d = haversineMeters(coord, closest);
//             if (d < best.dist) {
//                 best = { idx: i, dist: d, closest, t };
//             }
//         }

//         // compute remaining distance from closest point to route end
//         let rem = 0;
//         const nSeg = segmentDistances.length; // routeCoords.length - 1
//         if (best.idx < routeCoords.length - 1) {
//             // distance from closest point to end of its segment
//             rem += haversineMeters(best.closest, routeCoords[best.idx + 1]);
//             // add all following full segments
//             for (let j = best.idx + 1; j < nSeg; j++) {
//                 rem += segmentDistances[j];
//             }
//         }
//         return { remaining: rem, segIndex: best.idx };
//     }

//     // find next step index (closest step not yet spoken)
//     function findNextStepIndex(coord: LatLng | null) {
//         if (!coord) return -1;
//         let bestIdx = -1;
//         let bestDist = Infinity;
//         steps.forEach((s, idx) => {
//             if (!s.location) return;
//             if (spokenStepsRef.current.has(idx)) return; // skip already spoken
//             const d = haversineMeters(coord, s.location);
//             if (d < bestDist) {
//                 bestDist = d;
//                 bestIdx = idx;
//             }
//         });
//         return bestIdx;
//     }

//     // --- Interpolation (simulation) ---
//     async function interpolateSegment(start: LatLng, end: LatLng, segDurationMs: number) {
//         const stepMs = frameMs;
//         const frames = Math.max(1, Math.floor(segDurationMs / stepMs));
//         let prevPoint: LatLng = start;

//         for (let f = 1; f <= frames; f++) {
//             if (stopRef.current) break;
//             const t = f / frames;
//             const nextPoint: LatLng = {
//                 latitude: start.latitude + (end.latitude - start.latitude) * t,
//                 longitude: start.longitude + (end.longitude - start.longitude) * t,
//             };

//             // heading
//             const brg = bearing(prevPoint, nextPoint);
//             const smoothBrg = smoothHeading(brg);
//             setHeading(smoothBrg);

//             // animate marker
//             await animateRegionTo(nextPoint, stepMs);
//             setCurrentCoord(nextPoint);

//             // update progress / distances using projection (lisse)
//             const remObj = computeRemainingDistanceFromPoint(nextPoint);
//             setRemainingDistance(remObj.remaining);
//             setCurrentIndex(remObj.segIndex); // mise à jour en live de l'index de segment

//             // remaining duration
//             if (totalRouteDurationSec && totalRouteDist > 0) {
//                 const ratio = remObj.remaining / totalRouteDist;
//                 setRemainingDuration(Math.round(totalRouteDurationSec * ratio));
//             } else {
//                 setRemainingDuration(Math.round(remObj.remaining / fallbackSpeedMetersPerSec));
//             }

//             // detect next step for display & TTS
//             const nextIdx = findNextStepIndex(nextPoint);
//             if (nextIdx >= 0) {
//                 const step = steps[nextIdx];
//                 const dToStep = haversineMeters(nextPoint, step.location!);
//                 setNextStepDistance(dToStep);
//                 // display a bit before
//                 if (dToStep < displayThreshold) {
//                     setCurrentInstruction(step.instruction);
//                 }
//                 // speak a bit later (closer)
//                 if (dToStep < speakThreshold && !spokenStepsRef.current.has(nextIdx)) {
//                     if (!isMuted) {
//                         try {
//                             Speech.speak(step.instruction, {
//                                 language: ttsLanguage,
//                                 rate: 1.02,
//                                 pitch: 1.0,
//                             });
//                         } catch { }
//                     }
//                     spokenStepsRef.current.add(nextIdx);
//                 }
//             } else {
//                 // no upcoming step
//                 setNextStepDistance(null);
//                 // if all steps spoken or none, clear instruction when close enough to previous step
//                 if (currentInstruction) {
//                     const prevIdx = steps.findIndex((s) => s.instruction === currentInstruction);
//                     if (prevIdx >= 0 && steps[prevIdx].location) {
//                         const dprev = haversineMeters(nextPoint, steps[prevIdx].location);
//                         if (dprev < 5) {
//                             setCurrentInstruction(null);
//                         }
//                     }
//                 }
//             }

//             prevPoint = nextPoint;
//             await wait(2);
//         }
//     }

//     // --- Simulation runner ---
//     async function startSimulation(fromIndex = 0) {
//         if (!routeCoords || routeCoords.length < 2) return;
//         if (isPlaying) return;
//         stopRef.current = false;
//         setIsPlaying(true);
//         spokenStepsRef.current = new Set();

//         const startPos = routeCoords[fromIndex] ?? routeCoords[0];
//         try {
//             markerRegionRef.current.setValue(startPos);
//         } catch { }
//         setCurrentCoord(startPos);
//         setCurrentIndex(fromIndex);

//         for (let i = fromIndex + 1; i < routeCoords.length; i++) {
//             if (stopRef.current) break;
//             const segDist = segmentDistances[i - 1] ?? haversineMeters(routeCoords[i - 1], routeCoords[i]);
//             const segDurationSec = totalRouteDurationSec
//                 ? Math.max(0.3, totalRouteDurationSec * (segDist / totalRouteDist))
//                 : Math.max(0.3, segDist / fallbackSpeedMetersPerSec);
//             const segDurationMs = Math.max(300, Math.round(segDurationSec * 1000));

//             await interpolateSegment(routeCoords[i - 1], routeCoords[i], segDurationMs);

//             // update index to the vertex we just reached
//             setCurrentIndex(i);

//             // after finishing a vertex, recompute remainingDistance with new currentIndex (use projection at exact vertex)
//             const remObj = computeRemainingDistanceFromPoint(routeCoords[i]);
//             setRemainingDistance(remObj.remaining);
//             if (totalRouteDurationSec && totalRouteDist > 0) {
//                 setRemainingDuration(Math.round(totalRouteDurationSec * (remObj.remaining / totalRouteDist)));
//             } else {
//                 setRemainingDuration(Math.round(remObj.remaining / fallbackSpeedMetersPerSec));
//             }
//         }

//         setIsPlaying(false);
//         stopRef.current = false;
//     }

//     function stopSimulation() {
//         stopRef.current = true;
//         setIsPlaying(false);
//     }

//     // --- Live GPS tracking (interpolated movement) ---
//     async function startLiveLocation() {
//         // if simulation running, stop it
//         stopSimulation();

//         const { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== "granted") {
//             console.warn("Location permission denied");
//             return;
//         }

//         let prevCoord: LatLng | null = null;
//         recentPositionsRef.current = [];

//         locSubRef.current = await Location.watchPositionAsync(
//             {
//                 accuracy: Location.Accuracy.Highest,
//                 timeInterval: 1000,
//                 distanceInterval: 1,
//             },
//             async (pos) => {
//                 const raw = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
//                 const filtered = addFilteredPosition(raw);

//                 if (prevCoord) {
//                     const d = haversineMeters(prevCoord, filtered);
//                     if (d > 0.5) {
//                         const brg = bearing(prevCoord, filtered);
//                         const smoothBrg = smoothHeading(brg);
//                         setHeading(smoothBrg);

//                         // choose duration proportional to distance (makes the interpolation feel natural)
//                         // const durationMs = Math.min(2000, Math.max(200, Math.round((d / fallbackSpeedMetersPerSec) * 1000)));
//                          const durationMs = Math.min(1500, Math.max(200, Math.round((d / fallbackSpeedMetersPerSec) * 1000)));

//                         // animate smoothly toward filtered location
//                         try {
//                             await new Promise<void>((resolve) =>
//                                 markerRegionRef.current.timing({ latitude: filtered.latitude, longitude: filtered.longitude, duration: durationMs }).start(() => resolve())
//                             );
//                         } catch {
//                             try {
//                                 markerRegionRef.current.setValue(filtered);
//                             } catch { }
//                         }

//                         setCurrentCoord(filtered);
//                     }
//                 } else {
//                     // first point
//                     try {
//                         markerRegionRef.current.setValue(filtered);
//                     } catch { }
//                     setCurrentCoord(filtered);
//                 }

//                 prevCoord = filtered;

//                 // handle steps: set instruction & TTS as in simulation
//                 const nextIdx = findNextStepIndex(filtered);
//                 if (nextIdx >= 0) {
//                     const step = steps[nextIdx];
//                     const dToStep = haversineMeters(filtered, step.location!);
//                     setNextStepDistance(dToStep);
//                     if (dToStep < displayThreshold) setCurrentInstruction(step.instruction);
//                     if (dToStep < speakThreshold && !spokenStepsRef.current.has(nextIdx)) {
//                         if (!isMuted) {
//                             try {
//                                 Speech.speak(step.instruction, {
//                                     language: ttsLanguage, rate: 1.02,
//                                     pitch: 1.0,
//                                 });
//                             } catch { }
//                         }
//                         spokenStepsRef.current.add(nextIdx);
//                     }
//                 } else {
//                     setNextStepDistance(null);
//                 }

//                 // remaining distance/duration via projection (plus stable)
//                 const remObj = computeRemainingDistanceFromPoint(filtered);
//                 setRemainingDistance(remObj.remaining);
//                 setCurrentIndex(remObj.segIndex);
//                 if (totalRouteDurationSec && totalRouteDist > 0) {
//                     const ratio = remObj.remaining / totalRouteDist;
//                     setRemainingDuration(Math.round(totalRouteDurationSec * ratio));
//                 } else {
//                     setRemainingDuration(Math.round(remObj.remaining / fallbackSpeedMetersPerSec));
//                 }
//             }
//         );

//         setIsPlaying(true);
//     }

//     async function stopLiveLocation() {
//         if (locSubRef.current) {
//             locSubRef.current.remove();
//             locSubRef.current = null;
//         }
//         setIsPlaying(false);
//     }

//     // --- watch simulate flag: start/stop accordingly ---
//     useEffect(() => {
//         if (simulate) {
//             // start from beginning
//             startSimulation(0).catch(() => { });
//             if (locSubRef.current) {
//                 locSubRef.current.remove();
//                 locSubRef.current = null;
//             }
//         } else {
//             // leave simulation stopped; live location not auto-started (call startLiveLocation externally)
//             stopSimulation();
//         }
//         return () => stopSimulation();
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [simulate, routeCoords.length, routeKey]);

//     // --- when routeCoords or routeKey change, reset marker & internal state sensibly ---
//     useEffect(() => {
//         // reset marker to new first point
//         const first = routeCoords?.[0];
//         if (first) {
//             try {
//                 markerRegionRef.current.setValue(first);
//             } catch { }
//             setCurrentCoord(first);
//             setCurrentIndex(0);
//         }
//         // clear spoken steps (because new route)
//         spokenStepsRef.current = new Set();
//         setCurrentInstruction(null);
//         setNextStepDistance(null);

//         // recompute remaining distance/duration using projection
//         const remObj = computeRemainingDistanceFromPoint(first ?? null);
//         setRemainingDistance(remObj.remaining);
//         if (totalRouteDurationSec && totalRouteDist > 0) {
//             setRemainingDuration(Math.round(totalRouteDurationSec * (remObj.remaining / totalRouteDist)));
//         } else {
//             setRemainingDuration(Math.round(remObj.remaining / fallbackSpeedMetersPerSec));
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [routeCoords, routeKey]);

//     // cleanup on unmount
//     useEffect(() => {
//         return () => {
//             stopRef.current = true;
//             if (locSubRef.current) locSubRef.current.remove?.();
//         };
//     }, []);

//     return {
//         // marker object usable by <Marker.Animated coordinate={markerRegion}>
//         markerRegion: markerRegionRef.current,
//         // position & orientation
//         currentCoord,
//         heading,
//         // follow toggle
//         isFollowing,
//         setIsFollowing,
//         // audio toggle
//         isMuted,
//         setIsMuted,
//         // traffic toggle
//         showTraffic,
//         setShowTraffic,
//         // play state + control
//         isPlaying,
//         startSimulation,
//         stopSimulation,
//         startLiveLocation,
//         stopLiveLocation,
//         // route info
//         steps,
//         routeCoords,
//         currentIndex,
//         setCurrentIndex,
//         // instruction & progress
//         currentInstruction,
//         nextStepDistance,
//         remainingDistance,
//         remainingDuration,
//     };
// }