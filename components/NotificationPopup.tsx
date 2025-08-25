import React, { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, Platform } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useNotificationModal } from '@/store/useNotificationModal';


const line = (label: string, value?: string) => (
    !!value ? (
        <View style={{ marginTop: 6 }}>
            <Text style={{ fontWeight: '600' }}>{label}</Text>
            <Text style={{ marginTop: 2 }}>{value}</Text>
        </View>
    ) : null
);


export default function NotificationPopup() {
    const { visible, payload, hide } = useNotificationModal();
    const data = payload?.data ?? {};


    const primaryCta = useMemo(() => {
        // Choix dynamique du CTA principal selon le type
        switch (data?.type) {
            case 'NEW_RIDE':
                return 'Voir la course';
            default:
                return 'Ouvrir';
        }
    }, [data?.type]);


    const onOpen = () => {
        try {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch { }


        // Priorité: url explicite -> sinon route par défaut NEW_RIDE
        if (data?.url) {
            router.push({ pathname: data.url, params: { id: data?.id } });
        } else if (data?.type === 'NEW_RIDE' && data?.rideId) {
            // Adapte la route à ton arborescence (ex: '/(driver)/ride/[id]')
            router.push({ pathname: `/ride/${String(data.rideId)}` });
        }
        hide();
    };


    const onDismiss = () => hide();


    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
                <View style={{ width: '100%', maxWidth: 420, borderRadius: 16, backgroundColor: 'white', padding: 16 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700' }}>{payload?.title ?? 'Notification'}</Text>
                    {line('Message', payload?.body)}


                    {/* Contenu riche selon les données envoyées */}
                    {data?.type === 'NEW_RIDE' ? (
                        <View style={{ marginTop: 8 }}>
                            {line('Départ', data?.pickup?.address)}
                            {line('Arrivée', data?.drop?.address)}
                            {line('Distance', (typeof data?.distanceInKm === 'number' ? `${data.distanceInKm.toFixed(1)} km` : data?.distanceInKm))}
                            {line('Durée estimée', (typeof data?.estimatedDuration === 'number' ? `${Math.round(data.estimatedDuration)} min` : data?.estimatedDuration))}
                        </View>
                    ) : null}


                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 16 }}>
                        <TouchableOpacity onPress={onDismiss} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8 }}>
                            <Text style={{ fontWeight: '600' }}>Ignorer</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onOpen} style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#2563EB' }}>
                            <Text style={{ fontWeight: '600', color: 'white' }}>{primaryCta}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}