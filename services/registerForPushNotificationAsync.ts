import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiUrl } from './api';

export async function registerForPushNotificationsAsync(tok: string){
    let token;

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Permission non accordée');
            return;
        }

        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
            if (!projectId) {
                throw new Error('Project ID not found');
            }

            token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
            // token = (await Notifications.getDevicePushTokenAsync()).data;

            await fetch(apiUrl + 'addNotifToken', {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                    Authorization: 'Bearer ' + tok,
                },
                body: JSON.stringify({
                    'token': token,
                })
            })
                .then(response => response.json())
                .then(res => {
                    // console.log(res)
                })
                .catch(e => {
                    console.log(e)
                })
        } catch (e) {
            token = `${e}`;
        }
    } else {
        console.log('Les notifications push ne sont pas supportées sur un simulateur');
    }

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    return token;
}
