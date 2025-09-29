import { IRide } from "@/types";
import { Icon } from "@rneui/themed";
import { router } from "expo-router";
import moment from "moment";
import "moment/locale/fr";
import React, { useMemo, useState, useCallback } from "react";
import {
    Alert,
    Modal,
    Pressable,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";

moment.locale("fr");

type Props = {
    ride: IRide;
    onCancel?: (ride: IRide) => void | Promise<void>;
};

// Couleurs & libellés de statut
const statusColors: Record<string, string> = {
    SEARCHING_FOR_RIDER: "#facc15", // jaune
    ACCEPTED: "#38bdf8", // bleu clair
    ARRIVED: "#34d399", // vert clair
    VERIFIED: "#4ade80", // vert
    START: "#3b82f6", // bleu
    COMPLETED: "#6366f1", // indigo
    PAYED: "#10b981", // émeraude
};

const statusLabels: Record<string, string> = {
    SEARCHING_FOR_RIDER: "Recherche d'un chauffeur",
    ACCEPTED: "Course acceptée",
    ARRIVED: "Votre chauffeur est là",
    VERIFIED: "Confirmation de la course",
    START: "Course en cours",
    COMPLETED: "Course terminée",
    PAYED: "Course payée",
};

// Statuts autorisés à l'annulation
const CANCELLABLE = new Set(["SEARCHING_FOR_RIDER", "ACCEPTED", "ARRIVED", "VERIFIED", "START"]);

/** --- Helpers responsive (base iPhone 11 ~ 375x812) --- */
const BASE_W = 375;
const BASE_H = 812;
const hs = (size: number, w: number) => (size * w) / BASE_W;                  // horizontal scale
const vs = (size: number, h: number) => (size * h) / BASE_H;                  // vertical scale
const ms = (size: number, w: number, factor = 0.5) =>
    size + (hs(size, w) - size) * factor;                                       // moderate scale

export default function RenderEnCours({ ride, onCancel }: Props) {
    const { width, height } = useWindowDimensions();

    // Tokens responsive
    const pad = ms(14, width);
    const radius = ms(14, width);
    const gapSm = ms(6, width);
    const gapMd = ms(10, width);
    const gapLg = ms(14, width);

    const fsXs = ms(11.5, width);
    const fsSm = ms(13, width);
    const fsBase = ms(15, width);
    const fsMd = ms(16, width);

    const iconSm = ms(14, width);
    const iconMd = ms(18, width);
    const iconLg = ms(20, width);

    const chipPadV = Math.max(6, ms(6, width));
    const chipPadH = Math.max(8, ms(8, width));

    const [menuOpen, setMenuOpen] = useState(false);

    const goToDetails = () => {
        if (menuOpen) return; // évite d'ouvrir les détails quand le menu est visible
        router.push({ pathname: "/liveride", params: { id: ride._id } });
    };

    const canCancel = useMemo(() => CANCELLABLE.has(ride.status), [ride.status]);
    const dotColor = statusColors[ride.status] || "#e5e7eb";

    const doCancel = useCallback(async () => {
        try {
            if (onCancel) {
                await onCancel(ride);
            } else {
                console.warn("onCancel non fourni — branche ton API ici.");
            }
        } catch (e) {
            console.error("Annulation échouée:", e);
        }
    }, [onCancel, ride]);

    const confirmCancel = useCallback(() => {
        if (!canCancel) return;
        Alert.alert(
            "Annuler la course",
            "Es-tu sûr de vouloir annuler cette course ?",
            [
                { text: "Non", style: "cancel" },
                {
                    text: "Oui, annuler",
                    style: "destructive",
                    onPress: () => {
                        setMenuOpen(false);
                        void doCancel();
                    },
                },
            ],
            { cancelable: true }
        );
    }, [canCancel, doCancel]);

    return (
        <>
            <TouchableOpacity
                onPress={goToDetails}
                activeOpacity={0.92}
                disabled={menuOpen}
                style={{
                    position: "relative",
                    backgroundColor: "#f9fafb",
                    padding: pad,
                    borderRadius: radius,
                    marginBottom: hs(12, width),
                    borderWidth: 1,
                    borderColor: "rgba(59,130,246,0.15)", // primary/20
                }}
            >
                {/* Header: statut + date + menu */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginBottom: gapMd,
                    }}
                >
                    {/* Group statut (puce + libellé) */}
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                        <View
                            style={{
                                width: hs(10, width),
                                height: hs(10, width),
                                borderRadius: hs(5, width),
                                backgroundColor: dotColor,
                                marginRight: gapSm,
                            }}
                        />
                        <View
                            style={{
                                paddingVertical: chipPadV,
                                paddingHorizontal: chipPadH,
                                backgroundColor: "white",
                                borderRadius: hs(999, width),
                                borderWidth: 1,
                                borderColor: "rgba(0,0,0,0.06)",
                            }}
                        >
                            <Text
                                numberOfLines={1}
                                style={{
                                    fontSize: fsMd,
                                    fontWeight: "700",
                                    color: "#1e3a8a",
                                }}
                            >
                                {statusLabels[ride.status] || "--"}
                            </Text>
                        </View>
                    </View>

                    {/* Date */}
                    <Text
                        numberOfLines={1}
                        style={{
                            fontSize: fsXs,
                            color: "#6b7280",
                            marginRight: gapSm,
                            maxWidth: "52%",
                            textAlign: "right",
                        }}
                    >
                        {moment(ride.createdAt).calendar()}
                    </Text>

                    {/* Bouton menu (kebab) */}
                    <TouchableOpacity
                        onPress={() => setMenuOpen(true)}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel="Ouvrir le menu de la course"
                        style={{
                            width: hs(36, width),
                            height: hs(36, width),
                            borderRadius: hs(18, width),
                            alignItems: "center",
                            justifyContent: "center",
                            backgroundColor: "#ffffff",
                            elevation: 2,
                            shadowColor: "#000",
                            shadowOpacity: 0.12,
                            shadowRadius: 4,
                            shadowOffset: { width: 0, height: 2 },
                        }}
                    >
                        <Icon name="more-vertical" type="feather" size={iconMd} color="#111827" />
                    </TouchableOpacity>
                </View>

                {/* Bloc adresses */}
                <View style={{ gap: gapSm }}>
                    {/* Départ */}
                    <View style={{ marginBottom: gapSm }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: hs(2, width) }}>
                            <Icon name="flag" type="feather" size={iconSm} color="#6b7280" />
                            <Text style={{ fontSize: fsXs, color: "#6b7280", marginLeft: hs(6, width) }}>Départ</Text>
                        </View>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{ fontSize: fsBase, fontWeight: "600", color: "#374151" }}
                        >
                            {ride.pickup?.address}
                        </Text>
                    </View>

                    {/* Destination */}
                    <View>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: hs(2, width) }}>
                            <Icon name="map-pin" type="feather" size={iconSm} color="#6b7280" />
                            <Text style={{ fontSize: fsXs, color: "#6b7280", marginLeft: hs(6, width) }}>
                                Destination
                            </Text>
                        </View>
                        <Text
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            style={{ fontSize: fsBase, fontWeight: "600", color: "#374151" }}
                        >
                            {ride.drop?.address}
                        </Text>
                    </View>
                </View>

                {/* Ligne chauffeur */}
                <View
                    style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: gapLg,
                    }}
                >
                    <Text style={{ fontSize: fsSm, color: "#4b5563" }}>Chauffeur</Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <Icon name="user" type="feather" size={iconSm} color="#1e3a8a" />
                        <Text
                            numberOfLines={1}
                            style={{
                                fontSize: fsSm,
                                fontWeight: "700",
                                color: "#1e3a8a",
                                marginLeft: hs(6, width),
                                maxWidth: "78%",
                                textAlign: "right",
                            }}
                        >
                            {ride.rider ? `${ride.rider?.prenom} ${ride.rider?.nom}` : "--"}
                        </Text>
                    </View>
                </View>
            </TouchableOpacity>

            {/* --- Bottom Sheet Menu (responsive) --- */}
            <Modal
                visible={menuOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setMenuOpen(false)}
            >
                {/* Backdrop */}
                <Pressable
                    onPress={() => setMenuOpen(false)}
                    style={{
                        flex: 1,
                        backgroundColor: "rgba(0,0,0,0.25)",
                    }}
                />

                {/* Sheet */}
                <View
                    style={{
                        paddingHorizontal: hs(16, width),
                        paddingBottom: Math.max(vs(18, height), 18),
                        backgroundColor: "rgba(0,0,0,0.25)",
                    }}
                >
                    <View
                        style={{
                            backgroundColor: "#ffffff",
                            borderTopLeftRadius: hs(18, width),
                            borderTopRightRadius: hs(18, width),
                            paddingVertical: vs(8, height),
                            paddingHorizontal: hs(8, width),
                            elevation: 12,
                            shadowColor: "#000",
                            shadowOpacity: 0.25,
                            shadowRadius: 12,
                            shadowOffset: { width: 0, height: 6 },
                        }}
                    >
                        {/* Handler */}
                        <View
                            style={{
                                alignSelf: "center",
                                width: hs(40, width),
                                height: vs(5, height),
                                borderRadius: hs(10, width),
                                backgroundColor: "#e5e7eb",
                                marginBottom: vs(6, height),
                            }}
                        />

                        {/* Annuler */}
                        <Pressable
                            disabled={!canCancel}
                            onPress={confirmCancel}
                            style={({ pressed }) => ({
                                opacity: canCancel ? (pressed ? 0.7 : 1) : 0.45,
                                paddingVertical: vs(14, height),
                                paddingHorizontal: hs(12, width),
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                            })}
                            accessibilityRole="button"
                            accessibilityLabel="Annuler la course"
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", margin: 5 }}>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Icon name="x-circle" type="feather" size={iconLg} color={canCancel ? "#dc2626" : "#6b7280"} />
                                    <Text
                                        style={{
                                            marginLeft: hs(10, width),
                                            fontSize: fsMd,
                                            fontWeight: "700",
                                            color: canCancel ? "#dc2626" : "#6b7280",
                                        }}
                                    >
                                        Annuler la course
                                    </Text>
                                </View>

                                {/* <Icon name="chevron-right" type="feather" size={iconMd} color={canCancel ? "#dc2626" : "#9ca3af"} /> */}
                            </View>
                        </Pressable>

                        {/* Séparateur */}
                        <View style={{ height: 1, backgroundColor: "#f3f4f6" }} />

                        {/* Fermer */}
                        <Pressable
                            onPress={() => setMenuOpen(false)}
                            style={({ pressed }) => ({
                                opacity: pressed ? 0.7 : 1,
                                paddingVertical: vs(14, height),
                                paddingHorizontal: hs(12, width),
                                flexDirection: "row",
                                alignItems: "center",
                                justifyContent: "space-between",
                            })}
                            accessibilityRole="button"
                            accessibilityLabel="Fermer le menu"
                        >
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", margin: 5 }}>
                                <View style={{ flexDirection: "row", alignItems: "center" }}>
                                    <Icon name="x" type="feather" size={iconLg} color="#111827" />
                                    <Text
                                        style={{
                                            marginLeft: hs(10, width),
                                            fontSize: fsMd,
                                            fontWeight: "700",
                                            color: "#111827",
                                        }}
                                    >
                                        Fermer
                                    </Text>
                                </View>

                                {/* <Icon name="chevron-right" type="feather" size={iconMd} color="#9ca3af" /> */}
                            </View>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </>
    );
}






