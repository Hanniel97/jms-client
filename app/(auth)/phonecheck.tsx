/* eslint-disable react-hooks/rules-of-hooks */
import BottomModal from "@/components/BottomModal";
import { CustomButton } from "@/components/CustomButton";
import { CustomTextInput } from "@/components/CustomTextInput";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
// import { AntDesign, Entypo, FontAwesome } from "@expo/vector-icons";
import { showError, showSuccess } from "@/utils/showToast";
import { yupResolver } from "@hookform/resolvers/yup";
import { Icon } from "@rneui/base";
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Image, Text, View } from "react-native";
import CountryPicker, {
    Country,
} from "react-native-country-picker-modal";
import * as yup from "yup";

const schema = yup.object().shape({
    phone: yup
        .string()
        .required("Le numéro est requis")
        .min(8, "Le numéro est trop court"),
});

export default function phonecheck() {
    const { setUser } = useStore()

    const [loading, setLoading] = useState<boolean>(false);
    const [method, setMethode] = useState<string>("");
    const [countryCode, setCountryCode] = useState('CI');
    const [visible, setVisible] = useState(false);
    const [visible2, setVisible2] = useState(false);
    const [country, setCountry] = useState<Country>({
        "callingCode": ["225"],
        "cca2": "CI",
        "name": "Côte d'Ivoire",
        "region": "Africa",
        "subregion": "Western Africa",
        "currency": [],
        "flag": ""
    });
    const onSelect = (selectedCountry: Country) => {
        setCountryCode(selectedCountry.cca2);
        setCountry(selectedCountry);
    };
    const onClose = () => { setVisible(false) };

    const {
        control,
        handleSubmit,
        formState: { errors },
    } = useForm({
        resolver: yupResolver(schema),
    });

    const onSubmit = useCallback(async (data: any) => {
        setLoading(true)
        const res = await apiRequest({
            method: 'POST',
            endpoint: 'checkPhoneClient',
            data: {
                phone: (`+${country?.callingCode?.[0] || "1"}`).concat(data.phone),
                countryCode: country?.cca2.toLowerCase(),
                method
            },
        });

        // console.log(res)

        if (res.status === 401) {
            setLoading(false)
            setVisible2(true)
            // showError(res.message)
            return;
        }

        if (res.success === false) {
            setLoading(false)
            showError(res.message)
            return;
        }

        if (res.user === true) {
            if (res.data.step === 1) {
                router.push('/(auth)/otpcheck')
            } else if (res.data.step === 2) {
                router.push('/(auth)/passwordadd')
            } else if (res.data.step === 3) {
                router.push('/(auth)/userinfoadd')
            } else {
                setUser(res.data)
                setLoading(false)
                showSuccess(res.message)
                router.push('/(auth)/passwordcheck')
            }
        }

        if (res.success === true) {
            setUser(res.data)
            setLoading(false)
            showSuccess(res.message)
            router.push('/otpcheck')
        }
    }, [country?.callingCode, method, setUser]);

    useEffect(() => {
        if (method) {
            handleSubmit(onSubmit)(); // exécute onSubmit avec la bonne méthode
        }
    }, [handleSubmit, method, onSubmit]);

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <KeyboardAvoidWrapper>
                <View className="justify-center items-center rounded-3xl">
                    <Image resizeMode="cover" className="w-full h-96 self-center" source={require("../../assets/images/car.jpg")} />
                </View>

                <View className="px-3 flex-1 h-full">
                    <Text className="text-sm text-center font-['RubikBold'] text-black dark:text-white mt-8 mb-2">Entrer vôtre numéro de téléphone</Text>

                    <Text className="text-center text-black text-sm font-['RubikRegular'] dark:text-white mb-8">entrer vôtre numéro de téléphone pour vous connecter ou pour créer un compte</Text>

                    <Controller
                        control={control}
                        name="phone"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                // label="Téléphone"
                                country={`+ ${country?.callingCode?.[0] || "1"}`}
                                icon0={
                                    <View className="flex items-center justify-center h-[38px] w-[38px]">
                                        <CountryPicker
                                            {...{
                                                countryCode,
                                                onSelect,
                                                onClose
                                            }}
                                            withFilter={true}
                                            withFlag={true}
                                            withCountryNameButton={false}
                                            withAlphaFilter={false}
                                            withCallingCode={true}
                                            withEmoji={true}
                                            visible={visible}
                                            containerButtonStyle={{ marginRight: 6 }}
                                            closeButtonImageStyle={{ height: 14, }}
                                            translation='fra'
                                        />
                                    </View>
                                }
                                placeholder="0707070707"
                                keyboardType="phone-pad"
                                value={value}
                                onChangeText={onChange}
                                error={errors.phone?.message}
                            />
                        )}
                    />

                    <CustomButton
                        buttonText="Commencer"
                        loading={loading}
                        buttonClassNames="bg-primary w-full h-12 rounded-full items-center justify-center mt-4"
                        textClassNames="text-white text-sm font-['RubikBold']"
                        onPress={handleSubmit(onSubmit)}
                    />
                </View>
            </KeyboardAvoidWrapper>

            <BottomModal
                visible={visible2}
                onClose={() => setVisible2(false)}
                // onFirstAction={() => {
                //     setMethode('sms');
                //     setVisible2(false);
                //     // handleSubmit(onSubmit)();
                // }}
                // onSecondAction={() => {
                //     setMethode('whatsapp')
                //     setVisible2(false);
                //     // handleSubmit(onSubmit)();
                // }}
                title="Nouveau numero ?"
                description="Choisisser une option de méthode de vérification"
                content={
                    <View className="justify-between space-x-3 mt-4">
                        <CustomButton
                            buttonText="Continuer via SMS"
                            // loading={loading}
                            buttonClassNames="bg-gray-200 w-full h-12 rounded-full items-center justify-center mt-4"
                            textClassNames="text-black text-sm font-['RubikBold']"
                            onPress={() => {
                                setMethode('sms');
                                setVisible2(false);
                                // handleSubmit(onSubmit)();
                            }}
                            icon={<Icon name="message-circle" type="feather" size={22} color="#000000" />}
                        />

                        <CustomButton
                            buttonText="Continuer via WhatsApp"
                            // loading={loading}
                            buttonClassNames="bg-gray-200 w-full h-12 rounded-full items-center justify-center mt-4"
                            textClassNames="text-black text-sm font-['RubikBold']"
                            onPress={() => {
                                setMethode('whatsapp')
                                setVisible2(false);
                                // handleSubmit(onSubmit)();
                            }}
                            icon={<Image source={require("../../assets/images/whatsapp.png")} className="w-7 h-7 mr-3" />}
                        />
                    </View>
                }
            />
        </View>
    )
}