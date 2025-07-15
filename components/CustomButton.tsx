import { Text, Pressable, ActivityIndicator, View } from "react-native";
import React from "react";
import { CustomButtonProps } from "@/types/auth.app";


export const CustomButton: React.FC<CustomButtonProps> = ({
    onPress,
    buttonClassNames,
    textClassNames,
    buttonText,
    buttonTextSpan,
    spanClassNames,
    loading,
    disable,
    icon,
    iconPosition = "left",
}) => {
    return (
        <Pressable disabled={disable} className={`${buttonClassNames}`} onPress={onPress}>
            {loading ? (
                <ActivityIndicator size={"small"} color={"#FFFFFF"} />
            ) : (
                <View className="flex-row items-center justify-center w-full">
                    {/* Icône à gauche */}
                    {icon && iconPosition === "left" && (
                        <View className="mr-2 absolute left-3">{icon}</View>
                    )}

                    {/* Texte principal + span */}
                    <Text numberOfLines={1} adjustsFontSizeToFit className={`${textClassNames}`}>
                        {buttonText}
                        {buttonTextSpan && (
                            <Text numberOfLines={1} adjustsFontSizeToFit className={`${spanClassNames}`}>{buttonTextSpan}</Text>
                        )}
                    </Text>

                    {/* Icône à droite */}
                    {icon && iconPosition === "right" && (
                        <View className="ml-2">{icon}</View>
                    )}
                </View>
            )}
        </Pressable>
    );
};


// interface ButtonProps extends TouchableOpacityProps {
//     title: string;
//     variant?: "primary" | "secondary";
// }

// export default function Button({ title, variant = "primary", ...props }: ButtonProps) {
//     return (
//         <TouchableOpacity
//              className={`px-4 py-3 rounded-xl items-center
//                 ${variant === "primary"  && "bg-primary"} ,
//                 ${variant === "secondary" && "bg-gray-200"}`
//             }
//             {...props}
//         >
//             <Text  className={`text-white", ${variant === "secondary" && "text-black"}`}>
//                 {title}
//             </Text>
//         </TouchableOpacity>
//     );
// }
