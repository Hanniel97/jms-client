import { useWS } from '@/services/WSProvider';
import { apiRequest } from '@/services/api';
import { refresh_tokens } from '@/services/apiInterceptors';
import useStore from '@/store/useStore';
import { showError, showSuccess } from '@/utils/showToast';
import { useIsFocused } from '@react-navigation/native';
import { Icon } from '@rneui/base';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import haversine from "haversine-distance";
import { jwtDecode } from "jwt-decode";
import { isEqual } from 'lodash';
import { Car } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, TouchableOpacity, useColorScheme, Vibration, View } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SwipeButton from 'rn-swipe-button';
import darkMapStyle from "../../services/mapStyleDark.json";
import lightMapStyle from '../../services/mapStyleLight.json';

interface DecodedToken {
  exp: number;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const LATITUDE_DELTA = 0.01;
const LONGITUDE_DELTA = 0.01;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView | null>(null);
  const isFocused = useIsFocused();
  const [markers, setMarkers] = useState<any>([])

  const { on, emit, disconnect, off } = useWS()
  const { user, tok, refresh_tok, isAuthenticated, position, outOfRange, setOutOfRange, setPosition, setLogout } = useStore()

  const theme = useColorScheme();
  const mapStyle = theme === 'dark' ? darkMapStyle : lightMapStyle;

  const [moving, setMoving] = useState(true);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [region, setRegion] = useState({
    latitude: position.latitude,
    longitude: position.longitude,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  })
  const MAx_DISTANCE_THERESHOLD = 10000;

  // const getPosition = useCallback(async () => {
  //   let { status } = await Location.requestForegroundPermissionsAsync();
  //   // console.log(status)
  //   if (status !== 'granted') {
  //     console.log('Permission to access location was denied');
  //     return;
  //   };

  //   console.log('location status', Location.getCurrentPositionAsync({}))
  //   try {
  //     let location = await Location.getCurrentPositionAsync({});
  //     setPosition({ latitude: location.coords.latitude, longitude: location.coords.longitude, address: "" });

  //     console.log('location', location)
  //   } catch {
  //     // return null
  //     try {

  //       let location = await Location.getLastKnownPositionAsync({});
  //       setPosition({ latitude: Number(location?.coords.latitude), longitude: Number(location?.coords.longitude), address: "" });
  //       // setModalVisible(false)
  //     } catch {
  //       console.log("")
  //     }
  //   }
  // }, [setPosition])

