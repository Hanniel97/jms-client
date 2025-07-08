import { View, Text, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { ReactNode } from "react";
import { Icon } from "@rneui/themed"; // ou de ton système d’icônes habituel

interface CustomHeaderProps {
    title?: string;
    showTitle?: boolean,
    showBack?: boolean;
    right?: ReactNode;
}

const CustomHeader = ({ title, showTitle = true, showBack = true, right }: CustomHeaderProps) => {
    const router = useRouter();

    return (
        <View className="h-14 mt-7 px-3 flex-row justify-between items-center bg-white">
            <View className="flex-row items-center">
                {showBack && (
                    <TouchableOpacity
                        onPress={() => router.back()}
                        // className="h-10 w-10 rounded-xl justify-center items-center"
                        className="h-10 w-10 rounded-full bg-green-600/70 justify-center items-center border-[1px] border-gray-300"
                    >
                        <Icon name="arrow-left" type="feather" size={25} color="#FFFFFF" />
                    </TouchableOpacity>
                )}

                {showTitle && (
                    <Text className="ml-2 text-[18px] font-['RubikBold'] text-[#313742]">{title}</Text>
                )}

            </View>

            <View className="flex-row items-center space-x-2">
                {right}
            </View>
        </View>
    );
};

export default CustomHeader;
