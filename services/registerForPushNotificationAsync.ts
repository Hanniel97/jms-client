import useStore from '@/store/useStore';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { apiUrl } from './api';

export async function registerForPushNotificationsAsync(authToken: string) {
    if (!Device.isDevice) {
        console.log('Push non supporté sur simulateur');
        return null;
    }

    // 1) Permissions (Android 13+ nécessite POST_NOTIFICATIONS)
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }
    if (finalStatus !== 'granted') {
        console.log('Permission notifications refusée');
        return null;
    }

    // 2) Résolution projectId (nouveau compte)
    const EXTRA: any =
        (Constants.expoConfig && (Constants.expoConfig as any).extra) ||
        (Constants.manifest && (Constants.manifest as any).extra) || {};
    const explicitProjectId = EXTRA?.eas?.projectId;
    const projectId =
        Constants.easConfig?.projectId || explicitProjectId || null;

    if (!projectId) {
        console.warn('projectId introuvable → passe-le via extra.eas.projectId ou utilise un dev/release build');
    }

    let token: string | null = null;

    // 3) Token Expo (prioritaire)
    try {
        const res = await Notifications.getExpoPushTokenAsync(
            projectId ? { projectId } : undefined
        );
        token = res?.data ?? null; // ExponentPushToken[...]
        console.log('Expo push token:', token);
    } catch (e) {
        console.warn('getExpoPushTokenAsync a échoué:', e);
    }

    // 4) Fallback device token (si APNs/FCM correctement configuré)
    if (!token) {
        try {
            const native = await Notifications.getDevicePushTokenAsync();
            token = native?.data ?? null; // iOS: APNs, Android: FCM
            if (token) console.log('Device token (fallback):', token);
        } catch (e) {
            console.warn('getDevicePushTokenAsync a échoué:', e);
        }
    }

    if (!token) {
        console.log('Aucun token obtenu');
        return null;
    }

    // 5) Envoi au backend 
    try {
        const res = await fetch(apiUrl + 'addNotifToken', {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + authToken,
            },
            body: JSON.stringify({
                token,
                provider: token.startsWith('ExponentPushToken') ? 'expo' : (Platform.OS === 'ios' ? 'apns' : 'fcm'),
            }),
        });
        const json = await res.json();
        console.log('addNotifToken:', json);
        // garde le token localement si tu veux
        useStore.getState().setPrices(json.data);
    } catch (e) {
        console.log('Envoi token backend échec:', e);
    }

    // 6) Channel Android
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('new_ride', {
            name: 'Notification de course',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
            sound: 'notification.wav',
        });
    }

    return token;
}




// import useStore from '@/store/useStore';
// import Constants from 'expo-constants';
// import * as Device from 'expo-device';
// import * as Notifications from 'expo-notifications';
// import { Platform } from 'react-native';
// import { apiUrl } from './api';

// export async function registerForPushNotificationsAsync(tok: string) {
//     let token;

//     // console.log("Registering for push notifications with token:", tok);

//     if (Device.isDevice) {
//         const { status: existingStatus } = await Notifications.getPermissionsAsync();
//         let finalStatus = existingStatus;

//         console.log("Existing notification permission status:", existingStatus);

//         if (existingStatus !== 'granted') {
//             const { status } = await Notifications.requestPermissionsAsync();
//             finalStatus = status;
//         }

//         if (finalStatus !== 'granted') {
//             console.log('Permission non accordée');
//             return;
//         }

//         try {
//             const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
//             if (!projectId) {
//                 throw new Error('Project ID not found');
//             }

//             // console.log("Using Expo project ID:", (await Notifications));

//             token = (
//                 await Notifications.getExpoPushTokenAsync({
//                     projectId,
//                 })
//             ).data;
//             console.log("token:", token);
//             // token = (await Notifications.getDevicePushTokenAsync()).data;

//             console.log("Push notification token:", token);

//             await fetch(apiUrl + 'addNotifToken', {
//                 method: 'POST',
//                 headers: {
//                     Accept: 'application/json',
//                     'Content-Type': 'application/json',
//                     Authorization: 'Bearer ' + tok,
//                 },
//                 body: JSON.stringify({
//                     'token': token,
//                 })
//             })
//                 .then(response => response.json())
//                 .then(res => {
//                     console.log("Response from addNotifToken:", res)
//                     useStore.getState().setPrices(res.data);
//                 })
//                 .catch(e => {
//                     console.log("Error adding notification token:", e)
//                 })
//         } catch (e) {
//             token = `${e}`;
//         }
//     } else {
//         console.log('Les notifications push ne sont pas supportées sur un simulateur');
//     }

//     if (Platform.OS === 'android') {
//         await Notifications.setNotificationChannelAsync('new_ride', {
//             name: 'Notification de course',
//             importance: Notifications.AndroidImportance.MAX,
//             vibrationPattern: [0, 250, 250, 250],
//             lightColor: '#FF231F7C',
//             sound: "notification.wav",
//         });
//     }

//     return token;
// }
