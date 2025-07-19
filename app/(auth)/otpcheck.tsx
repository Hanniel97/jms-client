/* eslint-disable react-hooks/rules-of-hooks */
import { CustomButton } from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import { OtpInput } from "react-native-otp-entry";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
// import { AntDesign, Entypo, FontAwesome } from "@expo/vector-icons";
import { yupResolver } from "@hookform/resolvers/yup";
import { router } from "expo-router";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import * as yup from "yup";
import { showError, showSuccess } from "@/utils/showToast";

const otpSchema = yup.object().shape({
    code: yup.string().length(6, "Le code doit contenir 6 chiffres").required("Le code est requis"),
});

export default function otpcheck() {
    const { setUser } = useStore()

    const [loading, setLoading] = useState<boolean>(false);

    const {
        control: otpControl,
        handleSubmit: handleOtpSubmit,
        setValue: setOtpValue,
        formState: { errors: otpErrors },
    } = useForm({
        resolver: yupResolver(otpSchema),
    });

    const handleOTP = async (data: any) => {
        setLoading(true)
        const res = await apiRequest({
            method: 'PUT',
            endpoint: 'checkCode',
            data: {
                otp: data.code,
            },
        });

        console.log(res)

        if (res.success === false) {
            setLoading(false);
            showError(res.message)
            return;
        }

        if (res.success === true) {
            setLoading(false);
            showSuccess(res.message)
            setUser(res.data);
            router.push('/(auth)/passwordadd')
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} showTitle={false} />

            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full">
                    <Text className="text-sm font-['RubikBold'] text-black dark:text-white mb-2">Entrer le code de vérification</Text>

                    <Text className="text-gray-500 font-['RubikRegular'] text-sm dark:text-white mb-8">Un code a été envoyé sur votre numéro via la méthode de vérification que vous avez choisi. Ce code expire dans 5 minutes pour votre sécurité.</Text>

                    <Controller
                        control={otpControl}
                        name="code"
                        render={({ field: { value } }) => (
                            <>
                                <OtpInput
                                    numberOfDigits={6}
                                    focusColor="green"
                                    focusStickBlinkingDuration={500}
                                    onTextChange={(text) => setOtpValue("code", text)}
                                    onFilled={(text) => setOtpValue("code", text)}
                                    secureTextEntry={false}
                                    theme={{ containerStyle: { marginTop: 0 } }}
                                />
                                {otpErrors.code?.message && (
                                    <Text className="text-[#E50506] font-['RubikRegular'] text-[14px] m-2">
                                        {otpErrors.code.message}
                                    </Text>
                                )}
                            </>
                        )}
                    />

                    <CustomButton
                        buttonText="Valider"
                        loading={loading}
                        buttonClassNames="bg-primary w-full h-12 rounded-full items-center justify-center mt-4"
                        textClassNames="text-white text-sm font-['RubikBold']"
                        onPress={handleOtpSubmit(handleOTP)}
                    />
                </View>
            </KeyboardAvoidWrapper>
        </View>
    )
}