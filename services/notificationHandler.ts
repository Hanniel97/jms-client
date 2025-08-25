// ================================
// listeners/NotificationListener.ts (version adaptée)
// Affiche le popup en foreground et gère la navigation au clic système
// ================================
// import { useNotificationModal } from '@/store/useNotificationModal';
// import { useNotificationNavigation } from '@/hooks/useNotificationNavigation';
import { useNotificationStore } from '@/store/notificationStore';
import { useTopBanner } from '@/store/useTopBanner';
import { getApp } from '@react-native-firebase/app';
import messaging from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';
// import { router } from 'expo-router';

const app = getApp();

// function handleNotificationRedirect(remoteMessage: any) {
//     // Priorité à remoteMessage.data.url si présent
//     const url = remoteMessage?.data?.url;
//     const id = remoteMessage?.data?.id;
//     const type = remoteMessage?.data?.type;
//     const rideId = remoteMessage?.data?.rideId;

//     if (url) {
//         router.push({ pathname: url, params: { id } });
//         return;
//     }

//     if (type === 'NEW_RIDE' && rideId) {
//         router.push({ pathname: `/ride/${String(rideId)}` });
//     }
// }

export const NotificationListener = () => {
    let unsubscribeOnMessage: any = null;
    let unsubscribeOnNotificationOpenedApp: any = null;
    let unsubscribeForegroundClick: any = null;

    const { setPendingRoute } = useNotificationStore.getState();

    // Background -> app ouverte par clic
        unsubscribeOnNotificationOpenedApp = messaging(app).onNotificationOpenedApp(
        (remoteMessage) => {
            if (remoteMessage?.data?.url) {
                setPendingRoute({ url: remoteMessage.data.url, id: remoteMessage.data.id });
            }
        }
    );

    // App tuée -> app ouverte par clic
    messaging(app)
        .getInitialNotification()
        .then((remoteMessage) => {
        if (remoteMessage?.data?.url) {
            console.log('📲 Ouvert depuis quit:', remoteMessage);
            // handleNotificationRedirect(remoteMessage);
            setPendingRoute({ url: remoteMessage.data.url, id: remoteMessage.data.id });
        }
    });

    // Foreground: au lieu de planifier une notif système (doublon), on affiche un popup in-app
    unsubscribeOnMessage = messaging(app).onMessage(async (remoteMessage) => {
        console.log('🔔 Notification en foreground:', remoteMessage);

        const title = remoteMessage?.notification?.title || 'Nouvelle notification';
        const body = remoteMessage?.notification?.body || '';
        const data = remoteMessage?.data || {};

        // Montre le popup
        // useNotificationModal.getState().show({ title, body, data });
        useTopBanner.getState().show({ title, body, data });

        // Optionnel: si tu veux *aussi* une bannière système en foreground, décommente:
        // await Notifications.scheduleNotificationAsync({
        //   content: { title, body, data, priority: 'high', sound: 'notification.wav' },
        //   trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: 'new_ride' },
        // });

        await Notifications.scheduleNotificationAsync({
            content: {
                title: remoteMessage.notification?.title || "Nouvelle notification",
                body: remoteMessage.notification?.body || "",
                data: remoteMessage.data,
                priority: "high",
                sound: "notification.wav",
            },
            trigger: { seconds: 1, channelId: "new_ride" },
        });
    });

    // Clic sur une notification système (générée par FCM/OS)
    unsubscribeForegroundClick = Notifications.addNotificationResponseReceivedListener((response) => {
        console.log('👉 Notification cliquée:', response);
        const data: any = response.notification.request.content.data;
        // if (data) {
        //     handleNotificationRedirect({ data });
        // }
        if (data?.url) {
            setPendingRoute({ url: data.url, id: data.id });
        }
    });

    return () => {
        if (unsubscribeOnMessage) unsubscribeOnMessage();
        if (unsubscribeOnNotificationOpenedApp) unsubscribeOnNotificationOpenedApp();
        if (unsubscribeForegroundClick) unsubscribeForegroundClick.remove();
    };
};





// // NotificationListener.ts
// import { getApp } from "@react-native-firebase/app";
// import messaging from "@react-native-firebase/messaging";
// import * as Notifications from "expo-notifications";
// import { router } from "expo-router";

// const app = getApp(); // ✅ Nouvelle API

// // Fonction pour rediriger l'utilisateur après un clic sur une notification
// function handleNotificationRedirect(remoteMessage: any){
//     if (remoteMessage?.data?.url) {
//         router.push({
//             pathname: remoteMessage.data.url,
//             params: { id: remoteMessage.data.id },
//         });
//     }
// };

// // Fonction principale de gestion des notifications
// export const NotificationListener = () => {
//     let unsubscribeOnMessage: any = null;
//     let unsubscribeOnNotificationOpenedApp: any = null;
//     let unsubscribeForegroundClick: any = null;