  const getPosition = useCallback(async () => {
    try {
      // 1) Permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        // Ne pas setter d'objet avec NaN
        return;
      }

      // 2) Services activés ?
      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        console.log("Location services are disabled");
        return;
      }

      // 3) Fallback rapide: dernier fix connu (si valide)
      try {
        const last = await Location.getLastKnownPositionAsync();
        const lat = Number(last?.coords?.latitude);
        const lon = Number(last?.coords?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setPosition({ latitude: lat, longitude: lon, address: "" });
        }
      } catch {
        // ignore
      }

      // 4) Fix actuel (avec garde-fous)
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation, // ou High/BestForNavigation si tu veux
      });

      const lat = Number(loc?.coords?.latitude);
      const lon = Number(loc?.coords?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setPosition({ latitude: lat, longitude: lon, address: "" });
      } else {
        // Ne pas set si invalide (évite NaN -> crash MapView)
        console.log("Current location invalid");
      }
    } catch (e) {
      console.warn("getPosition failed:", e);
      // Ne rien setter si échec pour ne pas propager des NaN
    }
  }, [setPosition]);

  useEffect(() => {
    if (position && moving) {
      const region_to_go = {
        ...position,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };

      setTimeout(() => {
        mapRef.current?.animateToRegion(region_to_go, 1000);
        setMoving(false)
      }, 500);
    }
  }, [moving, position])

  const logout = useCallback(async () => {
    const res = await apiRequest({
      method: 'GET',
      endpoint: 'logout',
    })

    if (res.success === true) {
      setLogout()
      disconnect()
    } else {
      setLogout()
      disconnect()
    }
  }, [disconnect, setLogout])

  const tokenCheck = useCallback(async () => {
    if (tok) {
      const decodedToken = jwtDecode<DecodedToken>(tok);
      const decodedRefreshToken = jwtDecode<DecodedToken>(refresh_tok);
      const currentTime = Date.now() / 1000;

      if (decodedToken?.exp < currentTime) {
        setTimeout(() => {
          setVisible(true)
          setMessage("Vérification de la session")
          setTimeout(() => {
            setVisible(true)
            setMessage("Session expirée. Déconnexion!");

            setTimeout(() => {
              logout();
            }, 5000);
          }, 4000);
        }, 2000);
        return;
      }

      if (decodedRefreshToken?.exp < currentTime) {
        try {
          refresh_tokens()
          setVisible(false)
          emit('user_connected', user._id)
        } catch (e) {
          console.log(e)
          showError("Erreur lors de la récupération de la session")
          logout();
        }
      }
      // console.log("check terminé")
    }
  }, [emit, logout, refresh_tok, tok, user._id])

  useEffect(() => {
    if (!isAuthenticated) return;

    emit('user_connected', user._id);

    getPosition();

    const timeoutId = setTimeout(() => {
      tokenCheck();
    }, 1000);

    return () => clearTimeout(timeoutId);

  }, [getPosition, isAuthenticated, user._id])

  useEffect(() => {
    const interval = setInterval(() => {
      emit("heartbeat");
    }, 10000);

    return () => clearInterval(interval);
  }, [emit]);

  const goToUserLocation = () => {
    const region_to_go = {
      latitude: position.latitude,
      longitude: position.longitude,
      latitudeDelta: LATITUDE_DELTA,
      longitudeDelta: LONGITUDE_DELTA,
    };

    if (!isEqual(region_to_go, region)) {
      setRegion(region_to_go);
      mapRef.current?.animateToRegion(region_to_go, 1000);
    }
  };

  const onRegionChangeComplete = async (newRegion: Region) => {
    // const address = await reverseGeocode(newRegion.latitude, newRegion.longitude);
    // setPosition({ latitude: newRegion.latitude, longitude: newRegion.longitude, address: address });

    const userLocation = { latitude: position?.latitude, longitude: position?.longitude } as any;
    if (userLocation) {
      const newLocation = { latitude: newRegion.latitude, longitude: newRegion.longitude };
      const distance = haversine(userLocation, newLocation);
      setOutOfRange(distance > MAx_DISTANCE_THERESHOLD);
    }
  }

  useEffect(() => {
    (async () => {
      if (isFocused) {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          try {
            let location = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = location.coords;
            mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
              edgePadding: { top: 50, left: 50, bottom: 20, right: 50, },
              animated: true,
            });
            const newRegion = {
              latitude,
              longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }
            onRegionChangeComplete(newRegion)
          } catch (error) {
            console.log(error)
          }
        } else {
          console.log('Permission to access location was denied');
        };
      }
    })()
  }, [mapRef, isFocused])

  const generateRandomMarkers = () => {
    console.log(position)
    if (!position?.latitude || !position?.longitude || outOfRange) return;

    const types = ["auto", "eco"];
    const newMarkers = Array.from({ length: 20 }, (_, index) => {
      const randomType = types[Math.floor(Math.random() * types.length)];
      const randomRotation = Math.floor(Math.random() * 360)

      return {
        id: index,
        latitude: position?.latitude + (Math.random() - 0.5) * 0.01,
        longitude: position?.longitude + (Math.random() - 0.5) * 0.01,
        type: randomType,
        rotation: randomRotation,
        visible: true,
      }
    });
    console.log(markers)
    setMarkers(newMarkers)
  }

  useEffect(() => {
    generateRandomMarkers();
  }, [])

  useEffect(() => {
    // getMyRide();
  }, [isAuthenticated, position])

  useEffect(() => {
    if (position?.latitude && position?.longitude && isFocused) {
      emit("subscribeToZone", {
        latitude: position.latitude,
        longitude: position.longitude,
      });

      on("nearbyriders", (riders: any[]) => {
        const updatedMarkers = riders.map((rider) => ({
          id: rider.id,
          latitude: rider.coords.latitude,
          longitude: rider.coords.longitude,
          type: "rider",
          rotation: rider.coords.heading,
          visible: true,
        }));
        setMarkers(updatedMarkers)
      });
    }

    return () => {
      off("nearbyRiders")
    }

  }, [position, emit, on, off, isFocused])

  // const handleGpsButtonPress = async () => {
  //   try {
  //     let { status } = await Location.requestForegroundPermissionsAsync();
  //     let location = await Location.getCurrentPositionAsync({});
  //     const { latitude, longitude } = location.coords;

  //     mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
  //       edgePadding: { top: 100, left: 100, bottom: 100, right: 100, },
  //       animated: true,
  //     });
  //     const address = await reverseGeocode(latitude, longitude);
  //     setPosition({ latitude: latitude, longitude: longitude, address: address });
  //   } catch (error) {
  //     console.log(error)
  //   }
  // }

  const getRide = useCallback(async () => {
    setLoading(true)
    const res = await apiRequest({
      method: 'GET',
      endpoint: 'ride/getRideStart/' + user._id,
      token: tok,
    });

    // console.log('dfdbfk jd', res)

    if (res.success === false) {
      setLoading(false)
      router.push('/addcourse')
      // showError(res.message)
      return;
    }

    if (res.success === true) {
      setLoading(false)
      showSuccess(res.message)
      router.push({ pathname: '/liveride', params: { id: res.ride._id } })
    }
  }, [tok, user._id]);

  return (
    <View className="flex-1 bg-white">
      <MapView
        style={{ flex: 1 }}
        ref={mapRef}
        customMapStyle={mapStyle}
        maxZoomLevel={17}
        // minZoomLevel={12}
        showsUserLocation={true}
        showsMyLocationButton={false}
        zoomEnabled={true}
        initialRegion={{
          latitude: Number(position.latitude),
          longitude: Number(position.longitude),
          latitudeDelta: LATITUDE_DELTA,
          longitudeDelta: LONGITUDE_DELTA,
        }}
        followsUserLocation
        // onRegionChangeComplete={onRegionChangeComplete}
        onRegionChangeComplete={async (region, move) => {
          if (!move.isGesture || move.isGesture) setRegion(region);
          // const address = await reverseGeocode(region.latitude, region.longitude);
          // setPosition({ latitude: region.latitude, longitude: region.longitude, address: address });

          // const userLocation = { latitude: position?.latitude, longitude: position?.longitude } as any;
          // if (userLocation) {
          //   const newLocation = { latitude: region.latitude, longitude: region.longitude };
          //   const distance = haversine(userLocation, newLocation);
          //   setOutOfRange(distance > MAx_DISTANCE_THERESHOLD);
          // }
        }}
        // pitchEnabled={false}
        provider="google"
      // showsCompass={false}
      // showsIndoors={false}
      // showsIndoorLevelPicker={false}
      // showsTraffic={false}
      // showsScale={false}
      // showsBuildings={false}
      // showsPointsOfInterest={false}
      >
        {
          markers.filter((marker: any) => marker?.latitude && marker.longitude && marker.visible).map((marker: any, index: number) =>
            <Marker
              key={index}
              zIndex={index + 1}
              flat
              anchor={{ x: 0.3, y: 0.6 }}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude
              }}
            >
              <View style={{ transform: [{ rotate: `${marker?.rotation}deg` }] }}>
                <Image
                  source={
                    marker.type === "confort" ? require('../../assets/images/driver.png') : require('../../assets/images/customer.png')
                  }
                  style={{ height: 40, width: 40, resizeMode: "contain" }}
                />
              </View>
            </Marker>
          )
        }
      </MapView>

      {/* <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon name="map-pin" type='font-awesome-5' size={25} color="red" />
      </View> */}

      {/* <DraggableMap height={mapHeight}/> */}
      {/* <LiveRide /> */}

      <View
        className="px-3 flex-row w-full justify-between items-center"
        style={{ position: 'absolute', top: insets.top }}
      >
        <View style={{ flex: 0.75 }} className='h-14 flex-row items-center'>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profil')} className="w-11 h-11 justify-center items-center rounded-full bg-primary border border-primary">
            <Icon type="font-awesome" name="user" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/notifications')} className="w-11 h-11 justify-center items-center rounded-full bg-primary border border-primary ml-2">
          <Icon type="font-awesome" name="bell" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 🔘 BOUTON EN BAS */}
      {/* <View className="flex-row absolute bottom-3 justify-between items-center h-12 w-full px-3">
        <CustomButton
          icon={<Icon name="my-location" type="material-icon" size={24} color="#ff6d00" />}
          // buttonText="Commander une course"
          buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
          textClassNames="text-white text-sm font-['RubikBold']"
          // onPress={() => { handleGpsButtonPress() }}
          onPress={() => goToUserLocation()}
        />
        <CustomButton
          buttonText="Commander une course"
          loading={loading}
          buttonClassNames="bg-primary shadow-xl h-12 w-72 rounded-full items-center justify-center"
          textClassNames="text-white text-sm font-['RubikBold']"
          onPress={() => {
            getRide()
          }}
        />
      </View> */}

      <View className="flex-row absolute bottom-4 justify-between items-center h-12 w-full px-3">
        {/* Bouton GPS */}
        <TouchableOpacity onPress={() => goToUserLocation()} className="bg-white shadow-xl shadow-gray-700 w-14 h-14 rounded-full items-center justify-center">
          <Icon name="my-location" type="material-icon" size={24} color="#ff6d00" />
        </TouchableOpacity>

        {/* Slider */}
        {/* <Slider
          ref={sliderRef}
          disabled={loading || slideComplete}
          // childrenContainer={{ backgroundColor: 'red' }}
          onEndReached={() => {
            // getRide();
          }}
          containerStyle={{
            margin: 0,
            backgroundColor: '#ff6d00',
            borderRadius: 50,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            width: Dimensions.get('window').width * 0.7
          }}
          sliderElement={<View className="w-12 h-12 rounded-full bg-white justify-center items-center shadow-md">
            <Car size={24} color="#ff6d00" />
          </View>}
          onSlideStart={() => { }}
          onSlideEnd={() => {
            getRide();
            setSlideComplete(true);
          }}
        >
          {
            loading ?
              <ActivityIndicator size={"small"} color={"#FFFFFF"} />
              : <Text className="text-white text-sm font-['RubikBold']">Glissez pour commander</Text>
          }
        </Slider> */}

        <SwipeButton
          containerStyles={{
            borderRadius: 999,
            backgroundColor: "#ff6d00",
            width: Dimensions.get("window").width * 0.75,
            height: 60,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
            shadowRadius: 4,
            elevation: 4,
          }}
          railBackgroundColor="#ff6d00"
          railBorderColor="transparent"
          railFillBackgroundColor="#fff"
          railFillBorderColor="#fff"
          railStyles={{
            borderWidth: 0,
            backgroundColor: "transparent",
          }}
          thumbIconComponent={() => (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: "#ffffff",
                justifyContent: "center",
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 3,
              }}
            >
              {
                loading ?
                  <ActivityIndicator size={"small"} color={"#ff6d00"} />
                  : <Car size={22} color="#ff6d00" />
              }

            </View>
          )}
          thumbIconBackgroundColor="transparent"
          thumbIconBorderColor="transparent"
          title="Glissez pour commander"
          titleStyles={{
            color: "#fff",
            fontFamily: "RubikBold",
            fontSize: 14,
            // letterSpacing: 0.5,
          }}
          height={60}
          onSwipeSuccess={() => {
            Vibration.vibrate(200);
            getRide();
          }}
          resetAfterSuccessAnimDelay={200}
          shouldResetAfterSuccess={true}
        />
      </View>

      {/* <GrantLocationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={getPosition}
      /> */}
    </View>
  );
}





