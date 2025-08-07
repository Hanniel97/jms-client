/* eslint-disable react-hooks/rules-of-hooks */
import { CustomButton } from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import { CustomTextInput } from "@/components/CustomTextInput";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
import { showError, showInfo, showSuccess } from "@/utils/showToast";
import { yupResolver } from "@hookform/resolvers/yup";
import { Icon } from "@rneui/base";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import * as yup from "yup";

const schema = yup.object().shape({
    montant: yup
        .string()
        .required("Le montant est requis")
});

const paymentMethods = [
    {
        key: "wave",
        title: "Wave",
        image: require("../assets/images/wave.png"),
    },
    // {
    //     key: "momo",
    //     title: "Mtn",
    //     image: require("../assets/images/mtn.png"),
    // },
    // {
    //     key: "moov",
    //     title: "Moov",
    //     image: require("../assets/images/moov.png"),
    // },
    // {
    //     key: "orange",
    //     title: "Orange",
    //     image: require("../assets/images/orange.png"),
    // },
];

const formule = [
    {
        key: 1,
        title: "100",
        montant: 100,
    },
    {
        key: 2,
        title: "300",
        montant: 300,
    },
    {
        key: 3,
        title: "500",
        montant: 500,
    },
    {
        key: 4,
        title: "1000",
        montant: 1000,
    },
    {
        key: 5,
        title: "2000",
        montant: 2000,
    },
    {
        key: 6,
        title: "5000",
        montant: 5000,
    },
    {
        key: 7,
        title: "10000",
        montant: 10000,
    },
]

export default function rechargewallet() {
    const { user, tok, setUser, } = useStore();

    const [loading, setLoading] = useState<boolean>(false);
    const [selectedMethod, setSelectedMethod] = useState<string>("wave");
    const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
    const [showWebview, setShowWebview] = useState(false);
    const [montant, setMontant] = useState<number>(0);
    const [urlPayment, setUrlPayment] = useState("");

    const hideModal = () => setShowWebview(false);

    const {
        control,
        handleSubmit,
        formState: { errors },
        setValue,
        watch,
    } = useForm({
        resolver: yupResolver(schema),
    });

    const montantValue = watch("montant"); // pour détecter si un montant est saisi

    const setMontantFromFormule = (montant: number) => {
        // Efface la valeur saisie manuellement
        setMontant(montant)
        setValue("montant", montant.toString());
        setSelectedAmount(montant);
    };

    const onSubmit = async (data: any) => {
        setLoading(true)
        const res = await apiRequest({
            method: 'POST',
            endpoint: 'fedaPayment',
            token: tok,
            data: {
                amount: data.montant,
                user: user
            }
        })

        // console.log('  ', res)

        if (res.success === true) {
            showSuccess(res.message)
            setLoading(false);
            setUrlPayment(res.data.url)
        } else {
            setLoading(false);
            showError(res.message)
        }
    };

    useEffect(() => {
        if (urlPayment) {
            setShowWebview(true)
        }
    }, [urlPayment])

    const handleTransaction = async () => {
        setLoading(true);
        const res = await apiRequest({
            method: 'POST',
            endpoint: 'transaction/add',
            token: tok,
            data: {
                user: user._id,
                type: "recharge",
                amount: montant,
                title: "Recharge de portefeuille"
            }
        })

        if (res.success === true) {
            showSuccess(res.message)
            setUser(res.user)
            setLoading(false);
            router.back();
        } else {
            setLoading(false);
            showError(res.message)
        }
    }


    function handleWebViewNavigation({ url }: { url: string }) {
        if (url.includes("success")) {
            hideModal();
            showSuccess("Paiement effectué");
            handleTransaction();
        } else if (url.includes("declined")) {
            hideModal();
            showInfo("Paiement annulé");
        } else if (url.includes("canceled")) {
            hideModal();
            showError("Paiement refusé");
        }
    }

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title={"Recharger mon portefeuille"} />

            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full mt-3">
                    {/* <Controller
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
                    /> */}

                    <Controller
                        control={control}
                        name="montant"
                        render={({ field: { onChange, value } }) => (
                            <CustomTextInput
                                placeholder="Montant à recharger"
                                keyboardType="numeric"
                                icon0={<Icon name="wallet" type="ionicon" size={20} color="#000000" />}
                                value={value}
                                onChangeText={(text) => {
                                    onChange(text);
                                    if (selectedAmount !== null) {
                                        setSelectedAmount(null); // on désélectionne un bouton si l’utilisateur tape
                                    }
                                }}
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

                    <Text>Montants</Text>

                    <View className="flex-row flex-wrap gap-2 my-2">
                        {formule.map((item) => (
                            <TouchableOpacity
                                key={item.key}
                                disabled={!!montantValue && selectedAmount === null}
                                onPress={() => setMontantFromFormule(item.montant)}
                                className={`px-4 py-2 rounded-full border
                                    ${selectedAmount === item.montant ? "bg-primary/10 border-primary" : "bg-gray-200 border-gray-300"}
                                    ${!!montantValue && selectedAmount === null ? "opacity-50" : ""}
                                `}
                            >
                                <Text className={`font-['RubikBold'] ${selectedAmount === item.montant ? "text-primary" : "text-black"}`}>
                                    {item.title} XOF
                                </Text>
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

            <Modal
                visible={showWebview}
                transparent
                animationType="fade"
                onRequestClose={hideModal}
            >
                <View style={styles.modalContainer}>
                    <TouchableOpacity onPress={hideModal} style={styles.closeButton}>
                        <Icon type="ionicon" name="close" color="white" size={24} />
                    </TouchableOpacity>

                    <View style={styles.webviewWrapper}>
                        {urlPayment && (
                            <WebView
                                source={{ uri: urlPayment }}
                                originWhitelist={["*"]}
                                onNavigationStateChange={handleWebViewNavigation}
                                onMessage={(event: WebViewMessageEvent) => {
                                    const message = JSON.parse(event.nativeEvent.data);
                                    switch (message.type) {
                                        case "test":
                                            // console.log("Test message reçu");
                                            break;
                                        default:
                                            // console.log("Type reçu :", message.type);
                                    }
                                }}
                            />
                        )}
                    </View>
                </View>
            </Modal>

        </View>
    )
}

const styles = StyleSheet.create({
    modalContainer: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
    } as ViewStyle,

    webviewWrapper: {
        width: "100%",
        height: "90%",
        backgroundColor: "white",
        borderRadius: 16,
        overflow: "hidden",
    },

    closeButton: {
        position: "absolute",
        top: 40,
        right: 20,
        zIndex: 10,
        backgroundColor: "rgba(0,0,0,0.6)",
        width: 40,
        height: 40,
        justifyContent: "center",
        alignItems: "center",
        borderRadius: 20,
    },

    webview: {
        flex: 1,
    },
});
