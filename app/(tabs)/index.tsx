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
import { ActivityIndicator, Dimensions, Image, Text, TouchableOpacity, useColorScheme, Vibration, View } from 'react-native';
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
  const { user, tok, refresh_tok, isAuthenticated, position, outOfRange, setOutOfRange, setPosition, setLogout, currentRide, currentRideEtaMs, currentRideRemainingMeters } = useStore()

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

  const getPosition = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Permission to access location was denied");
        return;
      }

      const servicesOn = await Location.hasServicesEnabledAsync();
      if (!servicesOn) {
        console.log("Location services are disabled");
        return;
      }

      try {
        const last = await Location.getLastKnownPositionAsync();
        const lat = Number(last?.coords?.latitude);
        const lon = Number(last?.coords?.longitude);
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          setPosition({ latitude: lat, longitude: lon, address: "" });
        }
      } catch {}

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      const lat = Number(loc?.coords?.latitude);
      const lon = Number(loc?.coords?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        setPosition({ latitude: lat, longitude: lon, address: "" });
      } else {
        console.log("Current location invalid");
      }
    } catch (e) {
      console.warn("getPosition failed:", e);
    }
  }, [setPosition]);

  // Helpers for ETA card (component scope)
  const formatDistance = (m: number | null | undefined) => {
    if (!Number.isFinite(Number(m))) return "-";
    const val = Number(m);
    if (val >= 1000) return `${(val / 1000).toFixed(2)} km`;
    return `${Math.round(val)} m`;
  };
  const formatTime = (ms: number | null | undefined) => {
    if (!Number.isFinite(Number(ms)) || Number(ms) <= 0) return "0:00";
    const sec = Math.round(Number(ms) / 1000);
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const reverseGeocodeAddress = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (res && res.length > 0) {
        const r = res[0] as any;
        const parts = [r.name, r.street, r.city, r.region, r.country].filter(Boolean);
        return parts.join(', ');
      }
    } catch { }
    return '';
  }, []);

  // useEffect(() => {
  //   const lat = Number(position?.latitude);
  //   const lon = Number(position?.longitude);
  //   if (Number.isFinite(lat) && Number.isFinite(lon)) {
  //     (async () => {
  //       const addr = await reverseGeocodeAddress(lat, lon);
  //       if (addr && addr !== position.address) {
  //         setPosition({ latitude: lat, longitude: lon, address: addr });
  //       }
  //     })();
  //   }
  // }, [position]);

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

      { (currentRide || (currentRideEtaMs != null)) && (
        <View className="px-3 w-full absolute" style={{ top: (insets.top || 0) + 56 }}>
          <View className="bg-white rounded-xl shadow p-3">
            <View className="flex-row justify-between items-center">
              <View>
                <Text className="text-gray-500 text-xs font-['RubikMedium']">Temps restant</Text>
                <Text className="text-base font-['RubikBold']">{formatTime(currentRideEtaMs || 0)}</Text>
              </View>
              <View className="items-end">
                <Text className="text-gray-500 text-xs font-['RubikMedium']">Distance</Text>
                <Text className="text-base font-['RubikBold']">{formatDistance(currentRideRemainingMeters || 0)}</Text>
              </View>
            </View>
            {currentRide?.status ? (
              <View className="mt-2">
                <Text className="text-gray-700 text-xs font-['RubikMedium']">Statut: {currentRide.status}</Text>
              </View>
            ) : null}
          </View>
        </View>
      )}

      {/* Header */}
      <View style={{ position: 'absolute', top: insets.top }} className="px-3 flex-row w-full justify-between items-center absolute top-4">
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {}}
          className="flex-1 h-11 rounded-full bg-white px-4 flex-row items-center border border-gray-200 shadow"
        >
          <Icon type="font-awesome" name="map-marker" size={16} color="#ff6d00" />
          <Text numberOfLines={1} ellipsizeMode="tail" className="ml-2 text-gray-800 text-sm font-['RubikMedium']">
            {position?.address && position.address.length > 0
              ? position.address
              : (Number.isFinite(Number(position?.latitude)) && Number.isFinite(Number(position?.longitude))
                ? `${position.latitude}, ${position.longitude}`
                : 'Localisation en cours...')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/notifications')} className="w-11 h-11 justify-center items-center rounded-full bg-primary border border-primary ml-2">
          <Icon type="font-awesome" name="bell" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <View className="flex-row absolute bottom-4 justify-between items-center h-12 w-full px-3">
        {/* Bouton GPS */}
        <TouchableOpacity onPress={() => goToUserLocation()} className="bg-white shadow-xl shadow-gray-700 w-14 h-14 rounded-full items-center justify-center">
          <Icon name="my-location" type="material-icon" size={24} color="#ff6d00" />
        </TouchableOpacity>

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