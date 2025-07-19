 
import { DisplayLoading } from '@/components/DisplayLoading';
import RenderEnCours from '@/components/RenderEnCours';
import RenderHistorique from '@/components/RenderHistorique';
import { apiRequest } from '@/services/api';
import useStore from '@/store/useStore';
import { groupByDate } from '@/utils/groupByDate';
import { Icon } from '@rneui/base';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SceneMap, TabBar, TabView } from 'react-native-tab-view';

const initialLayout = { width: Dimensions.get('window').width };

export default function HistoriqueScreen() {
  const insets = useSafeAreaInsets();

  const { tok, isAuthenticated, historiques, setHistorique, enCours, setEnCours } = useStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const groupedHistorique = groupByDate(historiques, 'createdAt');

  const fetchRides = useCallback(async () => {
    try {
      setLoading(true);
      const [historiqueRes, enCoursRes] = await Promise.all([
        apiRequest({ method: 'GET', endpoint: "ride/rides?status=PAYED", token: tok }),
        apiRequest({ method: 'GET', endpoint: "ride/rides", token: tok }),
      ]);
      setHistorique(historiqueRes.rides);
      setEnCours(enCoursRes.rides);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tok, setHistorique, setEnCours]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchRides();
    }
  }, [fetchRides, isAuthenticated]);

  const onRefresh = () => {
    try {
      fetchRides();
    } catch (error) {
      console.error(error);
      setRefreshing(false);
    }
  };

  // Définition des scènes pour chaque onglet
  const EnCoursScene = () => {
    if (loading) return <DisplayLoading />;
    return (
      <FlatList
        data={enCours}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <RenderEnCours ride={item} /> // composant spécifique aux courses en cours
        )}
        ListEmptyComponent={
          <View className="items-center mt-16">
            <Image source={require("../../assets/images/no-data.png")} className="w-44 h-44 mb-4" />
            <Text className="text-gray-500 font-['RubikRegular']">aucune course en cours</Text>
          </View>
        }
      />
    );
  };

  const HistoriqueScene = () => {
    if (loading) return <DisplayLoading />;
    return (
      <FlatList
        data={groupedHistorique}
        keyExtractor={(item) => item.title}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="mb-6 w-full flex-1">
            <Text className="text-sm text-black mb-2 font-['RubikBold']">{item.title}</Text>
            {Array.isArray(item.data) &&
              item.data.map((ride) => (
                <RenderHistorique key={ride._id} ride={ride} />
              ))}
          </View>
        )}
        ListEmptyComponent={
          <View style={{ justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 50 }}>
            <Image
              source={require("../../assets/images/no-data.png")}
              className="w-44 h-44 mb-4"
            />
            <Text style={{ color: 'gray', fontFamily: 'RubikRegular' }}>aucune course</Text>
          </View>
        }
      />
    );
  };

  const renderScene = SceneMap({
    enCours: EnCoursScene,
    historique: HistoriqueScene,
  });

  const [index, setIndex] = useState(0);
  const [routes] = useState([
    { key: 'enCours', title: 'En cours' },
    { key: 'historique', title: 'Historique' },
  ]);

  return (
    <View className="flex-1 bg-white">
      {/* En-tête */}
      <View
        className="px-3 flex-row w-full justify-between items-center mb-3"
        style={{ paddingTop: insets.top }}
      >
        <View className="flex-row items-center space-x-3">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profil')}
            className="w-12 h-12 rounded-full bg-primary border border-primary justify-center items-center"
          >
            <Icon type="font-awesome" name="user" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          className="w-12 h-12 rounded-full bg-primary border border-primary ml-2 justify-center items-center"
        >
          <Icon type="font-awesome" name="bell" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <TabView
        navigationState={{ index, routes }}
        renderScene={renderScene}
        onIndexChange={setIndex}
        initialLayout={initialLayout}
        renderTabBar={(props) => (
          <TabBar
            {...props}
            indicatorStyle={{ backgroundColor: '#ff6d00', height: 3 }}
            style={{ backgroundColor: 'white', elevation: 2 }}
            activeColor="#ff6d00"
            inactiveColor="gray"
            pressColor="transparent"
            scrollEnabled={false}
            tabStyle={{
              width: Dimensions.get('window').width / routes.length,
            }}
            // labelStyle={{
            //   fontFamily: 'RubikBold',
            //   fontSize: 14,
            //   textTransform: 'none',
            // }}
          />
        )}
      />
    </View>
  );
}