// import { useWS } from '@/services/WSProvider';
// import { apiRequest, reverseGeocode } from '@/services/api';
// import { refresh_tokens } from '@/services/apiInterceptors';
// import useStore from '@/store/useStore';
// import { showError, showSuccess } from '@/utils/showToast';
// import { useIsFocused } from '@react-navigation/native';
// import { Icon } from '@rneui/base';
// import MapboxGL from '@rnmapbox/maps';
// import * as Location from 'expo-location';
// import * as Notifications from 'expo-notifications';
// import { router } from 'expo-router';
// import haversine from 'haversine-distance';
// import { jwtDecode } from 'jwt-decode';
// import { isEqual } from 'lodash';
// import { Car } from 'lucide-react-native';
// import React, { JSX, useCallback, useEffect, useRef, useState } from 'react';
// import {
//   ActivityIndicator,
//   Dimensions,
//   Image,
//   LogBox,
//   TouchableOpacity,
//   useColorScheme,
//   Vibration,
//   View,
// } from 'react-native';
// import { useSafeAreaInsets } from 'react-native-safe-area-context';
// import SwipeButton from 'rn-swipe-button';

// LogBox.ignoreLogs([
//   'new NativeEventEmitter',
//   'ViewTagResolver',
// ]);

// interface DecodedToken {
//   exp: number;
// }

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldPlaySound: true,
//     shouldSetBadge: true,
//     shouldShowBanner: true,
//     shouldShowList: true,
//   }),
// });

