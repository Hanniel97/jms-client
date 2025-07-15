import { IRide } from "@/types";
import { Icon } from "@rneui/themed";
import { router } from "expo-router";
import moment from 'moment';
import 'moment/locale/fr';
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

moment.locale('fr');

type Props = {
    ride: IRide;
};

// Map de status vers couleur
const statusColors: Record<string, string> = {
    SEARCHING_FOR_RIDER: "#facc15",   // jaune
    ACCEPTED: "#38bdf8",              // bleu clair
    ARRIVED: "#34d399",               // vert clair
    VERIFIED: "#4ade80",              // vert
    START: "#3b82f6",                 // bleu
    COMPLETED: "#6366f1",             // indigo
    PAYED: "#10b981",                 // émeraude
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

export default function RenderEnCours({ ride }: Props) {
    const goToDetails = () => {
        router.push({ pathname: '/liveride', params: { id: ride._id } });
    };

    const dotColor = statusColors[ride.status] || "#e5e7eb"; // gris par défaut

    return (
        <TouchableOpacity
            onPress={goToDetails}
            className="relative bg-gray-50 gap-3 p-4 rounded-lg mb-3 border border-primary/20"
        >
            {/* Petit point coloré dans le coin */}
            <View
                style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    backgroundColor: dotColor,
                    position: "absolute",
                    top: 5,
                    right: 5,
                }}
            />

            <View className="flex-row justify-between items-center mb-2">
                <View className="">
                    <Text numberOfLines={1} adjustsFontSizeToFit className="text-base font-semibold text-blue-900">
                        {statusLabels[ride.status] || "--"}
                    </Text>
                </View>
                <View style={{ flex: 0.5 }}>
                    <Text numberOfLines={1} adjustsFontSizeToFit className="text-xs text-gray-500">
                        {moment(ride.createdAt).calendar()}
                    </Text>
                </View>

            </View>

            <View className="mb-1">
                <Text className="text-gray-500 text-sm">Départ</Text>
                <Text className="text-sm font-semibold text-gray-700">
                    {ride.pickup.address}
                </Text>
            </View>

            <View className="mb-1">
                <Text className="text-gray-500 text-sm">Destination</Text>
                <Text className="text-sm font-semibold text-gray-700">
                    {ride.drop.address}
                </Text>
            </View>

            <View className="flex-row justify-between items-center mt-3">
                <Text className="text-sm text-gray-600">Chauffeur </Text>
                <View className="flex-row items-center space-x-1">
                    <Icon name="user" type="feather" size={16} color="#1e3a8a" />
                    <Text className="text-sm font-semibold text-blue-900">
                        {ride.rider ? `${ride.rider?.prenom} ${ride.rider?.nom}` : "--"}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
}