//     // Lorsque l'application est en arrière-plan et que l'utilisateur clique sur une notif
//     unsubscribeOnNotificationOpenedApp = messaging(app).onNotificationOpenedApp(
//         (remoteMessage) => {
//             console.log("📲 Ouvert depuis background:", remoteMessage);
//             handleNotificationRedirect(remoteMessage);
//         }
//     );

//     // Lorsque l'application est complètement fermée (état quit)
//     messaging(app)
//         .getInitialNotification()
//         .then((remoteMessage) => {
//             if (remoteMessage) {
//                 console.log("📲 Ouvert depuis quit:", remoteMessage);
//                 handleNotificationRedirect(remoteMessage);
//             }
//         });

//     // Lorsque l'application est en foreground (ouverte et reçoit une notif)
//     unsubscribeOnMessage = messaging(app).onMessage(async (remoteMessage) => {
//         console.log("🔔 Notification en foreground:", remoteMessage);

//         await Notifications.scheduleNotificationAsync({
//         content: {
//             title: remoteMessage.notification?.title || "Nouvelle notification",
//             body: remoteMessage.notification?.body || "",
//             data: remoteMessage.data,
//             priority: "high",
//             sound: "notification.wav", // ⚠️ vérifie que le son existe dans ton projet Android
//         },
//             trigger: {
//                 type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
//                 seconds: 1,
//                 channelId: "new_ride", // ✅ correspond à ton channel défini dans registerForPushNotificationsAsync
//             },
//         });
//     });

//     // Lorsque l'utilisateur clique sur une notif générée en foreground
//     unsubscribeForegroundClick =
//         Notifications.addNotificationResponseReceivedListener((response) => {
//         console.log("👉 Notification cliquée:", response);

//         const data = response.notification.request.content.data;
//             if (data?.url) {
//                 router.push({
//                     pathname: data.url,
//                     params: { id: data.id },
//                 });
//             }
//         });

//     // Retourner une fonction pour nettoyer les listeners au démontage
//     return () => {
//         if (unsubscribeOnMessage) unsubscribeOnMessage();
//         if (unsubscribeOnNotificationOpenedApp)
//             unsubscribeOnNotificationOpenedApp();
//         if (unsubscribeForegroundClick) unsubscribeForegroundClick.remove();
//     };
// };



// import messaging from "@react-native-firebase/messaging";
// import * as Notifications from "expo-notifications";
// import { router } from "expo-router";

// // Fonction pour rediriger l'utilisateur après un clic sur une notification
// const handleNotificationRedirect = (remoteMessage: any) => {
//     if (remoteMessage?.data) {
//         router.push({ pathname: remoteMessage?.data?.url, params: { id: remoteMessage?.data?.id } })
//     }
// };

// // Fonction principale de gestion des notifications
// export const NotificationListener = () => {
//     let unsubscribeOnMessage: any = null;
//     let unsubscribeOnNotificationOpenedApp: any = null;
//     let unsubscribeForegroundClick: any = null;

//     // Lorsque l'application est en arrière-plan ou quittée
//     unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
//         console.log("Ouvert depuis background:", remoteMessage);
//         handleNotificationRedirect(remoteMessage);
//     });

//     // Lorsque l'application est complètement fermée (état quit)
//     messaging()
//         .getInitialNotification()
//         .then(remoteMessage => {
//             if (remoteMessage) {
//                 console.log("Ouvert depuis quit:", remoteMessage);
//                 handleNotificationRedirect(remoteMessage);
//             }
//         });

//     // Lorsque l'application est en foreground (ouverte)
//     unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
//         console.log("Notification en foreground:", remoteMessage);
//         await Notifications.scheduleNotificationAsync({
//             content: {
//                 title: remoteMessage.notification?.title || "Nouvelle notification",
//                 body: remoteMessage.notification?.body || "",
//                 data: remoteMessage.data,
//                 priority: "high",
//                 sound: "notification.wav",
//             },
//             trigger: {
//                 type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
//                 seconds: 1,
//                 channelId: 'new_ride',
                
//             },
//         });
//     });

//     // Lorsque l'utilisateur clique sur la notification en foreground
//     unsubscribeForegroundClick = Notifications.addNotificationResponseReceivedListener(response => {
//         console.log("Notification cliquée:", response);
//         // handleNotificationRedirect(response.notification.request.content);
//         router.push({ pathname: response.notification.request.content.data?.url, params: { id: response.notification.request.content.data?.id } })
//     });

//     // Retourner une fonction pour désactiver les listeners quand le composant est démonté
//     return () => {
//         if (unsubscribeOnMessage) unsubscribeOnMessage();
//         if (unsubscribeOnNotificationOpenedApp) unsubscribeOnNotificationOpenedApp();
//         if (unsubscribeForegroundClick) unsubscribeForegroundClick.remove();
//     };
// };