// // Map defaults
// const LATITUDE_DELTA = 0.01;
// const LONGITUDE_DELTA = 0.01;
// const INITIAL_ZOOM = 15;
// const MAX_DISTANCE_THRESHOLD = 10000;
// // const MAPBOX_TOKEN =
// //   (Constants.manifest2 as any)?.extra?.EXPO_PUBLIC_MAPBOX_TOKEN ??
// //   (process.env as any)?.EXPO_PUBLIC_MAPBOX_TOKEN ??
// //   ''; // replace via app config / .env

// // MapboxGL.setAccessToken(MAPBOX_TOKEN);
// // MapboxGL.setTelemetryEnabled?.(false);

// export default function HomeScreen(): JSX.Element {
//   const insets = useSafeAreaInsets();
//   const isFocused = useIsFocused();
//   const theme = useColorScheme();

//   const { on, emit, disconnect, off } = useWS();
//   const {
//     user,
//     first,
//     tok,
//     refresh_tok,
//     isAuthenticated,
//     position,
//     outOfRange,
//     setOutOfRange,
//     setPosition,
//     setFirst,
//     setLogout,
//   } = useStore();

//   // Map refs
//   const mapRef = useRef<MapboxGL.MapView | null>(null);
//   const cameraRef = useRef<any>(null); // Camera ref (has getCenter, setCamera, flyTo)