// /* eslint-disable react-hooks/rules-of-hooks */
// import { DisplayLoading } from '@/components/DisplayLoading';
// import RenderHistorique from '@/components/RenderHistorique';
// import { apiRequest } from '@/services/api';
// import useStore from '@/store/useStore';
// import { Icon } from '@rneui/base';
// import { router } from 'expo-router';
// import { useCallback, useEffect, useState } from 'react';
// import { FlatList, Image, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { groupByDate } from '@/utils/groupByDate';

// export default function historique() {
//   const insets = useSafeAreaInsets();

//   const { tok, isAuthenticated, historiques, setHistorique } = useStore();

//   const [loading, setLoading] = useState(false)
//   const [refreshing, setRefreshing] = useState(false);

//   const newHistorique = groupByDate(historiques, 'createdAt');

//   const getRides = useCallback(async () => {
//     try {
//       setLoading(true)
//       const res = await apiRequest({
//         method: 'GET',
//         endpoint: "ride/rides?status=PAYED",
//         token: tok,
//       })

//       setHistorique(res.rides)
//       setLoading(false)
//     }
//     catch (e) {
//       console.log(e)
//       setLoading(false)
//     }
//   }, [setHistorique, tok])

//   useEffect(() => {
//     if (isAuthenticated) {
//       getRides()
//     }
//   }, [getRides, isAuthenticated])

//   const onRefresh = () => {
//     try {
//       getRides()
//     } catch (error) {
//       console.log(error)
//       setRefreshing(false);
//     } finally {
//       setRefreshing(false);
//     }
//   }

//   return (
//     <View className="flex-1 bg-white">
//       <View
//         className="px-3 flex-row w-full justify-between items-center mb-3"
//         style={{ top: insets.top }}
//       >
//         <View style={{ flex: 0.75 }} className='h-14 flex-row items-center'>
//           <TouchableOpacity onPress={() => router.push('/(tabs)/profil')} className="w-10 h-10 justify-center items-center rounded-full bg-primary/80 border border-primary">
//             <Icon type="font-awesome" name="user" size={20} color="#FFFFFF" />
//           </TouchableOpacity>
//         </View>

//         <TouchableOpacity onPress={() => router.push('/notifications')} className="w-10 h-10 justify-center items-center rounded-full bg-primary/80 border border-primary ml-2">
//           <Icon type="font-awesome" name="bell" size={20} color="#FFFFFF" />
//         </TouchableOpacity>
//       </View>

//       {
//         loading ?
//           <DisplayLoading />
//           :
//           <FlatList
//             refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
//             data={newHistorique}
//             // keyExtractor={(item) => item._id}
//             keyExtractor={(item) => item.title}
//             contentContainerStyle={{ padding: 16 }}
//             renderItem={({ item }) => (
//               <View className="mb-6 w-full flex-1">
//                 <Text className="text-lg text-black mb-2 font-['RubikBold'] ">{item.title}</Text>
//                 {Array.isArray(item?.data) &&
//                   item.data.map((item) => (
//                     <RenderHistorique key={item._id} ride={item} />
//                   ))}
//               </View>
//             )}
//             ListEmptyComponent={
//               <View style={{ justifyContent: 'center', alignItems: 'center', alignContent: "center", padding: 40, marginTop: 50 }}>
//                 <Image
//                   source={require("../../assets/images/no-data.png")}
//                   className="w-44 h-44 mb-4"
//                 />
//                 <Text style={{ color: 'gray', fontFamily: 'RubikRegular' }}>aucune course</Text>
//               </View>
//             }
//           />
//       }
//     </View>
//   );
// }
