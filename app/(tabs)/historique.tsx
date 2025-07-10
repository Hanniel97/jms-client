/* eslint-disable react-hooks/rules-of-hooks */
import { DisplayLoading } from '@/components/DisplayLoading';
import RenderHistorique from '@/components/RenderHistorique';
import { apiRequest } from '@/services/api';
import useStore from '@/store/useStore';
import { Icon } from '@rneui/base';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupByDate } from '@/utils/groupByDate';

export default function historique() {
  const insets = useSafeAreaInsets();

  const { tok, isAuthenticated, historiques, setHistorique } = useStore();

  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false);

  const newHistorique = groupByDate(historiques, 'createdAt');

  const getRides = useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiRequest({
        method: 'GET',
        endpoint: "ride/rides?status=PAYED",
        token: tok,
      })

      setHistorique(res.rides)
      setLoading(false)
    }
    catch (e) {
      console.log(e)
      setLoading(false)
    }
  }, [setHistorique, tok])

  useEffect(() => {
    if (isAuthenticated) {
      getRides()
    }
  }, [getRides, isAuthenticated])

  const onRefresh = () => {
    try {
      getRides()
    } catch (error) {
      console.log(error)
      setRefreshing(false);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <View className="flex-1 bg-white">
      <View
        className="px-3 flex-row w-full justify-between items-center mb-3"
        style={{ top: insets.top }}
      >
        <View style={{ flex: 0.75 }} className='h-14 flex-row items-center'>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profil')} className="w-10 h-10 justify-center items-center rounded-full bg-primary/80 border border-primary">
            <Icon type="font-awesome" name="user" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/notifications')} className="w-10 h-10 justify-center items-center rounded-full bg-primary/80 border border-primary ml-2">
          <Icon type="font-awesome" name="bell" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {
        loading ?
          <DisplayLoading />
          :
          <FlatList
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            data={newHistorique}
            // keyExtractor={(item) => item._id}
            keyExtractor={(item) => item.title}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View className="mb-6 w-full flex-1">
                <Text className="text-lg text-black mb-2 font-['RubikBold'] ">{item.title}</Text>
                {Array.isArray(item?.data) &&
                  item.data.map((item) => (
                    <RenderHistorique key={item._id} ride={item} />
                  ))}
              </View>
            )}
            ListEmptyComponent={
              <View style={{ justifyContent: 'center', alignItems: 'center', alignContent: "center", padding: 40, marginTop: 50 }}>
                <Image
                  source={require("../../assets/images/no-data.png")}
                  className="w-44 h-44 mb-4"
                />
                <Text style={{ color: 'gray', fontFamily: 'RubikRegular' }}>aucune course</Text>
              </View>
            }
          />
      }
    </View>
  );
}
