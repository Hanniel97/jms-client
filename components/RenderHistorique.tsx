import { IRide } from '@/types';
import React from 'react';
import { Text, View } from 'react-native';
import moment from 'moment';
import 'moment/locale/fr';

moment.locale('fr');

type Props = {
    ride: IRide;
};


const RenderHistorique: React.FC<Props> = ({ ride }) => {
    console.log(ride.distance)
    
    return (
        <View className="flex-1 w-full my-2 justify-between rounded-lg p-3 border-[1px] border-primary">
            <View className="flex-row justify-between">
                <Text numberOfLines={1} className="font-['RubikBold'] text-gray-800 flex">{ride?.rider?.prenom} {ride?.rider?.nom}</Text>
                <Text numberOfLines={1} className="font-['RubikRegular']">{moment(ride.createdAt).format('HH:MM')}</Text>
            </View>

            <View className="flex-row justify-between mt-2">
                <Text numberOfLines={1} className="font-['RubikBold'] text-gray-400 uppercase">{ride?.vehicle} </Text>
                <Text numberOfLines={1} className="font-['RubikRegular'] text-gray-400">{ride.fare.toFixed(0)} XOF</Text>
            </View>
        </View>
    )
}

export default RenderHistorique;