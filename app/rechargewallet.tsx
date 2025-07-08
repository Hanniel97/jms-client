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
import { Text, View, Image, TouchableOpacity } from "react-native";
import * as yup from "yup";
import { Controller, useForm } from "react-hook-form";
import { CustomButton } from "@/components/CustomButton";
import { showError, showSuccess } from "@/utils/showToast";
import { useWS } from "@/services/WSProvider";

const schema = yup.object().shape({
    montant: yup
        .string()
        .required("Le montant est requis")
});

const paymentMethods = [
    {
        key: "momo",
        title: "Mtn",
        image: require("../assets/images/mtn.png"),
    },
    {
        key: "moov",
        title: "Moov",
        image: require("../assets/images/moov.png"),
    },
    {
        key: "orange",
        title: "Orange",
        image: require("../assets/images/orange.png"),
    },
];

export default function rechargewallet() {
    const { user, tok, setUser, } = useStore();

    const [loading, setLoading] = useState<boolean>(false);
    const [selectedMethod, setSelectedMethod] = useState<string>("momo");


    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(schema),
    });

    const onSubmit = async (data: any) => {
        // setLoading(true)
        // const res = await apiRequest({
        //     method: 'PUT',
        //     endpoint: 'updateProfil/' + user._id,
        //     token: tok,
        //     data: {
        //         nom: data.nom,
        //         prenom: data.prenom
        //     },
        // });

        // console.log('dfdbfk jd', res)

        // if (res.success === false) {
        //     setLoading(false)
        //     showError(res.message)
        //     return;
        // }

        // if (res.success === true) {
        //     setUser(res.data)
        //     setLoading(false)
        //     showSuccess(res.message)
        //     router.back()
        // }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title={"Recharger mon portefeuille"} />

            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full mt-3">
                    <Controller
                        control={control}
                        name="montant"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                placeholder="Montant à recharger"
                                keyboardType="numeric"
                                icon0={<Icon name="wallet" type="ionicon" size={20} color="#000000" />}
                                value={value}
                                onChangeText={onChange}
                                error={errors.montant?.message}
                            />
                        )}
                    />

                    <View className="flex-row justify-between mb-4">
                        {paymentMethods.map((method) => (
                            <TouchableOpacity
                                key={method.key}
                                onPress={() => setSelectedMethod(method.key)}
                                className={`items-center p-3 rounded-xl border w-[30%] ${selectedMethod === method.key
                                        ? "border-primary bg-primary/10"
                                        : "border-gray-300"
                                    }`}
                            >
                                <Image
                                    source={method.image}
                                    className="w-12 h-12 mb-2"
                                    resizeMode="contain"
                                />
                                <Text className="text-center font-['RubikRegular'] text-black dark:text-white text-sm mb-2">
                                    {method.title}
                                </Text>

                                {/* Radio circle */}
                                {/* <View className="w-5 h-5 rounded-full border-2 border-primary items-center justify-center">
                                    {selectedMethod === method.key && (
                                        <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                                    )}
                                </View> */}
                            </TouchableOpacity>
                        ))}
                    </View>

                    <CustomButton
                        buttonText="Recharger maintenant"
                        loading={loading}
                        buttonClassNames="bg-primary shadow-xl w-full h-12 rounded-full items-center justify-center mt-4"
                        textClassNames="text-white text-lg font-['RubikBold']"
                        onPress={handleSubmit(onSubmit)}
                    />
                </View>
            </KeyboardAvoidWrapper>
        </View>
    )
}