//   // local state
//   const [markers, setMarkers] = useState<any[]>([]);
//   const [moving, setMoving] = useState(true);
//   const [visible, setVisible] = useState(false);
//   const [loading, setLoading] = useState(false);
//   const [message, setMessage] = useState<string>('');
//   const [region, setRegion] = useState({
//     latitude: position?.latitude ?? 0,
//     longitude: position?.longitude ?? 0,
//     latitudeDelta: LATITUDE_DELTA,
//     longitudeDelta: LONGITUDE_DELTA,
//   });

//   // Map style (use Mapbox built-in styles; replace by your styleURL if needed)
//   const styleURL = theme === 'dark' ? MapboxGL.StyleURL.Dark : MapboxGL.StyleURL.Street;

//   // --- Position helpers ---
//   const getPosition = useCallback(async () => {
//     const { status } = await Location.requestForegroundPermissionsAsync();
//     if (status !== 'granted') {
//       console.log('Permission to access location was denied');
//       return;
//     }

//     try {
//       const location = await Location.getCurrentPositionAsync({});
//       const address = await reverseGeocode(location.coords.latitude, location.coords.longitude);
//       setPosition({
//         latitude: location.coords.latitude,
//         longitude: location.coords.longitude,
//         address: address,
//       });
//       setFirst(false);
//     } catch {
//       try {
//         const location = await Location.getLastKnownPositionAsync({});
//         if (location?.coords) {
//           const address = await reverseGeocode(location.coords.latitude, location.coords.longitude);
//           setPosition({
//             latitude: Number(location.coords.latitude),
//             longitude: Number(location.coords.longitude),
//             address: address,
//           });
//           setFirst(false);
//         }
//       } catch (e) {
//         console.log('Unable to read last known position', e);
//       }
//     }
//   }, [setFirst, setPosition]);

