// components/NewTracking/index.tsx
import type { LatLng } from "@/utils/geo";
import React, { useMemo } from "react";
import { SafeAreaView } from "react-native";
import DriverMap from "./ClientMap";
import InstructionBanner from "./InstructionBanner";
import MapControls from "./MapControls";
import useDriverTracking from "./useDriverTracking";

function haversineMeters(a: LatLng, b: LatLng) {
    const R = 6371000;
    const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
    const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
    const lat1 = (a.latitude * Math.PI) / 180;
    const lat2 = (b.latitude * Math.PI) / 180;
    const sinDlat = Math.sin(dLat / 2);
    const sinDlon = Math.sin(dLon / 2);
    const h = sinDlat * sinDlat + Math.cos(lat1) * Math.cos(lat2) * sinDlon * sinDlon;
    return 2 * R * Math.asin(Math.sqrt(h));
}

function normalizePairs(pairs: [number, number][], pickup?: LatLng | null, drop?: LatLng | null): LatLng[] {
    if (!Array.isArray(pairs)) return [];
    if (!pairs.length) return [];

    const first = pairs[0];
    const asLatLng = { latitude: first[0], longitude: first[1] };
    const asLngLat = { latitude: first[1], longitude: first[0] };

    const ref = pickup || drop || asLatLng;
    const d1 = haversineMeters(ref, asLatLng);
    const d2 = haversineMeters(ref, asLngLat);

    const isLatLng = d1 <= d2;
    return isLatLng ? pairs.map(([lat, lng]) => ({ latitude: lat, longitude: lng })) : pairs.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
}

