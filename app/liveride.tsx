import LiveTrackingSheet from "@/components/LiveTrackingSheet";
import SearchingRiderSheet from "@/components/SearchingRiderSheet";
import { TrackingMapV3 } from "@/components/TrackingMapV3";
import { apiRequest } from "@/services/api";
import { useWS } from "@/services/WSProvider";
import useStore from "@/store/useStore";
import { showError, showInfo, showSuccess } from "@/utils/showToast";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Icon, ScreenHeight } from "@rneui/base";
import { router, useLocalSearchParams } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView, WebViewMessageEvent } from "react-native-webview";

// ==================== UI sizing ====================
const androidHeights = [ScreenHeight * 0.15, ScreenHeight * 0.64];
const iosHeights = [ScreenHeight * 0.2, ScreenHeight * 0.5];

// ==================== Cache keys ====================
const CACHE_KEYS = {
    rideSnapshot: "liveRide:snapshot",
    lastRider: "liveRide:lastRider",
} as const;

const HALF_HEIGHT = ScreenHeight / 2;

// ==================== Types & utils ====================
type RiderCoord = { latitude: number; longitude: number; heading?: number; ts?: number } | null;

const isNum = (n: any): n is number => typeof n === "number" && !Number.isNaN(n);
const isLatLng = (p: any): p is { latitude: number; longitude: number } => isNum(p?.latitude) && isNum(p?.longitude);

const toNum = (v: any, fallback = 0) => {
    const n = typeof v === "string" ? parseFloat(v) : Number(v);
    return Number.isFinite(n) ? n : fallback;
};

const toRad = (d: number) => (d * Math.PI) / 180;
const EARTH_R = 6371000; // meters
const haversine = (a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) => {
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const la1 = toRad(a.latitude);
    const la2 = toRad(b.latitude);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_R * Math.asin(Math.sqrt(h));
};

// ~4–6 m selon devices; évite les micro-jitters
const MIN_MOVE_METERS = 5;
const MIN_HEADING_DELTA = 4; // °
const WS_THROTTLE_MS = 400; // >= 250ms pour MapView

// Statuts connus
const RideStatus = {
    SEARCHING_FOR_RIDER: "SEARCHING_FOR_RIDER",
    ACCEPTED: "ACCEPTED",
    ARRIVED: "ARRIVED",
    VERIFIED: "VERIFIED",
    START: "START",
    COMPLETED: "COMPLETED",
    PAYED: "PAYED",
} as const;

