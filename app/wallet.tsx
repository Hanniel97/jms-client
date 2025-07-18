import CustomHeader from '@/components/CustomHeader';
import { apiRequest } from '@/services/api';
import useStore from '@/store/useStore';
import { IRecharge } from '@/types';
import { Icon } from '@rneui/themed';
import { router } from 'expo-router';
import { DisplayLoading } from '@/components/DisplayLoading';
import moment from 'moment';
import 'moment/locale/fr';
import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';

moment.locale('fr');

export default function WalletHistory() {
    const { user, tok } = useStore();
    const [history, setHistory] = useState<IRecharge[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchWalletData = useCallback(async () => {
        // setLoading(true)
        try {
            const res = await apiRequest({
                method: 'GET',
                endpoint: `transaction/get/all?user=${user._id}`,
                token: tok,
            });

            console.log(res)

            if (res.success) {
                setHistory(res.data)
                setLoading(false)
            } else {
                setLoading(false)
            }
        } catch (error) {
            setLoading(false)
            console.log('Erreur lors de la récupération du wallet:', error);
        }
    }, [user._id, tok]);

    useEffect(() => {
        fetchWalletData();
    }, [fetchWalletData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchWalletData();
        setRefreshing(false);
    };

    return (
        <View className="flex-1 bg-white">
            <CustomHeader title="Mon Portefeuille" showBack />

            {/* === SOLDE === */}
            <View className="px-4 mt-4 mb-2">
                <View className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <Text className="text-gray-500 font-['RubikRegular']">Solde actuel</Text>
                    <Text className="text-3xl text-blue-900 mt-1 font-['RubikBold']">
                        {user.wallet.toLocaleString()} XOF
                    </Text>
                </View>

                <TouchableOpacity
                    className="bg-primary mt-4 py-3 px-4 rounded-full flex-row items-center justify-center"
                    onPress={() => router.push('/rechargewallet')}
                >
                    <Icon name="plus" type="feather" color="#fff" size={18} />
                    <Text className="ml-2 text-white text-base font-['RubikBold']">Recharger</Text>
                </TouchableOpacity>
            </View>

            {/* === HISTORIQUE === */}
            <View className="px-4 mt-4">
                <Text className="text-lg mb-2 font-['RubikBold']">Historique des recharges</Text>
            </View>

            {
                loading ?
                    <DisplayLoading />
                    :
                    <FlatList
                        data={history}
                        keyExtractor={(_, index) => index.toString()}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                        ListEmptyComponent={
                            <Text className="text-center text-gray-400 mt-8 font-['RubikRegular']">Aucune recharge trouvée.</Text>
                        }
                        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                        renderItem={({ item }) => (
                            <View className="bg-white border border-gray-100 shadow-sm rounded-lg p-4 flex-row justify-between items-center mb-2">
                                <View>
                                    <Text className="text-gray-700 font-['RubikSemiBold']">
                                        +{item.amount.toLocaleString()} XOF
                                    </Text>
                                    <Text className="text-sm text-gray-400 font-['RubikRegular']">{moment(item.createdAt).calendar()}</Text>
                                </View>
                                <Icon name="check-circle" type="feather" color="#16a34a" size={20} />
                            </View>
                        )}
                    />
            }


        </View>
    );
}
