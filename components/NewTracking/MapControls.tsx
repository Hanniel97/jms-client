// components/MapControls.tsx
import { Icon } from "@rneui/base";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CustomButton } from "../CustomButton";

type Props = {
    onCenter: () => void;
    isFollowing: boolean;
    toggleFollow: () => void;
    isMuted: boolean;
    toggleMute: () => void;
    showTraffic: boolean;
    toggleTraffic: () => void;
    isPlaying: boolean;
    start: () => void;
    stop: () => void;
    // startLiveTracking: () => void
    // stopLiveTracking: () => void
};

const MapControls: React.FC<Props> = ({
    onCenter,
    isFollowing,
    toggleFollow,
    isMuted,
    toggleMute,
    showTraffic,
    toggleTraffic,
    isPlaying,
    start,
    stop,
    // startLiveTracking,
    // stopLiveTracking,
}) => {
    const insets = useSafeAreaInsets();

    // gestion des tips
    const [visibleTips, setVisibleTips] = useState({
        traffic: true,
        follow: true,
        recenter: true,
        tts: true,
        simulate: true
    });

    // afficher tous les tips au début puis cacher après 3s
    useEffect(() => {
        const timer = setTimeout(() => {
            setVisibleTips({ traffic: false, follow: false, recenter: false, tts: false, simulate: false });
        }, 3000);
        return () => clearTimeout(timer);
    }, []);

    // useEffect(() => {
    //     if (isPlaying) {
    //         stopLiveTracking()
    //     } else {
    //         startLiveTracking()
    //     }
    // }, [isFollowing])

    // fonction utilitaire pour afficher un tip temporaire
    const showTip = (key: keyof typeof visibleTips, duration = 2000) => {
        setVisibleTips((prev) => ({ ...prev, [key]: true }));
        setTimeout(() => {
            setVisibleTips((prev) => ({ ...prev, [key]: false }));
        }, duration);
    };

    return (
        <View
            // className="absolute top-6 left-4 right-4 flex-row justify-between items-center"
            style={{
                position: "absolute",
                right: 14,
                top: insets.top + 10,
                zIndex: 50,
                gap: 10,
                alignItems: "flex-end",
            }}
        >
            {/* <TouchableOpacity className="bg-white rounded-lg px-3 py-2 shadow" onPress={onCenter}>
                <Text className="text-sm font-semibold">Center</Text>
            </TouchableOpacity> */}

            {/* Traffic Layer */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {visibleTips.traffic && (
                    <Text style={{ backgroundColor: "#000", color: "#fff", padding: 6, borderRadius: 6, marginRight: 8, maxWidth: 180, fontFamily: "Rubik-Medium" }}>
                        Afficher/masquer le trafic
                    </Text>
                )}
                <CustomButton
                    icon={
                        <Icon
                            name="layers"
                            type="material-icons"
                            size={22}
                            color={showTraffic ? "#16B84E" : "#555"}
                        />
                    }
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={() => {
                        toggleTraffic();
                        showTip("traffic");
                    }}
                />
            </View>

            {/* Follow Mode */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {visibleTips.follow && (
                    <Text style={{ backgroundColor: "#000", color: "#fff", padding: 6, borderRadius: 6, marginRight: 8, maxWidth: 180, fontFamily: "Rubik-Medium" }}>
                        Suivre le trajet
                    </Text>
                )}
                <CustomButton
                    icon={
                        <Icon
                            name="directions"
                            type="material-icons"
                            size={22}
                            color={isFollowing ? "#16B84E" : "#555"}
                        />
                    }
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={() => {
                        toggleFollow();
                        showTip("follow");
                    }}
                />
            </View>

            {/* Recenter */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {visibleTips.recenter && (
                    <Text style={{ backgroundColor: "#000", color: "#fff", padding: 6, borderRadius: 6, marginRight: 8, maxWidth: 180, fontFamily: "Rubik-Medium" }}>
                        Recentrer la carte
                    </Text>
                )}
                <CustomButton
                    icon={
                        <Icon
                            name="my-location"
                            type="material-icons"
                            size={22}
                            color="#222"
                        />
                    }
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={() => {
                        onCenter();
                        showTip("recenter");
                    }}
                />
            </View>

            {/* TTS (voix GPS) */}
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                {visibleTips.tts && (
                    <Text style={{ backgroundColor: "#000", color: "#fff", padding: 6, borderRadius: 6, marginRight: 8, maxWidth: 180, fontFamily: "Rubik-Medium" }}>
                        {isMuted ? "Activer le son" : "Couper le son"}
                    </Text>
                )}
                <CustomButton
                    icon={
                        <Icon
                            name={isMuted ? "volume-off" : "volume-up"}
                            type="material-icons"
                            size={22}
                            color={isMuted ? "#999" : "#222"}
                        />
                    }
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={() => {
                        toggleMute();
                        showTip("tts");
                    }}
                />
            </View>

            {/* Simulation course */}
            {/* <View style={{ flexDirection: "row", alignItems: "center" }}>
                {visibleTips.simulate && (
                    <Text style={{ backgroundColor: "#000", color: "#fff", padding: 6, borderRadius: 6, marginRight: 8, maxWidth: 180, fontFamily: "Rubik-Medium" }}>
                        {!isPlaying ? "Simulation activé" : "Simulation désactivé"}
                    </Text>
                )}
                <CustomButton
                    icon={
                        <Icon
                            name={!isPlaying ? "stop" : "play"}
                            type="font-awesome"
                            size={16}
                            color={!isPlaying ? "red" : "green"}
                        />
                    }
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={() => {
                        isPlaying ? stop() : start()
                        showTip("simulate");
                    }}
                />
            </View> */}

            {/* <View className="flex-row items-center space-x-2">
                    <TouchableOpacity className="bg-white rounded-lg px-3 py-2 shadow" onPress={toggleFollow}>
                        <Text className="text-sm">{isFollowing ? "Suivi ON" : "Suivi OFF"}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity className="bg-white rounded-lg px-3 py-2 shadow" onPress={toggleMute}>
                        <Text className="text-sm">{isMuted ? "Son OFF" : "Son ON"}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity className="bg-white rounded-lg px-3 py-2 shadow" onPress={toggleTraffic}>
                        <Text className="text-sm">{showTraffic ? "Trafic ON" : "Trafic OFF"}</Text>
                    </TouchableOpacity>

                    {!isPlaying ? (
                        <TouchableOpacity className="bg-blue-600 rounded-lg px-3 py-2 shadow" onPress={start}>
                            <Text className="text-sm text-white">▶ Play</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity className="bg-red-600 rounded-lg px-3 py-2 shadow" onPress={stop}>
                            <Text className="text-sm text-white">■ Stop</Text>
                        </TouchableOpacity>
                    )}
                </View> */}
        </View>
    );
};

export default MapControls;
