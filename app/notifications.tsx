/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import { DisplayLoading } from "@/components/DisplayLoading";
import RenderNotification from "@/components/RenderNotifications";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
import { groupNotificationsByDate } from "@/utils/groupNotificationsByDate";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, Image, RefreshControl, Text, View } from "react-native";

export default function notifications() {
    const { user, tok, isAuthenticated, notifications, setNotification } = useStore();

    const [loading, setLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false);

    const groupedNotifications = groupNotificationsByDate(notifications);

    const getNotification = useCallback(async () => {
        try {
            setLoading(true)
            const res = await apiRequest({
                method: 'GET',
                endpoint: 'notification/user?user=' + user._id,
                token: tok,
            })

            // console.log('notifications', res)

            setNotification(res.data)
            setLoading(false)
            // getReservationLength(user._id, tok, setReservationLength, setPanierLength)
        }
        catch (e) {
            console.log(e)
            setLoading(false)
        }
    }, [setNotification, tok, user._id])

    useEffect(() => {
        if (isAuthenticated) {
            getNotification()
        }
    }, [getNotification, isAuthenticated])

    const onRefresh = () => {
        try {
            getNotification()
        } catch (error) {
            console.log(error)
            setRefreshing(false);
        } finally {
            setRefreshing(false);
        }
    }

    return (
        <View className="flex-1 bg-white">
            <CustomHeader showBack={true} title={"Notifications"} />


            {
                loading ?
                    <DisplayLoading />
                    :
                    <FlatList
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        data={groupedNotifications}
                        // keyExtractor={(item) => item._id}
                        keyExtractor={(item) => item.title}
                        contentContainerStyle={{ padding: 16 }}
                        showsVerticalScrollIndicator={false}
                        // renderItem={({ item }: { item: INotification }) => (
                        //     <RenderNotification
                        //         notification={item}
                        //         // onConfirmer={handleConfirmer}
                        //         // onAnnuler={handleAnnuler}
                        //         // onTraiter={handleTraiter}
                        //         // loading2={loading2}
                        //         // loading3={loading3}
                        //         // loading4={loading4}
                        //     />
                        // )}

                        renderItem={({ item }) => (
                            <View className="mb-6 w-full flex-1">
                                <Text className="text-lg text-black mb-2 font-['RubikBold'] ">{item.title}</Text>
                                {Array.isArray(item?.data) &&
                                    item.data.map((notif) => (
                                        <RenderNotification key={notif._id} notification={notif} />
                                    ))}
                            </View>
                        )}
                        ListEmptyComponent={
                            <View style={{ justifyContent: 'center', alignItems: 'center', alignContent: "center", padding: 40, marginTop: 50 }}>
                                {/* <LottieView
                                    source={require('../assets/empty_history.json')}
                                    autoPlay
                                    loop
                                    style={{ width: 150, height: 150 }}
                                /> */}
                                <Image
                                    source={require("../assets/images/notification.png")}
                                    className="w-44 h-44 mb-4"
                                />
                                <Text style={{ color: 'gray', fontFamily: 'RubikRegular' }}>aucune notification</Text>
                            </View>
                        }
                    />
            }
        </View>
    )
}