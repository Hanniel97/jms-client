import { INotification } from '@/types';
import { Icon } from '@rneui/base';
import React from 'react';
import { Text, View } from 'react-native';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

type Props = {
    notification: INotification;
    // onConfirmer: (id: string) => void;
    // onAnnuler: (id: string) => void;
    // onTraiter: (id: string) => void;
    // loading2: boolean
    // loading3: boolean
    // loading4: boolean
};


const RenderNotification: React.FC<Props> = ({ notification }) => {

    return (
        <View className="flex-row flex-1 w-full mb-3 justify-center items-center">
            <View className="bg-primary h-12 w-12 rounded-full justify-center items-center">
                {notification.type === "recharge" ?
                    <Icon name="wallet" type='entypo' size={20} color="#FFFFFF" />
                    : notification.type === "paiement" ?
                        <Icon name="credit-card-alt" type='font-awesome' size={20} color="#FFFFFF" />
                        : notification.type === "reduction" ?
                            <Icon name="gift" type='ionicon' size={20} color="#FFFFFF" />
                            : null
                }

            </View>

            <View className="ml-2 flex-1">
                <Text numberOfLines={1} className="font-['RubikBold'] text-gray-800 flex">{notification.title}</Text>
                <Text numberOfLines={3} className="font-['RubikRegular'] text-gray-400">{notification.body}</Text>
                {/* <Text numberOfLines={1} className="text-xs text-gray-500 font-['RubikRegular']"> {notification.type === "don" ? "réservé " : "pris en charge "}
                            {moment(notification.createdAt).calendar()}
                        </Text> */}
            </View>
        </View>
    )
}

export default RenderNotification