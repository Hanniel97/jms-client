/* eslint-disable react-hooks/rules-of-hooks */
import { DisplayLoading } from '@/components/DisplayLoading';
import RenderHistorique from '@/components/RenderHistorique';
import { apiRequest } from '@/services/api';
import useStore from '@/store/useStore';
// import { IRide } from '@/types';
import { Icon } from '@rneui/base';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { groupByDate } from '@/utils/groupByDate';

// const data = [
//   {
//     "_id": "6862c9562afaa9bfa47e7e55",
//     "vehicle": "confort",
//     "distance": 7.962433528593179,
//     "pickup": {
//       "address": "3eme vons à droite après pharmacie Deo gratias en quittant Cotonou, Cocotomey, Bénin",
//       "latitude": 6.3891101,
//       "longitude": 2.3093765
//     },
//     "drop": {
//       "address": "F82W+4P8, BP 126, Abomey Calavi, Benin",
//       "latitude": 6.4502938,
//       "longitude": 2.3468167
//     },
//     "fare": 4879.338440726248,
//     "paymentMethod": "orange",
//     "customer": {
//       "_id": {
//         "$oid": "686137f75891d8cb28a2b7e8"
//       },
//       "role": "customer",
//       "phone": "+22997722461",
//       "email": "",
//       "birthday": {
//         "$date": "2025-06-29T12:39:37.482Z"
//       },
//       "pushNotificationToken": null,
//       "photo": "uploads\\profil\\1751201993644-984911972.jpeg",
//       "disabled": false,
//       "wallet": 0,
//       "idCard": "",
//       "verified": true,
//       "otp": null,
//       "otp_expiry": null,
//       "createdAt": {
//         "$date": "2025-06-29T12:56:23.751Z"
//       },
//       "updatedAt": {
//         "$date": "2025-06-29T12:59:54.030Z"
//       },
//       "__v": 0,
//       "password": "$2b$10$qH.5meAejo8oruYKaJBpQ.vuDPcvndlqaMSE29rYUKneIWZ.8k1QG",
//       "nom": "EKPELIKPEZE",
//       "prenom": "Hanniel"
//     },
//     "rider": {
//       "_id": {
//         "$oid": "686137f75891d8cb28a2b7e8"
//       },
//       "role": "rider",
//       "phone": "+22997722461",
//       "email": "",
//       "birthday": {
//         "$date": "2025-06-29T12:39:37.482Z"
//       },
//       "pushNotificationToken": null,
//       "photo": "uploads\\profil\\1751201993644-984911972.jpeg",
//       "disabled": false,
//       "wallet": 0,
//       "idCard": "",
//       "verified": true,
//       "otp": null,
//       "otp_expiry": null,
//       "createdAt": {
//         "$date": "2025-06-29T12:56:23.751Z"
//       },
//       "updatedAt": {
//         "$date": "2025-06-29T12:59:54.030Z"
//       },
//       "__v": 0,
//       "password": "$2b$10$qH.5meAejo8oruYKaJBpQ.vuDPcvndlqaMSE29rYUKneIWZ.8k1QG",
//       "nom": "DOE",
//       "prenom": "John"
//     },
//     "status": "COMPLETED",
//     "otp": "9256",
//     "createdAt": "2025-06-30T14:28:54.066Z",
//     "updatedAt": "2025-06-30T17:28:54.066Z",
//     "__v": 0
//   },
//   {
//     "_id": "6862c9562afaa9bfa47e7e56",
//     "vehicle": "eco",
//     "distance": 7.962433528593179,
//     "pickup": {
//       "address": "3eme vons à droite après pharmacie Deo gratias en quittant Cotonou, Cocotomey, Bénin",
//       "latitude": 6.3891101,
//       "longitude": 2.3093765
//     },
//     "drop": {
//       "address": "F82W+4P8, BP 126, Abomey Calavi, Benin",
//       "latitude": 6.4502938,
//       "longitude": 2.3468167
//     },
//     "fare": 4879.338440726248,
//     "paymentMethod": "orange",
//     "customer": {
//       "_id": {
//         "$oid": "686137f75891d8cb28a2b7e8"
//       },
//       "role": "customer",
//       "phone": "+22997722461",
//       "email": "",
//       "birthday": {
//         "$date": "2025-06-29T12:39:37.482Z"
//       },
//       "pushNotificationToken": null,
//       "photo": "uploads\\profil\\1751201993644-984911972.jpeg",
//       "disabled": false,
//       "wallet": 0,
//       "idCard": "",
//       "verified": true,
//       "otp": null,
//       "otp_expiry": null,
//       "createdAt": {
//         "$date": "2025-06-29T12:56:23.751Z"
//       },
//       "updatedAt": {
//         "$date": "2025-06-29T12:59:54.030Z"
//       },
//       "__v": 0,
//       "password": "$2b$10$qH.5meAejo8oruYKaJBpQ.vuDPcvndlqaMSE29rYUKneIWZ.8k1QG",
//       "nom": "EKPELIKPEZE",
//       "prenom": "Hanniel"
//     },
//     "rider": {
//       "_id": {
//         "$oid": "686137f75891d8cb28a2b7e8"
//       },
//       "role": "rider",
//       "phone": "+22997722461",
//       "email": "",
//       "birthday": {
//         "$date": "2025-06-29T12:39:37.482Z"
//       },
//       "pushNotificationToken": null,
//       "photo": "uploads\\profil\\1751201993644-984911972.jpeg",
//       "disabled": false,
//       "wallet": 0,
//       "idCard": "",
//       "verified": true,
//       "otp": null,
//       "otp_expiry": null,
//       "createdAt": {
//         "$date": "2025-06-29T12:56:23.751Z"
//       },
//       "updatedAt": {
//         "$date": "2025-06-29T12:59:54.030Z"
//       },
//       "__v": 0,
//       "password": "$2b$10$qH.5meAejo8oruYKaJBpQ.vuDPcvndlqaMSE29rYUKneIWZ.8k1QG",
//       "nom": "DOE",
//       "prenom": "John"
//     },
//     "status": "COMPLETED",
//     "otp": "9256",
//     "createdAt": "2025-06-30T17:28:54.066Z",
//     "updatedAt": "2025-06-30T17:28:54.066Z",
//     "__v": 0
//   },
//   {
//     "_id": "6862c9562afaa9bfa47e7e57",
//     "vehicle": "eco",
//     "distance": 7.962433528593179,
//     "pickup": {
//       "address": "3eme vons à droite après pharmacie Deo gratias en quittant Cotonou, Cocotomey, Bénin",
//       "latitude": 6.3891101,
//       "longitude": 2.3093765
//     },
//     "drop": {
//       "address": "F82W+4P8, BP 126, Abomey Calavi, Benin",
//       "latitude": 6.4502938,
//       "longitude": 2.3468167
//     },
//     "fare": 4879.338440726248,
//     "paymentMethod": "orange",
//     "customer": {
//       "_id": {
//         "$oid": "686137f75891d8cb28a2b7e8"
//       },
//       "role": "customer",
//       "phone": "+22997722461",
//       "email": "",
//       "birthday": {
//         "$date": "2025-06-29T12:39:37.482Z"
//       },
//       "pushNotificationToken": null,
//       "photo": "uploads\\profil\\1751201993644-984911972.jpeg",
//       "disabled": false,
//       "wallet": 0,
//       "idCard": "",
//       "verified": true,
//       "otp": null,
//       "otp_expiry": null,
//       "createdAt": {
//         "$date": "2025-06-29T12:56:23.751Z"
//       },
//       "updatedAt": {
//         "$date": "2025-06-29T12:59:54.030Z"
//       },
//       "__v": 0,
//       "password": "$2b$10$qH.5meAejo8oruYKaJBpQ.vuDPcvndlqaMSE29rYUKneIWZ.8k1QG",
//       "nom": "EKPELIKPEZE",
//       "prenom": "Hanniel"
//     },
//     "rider": {
//       "_id": {
//         "$oid": "686137f75891d8cb28a2b7e8"
//       },
//       "role": "rider",
//       "phone": "+22997722461",
//       "email": "",
//       "birthday": {
//         "$date": "2025-06-29T12:39:37.482Z"
//       },
//       "pushNotificationToken": null,
//       "photo": "uploads\\profil\\1751201993644-984911972.jpeg",
//       "disabled": false,
//       "wallet": 0,
//       "idCard": "",
//       "verified": true,
//       "otp": null,
//       "otp_expiry": null,
//       "createdAt": {
//         "$date": "2025-06-29T12:56:23.751Z"
//       },
//       "updatedAt": {
//         "$date": "2025-06-29T12:59:54.030Z"
//       },
//       "__v": 0,
//       "password": "$2b$10$qH.5meAejo8oruYKaJBpQ.vuDPcvndlqaMSE29rYUKneIWZ.8k1QG",
//       "nom": "DOE",
//       "prenom": "John"
//     },
//     "status": "COMPLETED",
//     "otp": "9256",
//     "createdAt": "2025-06-30T17:28:54.066Z",
//     "updatedAt": "2025-06-30T17:28:54.066Z",
//     "__v": 0
//   },
// ]

export default function historique() {
  const insets = useSafeAreaInsets();

  const { user, tok, isAuthenticated, historiques, setHistorique } = useStore();

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

      console.log('rides', res)

      setHistorique(res.rides)
      setLoading(false)
      // getReservationLength(user._id, tok, setReservationLength, setPanierLength)
    }
    catch (e) {
      console.log(e)
      setLoading(false)
    }
  }, [setHistorique, tok, user._id])

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
            // renderItem={({ item }: { item: IRide }) => (
            //   <RenderHistorique
            //     ride={item}
            //   />
            // )}
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
