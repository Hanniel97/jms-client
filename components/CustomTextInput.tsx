import { InputProps, InputsReviewProps, InputsSearchProps, LocationInputProps } from "@/types/auth.app";
import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";

export const CustomTextInput: React.FC<InputProps> = ({ label, onChangeText, icon0, icon, IsSecureText, keyboardType, placeholder, onPress, value, error, country }) => {
    return (
        <View className="flex justify-start w-full mb-4">
            {
                label && (
                    <Text className="text-[#000000] font-['RubikRegular'] mb-1 text-[13px]">{label}</Text>
                )
            }

            <View className="w-full bg-gray-200/20 border border-gray-200 rounded-xl h-[55px] p-1 flex justify-center items-center flex-row">
                {icon0 && (
                    <View className="flex items-center justify-center h-[38px] w-[38px]">
                        {icon0}
                    </View>
                )}

                {
                    country && (
                        <Text className="text-black dark:text-white font-['RubikRegular'] text-base mr-2">{country}</Text>
                    )
                }

                <TextInput className="flex flex-1 font-['RubikRegular'] bg-transparent text-md text-['#000'] h-[50px] pl-2"
                    onChangeText={onChangeText} secureTextEntry={IsSecureText} keyboardType={keyboardType} placeholder={placeholder}
                    placeholderTextColor={"gray"} autoCapitalize="none" value={value}
                />

                <Pressable onPress={onPress}>
                    {icon && (
                        <View className="flex items-center justify-center h-[38px] w-[38px]">
                            {icon}
                        </View>
                    )}
                </Pressable>


            </View>

            {error && (
                <Text className="text-red-500 text-xs mt-1 font-['RubikRegular']">{error}</Text>
            )}
        </View>
    )
}

export const CustomTextInputSearch: React.FC<InputsSearchProps> = ({ onPress, onChangeText, onSubmitEditing, icon, keyboardType, placeholder, label, value, IsSecureText, multiline, editable }) => {
    return (
        <View className="flex justify-start w-full mb-2 mt-1">
            {
                label && (
                    // <Text className="text-[#000000] font-['RubikRegular'] my-1 text-[13px] mx-3"> {label} </Text>
                    <Text className="text-[#000000] font-['RubikRegular'] mb-1 text-[13px]">{label}</Text>
                )
            }

            <View className="border-[1px] bg-[#009B9B]/10 border-[#009B9B]/50 rounded-lg h-[55px] p-1 flex justify-center items-center flex-row mx-3">
                <TextInput className="flex flex-1 font-['RubikRegular'] bg-transparent text-md text-['#000000'] h-[50px] pl-2"
                    onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder} value={value} secureTextEntry={IsSecureText} multiline={multiline} onSubmitEditing={onSubmitEditing}
                    placeholderTextColor={"gray"} editable={editable}
                />

                <Pressable onPress={onPress}>
                    {icon && (
                        <View className="flex items-center justify-center h-[38px] w-[38px]">
                            {icon}
                        </View>
                    )}
                </Pressable>
            </View>
        </View>


    )
}

export const CustomTextInputReview: React.FC<InputsReviewProps> = ({ onPress, onChangeText, icon, keyboardType, placeholder, value, error, }) => {
    return (
        <View className="flex justify-start w-full mb-2">
            <View className="bg-gray-200/20 border border-gray-200 rounded-xl h-24 p-1 flex justify-center items-center flex-row mt-1">
                <TextInput className="flex flex-1 font-['RubikRegular'] bg-transparent text-md text-['#000000'] h-[50px] pl-2"
                    onChangeText={onChangeText} keyboardType={keyboardType} placeholder={placeholder}
                    placeholderTextColor={"gray"}
                    numberOfLines={3}
                    multiline={true}
                    maxLength={150}
                    value={value}
                />

                <Pressable onPress={onPress}>
                    {icon && (
                        <View className="flex items-center justify-center h-[38px] w-[38px]">
                            {icon}
                        </View>
                    )}
                </Pressable>
            </View>

            {error && (
                <Text className="text-red-500 text-xs mt-1 font-['RubikRegular']">{error}</Text>
            )}
        </View>
    )
}

export const CustomLocationTextInput: React.FC<LocationInputProps> = ({ onChangeText, placeholder, value, onFocus, ...props }) => {
    return (
        <View className=" bg-gray-200/20 border border-gray-200 rounded-lg h-[50px] p-1 justify-center items-center w-full">
            <TextInput className="w-full font-['RubikRegular'] bg-transparent text-md text-['#000000']"
                onChangeText={onChangeText} keyboardType={"default"} placeholder={placeholder} value={value}
                placeholderTextColor={"gray"} onFocus={onFocus}
            />
        </View>
    )
}