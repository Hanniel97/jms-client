/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import { DisplayLoading } from "@/components/DisplayLoading";
import RenderNotification from "@/components/RenderNotifications";
import { apiRequest } from "@/services/api";
import useStore from "@/store/useStore";
import { groupNotificationsByDate } from "@/utils/groupNotificationsByDate";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    Text,
    View
} from "react-native";

const PAGE_LIMIT = 10;

export default function notifications() {
    const { user, tok, isAuthenticated, notifications, setNotification } = useStore();

    // Etats de pagination + données locales
    const [notificationData, setNotificationData] = useState([]); // tableau aplati
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // regroupement par date à partir des données locales paginées
    const groupedNotifications = useMemo(
        () => groupNotificationsByDate(notificationData),
        [notificationData]
    );

    // fonction de récupération paginée
    const getNotification = useCallback(
        async (requestedPage = 1, append = false) => {
            if (!user?._id || !tok) return;

            try {
                if (append) setLoadingMore(true);
                else setLoading(true);

                const endpoint = `notification/user?user=${user._id}&page=${requestedPage}&limit=${PAGE_LIMIT}`;
                const res = await apiRequest({
                    method: 'GET',
                    endpoint,
                    token: tok,
                });

                // Adaptation aux différentes formes de réponse (res.data ou res.data.data)
                const listFromRes = Array.isArray(res?.data)
                    ? res.data
                    : Array.isArray(res?.data?.data)
                        ? res.data.data
                        : Array.isArray(res?.notifications)
                            ? res.notifications
                            : [];

                // Mettre à jour les données locales (concat si append)
                setNotificationData(prev => {
                    const next = append ? [...prev, ...listFromRes] : listFromRes;
                    // Mettre à jour également le store global pour cohérence
                    try { setNotification(next); } catch (e) { /* ignore */ }
                    return next;
                });

                // Pagination meta : préfère res.pagination, fallback sur calcul simple
                const total = res?.pagination?.total ?? res?.total ?? (listFromRes.length || 0);
                const totalP = res?.pagination?.totalPages ?? (total ? Math.max(1, Math.ceil(total / PAGE_LIMIT)) : 1);

                setPage(parseInt(requestedPage, 10));
                setTotalPages(parseInt(totalP, 10));
            } catch (e) {
                console.error("Erreur récupération notifications :", e);
            } finally {
                setLoading(false);
                setLoadingMore(false);
                setRefreshing(false);
            }
        },
        [user?._id, tok, setNotification]
    );

    // initial load
    useEffect(() => {
        if (!isAuthenticated) return;
        // si on a déjà des notifications dans le store et qu'on veut les réutiliser -> on peut initialiser depuis notifications
        if (Array.isArray(notifications) && notifications.length > 0) {
            setNotificationData(notifications);
        } else {
            getNotification(1, false);
        }
    }, [isAuthenticated, getNotification, notifications]);

    // pull-to-refresh (reset page)
    const onRefresh = () => {
        setRefreshing(true);
        getNotification(1, false);
    };

    // load more (infinite scroll)
    const loadMore = () => {
        if (loadingMore || loading) return;
        if (page < totalPages) {
            getNotification(page + 1, true);
        }
    };

    if (loading && notificationData.length === 0) return <DisplayLoading />;

    return (
        <View className="flex-1 bg-white">
            <CustomHeader showBack={true} title={"Notifications"} />

            {
                (loading && notificationData.length === 0) ? (
                    <DisplayLoading />
                ) : (
                    <FlatList
                        data={groupedNotifications}
                        keyExtractor={(item, idx) => `${item.title}-${idx}`}
                        contentContainerStyle={{ padding: 16 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
                            !loading ? (
                                <View style={{ justifyContent: 'center', alignItems: 'center', alignContent: "center", padding: 40, marginTop: 50 }}>
                                    <Image
                                        source={require("../assets/images/notification.png")}
                                        className="w-44 h-44 mb-4"
                                    />
                                    <Text style={{ color: 'gray', fontFamily: 'RubikRegular' }}>aucune notification</Text>
                                </View>
                            ) : null
                        }
                        onEndReachedThreshold={0.5}
                        onEndReached={loadMore}
                        ListFooterComponent={
                            loadingMore ? (
                                <View style={{ padding: 12, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" />
                                </View>
                            ) : null
                        }
                    />
                )
            }
        </View>
    );
}
