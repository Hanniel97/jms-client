import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

// Fonction pour rediriger l'utilisateur après un clic sur une notification
const handleNotificationRedirect = (remoteMessage: any) => {
    if (remoteMessage?.data) {
        router.push({ pathname: remoteMessage?.data?.url, params: { id: remoteMessage?.data?.id } })
    }
};

// Fonction principale de gestion des notifications
export const NotificationListener = () => {
    let unsubscribeOnMessage: any = null;
    let unsubscribeOnNotificationOpenedApp: any = null;
    let unsubscribeForegroundClick: any = null;

    // Lorsque l'application est en arrière-plan ou quittée
    unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
        console.log("Ouvert depuis background:", remoteMessage);
        handleNotificationRedirect(remoteMessage);
    });

    // Lorsque l'application est complètement fermée (état quit)
    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                console.log("Ouvert depuis quit:", remoteMessage);
                handleNotificationRedirect(remoteMessage);
            }
        });

    // Lorsque l'application est en foreground (ouverte)
    unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
        console.log("Notification en foreground:", remoteMessage);
        await Notifications.scheduleNotificationAsync({
            content: {
                title: remoteMessage.notification?.title || "Nouvelle notification",
                body: remoteMessage.notification?.body || "",
                data: remoteMessage.data,
                priority: "high",
            },
            trigger: null,
        });
    });

    // Lorsque l'utilisateur clique sur la notification en foreground
    unsubscribeForegroundClick = Notifications.addNotificationResponseReceivedListener(response => {
        console.log("Notification cliquée:", response);
        // handleNotificationRedirect(response.notification.request.content);
        router.push({ pathname: response.notification.request.content.data?.url, params: { id: response.notification.request.content.data?.id } })
    });

    // Retourner une fonction pour désactiver les listeners quand le composant est démonté
    return () => {
        if (unsubscribeOnMessage) unsubscribeOnMessage();
        if (unsubscribeOnNotificationOpenedApp) unsubscribeOnNotificationOpenedApp();
        if (unsubscribeForegroundClick) Notifications.removeNotificationSubscription(unsubscribeForegroundClick);
    };
};