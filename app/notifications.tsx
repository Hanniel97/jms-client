/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
import React, { useCallback, useEffect, useState } from "react";
import { FlatList, RefreshControl, Text, View, Image } from "react-native";
import { DisplayLoading } from "@/components/DisplayLoading";
import RenderNotification from "@/components/RenderNotifications";
import { groupNotificationsByDate } from "@/utils/groupNotificationsByDate";
import moment from 'moment';

const data = [
    {
        _id: "1",
        user: "",
        type: "recharge",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "Compte rechargé",
        isRead: false,
        createdAt: moment().toDate(), // Aujourd'hui
    },
    {
        _id: "2",
        user: "",
        type: "paiement",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "Course réglée",
        isRead: false,
        createdAt: moment().subtract(1, 'days').toDate(), // Hier
    },
    {
        _id: "3",
        user: "",
        type: "reduction",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "30% de réduction",
        isRead: false,
        createdAt: moment().subtract(3, 'days').toDate(), // Il y a 3 jours
    },
    {
        _id: "4",
        user: "",
        type: "recharge",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "Compte rechargé",
        isRead: false,
        createdAt: moment().subtract(7, 'days').toDate(), // Il y a 7 jours
    },
    {
        _id: "5",
        user: "",
        type: "paiement",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "Course réglée",
        isRead: false,
        createdAt: moment().toDate(), // Aujourd'hui
    },
    {
        _id: "6",
        user: "",
        type: "reduction",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "30% de réduction",
        isRead: false,
        createdAt: moment().subtract(1, 'days').toDate(), // Hier
    },
    {
        _id: "7",
        user: "",
        type: "paiement",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "Course réglée",
        isRead: false,
        createdAt: moment().subtract(10, 'days').toDate(), // Il y a 10 jours
    },
    {
        _id: "8",
        user: "",
        type: "reduction",
        body: "Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum",
        title: "30% de réduction",
        isRead: false,
        createdAt: moment().subtract(30, 'days').toDate(), // Il y a 30 jours
    },
];

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

            console.log('notifications', res)

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
            setRefreshing(false);
        } finally {
            setRefreshing(false);
        }
    }

    return (
        <View className="flex-1 bg-white dark:bg-black">
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