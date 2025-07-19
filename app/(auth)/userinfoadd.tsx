/* eslint-disable react-hooks/rules-of-hooks */
import BottomModal from "@/components/BottomModal";
import { CustomButton } from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import { CustomTextInput } from "@/components/CustomTextInput";
import DateOfBirthPicker from "@/components/DayOfBirthPicker";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
import { showError, showSuccess } from "@/utils/showToast";
import { yupResolver } from "@hookform/resolvers/yup";
import { Icon } from "@rneui/base";
import { router } from "expo-router";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TouchableOpacity, View } from "react-native";
import * as yup from "yup";

// const MIN_AGE = 18;
// const today = new Date();
// const maxDate = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());

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
    cgu_accepte: yup.boolean().oneOf([true], "Vous devez accepter les CGU"),
});

export default function userinfoadd() {
    const {user, setUser, setTok, setRefreshTok, setIsAuthenticated} = useStore();

    const [loading, setLoading] = useState<boolean>(false);
    const [showSexeModal, setShowSexeModal] = useState(false);

    const {
        control,
        handleSubmit,
        // setValue,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(schema),
    });

    // const handleSexeSelect = (value: string) => {
    //     setValue("sexe", value, { shouldValidate: true });
    //     setShowSexeModal(false);
    // };

    const onSubmit = async (data: any) => {
        // console.log(data)
        setLoading(true)
        const res = await apiRequest({
            method: 'PUT',
            endpoint: 'addInfo/' + user._id,
            data: {
                nom: data.nom,
                prenom: data.prenom,
                // sexe: data.sexe,
                // birthday: data.birthday,
            },
        });

        // console.log(res)

        if (res.success === false) {
            setLoading(false)
            showError(res.message)
            return;
        }

        if (res.success === true) {
            setLoading(false)
            setUser(res.data)
            setTok(res.access_token)
            setRefreshTok(res.refresh_token)
            setIsAuthenticated(true)
            showSuccess(res.message)
            router.replace("/(tabs)")
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} showTitle={false} />
            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full">
                    <Text className="text-sm font-['RubikBold'] text-black dark:text-white mb-2">
                        Dites-nous un peu plus sur vous
                    </Text>

                    <Text className="text-gray-500 font-['RubikRegular'] text-sm dark:text-white mb-8">
                        Renseigner les champs suivants pour nous permettre de vous connaître et de créer votre profil
                    </Text>

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

                    {/* <Controller
                        control={control}
                        name="sexe"
                        render={({ field: { value } }) => (
                            <View className="mb-4">
                                <Text className="text-black dark:text-white font-semibold mb-1 text-sm">Téléphone</Text>
                                <Pressable
                                    onPress={() => setShowSexeModal(true)}
                                    className="w-full bg-gray-200/20 border border-gray-200 rounded-xl h-[55px] p-1  mb-1 flex items-center flex-row">
                                    <View className="flex items-center justify-center h-[38px] w-[38px]">
                                        <Icon name="intersex" type='fontisto' size={20} color="#000000" />
                                    </View>
                                    <Text className={`text-black dark:text-white ${!value && "text-gray-400"}`}>
                                        {value || "Genre"}
                                    </Text>
                                </Pressable>
                                {errors.sexe && <Text className="text-red-500 mt-1 text-sm">{errors.sexe.message}</Text>}
                            </View>
                        )}
                    />

                    <Controller
                        name="birthday"
                        control={control}
                        render={({ field: { value, onChange } }) => (
                            <View>
                                <DateOfBirthPicker date={value} onChange={onChange} />
                                <Text className={`text-red-500 text-xs ${errors.birthday?.message && "mb-4"}`}>
                                    {errors.birthday?.message}
                                </Text>
                            </View>
                        )}
                    /> */}

                    <Controller
                        control={control}
                        name="cgu_accepte"
                        defaultValue={false}
                        render={({ field: { onChange, value } }) => (
                            <Pressable onPress={() => onChange(!value)} className="mb-2">
                                <View className="flex-row items-center p-2 justify-between mb-2">
                                    <View style={{ flex: 0.8 }} className="flex-row items-center">
                                        <View className={`h-5 w-5 mr-2 border ${value ? 'bg-secondary' : 'bg-white'} border-gray-400 rounded`} />
                                        <Text numberOfLines={2} className="text-black dark:text-white text-sm w-52 font-['RubikRegular']">Je suis d'accord avec les conditions générales d'utilisation</Text>
                                    </View>

                                    <TouchableOpacity onPress={() => router.push('/policy')} style={{ flex: 0.2 }} className={`border-[1px] border-green-600 rounded-full justify-center items-center`} >
                                        <Text className="text-sm text-green-600 dark:text-white px-2 py-1 items-center font-['RubikRegular']">
                                            Lire
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {errors.cgu_accepte && <Text className="text-red-500 mt-1 text-sm font-['RubikRegular']">{errors.cgu_accepte.message}</Text>}
                            </Pressable>
                        )}
                    />

                    <CustomButton
                        buttonText="Suivant"
                        loading={loading}
                        buttonClassNames="bg-primary w-full h-12 rounded-full items-center justify-center mt-4"
                        textClassNames="text-white text-sm font-['RubikBold']"
                        onPress={handleSubmit(onSubmit)}
                    />
                </View>
            </KeyboardAvoidWrapper>

            {/* <BottomModal
                visible={showSexeModal}
                onClose={() => setShowSexeModal(false)}
                title="Sélectionner le sexe ?"
                // description="Veuillez sélectionner votre genre"
                // onFirstAction={() => handleSexeSelect("Masculin")}
                // onSecondAction={() => handleSexeSelect("Féminin")}
                content={
                    <View className="justify-between space-x-3 mt-4">
                        <CustomButton
                            buttonText="Femme"
                            // loading={loading}
                            buttonClassNames="bg-gray-200 shadow-xl w-full h-12 rounded-full items-center justify-center mt-4"
                            textClassNames="text-black text-lg font-bold"
                            onPress={() => {
                                handleSexeSelect("Feminin")
                            }}
                            icon={<Icon name="man" type="ant-design" size={22} color="#000000" />}
                        />

                        <CustomButton
                            buttonText="Homme"
                            // loading={loading}
                            buttonClassNames="bg-gray-200 shadow-xl w-full h-12 rounded-full items-center justify-center mt-4"
                            textClassNames="text-black text-lg font-bold"
                            onPress={() => {
                                handleSexeSelect("Masculin")
                            }}
                            icon={<Icon name="woman" type="ant-design" size={22} color="#000000" />}
                        />
                    </View>
                }
            /> */}
        </View>
    )
}