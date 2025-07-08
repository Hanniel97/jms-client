/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import React, { useState } from "react";
import { View } from "react-native";
import { apiRequest } from "@/services/api";
import { showError, showSuccess } from "@/utils/showToast";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import useStore from "@/store/useStore";
import { CustomTextInput } from "@/components/CustomTextInput";
import { Icon } from "@rneui/base";
import { CustomButton } from "@/components/CustomButton";
import { router } from "expo-router";

const passwordSchema = yup.object().shape({
    oldPassword: yup.string().required("L'ancien mot de passe requis"),
    password: yup
        .string()
        .required("Nouveau mot de passe requis"),
        // .min(8, "Le mot de passe doit contenir au moins 8 caractères")
        // .matches(/[a-z]/, "Le mot de passe doit contenir au moins une lettre minuscule")
        // .matches(/[A-Z]/, "Le mot de passe doit contenir au moins une lettre majuscule")
        // .matches(/\d/, "Le mot de passe doit contenir au moins un chiffre")
        // .matches(
        //     /[@$!%*?&#^()_\-+=]/,
        //     "Le mot de passe doit contenir au moins un caractère spécial (@$!%*?&#^()-_=+)"
        // ),
    confirmPassword: yup
        .string()
        .oneOf([yup.ref("password")], "Les mots de passe ne correspondent pas")
        .required("Confirmation requise"),
});

export default function changepassword() {
    const { user, tok } = useStore();

    const [secureText, setSecureText] = useState(true);
    const [secureText2, setSecureText2] = useState(true);
    const [secureText3, setSecureText3] = useState(true);
    const [loading, setLoading] = useState(false);

    const {
        control: passwordControl,
        handleSubmit: handlePasswordSubmit,
        formState: { errors: passwordErrors },
    } = useForm({
        resolver: yupResolver(passwordSchema),
        defaultValues: {
            oldPassword: "",
            password: "",
            confirmPassword: "",
        },
    });

    const handlePasswordChange = async (data: any) => {
        setLoading(true);
        const res = await apiRequest({
            method: "PUT",
            endpoint: "updatePassword/" + user._id,
            token: tok,
            data: {
                oldPassword: data.oldPassword,
                newPassword: data.password,
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
            router.back();
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title={"Changer mot de passe"} />

            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full mt-3">
                    <Controller
                        control={passwordControl}
                        name="oldPassword"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                placeholder="Entrer ancien mot de passe"
                                icon0={<Icon name="locked" type="fontisto" size={20} color="#000000" />}
                                icon={
                                    secureText ? (
                                        <Icon name="eye-off" type="feather" size={20} color="#000000" />
                                    ) : (
                                        <Icon name="eye" type="feather" size={20} color="#000000" />
                                    )
                                }
                                IsSecureText={secureText}
                                value={value}
                                onChangeText={onChange}
                                error={passwordErrors.oldPassword?.message}
                                onPress={() => setSecureText(!secureText)}
                            />
                        )}
                    />
                    <Controller
                        control={passwordControl}
                        name="password"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                placeholder="Nouveau mot de passe"
                                icon0={<Icon name="locked" type="fontisto" size={20} color="#000000" />}
                                icon={
                                    secureText2 ? (
                                        <Icon name="eye-off" type="feather" size={20} color="#000000" />
                                    ) : (
                                        <Icon name="eye" type="feather" size={20} color="#000000" />
                                    )
                                }
                                IsSecureText={secureText2}
                                value={value}
                                onChangeText={onChange}
                                error={passwordErrors.password?.message}
                                onPress={() => setSecureText2(!secureText2)}
                            />
                        )}
                    />
                    <Controller
                        control={passwordControl}
                        name="confirmPassword"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                placeholder="Confirmation du mot de passe"
                                icon0={<Icon name="locked" type="fontisto" size={20} color="#000000" />}
                                icon={
                                    secureText3 ? (
                                        <Icon name="eye-off" type="feather" size={20} color="#000000" />
                                    ) : (
                                        <Icon name="eye" type="feather" size={20} color="#000000" />
                                    )
                                }
                                IsSecureText={secureText3}
                                value={value}
                                onChangeText={onChange}
                                error={passwordErrors.confirmPassword?.message}
                                onPress={() => setSecureText3(!secureText3)}
                            />
                        )}
                    />

                    <CustomButton
                        buttonText="Changer"
                        loading={loading}
                        buttonClassNames={`w-full h-12 rounded-full items-center justify-center mt-6 bg-primary shadow-xl`}
                        textClassNames="text-white text-lg font-['RubikBold']"
                        onPress={handlePasswordSubmit(handlePasswordChange)}
                    />
                </View>
            </KeyboardAvoidWrapper>
        </View>
    )
}