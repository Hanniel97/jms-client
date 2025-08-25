// components/NotificationTopBanner.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTopBanner } from '@/store/useTopBanner';

export default function NotificationTopBanner() {
    const { top } = useSafeAreaInsets();
    const { visible, current, hide } = useTopBanner();

    const slideY = useRef(new Animated.Value(-140)).current; // hauteur approx du banner
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && current) {
            Animated.timing(slideY, {
                toValue: 0,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();

            // auto-dismiss après 6s
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => onDismiss(), 6000);
        }
        // cleanup timer quand on change
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
                timerRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, current]);

    const onDismiss = () => {
        Animated.timing(slideY, {
            toValue: -140,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(() => hide());
    };

    const onPress = () => {
        const data = current?.data || {};
        if (data?.url) {
            router.push({ pathname: data.url, params: { id: data?.id } });
        } else if (data?.type === 'NEW_RIDE' && data?.rideId) {
            router.push({ pathname: `/ride/${String(data.rideId)}` });
        }
        onDismiss();
    };

    if (!visible || !current) return null;

    return (
        <Animated.View
            pointerEvents={visible ? 'auto' : 'none'}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                transform: [{ translateY: slideY }],
                zIndex: 9999,
            }}
        >
            <Pressable
                onPress={onPress}
                style={{
                    marginTop: top + (Platform.OS === 'android' ? 8 : 0),
                    marginHorizontal: 12,
                    borderRadius: 12,
                    backgroundColor: '#111827',
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    elevation: 6,
                }}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
                            {current.title}
                        </Text>
                        {current.body ? (
                            <Text style={{ color: 'white', opacity: 0.9, marginTop: 2 }} numberOfLines={2}>
                                {current.body}
                            </Text>
                        ) : null}
                    </View>
                    <Pressable onPress={onDismiss} hitSlop={12} style={{ marginLeft: 12 }}>
                        <Text style={{ color: 'white', fontWeight: '700' }}>×</Text>
                    </Pressable>
                </View>
            </Pressable>
        </Animated.View>
    );
}