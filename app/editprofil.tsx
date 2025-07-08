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

const schema = yup.object().shape({
    nom: yup.string().required("Le nom est requis"),
    prenom: yup.string().required("Le prénom est requis"),
    // sexe: yup.string().required("Le sexe est requis"),
    // birthday: yup
    //     .date()
    //     .nullable()
    //     .required('La date de naissance est requise')
    //     .max(today, 'La date ne peut pas être dans le futur')
    //     .max(maxDate, `Vous devez avoir au moins ${MIN_AGE} ans`),
    // cgu_accepte: yup.boolean().oneOf([true], "Vous devez accepter les CGU"),
});

export default function editprofil() {
    const { user, tok, setUser, } = useStore();

    const [loading, setLoading] = useState<boolean>(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            nom: user.nom,
            prenom: user.prenom,
        },
    });

    const onSubmit = async (data: any) => {
        setLoading(true)
        const res = await apiRequest({
            method: 'PUT',
            endpoint: 'updateProfil/' + user._id,
            token: tok,
            data: {
                nom: data.nom,
                prenom: data.prenom
            },
        });

        // console.log('dfdbfk jd', res)

        if (res.success === false) {
            setLoading(false)
            showError(res.message)
            return;
        }

        if (res.success === true) {
            setUser(res.data)
            setLoading(false)
            showSuccess(res.message)
            router.back()
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title={"Modifier profil"} />

            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full mt-3">
                    <Controller
                        control={control}
                        name="nom"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                // label="Nom & Prénom"
                                icon0={<Icon name="user" type='font-awesome' size={20} color="#000000" />}
                                placeholder="Entrez votre nom"
                                keyboardType="default"
                                value={value}
                                onChangeText={onChange}
                                error={errors.nom?.message}
                            />
                        )}
                    />

                    <Controller
                        control={control}
                        name="prenom"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                // label="Nom & Prénom"
                                icon0={<Icon name="user" type='font-awesome' size={20} color="#000000" />}
                                placeholder="Entrez votre prénom"
                                keyboardType="default"
                                value={value}
                                onChangeText={onChange}
                                error={errors.prenom?.message}
                            />
                        )}
                    />

                    <CustomButton
                        buttonText="Changer"
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