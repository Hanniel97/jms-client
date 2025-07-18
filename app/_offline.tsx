import React from "react";
import { Image, Linking, Platform, Text, TouchableOpacity, View } from "react-native";

export default function Offline() {

    const openConnectionSettings = () => {
        if (Platform.OS === "ios") {
            // iOS : ouvre les réglages Wi-Fi
            Linking.openURL("App-Prefs:WIFI");
        } else if (Platform.OS === "android") {
            // Android : ouvre les paramètres réseau
            Linking.openSettings();
        }
    };

    return (
        <View className="flex-1 items-center justify-center bg-white px-4">
            <Image
                source={require("../assets/images/disconnected.png")}
                className="w-40 h-40 mb-6"
                resizeMode="contain"
            />
            <Text className="text-xl font-rubik-bold text-gray-800 mb-2">
                Pas de connexion Internet
            </Text>
            <Text className="text-center text-gray-600 font-rubik-regular mb-6">
                Vérifiez votre connexion et réessayez.
            </Text>
            <TouchableOpacity
                onPress={openConnectionSettings}
                className="bg-primary px-6 py-3 rounded-full"
            >
                <Text className="text-white font-rubik-medium text-base">Paramètres</Text>
            </TouchableOpacity>
        </View>
    );
}
