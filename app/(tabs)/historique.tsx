import { DisplayLoading } from '@/components/DisplayLoading';
import RenderEnCours from '@/components/RenderEnCours';
import RenderHistorique from '@/components/RenderHistorique';
import { apiRequest } from '@/services/api';
import { useWS } from '@/services/WSProvider';
import useStore from '@/store/useStore';
import { IRide } from '@/types';
import { groupByDate } from '@/utils/groupByDate';
import { Icon } from '@rneui/base';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const PAGE_LIMIT = 10; // change si besoin

type Ride = { _id: string; createdAt?: string;[k: string]: any };

type Grouped = { title: string; data: Ride[] };

export default function HistoriqueScreen() {
  const insets = useSafeAreaInsets();

  const { emit } = useWS()

  // ✅ Ne garder que ce qui est nécessaire du store pour éviter des re-render inutiles
  const { tok, isAuthenticated, setHistorique, setEnCours } = useStore();

  // Onglet actif: 'enCours' | 'historique'
  const [activeTab, setActiveTab] = useState<'enCours' | 'historique'>('enCours');

  /* --- États locaux paginés --- */
  const [enCoursData, setEnCoursData] = useState<Ride[]>([]);
  const [enCoursPage, setEnCoursPage] = useState(1);
  const [enCoursTotalPages, setEnCoursTotalPages] = useState(1);
  const [loadingEnCours, setLoadingEnCours] = useState(false);
  const [loadingMoreEnCours, setLoadingMoreEnCours] = useState(false);
  const [refreshingEnCours, setRefreshingEnCours] = useState(false);

  const [historiqueData, setHistoriqueData] = useState<Ride[]>([]);
  const [historiquePage, setHistoriquePage] = useState(1);
  const [historiqueTotalPages, setHistoriqueTotalPages] = useState(1);
  const [loadingHistorique, setLoadingHistorique] = useState(false);
  const [loadingMoreHistorique, setLoadingMoreHistorique] = useState(false);
  const [refreshingHistorique, setRefreshingHistorique] = useState(false);

  // grouped data for rendering historique
  const groupedHistorique: Grouped[] = useMemo(
    () => groupByDate(historiqueData, 'createdAt'),
    [historiqueData]
  );

  /* ---------------------- fetchEnCours ---------------------- */
  const fetchEnCours = useCallback(
    async (page: number = 1, append: boolean = false) => {
      try {
        if (append) setLoadingMoreEnCours(true);
        else setLoadingEnCours(true);

        const endpoint = `ride/rides?page=${page}&limit=${PAGE_LIMIT}`;
        const res: any = await apiRequest({
          method: 'GET',
          endpoint,
          token: tok,
        });

        const rides: Ride[] = res?.rides ?? [];
        setEnCoursData((prev) => (append ? [...prev, ...rides] : rides));

        // pagination meta
        const totalPages =
          res?.pagination?.totalPages ??
          (res?.pagination?.total ? Math.ceil(res.pagination.total / PAGE_LIMIT) : 1);

        setEnCoursPage(Number(page));
        setEnCoursTotalPages(Number(totalPages));
      } catch (e) {
        console.error('Erreur fetchEnCours:', e);
      } finally {
        setLoadingEnCours(false);
        setLoadingMoreEnCours(false);
        setRefreshingEnCours(false);
      }
    },
    [tok]
  );

  /* ---------------------- fetchHistorique ---------------------- */
  const fetchHistorique = useCallback(
    async (page: number = 1, append: boolean = false) => {
      try {
        if (append) setLoadingMoreHistorique(true);
        else setLoadingHistorique(true);

        const endpoint = `ride/rides?status=PAYED&page=${page}&limit=${PAGE_LIMIT}`;
        const res: any = await apiRequest({
          method: 'GET',
          endpoint,
          token: tok,
        });

        const rides: Ride[] = res?.rides ?? [];
        setHistoriqueData((prev) => (append ? [...prev, ...rides] : rides));

        const totalPages =
          res?.pagination?.totalPages ??
          (res?.pagination?.total ? Math.ceil(res.pagination.total / PAGE_LIMIT) : 1);

        setHistoriquePage(Number(page));
        setHistoriqueTotalPages(Number(totalPages));
      } catch (e) {
        console.error('Erreur fetchHistorique:', e);
      } finally {
        setLoadingHistorique(false);
        setLoadingMoreHistorique(false);
        setRefreshingHistorique(false);
      }
    },
    [tok]
  );

  /* ---------- Sync store APRES rendu (évite update pendant render) ---------- */
  useEffect(() => {
    try { setEnCours(enCoursData); } catch (_) { }
  }, [enCoursData, setEnCours]);

  useEffect(() => {
    try { setHistorique(historiqueData); } catch (_) { }
  }, [historiqueData, setHistorique]);

  // Au montage et au changement d'onglet -> charger la page 1
  useEffect(() => {
    if (!isAuthenticated) return;
    if (activeTab === 'enCours') {
      fetchEnCours(1, false);
    } else {
      fetchHistorique(1, false);
    }
  }, [isAuthenticated, activeTab, fetchEnCours, fetchHistorique]);

  // refresh handler
  const onRefresh = () => {
    try {
      if (activeTab === 'enCours') {
        setRefreshingEnCours(true);
        fetchEnCours(1, false);
      } else {
        setRefreshingHistorique(true);
        fetchHistorique(1, false);
      }
    } catch (error) {
      console.error(error);
      setRefreshingEnCours(false);
      setRefreshingHistorique(false);
    }
  };

  const onCancel = async (ride: IRide) => {
    console.log(ride._id)
    emit('cancelRideCustomer', ride?._id)
    onRefresh()
  }

  /* ---------- FlatList onEndReached handlers ---------- */
  const loadMoreEnCours = () => {
    if (loadingEnCours || loadingMoreEnCours) return;
    if (enCoursPage < enCoursTotalPages) {
      fetchEnCours(enCoursPage + 1, true);
    }
  };

  const loadMoreHistorique = () => {
    if (loadingHistorique || loadingMoreHistorique) return;
    if (historiquePage < historiqueTotalPages) {
      fetchHistorique(historiquePage + 1, true);
    }
  };

  /* ---------- Renderers ---------- */
  const EnCoursView = () => {
    if (loadingEnCours && enCoursData.length === 0) return <DisplayLoading />;

    return (
      <FlatList
        data={enCoursData}
        keyExtractor={(item: Ride) => String(item._id)}
        contentContainerStyle={{ padding: 16 }}
        refreshControl={
          <RefreshControl refreshing={refreshingEnCours} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => <RenderEnCours ride={item} onCancel={onCancel} />}
        onEndReachedThreshold={0.5}
        onEndReached={loadMoreEnCours}
        ListEmptyComponent={
          !loadingEnCours && enCoursData.length === 0 ? (
            <View className="items-center mt-16">
              <Image
                source={require('../../assets/images/no-data.png')}
                className="mb-4 w-44 h-44"
              />
              <Text className="text-gray-500 font-['RubikRegular']">
                aucune course en cours
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMoreEnCours ? (
            <View style={{ padding: 12 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
      />
    );
  };

  const HistoriqueView = () => {
    if (loadingHistorique && historiqueData.length === 0) return <DisplayLoading />;

    return (
      <FlatList
        data={groupedHistorique}
        keyExtractor={(item: Grouped, idx: number) => `${item.title}-${idx}`}
        refreshControl={
          <RefreshControl refreshing={refreshingHistorique} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ padding: 16 }}
        renderItem={({ item }) => (
          <View className="flex-1 w-full mb-6">
            <Text className="text-lg text-black mb-2 font-['RubikBold']">{item.title}</Text>
            {Array.isArray(item.data) &&
              item.data.map((ride: Ride) => (
                <RenderHistorique key={ride._id} ride={ride} />
              ))}
          </View>
        )}
        onEndReachedThreshold={0.5}
        onEndReached={loadMoreHistorique}
        ListEmptyComponent={
          !loadingHistorique && historiqueData.length === 0 ? (
            <View
              style={{ justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 50 }}
            >
              <Image
                source={require('../../assets/images/no-data.png')}
                className="mb-4 w-44 h-44"
              />
              <Text style={{ color: 'gray', fontFamily: 'RubikRegular' }}>aucune course</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loadingMoreHistorique ? (
            <View style={{ padding: 12 }}>
              <ActivityIndicator size="small" />
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    );
  };

  const TabButtons = () => {
    return (
      <View className="flex-row px-4 mb-2">
        <TouchableOpacity
          className={`py-1 px-4 justify-center items-center rounded-full mr-2 border ${activeTab === 'enCours' ? 'bg-primary border-primary' : 'bg-white border-gray-300'
            }`}
          onPress={() => setActiveTab('enCours')}
        >
          <Text
            className={`text-center font-['RubikBold'] ${activeTab === 'enCours' ? 'text-white' : 'text-gray-700'
              }`}
          >
            En cours
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`py-1 px-4 justify-center items-center rounded-full ml-2 border ${activeTab === 'historique' ? 'bg-primary border-primary' : 'bg-white border-gray-300'
            }`}
          onPress={() => setActiveTab('historique')}
        >
          <Text
            className={`text-center font-['RubikBold'] ${activeTab === 'historique' ? 'text-white' : 'text-gray-700'
              }`}
          >
            Historique
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-white">
      {/* En-tête */}
      <View
        className="flex-row items-center justify-between w-full px-3 mt-8 mb-3"
        style={{ marginTop: insets.top }}
      >
        <View className="flex-row items-center space-x-3">
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profil')}
            className="items-center justify-center border rounded-full w-11 h-11 bg-primary border-primary"
          >
            <Icon type="font-awesome" name="user" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          className="items-center justify-center ml-2 border rounded-full w-11 h-11 bg-primary border-primary"
        >
          <Icon type="font-awesome" name="bell" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Boutons d’onglets */}
      <TabButtons />

      {/* Contenu */}
      <View style={{ flex: 1, width }}>
        {activeTab === 'enCours' ? <EnCoursView /> : <HistoriqueView />}
      </View>
    </View>
  );
}






// import { DisplayLoading } from '@/components/DisplayLoading';
// import RenderEnCours from '@/components/RenderEnCours';
// import RenderHistorique from '@/components/RenderHistorique';
// import { apiRequest } from '@/services/api';
// import { useWS } from '@/services/WSProvider';
// import useStore from '@/store/useStore';
// import { IRide } from '@/types';
// import { groupByDate } from '@/utils/groupByDate';
// import { Icon } from '@rneui/base';
// import { router } from 'expo-router';
// import React, { useCallback, useEffect, useState } from 'react';
// import {
//   Dimensions,
//   FlatList,
//   Image,
//   RefreshControl,
//   Text,
//   TouchableOpacity,
//   View
// } from 'react-native';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import { SceneMap, TabBar, TabView } from 'react-native-tab-view';

// const initialLayout = { width: Dimensions.get('window').width };

// export default function HistoriqueScreen() {
//   const {emit} = useWS();

//   const insets = useSafeAreaInsets();

//   const { tok, isAuthenticated, historiques, setHistorique, enCours, setEnCours } = useStore();

//   const [loading, setLoading] = useState(false);
//   const [refreshing, setRefreshing] = useState(false);

//   const groupedHistorique = groupByDate(historiques, 'createdAt');

//   const fetchRides = useCallback(async () => {
//     try {
//       setLoading(true);
//       const [historiqueRes, enCoursRes] = await Promise.all([
//         apiRequest({ method: 'GET', endpoint: "ride/rides?status=PAYED", token: tok }),
//         apiRequest({ method: 'GET', endpoint: "ride/rides", token: tok }),
//       ]);
//       setHistorique(historiqueRes.rides);
//       setEnCours(enCoursRes.rides);
//     } catch (e) {
//       console.error(e);
//     } finally {
//       setLoading(false);
//       setRefreshing(false);
//     }
//   }, [tok, setHistorique, setEnCours]);

//   useEffect(() => {
//     if (isAuthenticated) {
//       fetchRides();
//     }
//   }, [fetchRides, isAuthenticated]);

//   const onRefresh = () => {
//     try {
//       fetchRides();
//     } catch (error) {
//       console.error(error);
//       setRefreshing(false);
//     }
//   };

//   const onCancel = async (ride: IRide) => {
//     emit('cancelRide', ride?._id)
//   }

//   // Définition des scènes pour chaque onglet
//   const EnCoursScene = () => {
//     if (loading) return <DisplayLoading />;
//     return (
//       <FlatList
//         data={enCours}
//         keyExtractor={(item) => item._id}
//         contentContainerStyle={{ padding: 16 }}
//         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
//         renderItem={({ item }) => (
//           <RenderEnCours ride={item} onCancel={onCancel} /> // composant spécifique aux courses en cours
//         )}
//         ListEmptyComponent={
//           <View className="items-center mt-16">
//             <Image source={require("../../assets/images/no-data.png")} className="w-44 h-44 mb-4" />
//             <Text className="text-gray-500 font-['RubikRegular']">aucune course en cours</Text>
//           </View>
//         }
//       />
//     );
//   };

//   const HistoriqueScene = () => {
//     if (loading) return <DisplayLoading />;
//     return (
//       <FlatList
//         data={groupedHistorique}
//         keyExtractor={(item) => item.title}
//         refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
//         contentContainerStyle={{ padding: 16 }}
//         renderItem={({ item }) => (
//           <View className="mb-6 w-full flex-1">
//             <Text className="text-sm text-black mb-2 font-['RubikBold']">{item.title}</Text>
//             {Array.isArray(item.data) &&
//               item.data.map((ride) => (
//                 <RenderHistorique key={ride._id} ride={ride} />
//               ))}
//           </View>
//         )}
//         ListEmptyComponent={
//           <View style={{ justifyContent: 'center', alignItems: 'center', padding: 40, marginTop: 50 }}>
//             <Image
//               source={require("../../assets/images/no-data.png")}
//               className="w-44 h-44 mb-4"
//             />
//             <Text style={{ color: 'gray', fontFamily: 'RubikRegular' }}>aucune course</Text>
//           </View>
//         }
//       />
//     );
//   };

//   const renderScene = SceneMap({
//     enCours: EnCoursScene,
//     historique: HistoriqueScene,
//   });

//   const [index, setIndex] = useState(0);
//   const [routes] = useState([
//     { key: 'enCours', title: 'En cours' },
//     { key: 'historique', title: 'Historique' },
//   ]);

//   return (
//     <View className="flex-1 bg-white">
//       {/* En-tête */}
//       <View
//         className="px-3 flex-row w-full justify-between items-center mb-3"
//         style={{ paddingTop: insets.top }}
//       >
//         <View className="flex-row items-center space-x-3">
//           <TouchableOpacity
//             onPress={() => router.push('/(tabs)/profil')}
//             className="w-11 h-11 rounded-full bg-primary border border-primary justify-center items-center"
//           >
//             <Icon type="font-awesome" name="user" size={20} color="#fff" />
//           </TouchableOpacity>
//         </View>
//         <TouchableOpacity
//           onPress={() => router.push('/notifications')}
//           className="w-11 h-11 rounded-full bg-primary border border-primary ml-2 justify-center items-center"
//         >
//           <Icon type="font-awesome" name="bell" size={20} color="#fff" />
//         </TouchableOpacity>
//       </View>

//       <TabView
//         navigationState={{ index, routes }}
//         renderScene={renderScene}
//         onIndexChange={setIndex}
//         initialLayout={initialLayout}
//         renderTabBar={(props) => (
//           <TabBar
//             {...props}
//             indicatorStyle={{ backgroundColor: '#ff6d00', height: 3 }}
//             style={{ backgroundColor: 'white', elevation: 2 }}
//             activeColor="#ff6d00"
//             inactiveColor="gray"
//             pressColor="transparent"
//             scrollEnabled={false}
//             tabStyle={{
//               width: Dimensions.get('window').width / routes.length,
//             }}
//             // labelStyle={{
//             //   fontFamily: 'RubikBold',
//             //   fontSize: 14,
//             //   textTransform: 'none',
//             // }}
//           />
//         )}
//       />
//     </View>
//   );
// }




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
