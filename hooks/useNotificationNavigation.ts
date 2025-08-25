import { useEffect, useState } from "react";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

export const useNotificationNavigation = () => {
    const [pendingRoute, setPendingRoute] = useState<{ url: string; id: string } | null>(null);

    useEffect(() => {
        const sub = Notifications.addNotificationResponseReceivedListener((response) => {
            const data = response.notification.request.content.data;
            if (data?.url) {
                setPendingRoute({ url: data.url, id: data.id });
            }
        });

        return () => sub.remove();
    }, []);

    useEffect(() => {
        if (pendingRoute) {
            router.push({
                pathname: pendingRoute.url,
                params: { id: pendingRoute.id },
            });
            setPendingRoute(null); // reset pour éviter les boucles
        }
    }, [pendingRoute]);
};