// import { IRide } from "@/types";
// import { Icon } from "@rneui/themed";
// import { router } from "expo-router";
// import moment from 'moment';
// import 'moment/locale/fr';
// import React from "react";
// import { Text, TouchableOpacity, View } from "react-native";

// moment.locale('fr');

// type Props = {
//     ride: IRide;
// };

// // Map de status vers couleur
// const statusColors: Record<string, string> = {
//     SEARCHING_FOR_RIDER: "#facc15",   // jaune
//     ACCEPTED: "#38bdf8",              // bleu clair
//     ARRIVED: "#34d399",               // vert clair
//     VERIFIED: "#4ade80",              // vert
//     START: "#3b82f6",                 // bleu
//     COMPLETED: "#6366f1",             // indigo
//     PAYED: "#10b981",                 // émeraude
// };

// const statusLabels: Record<string, string> = {
//     SEARCHING_FOR_RIDER: "Recherche d'un chauffeur",
//     ACCEPTED: "Course acceptée",
//     ARRIVED: "Votre chauffeur est là",
//     VERIFIED: "Confirmation de la course",
//     START: "Course en cours",
//     COMPLETED: "Course terminée",
//     PAYED: "Course payée",
// };

// export default function RenderEnCours({ ride }: Props) {
//     const goToDetails = () => {
//         router.push({ pathname: '/liveride', params: { id: ride._id } });
//     };