//   // animate to initial pos once
//   useEffect(() => {
//     if (position && moving) {
//       const { latitude, longitude } = position;
//       setTimeout(() => {
//         try {
//           cameraRef.current?.setCamera({
//             centerCoordinate: [Number(longitude), Number(latitude)],
//             zoomLevel: INITIAL_ZOOM,
//             animationDuration: 1000,
//           });
//         } catch (e) {
//           // fallback: set region state (not ideal but safe)
//         } finally {
//           setMoving(false);
//         }
//       }, 400);
//     }
//   }, [moving, position]);

//   // --- logout + token check ---
//   const logout = useCallback(async () => {
//     try {
//       await apiRequest({ method: 'GET', endpoint: 'logout' });
//       setLogout();
//       disconnect();
//     } catch {
//       setLogout();
//       disconnect();
//     }
//   }, [disconnect, setLogout]);

//   const tokenCheck = useCallback(async () => {
//     if (!tok) return;
//     try {
//       const decodedToken = jwtDecode<DecodedToken>(tok);
//       const decodedRefreshToken = jwtDecode<DecodedToken>(refresh_tok);
//       const currentTime = Date.now() / 1000;

//       if (decodedToken?.exp < currentTime) {
//         setTimeout(() => {
//           setVisible(true);
//           setMessage('Vérification de la session');
//           setTimeout(() => {
//             setVisible(true);
//             setMessage('Session expirée. Déconnexion!');
//             setTimeout(() => logout(), 5000);
//           }, 4000);
//         }, 2000);
//         return;
//       }

//       if (decodedRefreshToken?.exp < currentTime) {
//         try {
//           await refresh_tokens();
//           setVisible(false);
//           emit('user_connected', user._id);
//         } catch (e) {
//           console.log(e);
//           showError('Erreur lors de la récupération de la session');
//           logout();
//         }
//       }
//     } catch (e) {
//       console.log('tokenCheck error', e);
//     }
//   }, [emit, logout, refresh_tok, tok, user._id]);

//   // on mount when authenticated
//   useEffect(() => {
//     if (!isAuthenticated && !user){
//       setLogout()
//       return;
//     };
//     emit('user_connected', user._id);
//     getPosition();
//     const timeoutId = setTimeout(() => tokenCheck(), 1000);
//     return () => clearTimeout(timeoutId);
//   }, [isAuthenticated, user]);

//   // heartbeat
//   useEffect(() => {
//     const interval = setInterval(() => emit('heartbeat'), 10000);
//     return () => clearInterval(interval);
//   }, [emit]);

//   // go to user location (camera)
//   const goToUserLocation = () => {
//     const region_to_go = {
//       latitude: position.latitude,
//       longitude: position.longitude,
//       latitudeDelta: LATITUDE_DELTA,
//       longitudeDelta: LONGITUDE_DELTA,
//     };

//     cameraRef.current?.flyTo([Number(position.longitude), Number(position.latitude)], 1000);

//     // if (!isEqual(region_to_go, region)) {
//     //   setRegion(region_to_go);
//     //   try {
//     //     cameraRef.current?.flyTo([Number(position.longitude), Number(position.latitude)], 1000);
//     //   } catch {
//     //     cameraRef.current?.setCamera({
//     //       centerCoordinate: [Number(position.longitude), Number(position.latitude)],
//     //       zoomLevel: INITIAL_ZOOM,
//     //       animationDuration: 600,
//     //     });
//     //   }
//     // }
//   };

//   // --- Map idle handler (fires when camera finished moving) ---
//   // NOTE: onMapIdle is preferred to the deprecated onRegionDidChange.
//   // We'll get the center via cameraRef.getCenter() and call reverseGeocode.
//   const onMapIdle = async () => {
//     try {
//       // Camera#getCenter returns [lng, lat] per docs
//       const center = await cameraRef.current?.getCenter?.();
//       if (!center || !Array.isArray(center)) return;
//       const [lon, lat] = center;
//       const address = await reverseGeocode(lat, lon);
//       // console.log('sfddfvdv', address)
//       setPosition({ latitude: lat, longitude: lon, address });

