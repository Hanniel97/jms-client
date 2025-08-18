import { LiveTrackingMap } from "@/components/LiveTrackingMap";
import LiveTrackingSheet from "@/components/LiveTrackingSheet";
import SearchingRiderSheet from "@/components/SearchingRiderSheet";
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
    START: "START", // ⚠️ pas STARTED
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

    // ==================== Ride setters ====================
    const hasMeaningfulChange = useCallback((prev: any, next: any) => {
        if (!prev) return true;
        if (!next) return false;
        return (
            prev._id !== next._id ||
            prev.status !== next.status ||
            prev.paymentMethod !== next.paymentMethod ||
            prev?.rider?._id !== next?.rider?._id ||
            prev.fare !== next.fare ||
            prev.updatedAt !== next.updatedAt
        );
    }, []);

    const setRideSafely = useCallback(
        (incomingRide: any, incomingCar?: any, incomingRating?: any) => {
            if (incomingCar !== undefined) setDataCar(incomingCar);
            if (incomingRating !== undefined) setRating(incomingRating);
            setRideData(incomingRide);

            // Offline-first snapshot
            saveRideSnapshot(incomingRide).catch(() => { });

            // Only write to store when meaningful
            if (hasMeaningfulChange(lastStoreRideRef.current, incomingRide)) {
                lastStoreRideRef.current = incomingRide;
                setCurrentRide(incomingRide);
            }
        },
        [hasMeaningfulChange, setCurrentRide, saveRideSnapshot]
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
    return (
        <View className="flex-1 bg-white">
            {rideData ? (
                <>
                    <LiveTrackingMap
                        setDuration={setDuration}
                        bottomSheetHeight={mapHeight}
                        height={mapHeight}
                        status={rideData?.status}
                        drop={{
                            latitude: toNum(rideData?.drop?.latitude, 0),
                            longitude: toNum(rideData?.drop?.longitude, 0),
                        }}
                        pickup={{
                            latitude: toNum(rideData?.pickup?.latitude, 0),
                            longitude: toNum(rideData?.pickup?.longitude, 0),
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
                    />

                    <BottomSheet
                        ref={(r) => (bottomSheetRef.current = r as any)}
                        index={1}
                        handleIndicatorStyle={{ backgroundColor: "#ccc" }}
                        enableOverDrag={false}
                        // ⚠️ Quand on utilise des snapPoints fixes, éviter enableDynamicSizing sauf si nécessaire
                        // enableDynamicSizing
                        style={{ zIndex: 4 }}
                        snapPoints={snapPoints}
                        onChange={handleSheetChanges}
                    >
                        <BottomSheetScrollView>
                            {rideData?.status === RideStatus.SEARCHING_FOR_RIDER ? (
                                <SearchingRiderSheet duration={duration} item={rideData} />
                            ) : (
                                <LiveTrackingSheet car={car} rating={rating} duration={duration} item={rideData} />
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
                                // console.log(message?.type);
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








// import { LiveTrackingMap } from "@/components/LiveTrackingMap";
// import LiveTrackingSheet from "@/components/LiveTrackingSheet";
// import SearchingRiderSheet from "@/components/SearchingRiderSheet";
// import { apiRequest } from "@/services/api";
// import { useWS } from "@/services/WSProvider";
// import useStore from "@/store/useStore";
// import { showError, showInfo, showSuccess } from "@/utils/showToast";
// import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
// import { Icon, ScreenHeight } from "@rneui/base";
// import { router, useLocalSearchParams } from "expo-router";
// import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
// import { WebView, WebViewMessageEvent } from "react-native-webview";

// const androidHeights = [ScreenHeight * 0.15, ScreenHeight * 0.64];
// const iosHeights = [ScreenHeight * 0.2, ScreenHeight * 0.5];

// export const LiveRide = () => {
//     const { tok, user, setUser, currentRide, setCurrentRide, clearCurrentRide } = useStore();
//     const { emit, on, off } = useWS();

//     const [rideData, setRideData] = useState<any>(null);
//     const [car, setDataCar] = useState<any>(null);
//     const [rating, setRating] = useState<any>(null);
//     const [riderCoords, setRiderCoords] = useState<any>(null);

//     const { id } = useLocalSearchParams();

//     const bottomSheetRef = useRef(null);
//     const snapPoints = useMemo(() => (Platform.OS === "ios" ? iosHeights : androidHeights), []);
//     const [mapHeight, setMapHeight] = useState(snapPoints[1]);
//     const [showWebview, setShowWebview] = useState(false);
//     const [urlPayment, setUrlPayment] = useState("");
//     const [duration, setDuration] = useState<number>(0);
//     const [load, setLoad] = useState<boolean>(false);

//     // ---- Helpers de stabilité ----
//     const resolvedRideId = useMemo<string | null>(
//         () => ((id as string) || currentRide?._id || null),
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//         [id, currentRide?._id]
//     );

//     // Mémorise le dernier snapshot utilisé pour le store pour éviter les re-writes inutiles
//     const lastStoreRideRef = useRef<any>(null);

//     // ✅ Refs déclarées AU NIVEAU SUPÉRIEUR (et non dans un effet)
//     const lastLocRef = useRef<any>(null);
//     const lastTsRef = useRef<number>(0);
//     const throttleMs = 400;

//     const hasMeaningfulChange = useCallback((prev: any, next: any) => {
//         if (!prev) return true;
//         if (!next) return false;
//         return (
//             prev._id !== next._id ||
//             prev.status !== next.status ||
//             prev.paymentMethod !== next.paymentMethod ||
//             prev?.rider?._id !== next?.rider?._id ||
//             prev.fare !== next.fare ||
//             prev.updatedAt !== next.updatedAt
//         );
//     }, []);

//     const setRideSafely = useCallback(
//         (incomingRide: any, incomingCar?: any, incomingRating?: any) => {
//             if (incomingCar !== undefined) setDataCar(incomingCar);
//             if (incomingRating !== undefined) setRating(incomingRating);
//             setRideData(incomingRide);

//             // N'écrit dans le store que si changement significatif
//             if (hasMeaningfulChange(lastStoreRideRef.current, incomingRide)) {
//                 lastStoreRideRef.current = incomingRide;
//                 setCurrentRide(incomingRide);
//             }
//         },
//         [hasMeaningfulChange, setCurrentRide]
//     );

//     /** Fermeture du WebView */
//     const hideModal = () => setShowWebview(false);

//     const handleSheetChanges = useCallback(
//         (index: number) => {
//             const height = snapPoints[index] ?? snapPoints[1];
//             setMapHeight(height);
//         },
//         [snapPoints]
//     );

//     /** Chargement ride par API (une seule écriture store si nécessaire) */
//     const getRide = useCallback(
//         async (rideId: string) => {
//             const res = await apiRequest({
//                 method: "GET",
//                 endpoint: "ride/getRideById/" + rideId,
//                 token: tok
//             });

//             if (res.success === true) {
//                 setRideSafely(res.ride, res.car, res.rating);
//             }
//         },
//         [tok, setRideSafely]
//     );

//     // ---- WebSocket Handlers (stables) ----
//     const handleRideData = useCallback(
//         (data: any) => {
//             const r = data?.ride;
//             if (!r) return;
//             setRideSafely(r, data.car, data.rating);

//             if (r?.status === "SEARCHING_FOR_RIDER" && resolvedRideId) {
//                 emit("searchrider", resolvedRideId);
//             }
//         },
//         [emit, resolvedRideId, setRideSafely]
//     );

//     const handleRideUpdate = useCallback(
//         (data: any) => {
//             const r = data?.ride;
//             if (!r) return;
//             setRideSafely(r, data.car, data.rating);
//         },
//         [setRideSafely]
//     );

//     const handleRideCanceled = useCallback(
//         (dat: any) => {
//             showInfo(dat?.message || "Trajet annulé");
//             clearCurrentRide();
//             router.replace("/(tabs)");
//         },
//         [clearCurrentRide]
//     );

//     const handleError = useCallback(
//         (error: any) => {
//             showError(error?.message || "Erreur");
//             clearCurrentRide();
//             router.replace("/(tabs)");
//         },
//         [clearCurrentRide]
//     );

//     /** Gestion des WS : un seul abonnement par rideId */
//     useEffect(() => {
//         if (!resolvedRideId) return;

//         emit("subscribeRide", resolvedRideId);

//         on("rideData", handleRideData);
//         on("rideUpdate", handleRideUpdate);
//         on("rideCanceled", handleRideCanceled);
//         on("riderCanceled", showInfo); // simple info
//         on("error", handleError);

//         return () => {
//             off("rideData");
//             off("rideUpdate");
//             off("rideCanceled");
//             off("riderCanceled");
//             off("error");
//             emit("unsubscribeRide", resolvedRideId);
//         };
//     }, [resolvedRideId, emit, on, off, handleRideData, handleRideUpdate, handleRideCanceled, handleError]);

//     /** Chargement initial */
//     useEffect(() => {
//         if (id) {
//             getRide(id as string);
//         } else if (!id && currentRide?._id) {
//             // reprend depuis le store puis resynchronise
//             setRideData(currentRide);
//             lastStoreRideRef.current = currentRide;
//             getRide(currentRide._id);
//         }
//     }, [id, currentRide, getRide]);

//     /** WS position rider — throttle léger et filtre de "petits" mouvements */
//     useEffect(() => {
//         if (!rideData?.rider?._id) return;

//         const riderId = rideData.rider._id;

//         emit("subscribeToriderLocation", riderId);

//         const handleRiderLoc = (data: any) => {
//             const c = data?.coords;
//             if (!c) return;

//             const now = Date.now();
//             if (now - lastTsRef.current < throttleMs) return;

//             const last = lastLocRef.current;
//             // ~5m à l'équateur ~ 0.000045°
//             const movedEnough =
//                 !last ||
//                 Math.abs(c.latitude - last.latitude) > 0.000045 ||
//                 Math.abs(c.longitude - last.longitude) > 0.000045 ||
//                 (c.heading ?? 0) !== (last?.heading ?? 0);

//             if (!movedEnough) return;

//             lastLocRef.current = c;
//             lastTsRef.current = now;
//             setRiderCoords(c);
//         };

//         on("riderLocationUpdate", handleRiderLoc);

//         return () => {
//             off("riderLocationUpdate");
//             // si dispo côté serveur :
//             emit("unsubscribeToriderLocation", riderId);
//         };
//     }, [emit, on, off, rideData?.rider?._id]);

//     /** Suppression ride en cours si terminée/annulée/payée */
//     useEffect(() => {
//         if (["COMPLETED", "CANCELED", "PAYED"].includes(rideData?.status)) {
//             clearCurrentRide();
//         }
//     }, [rideData?.status, clearCurrentRide]);

//     /** Paiement — empêcher les déclenchements multiples */
//     const paymentStartedRef = useRef<string | null>(null);

//     const handlePayment = useCallback(async () => {
//         const res = await apiRequest({
//             method: "POST",
//             endpoint: "fedaPayment",
//             token: tok,
//             data: {
//                 amount: rideData?.fare,
//                 user: user
//             }
//         });

//         if (res.success === true) {
//             showSuccess(res.message);
//             setUrlPayment(res.data.url);
//             setShowWebview(true);
//         } else {
//             showError(res.message);
//         }
//     }, [rideData?.fare, tok, user]);

//     const payRideFromWallet = useCallback(async () => {
//         setLoad(true);
//         const res = await apiRequest({
//             method: "POST",
//             endpoint: "ride/payRideFromWallet",
//             token: tok,
//             data: {
//                 rideId: rideData?._id,
//                 userId: user._id
//             }
//         });

//         if (res.success === true) {
//             showSuccess(res.message);
//             setUser(res.user);
//             clearCurrentRide();
//             router.replace("/(tabs)");
//         } else {
//             showError(res.message);
//         }
//         setLoad(false);
//     }, [rideData?._id, setUser, tok, user._id, clearCurrentRide]);

//     useEffect(() => {
//         if (!rideData) return;
//         if (rideData.status !== "COMPLETED") return;

//         // évite double déclenchement si rideUpdate arrive plusieurs fois
//         if (paymentStartedRef.current === rideData._id) return;
//         paymentStartedRef.current = rideData._id;

//         if (rideData.paymentMethod === "wallet") {
//             payRideFromWallet();
//         } else {
//             handlePayment();
//         }
//     }, [rideData, handlePayment, payRideFromWallet]);

//     /** Validation paiement */
//     const handleStatut = async () => {
//         setLoad(true);
//         const res = await apiRequest({
//             method: "PUT",
//             endpoint: "ride/update/" + rideData._id,
//             token: tok,
//             data: { status: "PAYED" }
//         });

//         if (res.success === true) {
//             showSuccess(res.message);
//             clearCurrentRide();
//             router.replace("/(tabs)");
//         } else {
//             showError(res.message);
//         }
//         setLoad(false);
//     };

//     function onNavigationStateChange({ url }: { url: string }) {
//         if (url.includes("success")) {
//             setLoad(false);
//             hideModal();
//             showSuccess("Paiement effectué");
//             handleStatut();
//         } else if (url.includes("declined")) {
//             setLoad(false);
//             hideModal();
//             showInfo("Paiement annulé");
//         } else if (url.includes("canceled")) {
//             setLoad(false);
//             hideModal();
//             showError("Paiement refusé");
//         }
//     }

//     return (
//         <View className="flex-1 bg-white">
//             {rideData ? (
//                 <>
//                     <LiveTrackingMap
//                         setDuration={setDuration}
//                         bottomSheetHeight={mapHeight}
//                         height={mapHeight}
//                         status={rideData?.status}
//                         drop={{
//                             latitude: parseFloat(rideData?.drop?.latitude),
//                             longitude: parseFloat(rideData?.drop?.longitude)
//                         }}
//                         pickup={{
//                             latitude: parseFloat(rideData?.pickup?.latitude),
//                             longitude: parseFloat(rideData?.pickup?.longitude)
//                         }}
//                         rider={
//                             riderCoords
//                                 ? {
//                                     latitude: riderCoords.latitude,
//                                     longitude: riderCoords.longitude,
//                                     heading: riderCoords.heading
//                                 }
//                                 : {}
//                         }
//                     />

//                     <BottomSheet
//                         ref={bottomSheetRef}
//                         index={1}
//                         handleIndicatorStyle={{ backgroundColor: "#ccc" }}
//                         enableOverDrag={false}
//                         enableDynamicSizing
//                         style={{ zIndex: 4 }}
//                         snapPoints={snapPoints}
//                         onChange={handleSheetChanges}
//                     >
//                         <BottomSheetScrollView>
//                             {rideData?.status === "SEARCHING_FOR_RIDER" ? (
//                                 <SearchingRiderSheet duration={duration} item={rideData} />
//                             ) : (
//                                 <LiveTrackingSheet car={car} rating={rating} duration={duration} item={rideData} />
//                             )}
//                         </BottomSheetScrollView>
//                     </BottomSheet>
//                 </>
//             ) : (
//                 <View className="flex-1 justify-center items-center">
//                     <Text className="text-gray-700 ml-2 font-['RubikMedium']">Chargement</Text>
//                     <ActivityIndicator size="small" color="#000" />
//                 </View>
//             )}

//             <Modal visible={showWebview} onDismiss={hideModal}>
//                 <TouchableOpacity onPress={hideModal} style={styles.closeButton}>
//                     <Icon type="ant-design" name="close" color={"red"} />
//                 </TouchableOpacity>
//                 {showWebview && urlPayment && (
//                     <WebView
//                         style={styles.webview}
//                         originWhitelist={["*"]}
//                         source={{ uri: urlPayment }}
//                         onNavigationStateChange={onNavigationStateChange}
//                         onMessage={(event: WebViewMessageEvent) => {
//                             try {
//                                 const message = JSON.parse(event.nativeEvent.data);
//                                 console.log(message?.type);
//                             } catch {
//                                 // ignore invalid JSON from the webview
//                             }
//                         }}
//                     />
//                 )}
//             </Modal>
//         </View>
//     );
// };

// export default memo(LiveRide);

// const styles = StyleSheet.create({
//     closeButton: {
//         backgroundColor: "rgba(255, 255, 255, 0.5)",
//         width: 48,
//         height: 48,
//         justifyContent: "center",
//         alignItems: "center",
//         borderRadius: 24,
//         margin: 16
//     },
//     webview: {
//         flex: 1,
//         margin: 16,
//         borderRadius: 8,
//         overflow: "hidden"
//     }
// });









// import { LiveTrackingMap } from "@/components/LiveTrackingMap";
// import LiveTrackingSheet from "@/components/LiveTrackingSheet";
// import SearchingRiderSheet from "@/components/SearchingRiderSheet";
// import { apiRequest } from "@/services/api";
// import { useWS } from "@/services/WSProvider";
// import useStore from "@/store/useStore";
// import { showError, showInfo, showSuccess } from "@/utils/showToast";
// import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
// import { Icon, ScreenHeight } from "@rneui/base";
// import { router, useLocalSearchParams } from "expo-router";
// import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
// import { ActivityIndicator, Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
// import { WebView, WebViewMessageEvent } from 'react-native-webview';

// const androidHeights = [ScreenHeight * 0.15, ScreenHeight * 0.64]
// const iosHeights = [ScreenHeight * 0.2, ScreenHeight * 0.5]

// export const LiveRide = () => {
//     const { tok, user, setUser } = useStore();
//     const { emit, on, off } = useWS();
//     const [rideData, setRideData] = useState<any>(null)
//     const [car, setDataCar] = useState<any>(null)
//     const [rating, setRating] = useState<any>(null)
//     const [riderCoords, setRiderCoords] = useState<any>(null)
//     const { id } = useLocalSearchParams();
//     const bottomSheetRef = useRef(null);
//     const snapPoints = useMemo(() => (Platform.OS === "ios" ? iosHeights : androidHeights), [])
//     const [mapHeight, setMapHeight] = useState(snapPoints[1]);
//     const [modalVisible, setModalVisible] = useState(false);
//     const [duration, setDuration] = useState<number>(0);
//     const [showWebview, setShowWebview] = useState(false);
//     const [load, setLoad] = useState<boolean>(false);
//     const [urlPayment, setUrlPayment] = useState("");

//     const onClose = () => {
//         setModalVisible(false)
//     }

//     const hideModal = () => setShowWebview(false);

//     const handleSheetChanges = useCallback((index: number) => {
//         const height = snapPoints[index] ?? snapPoints[1];
//         setMapHeight(height);
//     }, [snapPoints]);

//     useEffect(() => {
//         if (id) {
//             emit('subscribeRide', id)
//             on('rideData', (data) => {
//                 // console.log(data)
//                 setRideData(data.ride)
//                 setDataCar(data.car)
//                 setRating(data.rating)
//                 if (data?.ride?.status === "SEARCHING_FOR_RIDER") {
//                     emit('searchrider', id)
//                 }
//             })

//             on('rideUpdate', (data) => {
//                 setRideData(data.ride)
//                 setDataCar(data.car)
//                 setRating(data.rating)
//                 // console.log('ride data updated ==>', data)
//             })

//             on('rideCanceled', (dat) => {
//                 router.replace("/(tabs)")
//                 showInfo(dat.message)
//             })

//             on("riderCanceled", (data) => {
//                 showInfo(data.message)
//                 // console.log("🚨 Rider a annulé :", data.message);
//             });

//             on('error', (error) => {
//                 router.replace("/(tabs)")
//                 showError(error.message)
//             })
//         }

//         return () => {
//             off('rideData');
//             off('rideUpdate');
//             off('rideCanceled');
//             off('riderCanceled');
//             off('error');
//         }
//     }, [emit, id, off, on]);

//     const getRide = useCallback(async () => {
//         const res = await apiRequest({
//             method: 'GET',
//             endpoint: 'ride/getRideById/' + id,
//             token: tok,
//         });

//         // console.log('dfdbfk jd', res)

//         if (res.success === true) {
//             setRideData(res.ride)
//         }
//     }, [id, tok]);

//     useEffect(() => {
//         if (id) {
//             getRide()
//         }
//     }, [getRide, id]);

//     const handlePayment = useCallback(async () => {
//         const res = await apiRequest({
//             method: 'POST',
//             endpoint: 'fedaPayment',
//             token: tok,
//             data: {
//                 amount: rideData?.fare,
//                 user: user
//             }
//         })

//         console.log('  ', res)

//         if (res.success === true) {
//             showSuccess(res.message)
//             // setLoad(false);
//             setUrlPayment(res.data.url)
//         } else {
//             // setLoad(false);
//             showError(res.message)
//         }
//     }, [rideData?.fare, tok, user])

//     const payRideFromWallet = useCallback(async () => {
//         setLoad(true);
//         const res = await apiRequest({
//             method: 'POST',
//             endpoint: 'ride/payRideFromWallet',
//             token: tok,
//             data: {
//                 rideId: rideData?._id,
//                 userId: user._id
//             }
//         })


//         if (res.success === true) {
//             showSuccess(res.message)
//             setLoad(false);
//             setUser(res.user)
//             router.replace('/(tabs)')
//         } else {
//             showError(res.message)
//             setLoad(false);
//         }
//     }, [rideData?._id, setUser, tok, user._id])

//     useEffect(() => {
//         if (rideData && rideData?.status === "COMPLETED" && rideData?.paymentMethod !== "wallet") {
//             // handlePayment()
//         } else if (rideData && rideData?.status === "COMPLETED" && rideData?.paymentMethod === "wallet") {
//             payRideFromWallet()
//         }
//     }, [getRide, id, payRideFromWallet, rideData]);

//     // useEffect(() => {
//     //     if (urlPayment) {
//     //         setShowWebview(true)
//     //     }
//     // }, [urlPayment])

//     useEffect(() => {
//         if (rideData?.rider?._id) {
//             emit('subscribeToriderLocation', rideData?.rider?._id)
//             on('riderLocationUpdate', (data) => {
//                 console.log(data)
//                 setRiderCoords(data?.coords)
//             })
//         }

//         return () => {
//             off('riderLocationUpdate')
//             off('subscribeToriderLocation')
//         }
//     }, [emit, off, on, rideData]);

//     useEffect(() => {
//         if(rideData?.paymentMethod === "espece" && rideData?.status === "PAYED"){
//             router.replace('/(tabs)')
//         }
//     }, [rideData?.paymentMethod, rideData?.status])

//     const handleStatut = async () => {
//         setLoad(true);
//         const res = await apiRequest({
//             method: 'PUT',
//             endpoint: 'ride/update/' + rideData._id,
//             token: tok,
//             data: {
//                 status: "PAYED"
//             }
//         })

//         if (res.success === true) {
//             showSuccess(res.message)
//             setLoad(false);
//             router.replace('/(tabs)')
//         } else {
//             setLoad(false);
//             showError(res.message)
//         }
//     }

//     function onNavigationStateChange({ url }: { url: string }) {
//         if (url.includes('success')) {
//             setLoad(false)
//             hideModal()
//             showSuccess("Paiement effectué")
//             handleStatut();
//         } else if (url.includes('declined')) {
//             setLoad(false)
//             hideModal()
//             showInfo("Paiement annulé")
//         } else if (url.includes('canceled')) {
//             setLoad(false)
//             showError("Paiement refusé")
//             hideModal()
//         } else {
//             showError("Paiement non effectué")
//         }
//     }


//     return (
//         <View className="flex-1 bg-white">

//             {rideData && (
//                 <LiveTrackingMap
//                     setDuration={setDuration}
//                     bottomSheetHeight={mapHeight}
//                     height={mapHeight}
//                     status={rideData?.status}
//                     drop={{
//                         latitude: parseFloat(rideData?.drop?.latitude),
//                         longitude: parseFloat(rideData?.drop?.longitude),
//                     }}
//                     pickup={{
//                         latitude: parseFloat(rideData?.pickup?.latitude),
//                         longitude: parseFloat(rideData?.pickup?.longitude),
//                     }}
//                     rider={
//                         riderCoords ?
//                             {
//                                 latitude: riderCoords.latitude,
//                                 longitude: riderCoords.longitude,
//                                 heading: riderCoords.heading,
//                             }
//                             : {}
//                     }
//                 />
//             )}

//             {rideData ?
//                 <BottomSheet
//                     ref={bottomSheetRef}
//                     index={1}
//                     handleIndicatorStyle={{
//                         backgroundColor: "#ccc"
//                     }}
//                     enableOverDrag={false}
//                     enableDynamicSizing
//                     style={{ zIndex: 4 }}
//                     snapPoints={snapPoints}
//                     onChange={handleSheetChanges}
//                 >
//                     <BottomSheetScrollView contentContainerStyle={{}}>
//                         {rideData?.status === "SEARCHING_FOR_RIDER" ? (
//                             <SearchingRiderSheet
//                                 duration={duration}
//                                 item={rideData}
//                             />
//                         ) : (
//                             <LiveTrackingSheet
//                                 car={car}
//                                 rating={rating}
//                                 duration={duration}
//                                 item={rideData}
//                             />
//                         )}
//                     </BottomSheetScrollView>
//                 </BottomSheet>
//                 :
//                 <View className="flex-1 justify-center items-center">
//                     <Text className="text-gray-700 ml-2 font-['RubikMedium']">Chargement</Text>
//                     <ActivityIndicator size={"small"} color={"#000"} />
//                 </View>
//             }

//             <Modal visible={showWebview} onDismiss={hideModal}>
//                 <TouchableOpacity
//                     onPress={hideModal}
//                     style={styles.closeButton}
//                 >
//                     <Icon type='ant-design' name='close' color={"red"} />
//                 </TouchableOpacity>
//                 {showWebview && urlPayment && (
//                     <WebView
//                         style={styles.webview}
//                         originWhitelist={["*"]}
//                         source={{ uri: urlPayment }}
//                         onNavigationStateChange={onNavigationStateChange}
//                         onMessage={(event: WebViewMessageEvent) => {
//                             const message = JSON.parse(event.nativeEvent.data);
//                             switch (message.type) {
//                                 case "test":
//                                     console.log("hello");
//                                     break;
//                                 default:
//                                     console.log(message.type);
//                             }
//                         }}

//                     />
//                 )}
//             </Modal>

//             {/* <Modal
//                 animationType="fade"
//                 transparent
//                 visible={modalVisible}
//             // onRequestClose={onClose}
//             >
//                 <View style={[styles.overlay, {}]}>
//                     <View style={styles.modalContainer}>
//                         <Image
//                             source={require("../assets/images/downcast-face.png")}
//                             className="w-24 h-24 mb-4 self-center rounded-full border-4 border-primary"
//                         />

//                         <Text className="text-lg font-['RubikBold'] text-center text-black dark:text-white mb-2">
//                             Course achevée
//                         </Text>

//                         <Text className="text-sm text-center font-['RubikRegular'] text-gray-700 dark:text-gray-300 mb-6">
//                             Nous sommes arrivé à destination. Nous sommes ravis de vous avoir rendu service.
//                         </Text>

//                         <View className="flex-row justify-between">
//                             <Pressable
//                                 onPress={onClose}
//                                 className="flex-1 mr-2 items-center justify-center bg-primary dark:bg-gray-700 px-4 py-3 rounded-full"
//                             >
//                                 <Text className="text-white font-['RubikMedium']">Payer {rideData?.fare} </Text>
//                             </Pressable>

//                             <Pressable
//                                 // onPress={()}
//                                 className="flex-1 ml-2 items-center justify-center bg-green-600 px-4 py-3 rounded-full"
//                             >
//                                 <Text className="text-white font-medium">Oui</Text>
//                             </Pressable>
//                         </View>
//                     </View>
//                 </View>
//             </Modal> */}
//         </View>
//     )
// }

// export default memo(LiveRide);

// const styles = StyleSheet.create({
//     overlay: {
//         flex: 1,
//         backgroundColor: 'rgba(0,0,0,0.3)', // assombrit tout l'écran
//         justifyContent: 'center',
//         alignItems: 'center',
//         width: Dimensions.get('window').width,
//         height: Dimensions.get('window').height,
//     },
//     modalContainer: {
//         backgroundColor: 'white',
//         borderRadius: 10,
//         padding: 30,
//         width: '85%',
//     },
//     containerStyle: {
//         flex: 1,
//         backgroundColor: 'rgba(0, 0, 0, 0.5)',
//         justifyContent: 'center',
//     } as ViewStyle,
//     closeButton: {
//         backgroundColor: 'rgba(255, 255, 255, 0.5)',
//         width: 48,
//         height: 48,
//         justifyContent: 'center',
//         alignItems: 'center',
//         borderRadius: 24,
//         margin: 16,
//     },
//     webview: {
//         flex: 1,
//         margin: 16,
//         borderRadius: 8,
//         overflow: 'hidden',
//     },
// });