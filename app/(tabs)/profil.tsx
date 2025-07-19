/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import useStore from "@/store/useStore";
import { Icon } from "@rneui/base";
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system';
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { Dialog } from "react-native-paper";
import { Ionicons, Entypo, MaterialIcons, FontAwesome } from "@expo/vector-icons";
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { apiRequest, apiUrl, photoUrl } from "@/services/api";
import { useWS } from "@/services/WSProvider";
import { showError, showInfo, showSuccess } from "@/utils/showToast";

const SettingsItem = ({ icon, label, onPress, disabled = false }: any) => (
    <TouchableOpacity
        className={`flex-row items-center justify-between border-[1px] border-primary/30 px-4 py-4 rounded-lg mb-2 ${disabled && "opacity-50"}`}
        onPress={onPress}
        disabled={disabled}
    >
        <View className="flex-row items-center space-x-3">
            {icon}
            <Text className="text-gray-700 font-['RubikMedium']">{label}</Text>
        </View>
        {!disabled && <Ionicons name="chevron-forward-outline" size={18} color="#000000" />}
    </TouchableOpacity>
);

export default function profil() {
    const { disconnect } = useWS();
    const { user, tok, setUser, setLogout } = useStore();

    const [loading, setLoading] = useState<boolean>(false);
    const [visible, setVisible] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState(false);

    const hideDialog = () => setVisible(false);

    const getUserInfo = useCallback(async () => {
        try {
            // setLoading(true);
            const res = await apiRequest({
                method: "GET",
                endpoint: "me",
                token: tok,
            });

            if (res.success === true) {
                setUser(res.data);
            }
        } catch (e) {
            console.log(e);
            // setLoading(false);
        }
    }, [setUser, tok]);

    const onRefresh = () => {
        try {
            getUserInfo();
        } catch (error) {
            console.log(error);
            setRefreshing(false);
        } finally {
            setRefreshing(false);
        }
    };

    useEffect(() => {
        getUserInfo();
    }, [getUserInfo]);

    const logout = () => {
        fetch(apiUrl + 'logout', {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
            }
        })
            .then(response => response.json())
            .then(res => {
                console.log(res)
                if (res.success === true) {
                    disconnect()
                    setLogout()
                    router.replace("/(auth)/phonecheck")
                } else {
                    setLogout()
                    disconnect()
                    router.replace("/(auth)/phonecheck")
                }
            })
            .catch(e => {
                console.log(e)
                setLogout()
                disconnect()
                router.replace("/(auth)/phonecheck")
            })
    }

    const takeImage = async () => {
        try {
            // Demander l'accès à la caméra si nécessaire
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                showInfo("Vous devez autoriser l'accès à la caméra.")
                return;
            }

            // Ouvrir la caméra
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [4, 4],
                quality: 0.2,
            });

            // Fermer la modale (si nécessaire)
            setVisible(false);

            // Vérifier si l'utilisateur a annulé
            if (result.canceled) {
                return;
            }

            // Récupérer l'image sélectionnée
            const imageUri = result.assets?.[0]?.uri;
            if (!imageUri) {
                showError("Impossible d'obtenir l'image sélectionnée.")
                return;
            }

            try {
                setLoading(true);

                // Envoyer l'image au serveur
                const uploadPhoto = await FileSystem.uploadAsync(apiUrl + 'updatePhoto/' + user._id, imageUri, {
                    httpMethod: 'PUT',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'multipart/form-data',
                        Authorization: 'Bearer ' + tok,
                    },
                    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                    fieldName: 'photo',
                    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
                    parameters: {},
                });

                // Vérifier le statut de la réponse
                if (uploadPhoto.status === 200) {
                    const res = JSON.parse(decodeURIComponent(uploadPhoto.body));

                    if (res.success) {
                        setUser(res.data);
                        showSuccess(res.message)
                    } else {
                        showError(res.message)
                    }
                } else {
                    showError("Une erreur est survenue. Réessayez plus tard.")
                }
            } catch (e) {
                console.log(e)
                showError("Erreur de connexion. Vérifiez votre réseau.")
            } finally {
                setLoading(false);
            }
        } catch (error) {
            console.log(error)
            showError("Une erreur est survenue lors de l'ouverture de la caméra.")
        }
    };

    const pickImage = async () => {
        try {
            // Ouvrir la galerie d'images
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ["images"],
                allowsEditing: true,
                aspect: [4, 4],
                quality: 0.2,
            });

            // Fermer la modale (si nécessaire)
            setVisible(false);

            // Vérifier si l'utilisateur a annulé
            if (result.canceled) {
                return;
            }

            // Récupérer l'image sélectionnée
            const imageUri = result.assets?.[0]?.uri;
            if (!imageUri) {
                showError("Impossible d'obtenir l'image sélectionnée.")
                return;
            }

            try {
                setLoading(true);

                // Envoyer l'image au serveur
                const uploadPhoto = await FileSystem.uploadAsync(apiUrl + 'updatePhoto/' + user._id, imageUri, {
                    httpMethod: 'PUT',
                    headers: {
                        Accept: 'application/json',
                        'Content-Type': 'multipart/form-data',
                        Authorization: 'Bearer ' + tok,
                    },
                    uploadType: FileSystem.FileSystemUploadType.MULTIPART,
                    fieldName: 'photo',
                    sessionType: FileSystem.FileSystemSessionType.BACKGROUND,
                    parameters: {},
                });

                console.log(uploadPhoto)

                // Vérifier le statut de la réponse
                if (uploadPhoto.status === 200) {
                    const res = JSON.parse(decodeURIComponent(uploadPhoto.body));

                    if (res.success) {
                        setUser(res.data);
                        showSuccess(res.message)
                    } else {
                        showError(res.message)
                    }
                } else {
                    showError("Une erreur est survenue. Réessayez plus tard.")
                }
            } catch (e) {
                console.log(e)
                showError("Erreur de connexion. Vérifiez votre réseau.")
            } finally {
                setLoading(false);
            }
        } catch (error) {
            console.log(error)
            showError("Une erreur est survenue lors de l'ouverture de la caméra.")
        }
    };

    return (
        <View className="flex-1 bg-white">
            <CustomHeader showBack={true} showTitle={true} title="Profile" />

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ justifyContent: "center", marginBottom: 10 }}
                showsVerticalScrollIndicator={false}
                className="flex-1 px-4"
            >
                <View className="items-center mb-6">
                    <View className="flex w-28 h-28 rounded-full border-2 border-white">
                        <Image
                            source={user.photo === "" ? require("../../assets/images/profil1.png") : { uri: photoUrl + user.photo }}
                            className="w-28 h-28 rounded-full border-2 border-primary"
                        />
                        <TouchableOpacity onPress={() => { setVisible(true) }}>
                            <View className="flex h-9 w-9 rounded-full bg-primary absolute bottom-0 right-0 justify-center items-center">
                                {
                                    loading ?
                                        <ActivityIndicator size={"small"} color={"#FFFFFF"} />
                                        :
                                        <Icon type="entypo" name="camera" size={15} color={"#ffffff"} />
                                }
                            </View>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => router.push('/wallet')} className="flex-row justify-center items-center bg-green-600 mt-3 py-1 px-3 rounded-lg">
                        <Text className="text-sm text-white font-['RubikSemiBold']">Solde: </Text>
                        <Text numberOfLines={1} className="text-sm text-white font-['RubikRegular']">{user.wallet.toLocaleString()} XOF</Text>
                    </TouchableOpacity>

                    <Text className="text-lg mt-3 font-['RubikSemiBold']">{user.prenom} {user.nom}</Text>
                    <Text className="text-sm text-gray-500 mt-1 font-['RubikRegular']">{user.phone}</Text>
                </View>

                <SettingsItem icon={<FontAwesome name="user" size={20} color="#000000" />} label="Modifier le profil" onPress={() => router.push("/editprofil")} />
                <SettingsItem icon={<Entypo name="wallet" size={20} color="#000000" />} label="Portefeuille" onPress={() => router.push("/wallet")} />
                <SettingsItem icon={<Entypo name="lock" size={20} color="#000000" />} label="Changer mot de passe" onPress={() => router.push("/changepassword")} />
                <SettingsItem icon={<Ionicons name="shield-checkmark" size={20} color="#000000" />} label="Politique de confidentialité" onPress={() => router.push("/policy")} />
                <SettingsItem icon={<MaterialIcons name="message" size={20} color="#000000" />} label="Nous contacter" onPress={() => router.push("/contactus")} />
                <SettingsItem icon={<MaterialIcons name="delete" size={20} color="#000000" />} label="Supprimer le compte" onPress={() => router.push("/deleteaccount")} />
                <SettingsItem icon={<MaterialIcons name="logout" size={20} color="#000000" />} label="Deconnexion" onPress={logout} />
            </ScrollView>

            <Dialog visible={visible} onDismiss={hideDialog}>
                <Dialog.Title style={{ fontFamily: "RubikRegular" }}>Choisir une image</Dialog.Title>
                <Dialog.Content>
                    <View style={{ height: 120, flexDirection: 'row' }}>
                        <TouchableOpacity onPress={() => takeImage()} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Icon name='camera' type='ionicon' size={30} color="black" />
                            <Text style={{ marginTop: 10, fontFamily: 'RubikRegular' }} >Appareil photo</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => pickImage()} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>

                            {/* <MaterialIcons name="photo-library" size={30} color="black" /> */}
                            <Icon name='images' type='ionicon' size={30} color="black" />
                            <Text style={{ marginTop: 10, fontFamily: 'RubikRegular' }}>Gallerie</Text>

                        </TouchableOpacity>

                        {/* <TouchableOpacity onPress={() => supPhot(data.choixphot)} style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                            <AntDesign name="closecircle" size={24} color="black" />
                            <Text style={{marginTop: 10, fontFamily: 'Mukta_Malar'}}>Supprimer</Text>
                        </TouchableOpacity> */}
                    </View>
                </Dialog.Content>
            </Dialog>
        </View>
    )
}