//       const userLocation = { latitude: position?.latitude, longitude: position?.longitude } as any;
//       if (userLocation) {
//         const newLocation = { latitude: lat, longitude: lon };
//         const distance = haversine(userLocation, newLocation);
//         setOutOfRange(distance > MAX_DISTANCE_THRESHOLD);
//       }
//     } catch (e) {
//       // safe no-op
//     }
//   };

//   // on focus: center user, trigger reverse geocode
//   useEffect(() => {
//     (async () => {
//       if (!isFocused) return;
//       const { status } = await Location.requestForegroundPermissionsAsync();
//       if (status !== 'granted') {
//         console.log('Permission to access location was denied');
//         return;
//       }
//       try {
//         const location = await Location.getCurrentPositionAsync({});
//         const { latitude, longitude } = location.coords;
//         cameraRef.current?.setCamera({
//           centerCoordinate: [longitude, latitude],
//           zoomLevel: INITIAL_ZOOM,
//           animationDuration: 800,
//         });
//         await onMapIdle();
//       } catch (e) {
//         console.log(e);
//       }
//     })();
//   }, [isFocused]);

//   // --- WebSocket nearby riders subscription (fixed event name) ---
//   useEffect(() => {
//     if (position?.latitude && position?.longitude && isFocused) {
//       emit('subscribeToZone', {
//         latitude: position.latitude,
//         longitude: position.longitude,
//       });

//       // Use a stable handler reference to avoid leaking multiple listeners
//       const handleNearby = (riders: any[]) => {
//         const updatedMarkers = riders.map((rider) => ({
//           // ensure stable unique id (string)
//           id: String(rider.id ?? `${rider.coords.latitude}-${rider.coords.longitude}`),
//           latitude: rider.coords.latitude,
//           longitude: rider.coords.longitude,
//           type: 'rider',
//           rotation: rider.coords.heading ?? 0,
//           visible: true,
//         }));
//         setMarkers(updatedMarkers);
//       };

//       on('nearbyriders', handleNearby);

//       return () => {
//         try {
//           off('nearbyriders', handleNearby);
//         } catch { }
//       };
//     }
//   }, [position, emit, on, off, isFocused]);

//   // --- getRide ---
//   const getRide = useCallback(async () => {
//     setLoading(true);
//     try {
//       const res = await apiRequest({
//         method: 'GET',
//         endpoint: 'ride/getRideStart/' + user._id,
//         token: tok,
//       });

//       if (!res.success) {
//         setLoading(false);
//         router.push('/addcourse');
//         return;
//       }

//       setLoading(false);
//       showSuccess(res.message);
//       router.push({ pathname: '/liveride', params: { id: res.ride._id } });
//     } catch (e) {
//       setLoading(false);
//       showError('Erreur serveur');
//       console.log(e);
//     }
//   }, [tok, user._id]);

//   // --- Render ---
//   return (
//     <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
//       <MapboxGL.MapView
//         ref={(r) => (mapRef.current = r)}
//         style={{ flex: 1 }}
//         styleURL={styleURL}
//         logoEnabled={false}
//         compassEnabled={false}
//         rotateEnabled={false}
//         pitchEnabled={true}
//         zoomEnabled={true}
//         onMapIdle={onMapIdle} // use onMapIdle instead of deprecated onRegionDidChange
//       >
//         <MapboxGL.Camera
//           ref={(r) => (cameraRef.current = r)}
//           centerCoordinate={[Number(position.longitude ?? 0), Number(position.latitude ?? 0)]}
//           zoomLevel={INITIAL_ZOOM}
//           animationMode="flyTo"
//         />

//         <MapboxGL.UserLocation visible={true} androidRenderMode="normal" showsUserHeadingIndicator={true} />

//         {/* Markers: using PointAnnotation for simplicity. If many markers, migrate to ShapeSource + SymbolLayer */}
//         {markers
//           .filter((m) => m?.latitude && m?.longitude && m.visible)
//           .map((marker) => (
//             <MapboxGL.PointAnnotation
//               key={marker.id}
//               id={marker.id}
//               coordinate={[marker.longitude, marker.latitude]}
//             >
//               <View style={{ transform: [{ rotate: `${marker.rotation ?? 0}deg` }] }}>
//                 <Image
//                   source={
//                     marker.type === 'confort'
//                       ? require('../../assets/images/driver.png')
//                       : require('../../assets/images/customer.png')
//                   }
//                   style={{ height: 40, width: 40, resizeMode: 'contain' }}
//                 />
//               </View>
//             </MapboxGL.PointAnnotation>
//           ))}
//       </MapboxGL.MapView>