//     const dotColor = statusColors[ride.status] || "#e5e7eb"; // gris par défaut

//     return (
//         <TouchableOpacity
//             onPress={goToDetails}
//             className="relative bg-gray-50 gap-3 p-4 rounded-lg mb-3 border border-primary/20"
//         >
//             {/* Petit point coloré dans le coin */}
//             <View
//                 style={{
//                     width: 12,
//                     height: 12,
//                     borderRadius: 6,
//                     backgroundColor: dotColor,
//                     position: "absolute",
//                     top: 5,
//                     right: 5,
//                 }}
//             />

//             <View className="flex-row justify-between items-center mb-2">
//                 <View className="">
//                     <Text numberOfLines={1} adjustsFontSizeToFit className="text-base font-semibold text-blue-900">
//                         {statusLabels[ride.status] || "--"}
//                     </Text>
//                 </View>
//                 <View style={{ flex: 0.5 }}>
//                     <Text numberOfLines={1} adjustsFontSizeToFit className="text-xs text-gray-500">
//                         {moment(ride.createdAt).calendar()}
//                     </Text>
//                 </View>

//             </View>

//             <View className="mb-1">
//                 <Text className="text-gray-500 text-sm">Départ</Text>
//                 <Text className="text-sm font-semibold text-gray-700">
//                     {ride.pickup.address}
//                 </Text>
//             </View>

//             <View className="mb-1">
//                 <Text className="text-gray-500 text-sm">Destination</Text>
//                 <Text className="text-sm font-semibold text-gray-700">
//                     {ride.drop.address}
//                 </Text>
//             </View>

//             <View className="flex-row justify-between items-center mt-3">
//                 <Text className="text-sm text-gray-600">Chauffeur </Text>
//                 <View className="flex-row items-center space-x-1">
//                     <Icon name="user" type="feather" size={16} color="#1e3a8a" />
//                     <Text className="text-sm font-semibold text-blue-900">
//                         {ride.rider ? `${ride.rider?.prenom} ${ride.rider?.nom}` : "--"}
//                     </Text>
//                 </View>
//             </View>
//         </TouchableOpacity>
//     );
// }
