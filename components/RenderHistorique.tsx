import { IRide } from '@/types';
import { router } from 'expo-router';
import moment from 'moment';
import 'moment/locale/fr';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

moment.locale('fr');

type Props = {
    ride: IRide;
};

const RenderHistorique: React.FC<Props> = ({ ride }) => {
    
    return (
        <TouchableOpacity onPress={() =>{router.push({pathname: "/ridedetails", params: {item: JSON.stringify(ride)}})}} className="flex-1 w-full my-1 justify-between rounded-lg p-3 border-[1px] border-primary/40">
            <View className="flex-row justify-between">
                <Text numberOfLines={1} className="font-['RubikBold'] text-gray-800 flex">{ride?.rider?.prenom} {ride?.rider?.nom}</Text>
                <Text numberOfLines={1} className="font-['RubikRegular']">{moment(ride.createdAt).format('HH:mm')}</Text>
            </View>

            <View className="flex-row justify-between mt-2">
                <Text numberOfLines={1} className="font-['RubikBold'] text-gray-400 uppercase">{ride?.vehicle} </Text>
                <Text numberOfLines={1} className="font-['RubikRegular'] text-gray-400">{ride.fare.toFixed(0)} XOF</Text>
            </View>
        </TouchableOpacity>
    )
}

export default RenderHistorique;