//       {/* Top UI */}
//       <View
//         style={{
//           position: 'absolute',
//           top: insets.top,
//           left: 12,
//           right: 12,
//           flexDirection: 'row',
//           justifyContent: 'space-between',
//           alignItems: 'center',
//           paddingHorizontal: 6,
//         }}
//       >
//         <View style={{ flex: 0.75, flexDirection: 'row', alignItems: 'center', height: 56 }}>
//           <TouchableOpacity
//             onPress={() => router.push('/(tabs)/profil')}
//             style={{
//               width: 44,
//               height: 44,
//               justifyContent: 'center',
//               alignItems: 'center',
//               borderRadius: 44 / 2,
//               backgroundColor: '#ff6d00',
//               borderWidth: 1,
//               borderColor: '#ff6d00',
//             }}
//           >
//             <Icon type="font-awesome" name="user" size={20} color="#FFFFFF" />
//           </TouchableOpacity>
//         </View>

//         <TouchableOpacity
//           onPress={() => router.push('/notifications')}
//           style={{
//             width: 44,
//             height: 44,
//             justifyContent: 'center',
//             alignItems: 'center',
//             borderRadius: 44 / 2,
//             backgroundColor: '#ff6d00',
//             borderWidth: 1,
//             borderColor: '#ff6d00',
//           }}
//         >
//           <Icon type="font-awesome" name="bell" size={20} color="#FFFFFF" />
//         </TouchableOpacity>
//       </View>

//       {/* Bottom controls: GPS + swipe */}
//       <View
//         style={{
//           position: 'absolute',
//           bottom: 16,
//           left: 12,
//           right: 12,
//           flexDirection: 'row',
//           justifyContent: 'space-between',
//           alignItems: 'center',
//         }}
//       >
//         <TouchableOpacity
//           onPress={() => goToUserLocation()}
//           style={{
//             backgroundColor: '#fff',
//             width: 56,
//             height: 56,
//             borderRadius: 28,
//             justifyContent: 'center',
//             alignItems: 'center',
//             elevation: 4,
//           }}
//         >
//           <Icon name="my-location" type="material-icon" size={24} color="#ff6d00" />
//         </TouchableOpacity>

//         <SwipeButton
//           containerStyles={{
//             borderRadius: 999,
//             backgroundColor: '#ff6d00',
//             width: Dimensions.get('window').width * 0.75,
//             height: 60,
//             overflow: 'hidden',
//             shadowColor: '#000',
//             shadowOffset: { width: 0, height: 2 },
//             shadowOpacity: 0.2,
//             shadowRadius: 4,
//             elevation: 4,
//           }}
//           railBackgroundColor="#ff6d00"
//           railBorderColor="transparent"
//           railFillBackgroundColor="#fff"
//           railFillBorderColor="#fff"
//           railStyles={{ borderWidth: 0, backgroundColor: 'transparent' }}
//           thumbIconComponent={() => (
//             <View
//               style={{
//                 width: 48,
//                 height: 48,
//                 borderRadius: 24,
//                 backgroundColor: '#ffffff',
//                 justifyContent: 'center',
//                 alignItems: 'center',
//                 elevation: 3,
//               }}
//             >
//               {loading ? <ActivityIndicator size="small" color="#ff6d00" /> : <Car size={22} color="#ff6d00" />}
//             </View>
//           )}
//           thumbIconBackgroundColor="transparent"
//           thumbIconBorderColor="transparent"
//           title="Glissez pour commander"
//           titleStyles={{ color: '#fff', fontFamily: 'RubikBold', fontSize: 14 }}
//           height={60}
//           onSwipeSuccess={() => {
//             Vibration.vibrate(200);
//             getRide();
//           }}
//           resetAfterSuccessAnimDelay={200}
//           shouldResetAfterSuccess={true}
//         />
//       </View>
//     </View>
//   );
// }