export const LiveRide = () => {
    const { tok, user, setUser, currentRide, setCurrentRide, clearCurrentRide } = useStore();
    const { emit, on, off } = useWS();

    const [rideData, setRideData] = useState<any>(null);
    const [car, setDataCar] = useState<any>(null);
    const [rating, setRating] = useState<any>(null);

    // Live position in-memory + last cached
    const [riderCoords, setRiderCoords] = useState<RiderCoord>(null);
    const [cachedRider, setCachedRider] = useState<RiderCoord>(null);

    const { id } = useLocalSearchParams();

    const bottomSheetRef = useRef<BottomSheet | null>(null);
    const snapPoints = useMemo(() => (Platform.OS === "ios" ? iosHeights : androidHeights), []);
    const [mapHeight, setMapHeight] = useState(snapPoints[1]);
    const [showWebview, setShowWebview] = useState(false);
    const [urlPayment, setUrlPayment] = useState("");
    const [duration, setDuration] = useState<number>(0);
    const [load, setLoad] = useState<boolean>(false);

    // ---------- Ride ID resolution ----------
    const resolvedRideId = useMemo<string | null>(() => ((id as string) || currentRide?._id || null), [id, currentRide?._id]);

    // Avoid redundant store writes
    const lastStoreRideRef = useRef<any>(null);

    // WS throttle refs
    const lastLocRef = useRef<RiderCoord>(null);
    const lastTsRef = useRef<number>(0);

    // Track current riderId subscribed (so we can unsubscribe precisely)
    const subscribedRiderIdRef = useRef<string | null>(null);

    // ==================== Cache helpers ====================
    const saveRideSnapshot = useCallback(async (snap: any) => {
        try {
            await AsyncStorage.setItem(CACHE_KEYS.rideSnapshot, JSON.stringify(snap));
        } catch (e) {
            console.warn("Cache rideSnapshot error:", e);
        }
    }, []);

    const loadRideSnapshot = useCallback(async (): Promise<any | null> => {
        try {
            const j = await AsyncStorage.getItem(CACHE_KEYS.rideSnapshot);
            return j ? JSON.parse(j) : null;
        } catch (e) {
            console.warn("Load rideSnapshot error:", e);
            return null;
        }
    }, []);

    const clearRideSnapshot = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(CACHE_KEYS.rideSnapshot);
        } catch { }
    }, []);

    const saveLastRider = useCallback(async (coord: RiderCoord) => {
        try {
            if (!coord) return;
            await AsyncStorage.setItem(CACHE_KEYS.lastRider, JSON.stringify(coord));
        } catch (e) {
            console.warn("Cache lastRider error:", e);
        }
    }, []);

    const loadLastRider = useCallback(async (): Promise<RiderCoord> => {
        try {
            const j = await AsyncStorage.getItem(CACHE_KEYS.lastRider);
            return j ? JSON.parse(j) : null;
        } catch (e) {
            console.warn("Load lastRider error:", e);
            return null;
        }
    }, []);

    const clearLastRider = useCallback(async () => {
        try {
            await AsyncStorage.removeItem(CACHE_KEYS.lastRider);
        } catch { }
    }, []);


    // ==================== Helper: choisir la route active selon status ====================
    // const getActiveRoute = useCallback((ride: any) => {
    //     if (!ride) return null;

    //     // console.log("initial ride", ride.routes.initial)
    //     // console.log("driver to pickup", ride.routes.driverToPickup)
    //     // console.log("pickup to drop", ride.routes.pickupToDrop)

    //     // routes container (guard)
    //     const routes = ride.routes ?? {};

    //     const status = String(ride.status ?? "").toUpperCase();

    //     // Priority selection per status
    //     if (status === RideStatus.SEARCHING_FOR_RIDER) {
    //         if (routes.initial?.geometry) {
    //             return { geometry: routes.initial.geometry, distance: routes.initial.distance, duration: routes.initial.duration, key: "initial" };
    //         }
    //         if (ride.routeGeometry) {
    //             return { geometry: ride.routeGeometry, distance: ride.distance, duration: ride.estimatedDuration, key: "legacy_initial" };
    //         }
    //         return null;
    //     }

    //     if (status === RideStatus.ACCEPTED) {
    //         if (routes.driverToPickup?.geometry) {
    //             return { geometry: routes.driverToPickup.geometry, distance: routes.driverToPickup.distance, duration: routes.driverToPickup.duration, key: "driverToPickup" };
    //         }
    //         // fallback to initial / legacy
    //         if (routes.initial?.geometry) {
    //             return { geometry: routes.initial.geometry, distance: routes.initial.distance, duration: routes.initial.duration, key: "initial" };
    //         }
    //         if (ride.routeGeometry) {
    //             return { geometry: ride.routeGeometry, distance: ride.distance, duration: ride.estimatedDuration, key: "legacy_initial" };
    //         }
    //         return null;
    //     }

    //     if ([RideStatus.ARRIVED, RideStatus.VERIFIED, RideStatus.START].includes(status)) {
    //         if (routes.pickupToDrop?.geometry) {
    //             return { geometry: routes.pickupToDrop.geometry, distance: routes.pickupToDrop.distance, duration: routes.pickupToDrop.duration, key: "pickupToDrop" };
    //         }
    //         // fallback chain
    //         if (routes.initial?.geometry) {
    //             return { geometry: routes.initial.geometry, distance: routes.initial.distance, duration: routes.initial.duration, key: "initial" };
    //         }
    //         if (ride.routeGeometry) {
    //             return { geometry: ride.routeGeometry, distance: ride.distance, duration: ride.estimatedDuration, key: "legacy_initial" };
    //         }
    //         return null;
    //     }

    //     // default fallback: prefer pickupToDrop > driverToPickup > initial > routeGeometry
    //     if (routes.pickupToDrop?.geometry) return { geometry: routes.pickupToDrop.geometry, distance: routes.pickupToDrop.distance, duration: routes.pickupToDrop.duration, key: "pickupToDrop" };
    //     if (routes.driverToPickup?.geometry) return { geometry: routes.driverToPickup.geometry, distance: routes.driverToPickup.distance, duration: routes.driverToPickup.duration, key: "driverToPickup" };
    //     if (routes.initial?.geometry) return { geometry: routes.initial.geometry, distance: routes.initial.distance, duration: routes.initial.duration, key: "initial" };
    //     if (ride.routeGeometry) return { geometry: ride.routeGeometry, distance: ride.distance, duration: ride.estimatedDuration, key: "legacy_initial" };

    //     return null;
    // }, []);

    const getActiveRoute = useCallback((ride: any) => {
        if (!ride) return null;

        const routes = ride.routes ?? {};
        const status = String(ride.status ?? "").toUpperCase();

        // SEARCHING_FOR_RIDER → utiliser initial ou legacy
        if (status === RideStatus.SEARCHING_FOR_RIDER) {
            if (routes.initial?.geometry) {
                return {
                    geometry: routes.initial.geometry,
                    distance: routes.initial.distance,
                    duration: routes.initial.duration,
                    legs: routes.initial.legs,
                    steps: routes.initial.steps,
                    annotations: routes.initial.annotations,
                    weight: routes.initial.weight,
                    weightName: routes.initial.weightName,
                    key: "initial",
                };
            }
            if (ride.routeGeometry) {
                return {
                    geometry: ride.routeGeometry,
                    distance: ride.distance,
                    duration: ride.estimatedDuration,
                    key: "legacy_initial",
                };
            }
            return null;
        }

        // ACCEPTED → driverToPickup si dispo sinon initial/legacy
        if (status === RideStatus.ACCEPTED) {
            if (routes.driverToPickup?.geometry) {
                return {
                    geometry: routes.driverToPickup.geometry,
                    distance: routes.driverToPickup.distance,
                    duration: routes.driverToPickup.duration,
                    legs: routes.driverToPickup.legs,
                    steps: routes.driverToPickup.steps,
                    annotations: routes.driverToPickup.annotations,
                    weight: routes.driverToPickup.weight,
                    weightName: routes.driverToPickup.weightName,
                    key: "driverToPickup",
                };
            }
            if (routes.initial?.geometry) {
                return {
                    geometry: routes.initial.geometry,
                    distance: routes.initial.distance,
                    duration: routes.initial.duration,
                    legs: routes.initial.legs,
                    steps: routes.initial.steps,
                    annotations: routes.initial.annotations,
                    weight: routes.initial.weight,
                    weightName: routes.initial.weightName,
                    key: "initial",
                };
            }
            if (ride.routeGeometry) {
                return {
                    geometry: ride.routeGeometry,
                    distance: ride.distance,
                    duration: ride.estimatedDuration,
                    key: "legacy_initial",
                };
            }
            return null;
        }

        // ARRIVED / VERIFIED / START → on revient sur initial
        if ([RideStatus.ARRIVED, RideStatus.VERIFIED, RideStatus.START].includes(status)) {
            if (routes.initial?.geometry) {
                return {
                    geometry: routes.initial.geometry,
                    distance: routes.initial.distance,
                    duration: routes.initial.duration,
                    legs: routes.initial.legs,
                    steps: routes.initial.steps,
                    annotations: routes.initial.annotations,
                    weight: routes.initial.weight,
                    weightName: routes.initial.weightName,
                    key: "initial",
                };
            }
            if (ride.routeGeometry) {
                return {
                    geometry: ride.routeGeometry,
                    distance: ride.distance,
                    duration: ride.estimatedDuration,
                    key: "legacy_initial",
                };
            }
            return null;
        }

        // fallback par défaut : driverToPickup > initial > routeGeometry
        if (routes.driverToPickup?.geometry) {
            return {
                geometry: routes.driverToPickup.geometry,
                distance: routes.driverToPickup.distance,
                duration: routes.driverToPickup.duration,
                legs: routes.driverToPickup.legs,
                steps: routes.driverToPickup.steps,
                annotations: routes.driverToPickup.annotations,
                weight: routes.driverToPickup.weight,
                weightName: routes.driverToPickup.weightName,
                key: "driverToPickup",
            };
        }
        if (routes.initial?.geometry) {
            return {
                geometry: routes.initial.geometry,
                distance: routes.initial.distance,
                duration: routes.initial.duration,
                legs: routes.initial.legs,
                steps: routes.initial.steps,
                annotations: routes.initial.annotations,
                weight: routes.initial.weight,
                weightName: routes.initial.weightName,
                key: "initial",
            };
        }
        if (ride.routeGeometry) {
            return {
                geometry: ride.routeGeometry,
                distance: ride.distance,
                duration: ride.estimatedDuration,
                key: "legacy_initial",
            };
        }

        return null;
    }, []);


    // ==================== Ride setters ====================
    const hasMeaningfulChange = useCallback((prev: any, next: any) => {
        if (!prev) return true;
        if (!next) return false;

        // compute active routes for prev/next
        const prevActive = getActiveRoute(prev);
        const nextActive = getActiveRoute(next);

        const prevGeom = prevActive?.geometry?.coordinates ? JSON.stringify(prevActive.geometry.coordinates) : null;
        const nextGeom = nextActive?.geometry?.coordinates ? JSON.stringify(nextActive.geometry.coordinates) : null;

        return (
            prev._id !== next._id ||
            prev.status !== next.status ||
            prev.paymentMethod !== next.paymentMethod ||
            prev?.rider?._id !== next?.rider?._id ||
            prev.fare !== next.fare ||
            prev.updatedAt !== next.updatedAt ||
            prevGeom !== nextGeom
        );
    }, [getActiveRoute]);

    const setRideSafely = useCallback(
        (incomingRide: any, incomingCar?: any, incomingRating?: any) => {
            if (incomingCar !== undefined) setDataCar(incomingCar);
            if (incomingRating !== undefined) setRating(incomingRating);

            // compute active route and set duration from it if available
            const active = getActiveRoute(incomingRide);
            if (active?.duration != null) {
                // duration is in minutes per backend helpers
                setDuration(Math.max(1, Math.round(active.duration)));
            } else if (incomingRide?.estimatedDuration != null) {
                setDuration(Math.max(1, Math.round(incomingRide.estimatedDuration)));
            }

            setRideData(incomingRide);

            // Offline-first snapshot
            saveRideSnapshot(incomingRide).catch(() => { });

            // Only write to store when meaningful
            if (hasMeaningfulChange(lastStoreRideRef.current, incomingRide)) {
                lastStoreRideRef.current = incomingRide;
                setCurrentRide(incomingRide);
            }
        },
        [getActiveRoute, hasMeaningfulChange, setCurrentRide, saveRideSnapshot]
    );

    // ==================== Bottom sheet ====================
    const hideModal = () => setShowWebview(false);

    const handleSheetChanges = useCallback(
        (index: number) => {
            const height = snapPoints[index] ?? snapPoints[1];
            setMapHeight(height);
        },
        [snapPoints]
    );

    // ==================== API ====================
    const getRide = useCallback(
        async (rideId: string) => {
            const res = await apiRequest({ method: "GET", endpoint: "ride/getRideById/" + rideId, token: tok });
            if (res?.success === true) {
                setRideSafely(res.ride, res.car, res.rating);
            }
        },
        [tok, setRideSafely]
    );

    // ==================== WS handlers (stable) ====================
    const handleRideData = useCallback(
        (data: any) => {
            const r = data?.ride;
            if (!r) return;
            setRideSafely(r, data.car, data.rating);
            if (r?.status === RideStatus.SEARCHING_FOR_RIDER && resolvedRideId) {
                emit("searchrider", resolvedRideId);
            }
        },
        [emit, resolvedRideId, setRideSafely]
    );

    const handleRideUpdate = useCallback(
        (data: any) => {
            const r = data?.ride;
            if (!r) return;
            // ⬇️ met à jour y compris routeGeometry recalculée côté serveur
            setRideSafely(r, data.car, data.rating);
        },
        [setRideSafely]
    );

    const handleRideCanceled = useCallback(
        (dat: any) => {
            showInfo(dat?.message || "Trajet annulé");
            clearCurrentRide();
            // purge cache local
            clearRideSnapshot().catch(() => { });
            clearLastRider().catch(() => { });
            router.replace("/(tabs)");
        },
        [clearCurrentRide, clearRideSnapshot, clearLastRider]
    );

    const handleAnyError = useCallback(
        (error: any) => {
            showError(error?.message || "Erreur");
            // Ne pas supprimer le snapshot pour permettre un ré-affichage après reconnect
            clearCurrentRide();
            router.replace("/(tabs)");
        },
        [clearCurrentRide]
    );

    // ==================== WS lifecycle (per ride) ====================
    useEffect(() => {
        if (!resolvedRideId) return;

        emit("subscribeRide", resolvedRideId);

        on("rideData", handleRideData);
        on("rideUpdate", handleRideUpdate);
        on("rideCanceled", handleRideCanceled);
        on("riderCanceled", showInfo);
        on("error", handleAnyError);

        return () => {
            off("rideData", handleRideData);
            off("rideUpdate", handleRideUpdate);
            off("rideCanceled", handleRideCanceled);
            off("riderCanceled", showInfo as any);
            off("error", handleAnyError);
            emit("unsubscribeRide", resolvedRideId);
        };
    }, [resolvedRideId, emit, on, off, handleRideData, handleRideUpdate, handleRideCanceled, handleAnyError]);

    // ==================== Cold rehydration ====================
    useEffect(() => {
        (async () => {
            // Priorité à un ride déjà présent en store / URL
            if (rideData || currentRide?._id || id) {
                const last = await loadLastRider();
                if (last) setCachedRider(last);
                return;
            }

            // Sinon, restaurer le snapshot pour afficher vite
            const snap = await loadRideSnapshot();
            if (snap?._id) {
                setRideData(snap);
                lastStoreRideRef.current = snap;
                setCurrentRide(snap); // garde le store cohérent
            }
            const last = await loadLastRider();
            if (last) setCachedRider(last);
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ==================== Initial API load ====================
    useEffect(() => {
        if (id) {
            getRide(id as string);
        } else if (!id && currentRide?._id) {
            setRideData(currentRide);
            lastStoreRideRef.current = currentRide;
            getRide(currentRide._id);
        }
    }, [id, currentRide, getRide]);

    // ==================== WS rider live position ====================
    useEffect(() => {
        const rid = rideData?.rider?._id as string | undefined;
        if (!rid) return;

        // subscribe one-time per rider
        if (subscribedRiderIdRef.current !== rid) {
            // Unsubscribe previous if needed
            if (subscribedRiderIdRef.current) {
                emit("unsubscribeToriderLocation", subscribedRiderIdRef.current);
            }
            emit("subscribeToriderLocation", rid);
            subscribedRiderIdRef.current = rid;
        }

        const handleRiderLoc = (data: any) => {
            const c = data?.coords;
            if (!c || !isLatLng(c)) return;

            const now = Date.now();
            if (now - lastTsRef.current < WS_THROTTLE_MS) return; // global throttle

            const last = lastLocRef.current;
            const movedEnough = !last ||
                haversine({ latitude: c.latitude, longitude: c.longitude }, { latitude: last.latitude!, longitude: last.longitude! }) > MIN_MOVE_METERS ||
                Math.abs((c.heading ?? 0) - (last.heading ?? 0)) > MIN_HEADING_DELTA;

            if (!movedEnough) return;

            const withTs: RiderCoord = {
                latitude: c.latitude,
                longitude: c.longitude,
                heading: isNum(c.heading) ? c.heading : 0,
                ts: now,
            };

            lastLocRef.current = withTs;
            lastTsRef.current = now;

            setRiderCoords(withTs);
            saveLastRider(withTs).catch(() => { });
        };

        on("riderLocationUpdate", handleRiderLoc);

        return () => {
            off("riderLocationUpdate", handleRiderLoc);
        };
    }, [emit, on, off, rideData?.rider?._id, saveLastRider]);

    // ==================== Auto purge when paid ====================
    useEffect(() => {
        if ([RideStatus.PAYED].includes(rideData?.status)) {
            clearCurrentRide();
            clearRideSnapshot().catch(() => { });
            clearLastRider().catch(() => { });
        }
    }, [rideData?.status, clearCurrentRide, clearRideSnapshot, clearLastRider]);

    // ==================== Payment ====================
    const paymentStartedRef = useRef<string | null>(null);

    const payRideFromWallet = useCallback(async () => {
        setLoad(true);
        const res = await apiRequest({
            method: "POST",
            endpoint: "ride/payRideFromWallet",
            token: tok,
            data: { rideId: rideData?._id, userId: user._id },
        });

        if (res?.success === true) {
            showSuccess(res.message);
            setUser(res.user);
            clearCurrentRide();
            clearRideSnapshot().catch(() => { });
            clearLastRider().catch(() => { });
            router.replace("/(tabs)");
        } else {
            showError(res?.message || "Paiement échoué");
        }
        setLoad(false);
    }, [rideData?._id, setUser, tok, user._id, clearCurrentRide, clearRideSnapshot, clearLastRider]);

    useEffect(() => {
        if (!rideData) return;
        if (rideData.status !== RideStatus.COMPLETED) return;
        if (paymentStartedRef.current === rideData._id) return; // évite double déclenchement
        paymentStartedRef.current = rideData._id;

        if (rideData.paymentMethod === "wallet") {
            payRideFromWallet();
        } else {
            // TODO: init payment flow webview si nécessaire
            // setUrlPayment(...); setShowWebview(true);
        }
    }, [rideData, payRideFromWallet]);

    const handleStatut = async () => {
        setLoad(true);
        const res = await apiRequest({ method: "PUT", endpoint: "ride/update/" + rideData._id, token: tok, data: { status: RideStatus.PAYED } });
        if (res?.success === true) {
            showSuccess(res.message);
            clearCurrentRide();
            clearRideSnapshot().catch(() => { });
            clearLastRider().catch(() => { });
            router.replace("/(tabs)");
        } else {
            showError(res?.message || "Mise à jour échouée");
        }
        setLoad(false);
    };

    const onNavigationStateChange = ({ url }: { url: string }) => {
        if (url.includes("success")) {
            setLoad(false);
            hideModal();
            showSuccess("Paiement effectué");
            handleStatut();
        } else if (url.includes("declined")) {
            setLoad(false);
            hideModal();
            showInfo("Paiement annulé");
        } else if (url.includes("canceled")) {
            setLoad(false);
            hideModal();
            showError("Paiement refusé");
        }
    };

    // ==================== Normalisations ====================
    const shouldUseRider = (s?: string) =>
        s === RideStatus.ACCEPTED || s === RideStatus.ARRIVED || s === RideStatus.VERIFIED || s === RideStatus.START;

    const effectiveRider: RiderCoord = useMemo(() => {
        if (!shouldUseRider(rideData?.status)) return null;
        return riderCoords || cachedRider || null;
    }, [rideData?.status, riderCoords, cachedRider]);

    // ==================== Render ====================
    // compute active route (for render) — derived from latest rideData
    const activeRoute = useMemo(() => getActiveRoute(rideData), [rideData, getActiveRoute]);

    // generate stable key to force reseed of map polyline when geometry length changes
    const trackingMapKey = `${rideData?._id ?? "noRide"}:${activeRoute?.key ?? "none"}:${activeRoute?.geometry?.coordinates?.length ?? 0}`;

    return (
        <View className="flex-1 bg-white">
            {rideData ? (
                <>
                    {/* <TrackingMapV3
                        key={trackingMapKey}
                        setDuration={setDuration}
                        bottomSheetHeight={mapHeight}
                        height={mapHeight}
                        status={rideData?.status}
                        // route chosen according to status & available routes
                        routeGeometry={activeRoute?.geometry ?? null}
                        // ETA/distance prefer those of the active route, fallback to top-level fields
                        serverEtaMin={activeRoute?.duration ?? rideData?.estimatedDuration}
                        // serverEtaText={rideData?.estimatedDurationFormatted}
                        serverDistanceKm={activeRoute?.distance ?? rideData?.distance}
                        drop={{
                            latitude: toNum(rideData?.drop?.latitude, 0),
                            longitude: toNum(rideData?.drop?.longitude, 0),
                            address: rideData?.drop?.address,
                        }}
                        pickup={{
                            latitude: toNum(rideData?.pickup?.latitude, 0),
                            longitude: toNum(rideData?.pickup?.longitude, 0),
                            address: rideData?.pickup?.address,
                        }}
                        rider={
                            effectiveRider
                                ? {
                                    latitude: toNum(effectiveRider.latitude, 0),
                                    longitude: toNum(effectiveRider.longitude, 0),
                                    heading: isNum(effectiveRider.heading) ? effectiveRider.heading : 0,
                                }
                                : {}
                        }
                        onOffRoute={(meters) => {
                            // Affiche l’info; le recalcul est géré côté serveur
                            if (meters > 50) {
                                showInfo(`Hors itinéraire (${meters.toFixed(0)} m)`);
                            }
                        }}
                        onStepChange={(step) => {
                            // Si le front n'a pas de steps (route côté serveur), ce callback peut être null
                            if (!step) return;
                            showInfo(`${step.distanceText} — ${step.instruction}`);
                        }}
                    /> */}

                    <TrackingMapV3
                        key={trackingMapKey}
                        setDuration={setDuration}
                        bottomSheetHeight={mapHeight}
                        height={mapHeight}
                        status={rideData?.status}
                        // route chosen according to status & available routes
                        routeGeometry={activeRoute?.geometry ?? null}
                        // ETA/distance prefer those of the active route, fallback to top-level fields
                        serverEtaMin={activeRoute?.duration ?? rideData?.estimatedDuration}
                        serverEtaText={rideData?.estimatedDurationFormatted ?? null}
                        serverDistanceKm={activeRoute?.distance ?? rideData?.distance}
                        // NEW: pass steps array if available so the map can detect steps and call onStepChange
                        routeSteps={activeRoute?.steps ?? []}
                        drop={{
                            latitude: toNum(rideData?.drop?.latitude, 0),
                            longitude: toNum(rideData?.drop?.longitude, 0),
                            address: rideData?.drop?.address,
                        }}
                        pickup={{
                            latitude: toNum(rideData?.pickup?.latitude, 0),
                            longitude: toNum(rideData?.pickup?.longitude, 0),
                            address: rideData?.pickup?.address,
                        }}
                        rider={
                            effectiveRider
                                ? {
                                    latitude: toNum(effectiveRider.latitude, 0),
                                    longitude: toNum(effectiveRider.longitude, 0),
                                    heading: isNum(effectiveRider.heading) ? effectiveRider.heading : 0,
                                }
                                : {}
                        }
                        onOffRoute={(meters) => {
                            if (meters > 50) {
                                showInfo(`Hors itinéraire (${meters.toFixed(0)} m)`);
                            }
                        }}
                        onStepChange={(step) => {
                            if (!step) return;
                            showInfo(`${step.distanceText} — ${step.instruction}`);
                        }}
                    />

                    <BottomSheet
                        ref={(r) => (bottomSheetRef.current = r as any)}
                        index={1}
                        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
                        enableOverDrag={false}
                        style={{ zIndex: 4 }}
                        snapPoints={snapPoints}
                        onChange={handleSheetChanges}
                    >
                        <BottomSheetScrollView>
                            {rideData?.status === RideStatus.SEARCHING_FOR_RIDER ? (
                                <SearchingRiderSheet duration={Math.max(1, Math.round(duration as number))} item={rideData} />
                            ) : (
                                <LiveTrackingSheet car={car} distance={activeRoute?.distance ?? rideData?.distance} rating={rating} duration={Math.max(1, Math.round(duration as number))} item={rideData} />
                            )}
                        </BottomSheetScrollView>
                    </BottomSheet>
                </>
            ) : (
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-700 ml-2 font-['RubikMedium']">Chargement</Text>
                    <ActivityIndicator size="small" color="#000" />
                </View>
            )}

            <Modal visible={showWebview} onDismiss={hideModal}>
                <TouchableOpacity onPress={hideModal} style={styles.closeButton}>
                    <Icon type="ant-design" name="close" color={"red"} />
                </TouchableOpacity>
                {showWebview && urlPayment && (
                    <WebView
                        style={styles.webview}
                        originWhitelist={["*"]}
                        source={{ uri: urlPayment }}
                        onNavigationStateChange={onNavigationStateChange}
                        onMessage={(event: WebViewMessageEvent) => {
                            try {
                                const message = JSON.parse(event.nativeEvent.data);
                            } catch {
                                // ignore invalid JSON from the webview
                            }
                        }}
                    />
                )}
            </Modal>
        </View>
    );
};

export default memo(LiveRide);

const styles = StyleSheet.create({
    closeButton: {
        backgroundColor: "rgba(255, 255, 255, 0.5)",
        width: 48,
        height: 48,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 24,
        margin: 16,
    },
    webview: {
        flex: 1,
        margin: 16,
        borderRadius: 8,
        overflow: "hidden",
    },
});