export default function NewTracking({ selectedRoute, rideData, routeKey, rider }: any) {
    // pickup/drop (inchangé)
    const pickupCoord: LatLng | null = useMemo(() => {
        const p = rideData?.pickup;
        if (!p || !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude)) return null;
        return { latitude: Number(p.latitude), longitude: Number(p.longitude) };
    }, [rideData?.pickup?.latitude, rideData?.pickup?.longitude]);

    const dropCoord: LatLng | null = useMemo(() => {
        const d = rideData?.drop;
        if (!d || !Number.isFinite(d.latitude) || !Number.isFinite(d.longitude)) return null;
        return { latitude: Number(d.latitude), longitude: Number(d.longitude) };
    }, [rideData?.drop?.latitude, rideData?.drop?.longitude]);

    // geometry pairs (inchangé)
    const rawPairs: [number, number][] = useMemo(() => {
        if (Array.isArray(selectedRoute?.geometry) && selectedRoute.geometry.length > 0) {
            return selectedRoute.geometry as [number, number][];
        }
        if (Array.isArray(selectedRoute?.coordinates) && selectedRoute.coordinates.length > 0) {
            return selectedRoute.coordinates as [number, number][];
        }
        if (Array.isArray(rideData?.routeGeometry) && rideData.routeGeometry.length > 0) {
            return rideData.routeGeometry as [number, number][];
        }
        return [];
    }, [selectedRoute?.geometry, selectedRoute?.coordinates, rideData?.routeGeometry]);

    const routeCoords: LatLng[] = useMemo(() => {
        return normalizePairs(rawPairs, pickupCoord, dropCoord);
    }, [rawPairs, pickupCoord, dropCoord]);

    // --- NEW: build routeSteps array compatible avec Google Directions ---
    // selectedRoute may come from your backend using getGoogleDirections above; support both shapes
    // const routeSteps = useMemo(() => {
    //     const stepsRaw = selectedRoute?.steps ?? selectedRoute?.legs?.flatMap((l: any) => l.steps) ?? selectedRoute?.annotations ?? [];
    //     // keep each step with: instructionHtml, instructionText (stripped), location {lat,lng}, distance, duration
    //     const stripHtml = (s: string | null | undefined) =>
    //         s ? s.replace(/<[^>]*>?/gm, "") : "";

    //     return (stepsRaw || []).map((st: any, i: number) => {
    //         // google: st.html_instructions, st.maneuver, st.distance.value, st.duration.value, st.start_location / end_location
    //         const instructionHtml = st.html_instructions ?? st.instruction ?? st.instructionHtml ?? null;
    //         const instructionText = stripHtml(instructionHtml ?? st.instruction ?? "");
    //         let location = null;
    //         if (st.start_location) {
    //             location = { latitude: Number(st.start_location.lat), longitude: Number(st.start_location.lng) };
    //         } else if (st.maneuver?.location) {
    //             // some backends put location in maneuver.location [lng, lat]
    //             const loc = st.maneuver.location;
    //             if (Array.isArray(loc) && loc.length >= 2) location = { latitude: loc[1], longitude: loc[0] };
    //         } else if (st.maneuver?.location_lat && st.maneuver?.location_lng) {
    //             location = { latitude: Number(st.maneuver.location_lat), longitude: Number(st.maneuver.location_lng) };
    //         } else if (st.location && Array.isArray(st.location) && st.location.length >= 2) {
    //             // fallback: [lat, lng] or [lng, lat] — we try [lat,lng]
    //             const maybeLat = Number(st.location[0]), maybeLng = Number(st.location[1]);
    //             if (Number.isFinite(maybeLat) && Number.isFinite(maybeLng)) location = { latitude: maybeLat, longitude: maybeLng };
    //         }

    //         return {
    //             id: i,
    //             instructionHtml,
    //             instructionText,
    //             location,
    //             distance: st.distance?.value ?? st.distance ?? null,
    //             duration: st.duration?.value ?? st.duration ?? null,
    //             maneuver: st.maneuver ?? null,
    //         };
    //     });
    // }, [selectedRoute]);

    // dans NewTracking (index.tsx) — partie où tu appelles useDriverTracking
    // récupère les steps depuis selectedRoute (plusieurs formats possibles)
    const routeSteps = useMemo(() => {
        // prefer legs[0].steps (Google style)
        if (selectedRoute?.legs && Array.isArray(selectedRoute.legs) && selectedRoute.legs.length > 0 && Array.isArray(selectedRoute.legs[0].steps)) {
            return selectedRoute.legs[0].steps;
        }
        // fallback: selectedRoute.steps (some responses)
        if (Array.isArray(selectedRoute?.steps)) return selectedRoute.steps;
        // if annotations/steps flattened from backend
        if (Array.isArray(selectedRoute?.annotations)) return selectedRoute.annotations;
        return [];
    }, [selectedRoute]);

    const {
        markerRegion,
        currentCoord,
        heading,
        isFollowing,
        setIsFollowing,
        isMuted,
        setIsMuted,
        showTraffic,
        setShowTraffic,
        isPlaying,
        startSimulation,
        stopSimulation,
        steps, // now steps from hook (you may still use if needed)
        currentInstruction,
        nextStepDistance,
        remainingDistance,
        remainingDuration,
        markerRotation,
    } = useDriverTracking({ routeKey, routeCoords, routeSteps, ride: rideData as any, rider: rider as any, simulate: false });

    const onCenter = () => {
        setIsFollowing(true);
        setTimeout(() => setIsFollowing(false), 1100);
    };

    // console.debug("NewTracking routeSteps:", routeSteps);

    return (
        <SafeAreaView className="flex-1 bg-white">
            <DriverMap
                markerRotation={markerRotation}
                routeCoords={routeCoords}
                markerRegion={markerRegion}
                currentCoord={currentCoord}
                heading={heading}
                isFollowing={isFollowing}
                showTraffic={showTraffic}
                ride={rideData as any}
                pickupCoord={pickupCoord || undefined}
                dropCoord={dropCoord || undefined}
            />

            <MapControls
                onCenter={onCenter}
                isFollowing={isFollowing}
                toggleFollow={() => setIsFollowing((v) => !v)}
                isMuted={isMuted}
                toggleMute={() => setIsMuted((v) => !v)}
                showTraffic={showTraffic}
                toggleTraffic={() => setShowTraffic((v) => !v)}
                isPlaying={isPlaying}
                start={() => startSimulation()}
                stop={() => stopSimulation()}
            />

            <InstructionBanner
                instruction={currentInstruction}
                nextStepDistance={nextStepDistance}
                remainingDistance={remainingDistance}
                remainingDuration={remainingDuration}
            />
        </SafeAreaView>
    );
}
