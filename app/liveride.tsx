import { LiveTrackingMap } from "@/components/LiveTrackingMap";
import LiveTrackingSheet from "@/components/LiveTrackingSheet";
import SearchingRiderSheet from "@/components/SearchingRiderSheet";
import { apiRequest } from "@/services/api";
import { useWS } from "@/services/WSProvider";
import useStore from "@/store/useStore";
import { showError, showInfo, showSuccess } from "@/utils/showToast";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { Icon, ScreenHeight } from "@rneui/base";
import { router, useLocalSearchParams } from "expo-router";
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Dimensions, Modal, Platform, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { WebView, WebViewMessageEvent } from 'react-native-webview';

const androidHeights = [ScreenHeight * 0.14, ScreenHeight * 0.52]
const iosHeights = [ScreenHeight * 0.2, ScreenHeight * 0.5]

export const LiveRide = () => {
    const { tok, user } = useStore();
    const { emit, on, off } = useWS();
    const [riderData, setRiderData] = useState<any>(null)
    const [riderCoords, setRiderCoords] = useState<any>(null)
    const { id } = useLocalSearchParams();
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => (Platform.OS === "ios" ? iosHeights : androidHeights), [])
    const [mapHeight, setMapHeight] = useState(snapPoints[1]);
    const [modalVisible, setModalVisible] = useState(false);
    const [duration, setDuration] = useState<number>(0);
    const [showWebview, setShowWebview] = useState(false);
    const [load, setLoad] = useState<boolean>(false);
    const [urlPayment, setUrlPayment] = useState("");

    const onClose = () => {
        setModalVisible(false)
    }

    const hideModal = () => setShowWebview(false);

    const handleSheetChanges = useCallback((index: number) => {
        const height = snapPoints[index] ?? snapPoints[1];
        setMapHeight(height);
    }, [snapPoints]);

    useEffect(() => {
        if (id) {
            emit('subscribeRide', id)
            on('rideData', (data) => {
                if (data?.status === "SEARCHING_FOR_RIDER") {
                    emit('searchrider', id)
                }
            })

            on('rideUpdate', (data) => {
                setRiderData(data)
                // console.log(data)
            })

            on('rideCanceled', (message) => {
                router.replace("/(tabs)")
                showError(message)
            })

            on("riderCanceled", (data) => {
                showError(data.message)
                console.log("🚨 Rider a annulé :", data.message);
            });

            on('error', (error) => {
                router.replace("/(tabs)")
                showInfo("Aucun chauffeur trouvé")
            })
        }

        return () => {
            off('rideData');
            off('rideUpdate');
            off('rideCanceled');
            off('riderCanceled');
            off('error');
        }
    }, [emit, id, off, on, riderData]);

    const getRide = useCallback(async () => {
        const res = await apiRequest({
            method: 'GET',
            endpoint: 'ride/getRideById/' + id,
            token: tok,
        });

        // console.log('dfdbfk jd', res)

        // if (res.success === false) {
        //     setLoading(false)
        //     showError(res.message)
        //     return;
        // }

        if (res.success === true) {
            setRiderData(res.ride)
            // setLoading(false)
            // showSuccess(res.message)
            // router.push({ pathname: '/liveride', params: { id: res.ride._id } })
        }
    }, [id, tok]);

    useEffect(() => {
        if (id) {
            getRide()
        }
    }, [getRide, id]);

    const handlePayment = useCallback(async () => {
        const res = await apiRequest({
            method: 'POST',
            endpoint: 'fedaPayment',
            token: tok,
            data: {
                amount: riderData?.fare,
                user: user
            }
        })

        console.log('  ', res)

        if (res.success === true) {
            showSuccess(res.message)
            // setLoad(false);
            setUrlPayment(res.data.url)
        } else {
            // setLoad(false);
            showError(res.message)
        }
    }, [riderData?.fare, tok, user])

    useEffect(() => {
        if (riderData && riderData?.status === "COMPLETED") {
            // setModalVisible(true)
            handlePayment()
        }
    }, [getRide, handlePayment, id, riderData]);

    useEffect(() => {
        if (urlPayment) {
            setShowWebview(true)
        }
    }, [urlPayment])

    useEffect(() => {
        if (riderData?.rider?._id) {
            emit('subscribeToriderLocation', riderData?.rider?._id)
            on('riderLocationUpdate', (data) => {
                setRiderCoords(data?.coords)
            })
        }

        return () => {
            off('riderLocationUpdate')
        }
    }, [emit, off, on, riderData]);

    const handleStatut = async () => {
        setLoad(true);
        const res = await apiRequest({
            method: 'PUT',
            endpoint: 'ride/update/' + riderData._id,
            token: tok,
            data: {
                status: "PAYED"
            }
        })

        if (res.success === true) {
            showSuccess(res.message)
            setLoad(false);
            router.replace('/(tabs)')
        } else {
            setLoad(false);
            showError(res.message)
        }
    }

    function onNavigationStateChange({ url }: { url: string }) {
        if (url.includes('success')) {
            setLoad(false)
            hideModal()
            showSuccess("Paiement effectué")
            handleStatut();
        } else if (url.includes('declined')) {
            setLoad(false)
            hideModal()
            showInfo("Paiement annulé")
        } else if (url.includes('canceled')) {
            setLoad(false)
            showError("Paiement refusé")
            hideModal()
        } else {
            showError("Paiement non effectué")
        }
    }


    return (
        <View className="flex-1 bg-white">

            {riderData && (
                <LiveTrackingMap
                    setDuration={setDuration}
                    bottomSheetHeight={mapHeight}
                    height={mapHeight}
                    status={riderData?.status}
                    drop={{
                        latitude: parseFloat(riderData?.drop?.latitude),
                        longitude: parseFloat(riderData?.drop?.longitude),
                    }}
                    pickup={{
                        latitude: parseFloat(riderData?.pickup?.latitude),
                        longitude: parseFloat(riderData?.pickup?.longitude),
                    }}
                    rider={
                        riderCoords ?
                            {
                                latitude: riderCoords.latitude,
                                longitude: riderCoords.longitude,
                                heading: riderCoords.heading,
                            }
                            : {}
                    }
                />
            )}

            {riderData ?
                <BottomSheet
                    ref={bottomSheetRef}
                    index={1}
                    handleIndicatorStyle={{
                        backgroundColor: "#ccc"
                    }}
                    enableOverDrag={false}
                    enableDynamicSizing
                    style={{ zIndex: 4 }}
                    snapPoints={snapPoints}
                    onChange={handleSheetChanges}
                >
                    <BottomSheetScrollView contentContainerStyle={{}}>
                        {riderData?.status === "SEARCHING_FOR_RIDER" ? (
                            <SearchingRiderSheet
                                item={riderData}
                            />
                        ) : (
                            <LiveTrackingSheet
                                duration={duration.toFixed(0)}
                                item={riderData}
                            />
                        )}
                    </BottomSheetScrollView>
                </BottomSheet>
                :
                <View className="flex-1 justify-center items-center">
                    <Text className="text-gray-700 ml-2 font-['RubikMedium']">Chargement</Text>
                    <ActivityIndicator size={"small"} color={"#000"} />
                </View>
            }

            <Modal visible={showWebview} onDismiss={hideModal}>
                <TouchableOpacity
                    onPress={hideModal}
                    style={styles.closeButton}
                >
                    <Icon type='ant-design' name='close' color={"red"} />
                </TouchableOpacity>
                {showWebview && urlPayment && (
                    <WebView
                        style={styles.webview}
                        originWhitelist={["*"]}
                        source={{ uri: urlPayment }}
                        onNavigationStateChange={onNavigationStateChange}
                        onMessage={(event: WebViewMessageEvent) => {
                            const message = JSON.parse(event.nativeEvent.data);
                            switch (message.type) {
                                case "test":
                                    console.log("hello");
                                    break;
                                default:
                                    console.log(message.type);
                            }
                        }}

                    />
                )}
            </Modal>

            {/* <Modal
                animationType="fade"
                transparent
                visible={modalVisible}
            // onRequestClose={onClose}
            >
                <View style={[styles.overlay, {}]}>
                    <View style={styles.modalContainer}>
                        <Image
                            source={require("../assets/images/downcast-face.png")}
                            className="w-24 h-24 mb-4 self-center rounded-full border-4 border-primary"
                        />

                        <Text className="text-lg font-['RubikBold'] text-center text-black dark:text-white mb-2">
                            Course achevée
                        </Text>

                        <Text className="text-sm text-center font-['RubikRegular'] text-gray-700 dark:text-gray-300 mb-6">
                            Nous sommes arrivé à destination. Nous sommes ravis de vous avoir rendu service.
                        </Text>

                        <View className="flex-row justify-between">
                            <Pressable
                                onPress={onClose}
                                className="flex-1 mr-2 items-center justify-center bg-primary dark:bg-gray-700 px-4 py-3 rounded-full"
                            >
                                <Text className="text-white font-['RubikMedium']">Payer {riderData?.fare} </Text>
                            </Pressable>

                            <Pressable
                                // onPress={()}
                                className="flex-1 ml-2 items-center justify-center bg-green-600 px-4 py-3 rounded-full"
                            >
                                <Text className="text-white font-medium">Oui</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal> */}
        </View>
    )
}

export default memo(LiveRide);

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)', // assombrit tout l'écran
        justifyContent: 'center',
        alignItems: 'center',
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 30,
        width: '85%',
    },
    containerStyle: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
    } as ViewStyle,
    closeButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 24,
        margin: 16,
    },
    webview: {
        flex: 1,
        margin: 16,
        borderRadius: 8,
        overflow: 'hidden',
    },
});