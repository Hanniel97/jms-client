// InstructionBanner.tsx
import { Icon } from "@rneui/base";
import React from "react";
import { Dimensions, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
    instruction: string | null;
    nextStepDistance: number | null;
    remainingDistance: number;
    remainingDuration: number;
};

function formatDistance(m: number | null) {
    if (m === null) return "";
    if (m < 1000) return `${Math.round(m)} m`;
    return `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(s: number) {
    if (s < 60) return `${s}s`;
    const min = Math.round(s / 60);
    return `${min} min`;
}

const InstructionBanner: React.FC<Props> = ({
    instruction,
    nextStepDistance,
    remainingDistance,
    remainingDuration,
}) => {
    const insets = useSafeAreaInsets();

    if (!instruction) return null;

    return (
        <View
            style={{
                position: "absolute",
                top: insets.top + 24,
                left: 14,
                right: 14,
                width: Dimensions.get('screen').width * 0.75,
                alignItems: "center",
            }}
            pointerEvents="box-none"
        >
            <View
                style={{
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    backgroundColor: "#fff",
                    borderRadius: 12,
                    shadowColor: "#000",
                    shadowOpacity: 0.08,
                    shadowRadius: 6,
                    elevation: 2,
                    width: "100%",
                }}
            >
                <View style={{ justifyContent: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                            <Icon name="compass" type="feather" size={18} color="#000" />
                            <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: "600", flexShrink: 1 }}>
                                {instruction ?? "Suivre l'itinéraire"}
                            </Text>
                        </View>

                        <View style={{ marginLeft: 8, alignItems: "flex-end" }}>
                            <Text style={{ fontSize: 12, color: "#333" }}>{formatDuration(remainingDuration)}</Text>
                            {nextStepDistance != null && <Text style={{ fontSize: 11, color: "#666" }}>{formatDistance(nextStepDistance)}</Text>}
                        </View>
                    </View>

                    <Text style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
                        Arrivée dans {formatDistance(remainingDistance)}
                    </Text>
                </View>
            </View>
        </View>
    );
};

export default InstructionBanner;
