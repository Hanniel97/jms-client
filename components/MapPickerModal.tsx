// @/components/MapPickerModal.tsx
import { getPlaceDetails, searchPlaces } from "@/services/api";
import useStore from "@/store/useStore";
import { Icon } from "@rneui/base";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    Modal,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Region } from "react-native-maps";

export type PickedLocation = {
    latitude: number;
    longitude: number;
    address?: string;
};

type Props = {
    visible: boolean;
    title: "pickup" | "drop";
    selectedLocation?: PickedLocation | null;
    onClose: () => void;
    onSelectLocation: (picked: PickedLocation | null) => void;
};

const REVERSE_DEBOUNCE_MS = 450;
const SEARCH_DEBOUNCE_MS = 300;
const NEAR_EPS = 0.0001; // ~11m
const near = (a?: number, b?: number) =>
    typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < NEAR_EPS : a === b;

const MapPickerModal: React.FC<Props> = ({ visible, title, selectedLocation, onClose, onSelectLocation }) => {
    const { position } = useStore();

    const initialRegion = useMemo<Region>(() => {
        const lat = selectedLocation?.latitude ?? Number(position?.latitude ?? 0);
        const lng = selectedLocation?.longitude ?? Number(position?.longitude ?? 0);
        return { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };

    }, [selectedLocation?.latitude, selectedLocation?.longitude, position?.latitude, position?.longitude]);

    const mapRef = useRef<MapView | null>(null);
    const [region, setRegion] = useState<Region>(initialRegion);
    const [addr, setAddr] = useState<string>(selectedLocation?.address ?? "");
    const [loadingAddr, setLoadingAddr] = useState<boolean>(false);

    // Search
    const [query, setQuery] = useState<string>("");
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchSeqRef = useRef(0);
    const [searchLoading, setSearchLoading] = useState(false);

    // reverse geocode debounce
    const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);

    // reset when open
    useEffect(() => {
        if (visible) {
            setRegion(initialRegion);
            setAddr(selectedLocation?.address ?? "");
            setQuery("");
            setSuggestions([]);
            lastCenterRef.current = { lat: initialRegion.latitude, lng: initialRegion.longitude };
            setTimeout(() => mapRef.current?.animateToRegion(initialRegion, 250), 150);
        } else {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, selectedLocation?.address, selectedLocation?.latitude, selectedLocation?.longitude]);

    // reverse geocode
    const reverseGeocode = useCallback(async (lat: number, lng: number) => {
        try {
            setLoadingAddr(true);
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${(process.env.GOOGLE_API_KEY as string) || ""}&language=fr`;
            const res = await fetch(url);
            const json = await res.json();
            const formatted =
                json?.results?.[0]?.formatted_address ||
                json?.plus_code?.compound_code ||
                `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            setAddr(formatted);
        } catch {
            setAddr(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
        } finally {
            setLoadingAddr(false);
        }
    }, []);

    const onRegionChangeComplete = useCallback(
        (r: Region) => {
            setRegion(r);
            if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
            reverseTimerRef.current = setTimeout(() => {
                const last = lastCenterRef.current;
                if (!last || !near(last.lat, r.latitude) || !near(last.lng, r.longitude)) {
                    lastCenterRef.current = { lat: r.latitude, lng: r.longitude };
                    reverseGeocode(r.latitude, r.longitude);
                }
            }, REVERSE_DEBOUNCE_MS);
        },
        [reverseGeocode]
    );

    useEffect(() => {
        return () => {
            if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
            if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
        };
    }, []);

    // search places (debounce + anti race)
    useEffect(() => {
        if (!query || query.trim().length < 2) {
            setSuggestions([]);
            setSearchLoading(false);
            return;
        }
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        const seq = ++searchSeqRef.current;
        setSearchLoading(true);
        searchTimerRef.current = setTimeout(async () => {
            try {
                const results = await searchPlaces(query.trim());
                if (seq === searchSeqRef.current) setSuggestions(results ?? []);
            } catch {
            } finally {
                if (seq === searchSeqRef.current) setSearchLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);
    }, [query]);

    // select suggestion => move map
    const onSelectSuggestion = useCallback(
        async (placeId: string) => {
            try {
                setSearchLoading(true);
                const details = await getPlaceDetails(placeId);
                if (!details) return;
                const targetRegion: Region = {
                    latitude: details.latitude,
                    longitude: details.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                };
                setRegion(targetRegion);
                setAddr(details.address ?? "");
                lastCenterRef.current = { lat: details.latitude, lng: details.longitude };
                setTimeout(() => mapRef.current?.animateToRegion(targetRegion, 300), 50);
                setSuggestions([]);
                setQuery(details.address ?? "");
                Keyboard.dismiss();
            } catch {
            } finally {
                setSearchLoading(false);
            }
        },
        []
    );

    const confirm = useCallback(() => {
        onSelectLocation({
            latitude: region.latitude,
            longitude: region.longitude,
            address: addr,
        });
        onClose();
    }, [onClose, onSelectLocation, region.latitude, region.longitude, addr]);

    const renderSuggestion = ({ item }: { item: any }) => {
        return item?.description && item?.place_id ? (
            <TouchableOpacity
                onPress={() => onSelectSuggestion(item.place_id)}
                className="flex-row items-start px-3 py-2"
            >
                <Icon name="location-pin" type="entypo" size={18} color="#222" />
                <Text numberOfLines={2} className="ml-2 text-[14px] text-gray-900 flex-1">
                    {item.description}
                </Text>
            </TouchableOpacity>
        ) : null;
    };

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 bg-white">
                {/* header */}
                <View
                    className="flex-row items-center justify-between border-b border-gray-200 px-3"
                    style={{ paddingTop: Platform.OS === "ios" ? 12 : 6, height: 64 }}
                >
                    <TouchableOpacity onPress={onClose} className="w-12 h-10 items-center justify-center">
                        <Icon name="arrow-back" type="material" size={22} />
                    </TouchableOpacity>

                    <View className="flex-row items-center flex-1 mx-2 relative">
                        <TextInput
                            placeholder={title === "pickup" ? "Chercher un point de départ" : "Chercher une destination"}
                            value={query}
                            onChangeText={setQuery}
                            className="flex-1 h-10 bg-gray-100 rounded-md px-3 text-sm text-gray-900"
                            returnKeyType="search"
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                        {searchLoading && (
                            <View className="absolute right-2 top-2">
                                <ActivityIndicator size="small" />
                            </View>
                        )}
                    </View>

                    <TouchableOpacity onPress={confirm} className="w-12 h-10 items-center justify-center">
                        <Text className="text-green-600 font-bold">OK</Text>
                    </TouchableOpacity>
                </View>

                {/* suggestions overlay */}
                {suggestions.length > 0 && (
                    <View className="absolute top-16 left-3 right-3 z-50 bg-white rounded-md border border-gray-200 shadow-sm">
                        <FlatList
                            data={suggestions}
                            keyExtractor={(it, idx) => it.place_id ?? idx.toString()}
                            renderItem={renderSuggestion}
                            keyboardShouldPersistTaps="handled"
                            style={{ maxHeight: 200 }}
                        />
                    </View>
                )}

                {/* Map */}
                <View className="flex-1">
                    <MapView
                        ref={mapRef}
                        style={{ flex: 1 }}
                        initialRegion={initialRegion}
                        onRegionChangeComplete={onRegionChangeComplete}
                        showsCompass={false}
                        showsIndoors={false}
                        toolbarEnabled={false}
                        zoomEnabled
                        rotateEnabled={false}
                        pitchEnabled={false}
                        provider="google"
                    />
                    {/* crosshair */}
                    {/* <View pointerEvents="none" className="absolute left-1/2 top-1/2 -ml-5 -mt-9 bg-slate-400">
                        <Image source={require("../assets/images/pin.png")} className="w-9 h-9" />
                    </View> */}
                    <View pointerEvents="none" style={{position: "absolute", top: "50%", left: "50%", marginLeft: -18, marginTop: Platform.select({ ios: -36, android: -36 }),}}>
                        <Image source={require("../assets/images/pin.png")} style={{ width: 36, height: 36, resizeMode: "contain" }} />
                    </View>
                </View>

                {/* footer */}
                <View className="flex-row items-center border-t border-gray-200 p-3">
                    <View className="flex-1 pr-3">
                        <Text className="text-xs text-gray-500 mb-1">Adresse sélectionnée</Text>
                        <View className="min-h-[40px] px-2 py-2 border border-gray-200 rounded-md justify-center">
                            {loadingAddr ? (
                                <ActivityIndicator />
                            ) : (
                                <Text numberOfLines={2} className="text-sm text-gray-900">
                                    {addr || "Déplace la carte pour choisir…"}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* <TouchableOpacity onPress={confirm} className="bg-green-600 px-4 py-3 rounded-md ml-2">
                        <Text className="text-white font-bold">Confirmer</Text>
                    </TouchableOpacity> */}
                </View>
            </View>
        </Modal>
    );
};

export default React.memo(MapPickerModal);








// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//     Modal,
//     View,
//     Text,
//     TouchableOpacity,
//     StyleSheet,
//     Platform,
//     ActivityIndicator,
//     Image,
//     TextInput,
//     FlatList,
//     Keyboard,
// } from "react-native";
// import MapView, { Region } from "react-native-maps";
// import { Icon } from "@rneui/base";
// import useStore from "@/store/useStore";
// import { getPlaceDetails, searchPlaces } from "@/services/api";

// export type PickedLocation = {
//     latitude: number;
//     longitude: number;
//     address?: string;
// };

// type Props = {
//     visible: boolean;
//     title: "pickup" | "drop";
//     selectedLocation?: PickedLocation | null;
//     onClose: () => void;
//     onSelectLocation: (picked: PickedLocation | null) => void;
// };

// const REVERSE_DEBOUNCE_MS = 450;
// const SEARCH_DEBOUNCE_MS = 300;
// const NEAR_EPS = 0.0001; // ~11m

// const near = (a?: number, b?: number) =>
//     typeof a === "number" && typeof b === "number" ? Math.abs(a - b) < NEAR_EPS : a === b;

// const MapPickerModal: React.FC<Props> = ({ visible, title, selectedLocation, onClose, onSelectLocation }) => {
//     const { position } = useStore();

//     // initial region (fallback to user position)
//     const initialRegion = useMemo<Region>(() => {
//         const lat = selectedLocation?.latitude ?? Number(position?.latitude ?? 0);
//         const lng = selectedLocation?.longitude ?? Number(position?.longitude ?? 0);
//         return { latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [selectedLocation?.latitude, selectedLocation?.longitude, position?.latitude, position?.longitude]);

//     const mapRef = useRef<MapView | null>(null);
//     const [region, setRegion] = useState<Region>(initialRegion);
//     const [addr, setAddr] = useState<string>(selectedLocation?.address ?? "");
//     const [loadingAddr, setLoadingAddr] = useState<boolean>(false);

//     // Search field
//     const [query, setQuery] = useState<string>("");
//     const [suggestions, setSuggestions] = useState<any[]>([]);
//     const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
//     const searchSeqRef = useRef(0);
//     const [searchLoading, setSearchLoading] = useState(false);

//     // reverse geocode debounce
//     const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
//     const lastCenterRef = useRef<{ lat: number; lng: number } | null>(null);

//     // Reset state when modal opens
//     useEffect(() => {
//         if (visible) {
//             setRegion(initialRegion);
//             setAddr(selectedLocation?.address ?? "");
//             setQuery("");
//             setSuggestions([]);
//             lastCenterRef.current = { lat: initialRegion.latitude, lng: initialRegion.longitude };
//             // Animate map a bit after open for smoothness
//             setTimeout(() => mapRef.current?.animateToRegion(initialRegion, 250), 150);
//         } else {
//             // cleanup timers
//             if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
//             if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
//         }
//         // eslint-disable-next-line react-hooks/exhaustive-deps
//     }, [visible, selectedLocation?.address, selectedLocation?.latitude, selectedLocation?.longitude]);

//     // Reverse geocode function (debounced caller)
//     const reverseGeocode = useCallback(async (lat: number, lng: number) => {
//         try {
//             setLoadingAddr(true);
//             // On utilise Google Geocoding via getPlaceDetails? Ici on fait simple fetch to geocode endpoint
//             const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${(process.env.GOOGLE_API_KEY as string) || ""}&language=fr`;
//             // Note: si ton projet fournit un helper pour reverse geocode, remplace l'appel ci-dessus.
//             const res = await fetch(url);
//             const json = await res.json();
//             const formatted =
//                 json?.results?.[0]?.formatted_address ||
//                 json?.plus_code?.compound_code ||
//                 `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
//             setAddr(formatted);
//         } catch (e) {
//             setAddr(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
//         } finally {
//             setLoadingAddr(false);
//         }
//     }, []);

//     // Called when map region change ends
//     const onRegionChangeComplete = useCallback(
//         (r: Region) => {
//             setRegion(r);

//             // debounce reverse-geocode if center moved sufficiently
//             if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
//             reverseTimerRef.current = setTimeout(() => {
//                 const last = lastCenterRef.current;
//                 if (!last || !near(last.lat, r.latitude) || !near(last.lng, r.longitude)) {
//                     lastCenterRef.current = { lat: r.latitude, lng: r.longitude };
//                     reverseGeocode(r.latitude, r.longitude);
//                 }
//             }, REVERSE_DEBOUNCE_MS);
//         },
//         [reverseGeocode]
//     );

//     useEffect(() => {
//         return () => {
//             if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
//             if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
//         };
//     }, []);

//     // Search addresses (debounced + anti-race)
//     useEffect(() => {
//         if (!query || query.trim().length < 2) {
//             setSuggestions([]);
//             setSearchLoading(false);
//             return;
//         }
//         if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
//         const seq = ++searchSeqRef.current;
//         setSearchLoading(true);
//         searchTimerRef.current = setTimeout(async () => {
//             try {
//                 const results = await searchPlaces(query.trim());
//                 if (seq === searchSeqRef.current) {
//                     setSuggestions(results ?? []);
//                 }
//             } catch {
//                 // ignore
//             } finally {
//                 if (seq === searchSeqRef.current) setSearchLoading(false);
//             }
//         }, SEARCH_DEBOUNCE_MS);
//         // cleanup handled by other useEffect
//     }, [query]);

//     // When user selects a suggestion from search: fetch place details and move map
//     const onSelectSuggestion = useCallback(
//         async (placeId: string) => {
//             try {
//                 setSearchLoading(true);
//                 const details = await getPlaceDetails(placeId);
//                 if (!details) return;
//                 const targetRegion: Region = {
//                     latitude: details.latitude,
//                     longitude: details.longitude,
//                     latitudeDelta: 0.01,
//                     longitudeDelta: 0.01,
//                 };
//                 setRegion(targetRegion);
//                 setAddr(details.address ?? "");
//                 lastCenterRef.current = { lat: details.latitude, lng: details.longitude };
//                 // Move map to location
//                 setTimeout(() => mapRef.current?.animateToRegion(targetRegion, 300), 50);
//                 // clear suggestions & query
//                 setSuggestions([]);
//                 setQuery(details.address ?? "");
//                 Keyboard.dismiss();
//             } catch (e) {
//                 // ignore
//             } finally {
//                 setSearchLoading(false);
//             }
//         },
//         []
//     );

//     // Confirm selection: use current region center and addr (addr updated by reverseGeocode or by search)
//     const confirm = useCallback(() => {
//         onSelectLocation({
//             latitude: region.latitude,
//             longitude: region.longitude,
//             address: addr,
//         });
//         onClose();
//     }, [onClose, onSelectLocation, region.latitude, region.longitude, addr]);

//     const renderSuggestion = ({ item }: { item: any }) => {
//         return item?.description && item?.place_id ? (
//             <TouchableOpacity
//                 onPress={() => onSelectSuggestion(item.place_id)}
//                 style={styles.suggestionRow}
//             >
//                 <Icon name="location-pin" type="entypo" size={18} color="#222" />
//                 <Text numberOfLines={2} style={styles.suggestionText}>
//                     {item.description}
//                 </Text>
//             </TouchableOpacity>
//         ) : null;
//     };

//     return (
//         <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
//             <View style={styles.container}>
//                 {/* Header with search */}
//                 <View style={styles.header}>
//                     <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
//                         <Icon name="arrow-back" type="material" size={22} />
//                     </TouchableOpacity>

//                     <View style={styles.searchWrap}>
//                         <TextInput
//                             placeholder={title === "pickup" ? "Chercher un point de départ" : "Chercher une destination"}
//                             value={query}
//                             onChangeText={setQuery}
//                             style={styles.searchInput}
//                             returnKeyType="search"
//                             autoCorrect={false}
//                             autoCapitalize="none"
//                         />
//                         {searchLoading && <ActivityIndicator style={styles.searchSpinner} size="small" />}
//                     </View>

//                     <TouchableOpacity onPress={confirm} style={styles.headerBtn}>
//                         <Text style={styles.headerConfirm}>OK</Text>
//                     </TouchableOpacity>
//                 </View>

//                 {/* Suggestions list overlay (shows when there are results) */}
//                 {suggestions.length > 0 && (
//                     <View style={styles.suggestionsContainer}>
//                         <FlatList
//                             data={suggestions}
//                             keyExtractor={(it, idx) => it.place_id ?? idx.toString()}
//                             renderItem={renderSuggestion}
//                             keyboardShouldPersistTaps="handled"
//                             style={{ maxHeight: 200 }}
//                         />
//                     </View>
//                 )}

//                 {/* Map */}
//                 <View style={{ flex: 1 }}>
//                     <MapView
//                         ref={mapRef}
//                         style={{ flex: 1 }}
//                         initialRegion={initialRegion}
//                         onRegionChangeComplete={onRegionChangeComplete}
//                         showsCompass={false}
//                         showsIndoors={false}
//                         toolbarEnabled={false}
//                         zoomEnabled
//                         rotateEnabled={false}
//                         pitchEnabled={false}
//                         provider="google"
//                     />
//                     {/* Crosshair */}
//                     <View pointerEvents="none" style={styles.pinContainer}>
//                         <Image source={require("../assets/images/pin.png")} style={{ width: 36, height: 36, resizeMode: "contain" }} />
//                     </View>
//                 </View>

//                 {/* Footer address + confirm */}
//                 <View style={styles.footer}>
//                     <View style={{ flex: 1, paddingRight: 12 }}>
//                         <Text style={styles.addrLabel}>Adresse sélectionnée</Text>
//                         <View style={styles.addrBox}>
//                             {loadingAddr ? <ActivityIndicator /> : <Text numberOfLines={2} style={styles.addrText}>{addr || "Déplace la carte pour choisir…"}</Text>}
//                         </View>
//                     </View>

//                     {/* <TouchableOpacity onPress={confirm} style={styles.cta}>
//                         <Text style={styles.ctaText}>Confirmer</Text>
//                     </TouchableOpacity> */}
//                 </View>
//             </View>
//         </Modal>
//     );
// };

// export default React.memo(MapPickerModal);

// const styles = StyleSheet.create({
//     container: { flex: 1, backgroundColor: "#fff" },
//     header: {
//         height: 64,
//         paddingHorizontal: 10,
//         paddingTop: Platform.OS === "ios" ? 12 : 6,
//         flexDirection: "row",
//         alignItems: "center",
//         justifyContent: "space-between",
//         borderBottomWidth: StyleSheet.hairlineWidth,
//         borderBottomColor: "#eee",
//     },
//     headerBtn: {
//         width: 48,
//         height: 40,
//         alignItems: "center",
//         justifyContent: "center",
//     },
//     headerConfirm: { color: "#16B84E", fontWeight: "700" },

//     searchWrap: { flex: 1, marginHorizontal: 8, position: "relative" },
//     searchInput: {
//         height: 40,
//         backgroundColor: "#f7f7f8",
//         borderRadius: 8,
//         paddingHorizontal: 12,
//         fontSize: 14,
//     },
//     searchSpinner: { position: "absolute", right: 8, top: 8 },

//     suggestionsContainer: {
//         position: "absolute",
//         top: 64,
//         left: 12,
//         right: 12,
//         backgroundColor: "#fff",
//         zIndex: 40,
//         borderRadius: 8,
//         borderWidth: StyleSheet.hairlineWidth,
//         borderColor: "#e6e6e6",
//         shadowColor: "#000",
//         shadowOpacity: 0.08,
//         shadowRadius: 8,
//         elevation: 6,
//         paddingVertical: 6,
//     },
//     suggestionRow: { flexDirection: "row", alignItems: "center", padding: 10 },
//     suggestionText: { marginLeft: 8, fontSize: 14, color: "#111", flex: 1 },

//     pinContainer: {
//         position: "absolute",
//         top: "50%",
//         left: "50%",
//         marginLeft: -18,
//         marginTop: Platform.select({ ios: -36, android: -36 }),
//     },

//     footer: {
//         padding: 12,
//         borderTopWidth: StyleSheet.hairlineWidth,
//         borderTopColor: "#eee",
//         flexDirection: "row",
//         alignItems: "center",
//     },
//     addrLabel: { fontSize: 12, color: "#666", marginBottom: 4 },
//     addrBox: {
//         minHeight: 40,
//         padding: 8,
//         borderWidth: 1,
//         borderColor: "#ddd",
//         borderRadius: 8,
//         justifyContent: "center",
//     },
//     addrText: { color: "#111", fontSize: 14 },
//     cta: {
//         backgroundColor: "#16B84E",
//         paddingHorizontal: 16,
//         paddingVertical: 12,
//         borderRadius: 10,
//     },
//     ctaText: { color: "#fff", fontWeight: "700" },
// });
