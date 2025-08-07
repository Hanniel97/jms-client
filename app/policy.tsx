/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import React from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView from "react-native-webview";

export default function policy() {
    const insets = useSafeAreaInsets();

    return (
        <View style={{ marginBottom: insets.bottom }} className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title={"Politique de confidentialité"} />
            <WebView
                source={{ uri: "https://jmstracking-ci.com/privacy-policy#" }}
                originWhitelist={["*"]}
            />
        </View>
    )
}