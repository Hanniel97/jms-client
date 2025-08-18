import { INotification } from '@/types';
import { Icon } from '@rneui/base';
import React, { useMemo } from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

type Props = {
    notification: INotification;
};

/** Helpers responsive (base 375x812) */
const BASE_W = 375;
const BASE_H = 812;
const hs = (size: number, w: number) => (size * w) / BASE_W;
const vs = (size: number, h: number) => (size * h) / BASE_H;
const ms = (size: number, w: number, factor = 0.5) =>
    size + (hs(size, w) - size) * factor;

const RenderNotification: React.FC<Props> = ({ notification }) => {
    const { width, height } = useWindowDimensions();

    // tokens responsives
    const padV = Math.max(10, vs(10, height));
    const padH = Math.max(12, hs(12, width));
    const radius = ms(12, width);
    const gapSm = ms(6, width);
    const gapMd = ms(10, width);

    const iconSize = Math.round(ms(20, width));
    const circle = Math.max(44, ms(48, width));

    const fsTitle = ms(15, width);
    const fsBody = ms(13, width);
    const fsTime = ms(11.5, width);

    // mapping type → icône & couleurs
    const typeStyle = useMemo(() => {
        switch ((notification?.type || '').toLowerCase()) {
            case 'recharge':
                return { name: 'wallet', type: 'entypo' as const, bg: '#10b981' }; // emerald
            case 'paiement':
                return { name: 'credit-card-alt', type: 'font-awesome' as const, bg: '#FF6D00' }; // blue
            case 'reduction':
                return { name: 'gift', type: 'ionicon' as const, bg: '#a855f7' }; // violet
            default:
                return { name: 'bell', type: 'feather' as const, bg: '#6b7280' }; // gray
        }
    }, [notification?.type]);

    const title = notification?.title || '—';
    const body = notification?.body || '';
    const timeLabel = notification?.createdAt
        ? moment(notification.createdAt).calendar()
        : '';

    return (
        <View
            style={{
                width: '100%',
                backgroundColor: '#fff',
                paddingVertical: padV,
                paddingHorizontal: padH,
                borderRadius: radius,
                borderWidth: 1,
                borderColor: 'rgba(59,130,246,0.18)', // primary/20 approx
                marginBottom: vs(10, height),
                flexDirection: 'row',
                alignItems: 'flex-start',
                // ombre légère
                shadowColor: '#000',
                shadowOpacity: 0.06,
                shadowOffset: { width: 0, height: 2 },
                shadowRadius: 6,
                elevation: 1,
            }}
            accessibilityRole="summary"
            accessibilityLabel={`${title}. ${body}`}
        >
            {/* Icône circulaire à gauche */}
            <View
                style={{
                    width: circle,
                    height: circle,
                    borderRadius: circle / 2,
                    backgroundColor: typeStyle.bg,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: hs(10, width),
                    flexShrink: 0,
                }}
            >
                <Icon
                    name={typeStyle.name}
                    type={typeStyle.type}
                    size={iconSize}
                    color="#FFFFFF"
                />
            </View>

            {/* Contenu à droite (titre, corps, horodatage) */}
            <View style={{ flex: 1 }}>
                <Text
                    numberOfLines={1}
                    style={{
                        fontSize: fsTitle,
                        fontWeight: '700',
                        color: '#111827', // gray-900
                        marginBottom: gapSm,
                    }}
                >
                    {title}
                </Text>

                {!!body && (
                    <Text
                        numberOfLines={3}
                        style={{
                            fontSize: fsBody,
                            color: '#6b7280', // gray-500
                            lineHeight: Math.round(fsBody * 1.35),
                            marginBottom: gapMd,
                        }}
                    >
                        {body}
                    </Text>
                )}

                {!!timeLabel && (
                    <Text
                        numberOfLines={1}
                        style={{
                            fontSize: fsTime,
                            color: '#9ca3af', // gray-400
                        }}
                    >
                        {timeLabel}
                    </Text>
                )}
            </View>
        </View>
    );
};

export default RenderNotification;



// import { INotification } from '@/types';
// import { Icon } from '@rneui/base';
// import React from 'react';
// import { Text, View } from 'react-native';
// import moment from 'moment';
// import 'moment/locale/fr';

// moment.locale('fr');

// type Props = {
//     notification: INotification;
//     // onConfirmer: (id: string) => void;
//     // onAnnuler: (id: string) => void;
//     // onTraiter: (id: string) => void;
//     // loading2: boolean
//     // loading3: boolean
//     // loading4: boolean
// };


// const RenderNotification: React.FC<Props> = ({ notification }) => {

//     return (
//         <View className="flex-row flex-1 w-full mb-3 justify-center items-center">
//             <View className="bg-primary h-12 w-12 rounded-full justify-center items-center">
//                 {notification.type === "recharge" ?
//                     <Icon name="wallet" type='entypo' size={20} color="#FFFFFF" />
//                     : notification.type === "paiement" ?
//                         <Icon name="credit-card-alt" type='font-awesome' size={20} color="#FFFFFF" />
//                         : notification.type === "reduction" ?
//                             <Icon name="gift" type='ionicon' size={20} color="#FFFFFF" />
//                             : null
//                 }

//             </View>

//             <View className="ml-2 flex-1">
//                 <Text numberOfLines={1} className="font-['RubikBold'] text-gray-800 flex">{notification.title}</Text>
//                 <Text numberOfLines={3} className="font-['RubikRegular'] text-gray-400">{notification.body}</Text>
//                 {/* <Text numberOfLines={1} className="text-xs text-gray-500 font-['RubikRegular']"> {notification.type === "don" ? "réservé " : "pris en charge "}
//                             {moment(notification.createdAt).calendar()}
//                         </Text> */}
//             </View>
//         </View>
//     )
// }

// export default RenderNotification