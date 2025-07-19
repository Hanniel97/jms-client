/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
import { CustomTextInput } from "@/components/CustomTextInput";
import { yupResolver } from "@hookform/resolvers/yup";
import { Icon } from "@rneui/base";
import { router } from "expo-router";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import * as yup from "yup";
import { CustomButton } from "@/components/CustomButton";
import { showError, showSuccess } from "@/utils/showToast";

// Schema uniquement pour confirmer le mot de passe
const passwordSchema = yup.object().shape({
    password: yup.string().required("Mot de passe requis"),
    confirmPassword: yup
        .string()
        .oneOf([yup.ref("password")], "Les mots de passe ne correspondent pas")
        .required("Confirmation requise"),
});

export default function passwordadd() {
    const { user, setUser } = useStore();

    const [secureText, setSecureText] = useState(true);
    const [secureText2, setSecureText2] = useState(true);
    const [loading, setLoading] = useState(false);
    // const [password, setPassword] = useState("");

    // État pour les critères
    // const [passwordCriteria, setPasswordCriteria] = useState({
    //     length: false,
    //     uppercase: false,
    //     lowercase: false,
    //     number: false,
    //     special: false,
    // });

    // const isPasswordValid = Object.values(passwordCriteria).every(Boolean);

    const {
        control: passwordControl,
        handleSubmit: handlePasswordSubmit,
        formState: { errors: passwordErrors },
        // setValue,
    } = useForm({
        resolver: yupResolver(passwordSchema),
        // defaultValues: {
        //     password: "",
        //     confirmPassword: "",
        // },
    });

    // const evaluatePassword = (text: string) => {
    //     setPassword(text);
    //     setValue("password", text);
    //     setPasswordCriteria({
    //         length: text.length >= 8,
    //         uppercase: /[A-Z]/.test(text),
    //         lowercase: /[a-z]/.test(text),
    //         number: /\d/.test(text),
    //         special: /[@$!%*?&]/.test(text),
    //     });
    // };

    const handlePasswordChange = async (data: any) => {
        // console.log(password)
        setLoading(true);
        const res = await apiRequest({
            method: "PUT",
            endpoint: "addPassword/" + user._id,
            data: {
                password: data.password,
            },
        });

        // console.log(res)

        if (res.success === false) {
            setLoading(false);
            showError(res.message)
            return;
        }

        if (res.success === true) {
            setLoading(false);
            setUser(res.data);
            showSuccess(res.message)
            router.replace("/(auth)/userinfoadd");
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} showTitle={false} />
            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full">
                    <Text className="text-sm font-['RubikBold'] text-black dark:text-white mb-2">
                        Définissez votre mot de passe
                    </Text>

                    <Text className="text-gray-500 font-['RubikRegular'] text-sm dark:text-white mb-8">
                        Créez un mot de passe sécurisé. Vous en aurez besoin pour vous connecter à votre compte.
                    </Text>

                    {/* <CustomTextInput
                        placeholder="Mot de passe"
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
                    /> */}

                    <Controller
                        control={passwordControl}
                        name="password"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                placeholder="Mot de passe"
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
                                error={passwordErrors.password?.message}
                                onPress={() => setSecureText(!secureText)}
                            />
                        )}
                    />

                    {/* Champ de confirmation */}
                    <Controller
                        control={passwordControl}
                        name="confirmPassword"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                placeholder="Confirmation du mot de passe"
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
                                error={passwordErrors.confirmPassword?.message}
                                onPress={() => setSecureText2(!secureText2)}
                            />
                        )}
                    />

                    {/* Liste des critères */}
                    {/* <View className="mt-4 space-y-2">
                        <Text className="font-semibold text-black dark:text-white">
                            Le mot de passe doit contenir :
                        </Text>

                        {[
                            { label: "au moins un chiffre [0-9]", key: "number" },
                            { label: "au moins un caractère majuscule [A-Z]", key: "uppercase" },
                            { label: "au moins un caractère minuscule [a-z]", key: "lowercase" },
                            { label: "au moins un caractère spécial (@$!%*?&)", key: "special" },
                            { label: "au moins 8 caractères", key: "length" },

                        ].map(({ label, key }) => (
                            <View key={key} className="flex-row items-center space-x-2">
                                <Icon
                                    name={passwordCriteria[key as keyof typeof passwordCriteria] ? "check-circle" : "circle"}
                                    type="feather"
                                    color={passwordCriteria[key as keyof typeof passwordCriteria] ? "green" : "gray"}
                                    size={18}
                                />
                                <Text className="text-sm text-black dark:text-white">{label}</Text>
                            </View>
                        ))}
                    </View> */}

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