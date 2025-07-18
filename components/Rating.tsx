// components/Rating.tsx
import React, { useState } from "react";
import { View, TouchableOpacity } from "react-native";
import { FontAwesome } from "@expo/vector-icons";

interface RatingProps {
    value?: number;
    onChange: (rating: number) => void;
    size?: number;
    editable?: boolean;
}

export default function Rating({
    value = 0,
    onChange,
    size = 32,
    editable = true,
}: RatingProps) {
    const [hovered, setHovered] = useState<number | null>(null);

    return (
        <View className="flex-row justify-center items-center">
            {[1, 2, 3, 4, 5].map((star) => {
                const filled = hovered ? star <= hovered : star <= value;

                return (
                    <TouchableOpacity
                        key={star}
                        disabled={!editable}
                        onPress={() => onChange(star)}
                        onPressIn={() => setHovered(star)}
                        onPressOut={() => setHovered(null)}
                        activeOpacity={0.7}
                    >
                        <FontAwesome
                            name={filled ? "star" : "star-o"}
                            size={size}
                            color={filled ? "#facc15" : "#d1d5db"} // jaune & gris
                            style={{ marginHorizontal: 4 }}
                        />
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}
