/* eslint-disable react-hooks/rules-of-hooks */
import { CustomButton } from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import { CustomTextInputReview } from "@/components/CustomTextInput";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import useStore from "@/store/useStore";
import { yupResolver } from "@hookform/resolvers/yup";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
import * as yup from "yup";

const schema = yup.object().shape({
    message: yup.string().required("Le message est requis"),
});

export default function contactus() {
    const { user, tok, setUser, } = useStore();

    const [loading, setLoading] = useState<boolean>(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            message: "",
        },
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
            <CustomHeader showBack={true} title={"Nous contacter"} />

            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full mt-3">
                    <Text className="text-sm font-['RubikBold'] self-center text-black dark:text-white mb-2">Adresse</Text>

                    <Text className="text-gray-500 text-center font-['RubikMedium'] text-sm dark:text-white mb-8"></Text>

                    <Controller
                        control={control}
                        name="message"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInputReview
                                // label="Nom & Prénom"
                                // icon0={<Icon name="user" type='font-awesome' size={20} color="#000000" />}
                                placeholder="Taper votre message"
                                keyboardType="default"
                                value={value}
                                onChangeText={onChange}
                                error={errors.message?.message}
                            />
                        )}
                    />

                    <CustomButton
                        buttonText="Envoyer"
                        loading={loading}
                        buttonClassNames="bg-primary h-12 rounded-full items-center justify-center mt-4"
                        textClassNames="text-white text-sm font-['RubikBold']"
                        onPress={handleSubmit(onSubmit)}
                    />
                </View>
            </KeyboardAvoidWrapper>
        </View>
    )
}