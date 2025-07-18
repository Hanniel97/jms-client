import { NotificationListener } from '@/services/notificationHandler';
import { registerForPushNotificationsAsync } from '@/services/registerForPushNotificationAsync';
import useStore from '@/store/useStore';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

// function useNotificationObserver() {
//     useEffect(() => {
//         let isMounted = true;

//         function redirect(notification: Notifications.Notification) {
//             const url = notification.request.content.data?.url;
//             if (url) {
//                 // router.push(url, params: {});
//                 router.push({ pathname: url, params: { id: notification.request.content.data?.id } })
//             }
//         }

//         Notifications.getLastNotificationResponseAsync()
//             .then(response => {
//                 if (!isMounted || !response?.notification) {
//                     return;
//                 }
//                 redirect(response?.notification);
//             });

//         const subscription = Notifications.addNotificationResponseReceivedListener(response => {
//             redirect(response.notification);
//         });

//         return () => {
//             isMounted = false;
//             subscription.remove();
//         };
//     }, []);
// }

interface Props {
    isConnected: boolean
}

const Routes = ({ isConnected }: Props) => {
    const { isAuthenticated, tok } = useStore();

    // useNotificationObserver();

    useEffect(() => {
        // Enregistrer le token push
        if (isAuthenticated) {
            registerForPushNotificationsAsync(tok);
        }

    }, [tok, isAuthenticated]);

    useEffect(() => {
        const unsubscribe = NotificationListener();
        return () => {
            unsubscribe(); // Nettoie les écouteurs pour éviter les écoutes multiples
        };
    }, []);

    return (
        <Stack screenOptions={{headerShown: false}}>
            {
                isConnected ? (
                    <>
                        <Stack.Screen name="index" options={{ headerShown: false }} />
                        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                        <Stack.Screen name="editprofil" options={{ headerShown: false }} />
                        <Stack.Screen name="rechargewallet" options={{ headerShown: false }} />
                        <Stack.Screen name="changepassword" options={{ headerShown: false }} />
                        <Stack.Screen name="policy" options={{ headerShown: false }} />
                        <Stack.Screen name="contactus" options={{ headerShown: false }} />
                        <Stack.Screen name="notifications" options={{ headerShown: false }} />
                        <Stack.Screen name="deleteaccount" options={{ headerShown: false }} />
                        <Stack.Screen name="addcourse" options={{ headerShown: false }} />
                        <Stack.Screen name="liveride" options={{ headerShown: false }} />
                        <Stack.Screen name="ridedetails" options={{ headerShown: false }} />
                        <Stack.Screen name="wallet" options={{ headerShown: false }} />
                        <Stack.Screen name="_offline" options={{ headerShown: false }} />
                    </>
                )

                    :
                    (
                        <Stack.Screen name="_offline" options={{ headerShown: false }} />
                    )}

        </Stack>
    )
}

export default Routes;