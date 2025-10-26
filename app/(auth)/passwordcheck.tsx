/* eslint-disable react-hooks/rules-of-hooks */
import { CustomButton } from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import { CustomTextInput } from "@/components/CustomTextInput";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import { apiRequest } from "@/services/api";
import { useWS } from "@/services/WSProvider";
import useStore from "@/store/useStore";
import { showError } from "@/utils/showToast";
import { yupResolver } from "@hookform/resolvers/yup";
import { Icon } from "@rneui/base";
import { router } from "expo-router";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Text, View } from "react-native";
import * as yup from "yup";

// Schema uniquement pour confirmer le mot de passe
const passwordSchema = yup.object().shape({
    password: yup.string().required("Mot de passe requis"),
});

export default function passwordcheck() {
    const { updateAccessToken } = useWS();
    const {user, setUser, setTok, setRefreshTok, setIsAuthenticated} = useStore();

    const [secureText, setSecureText] = useState(true);
    const [loading, setLoading] = useState(false);
    const [password, setPassword] = useState("");

    const {
        // control: passwordControl,
        handleSubmit: handlePasswordSubmit,
        formState: { errors: passwordErrors },
        setValue,
    } = useForm({
        resolver: yupResolver(passwordSchema),
        defaultValues: {
            password: "",
        },
    });

    const evaluatePassword = (text: string) => {
        setPassword(text);
        setValue("password", text);
    };

    const handlePasswordChange = async (data: any) => {
        setLoading(true);
        const res = await apiRequest({
            method: "POST",
            endpoint: "checkPassword/" + user._id,
            data: {
                password: password,
            },
        });

        // console.log(res)

        if (res.success === false) {
            setLoading(false);
            showError(res.message)
            return;
        }

        if (res.success === true) {
            setLoading(false)
            setUser(res.data)
            setTok(res.access_token)
            setRefreshTok(res.refresh_token)
            updateAccessToken();
            setIsAuthenticated(true)
            // showSuccess(res.message)
            router.replace("/(tabs)")
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title="Mot de passe" />
            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full">
                    {/* <Text className="text-sm font-['RubikBold'] text-black dark:text-white mb-2">
                        Entrer votre mot de passe
                    </Text> */}

                    <Text className="text-gray-500 font-['RubikRegular'] text-sm dark:text-white mt-2 mb-8">
                        Entrer votre mot de passe pour vous connecter.
                    </Text>

                    <CustomTextInput
                        placeholder="**********"
                        icon0={<Icon name="locked" type="fontisto" size={20} color="#000000" />}
                        icon={
                            secureText ? (
                                <Icon name="eye-off" type="feather" size={20} color="#000000" />
                            ) : (
                                <Icon name="eye" type="feather" size={20} color="#000000" />
                            )
                        }
                        IsSecureText={secureText}
                        value={password}
                        onChangeText={(text) => evaluatePassword(text)}
                        error={passwordErrors.password?.message}
                        onPress={() => setSecureText(!secureText)}
                    />

                    <CustomButton
                        buttonText="Valider"
                        loading={loading}
                        // disable={!isPasswordValid}
                        buttonClassNames={`w-full h-12 rounded-full items-center justify-center mt-6 bg-primary`}
                        textClassNames="text-white text-sm font-['RubikBold']"
                        onPress={handlePasswordSubmit(handlePasswordChange)}
                    />
                </View>
            </KeyboardAvoidWrapper>
        </View>
    );
}