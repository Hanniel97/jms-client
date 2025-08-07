/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import KeyboardAvoidWrapper from "@/components/KeyboardAvoidingWrapper";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
import { router } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { CustomButton } from "@/components/CustomButton";
import { showError, showSuccess } from "@/utils/showToast";
import DeleteAccountModal from '@/components/DeleteAccountModal';
import { useWS } from "@/services/WSProvider";

export default function deleteaccount() {
    const { user, tok, setLogout, } = useStore();
    const { disconnect } = useWS();

    const [loading, setLoading] = useState<boolean>(false);
    const [modalVisible, setModalVisible] = useState(false);

    const onSubmit = async () => {
        setModalVisible(false)
        setLoading(true)
        const res = await apiRequest({
            method: 'DELETE',
            endpoint: 'deleteAccount?id=' + user._id,
            token: tok,
        });

        // console.log('dfdbfk jd', res)

        if (res.success === false) {
            setLoading(false)
            showError(res.message)
            return;
        }

        if (res.success === true) {
            setLoading(false)
            showSuccess(res.message)
            disconnect()
            setLogout()
            router.replace("/(auth)/phonecheck")
        }
    };

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader showBack={true} title={"Supprimer le compte"} />

            <KeyboardAvoidWrapper>
                <View className="px-3 flex-1 h-full mt-3">
                    {/* <Text className="text-lg font-bold self-center text-black dark:text-white mb-2">Adresse</Text> */}

                    <Text className="text-gray-500 font-['RubikMedium'] text-lg dark:text-white mb-4">Etes-vous sûr de vouloir supprimer votre compte ? Veuillez lire les conséquences de la suppression de votre compte.</Text>
                    <Text className="text-gray-500 font-['RubikMedium'] text-lg dark:text-white mb-8">La suppression de votre compte supprime vos informations personnelles de notre base de données. Votre numéro est réservé de manière permanente et ne peut pas être réutilisé pour créer un nouveau compte.</Text>

                    <CustomButton
                        buttonText="Supprimer le compte"
                        loading={loading}
                        buttonClassNames="bg-primary shadow-xl h-12 rounded-full items-center justify-center mt-4"
                        textClassNames="text-white text-lg font-['RubikBold']"
                        onPress={() => setModalVisible(true)}
                    />
                </View>
            </KeyboardAvoidWrapper>

            <DeleteAccountModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                onConfirm={onSubmit}
            />
        </View>
    )
}