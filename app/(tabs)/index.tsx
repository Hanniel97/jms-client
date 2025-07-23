import { CustomButton } from '@/components/CustomButton';
import { useWS } from '@/services/WSProvider';
import { apiRequest } from '@/services/api';
import { refresh_tokens } from '@/services/apiInterceptors';
import useStore from '@/store/useStore';
import { reverseGeocode } from '@/utils/mapUtils';
import { showError, showSuccess } from '@/utils/showToast';
import { useIsFocused } from '@react-navigation/native';
import { Icon } from '@rneui/base';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import haversine from "haversine-distance";
import { jwtDecode } from "jwt-decode";
import { isEqual } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, TouchableOpacity, View, useColorScheme } from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const { user, first, tok, refresh_tok, isAuthenticated, position, outOfRange, setOutOfRange, setPosition, setFirst, setLogout } = useStore()

  const theme = useColorScheme();
  const mapStyle = theme === 'dark' ? darkMapStyle : lightMapStyle;

  const [moving, setMoving] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
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
    let { status } = await Location.requestForegroundPermissionsAsync();
    // console.log(status)
    if (status !== 'granted') {
      console.log('Permission to access location was denied');
      return;
    };
    try {
      let location = await Location.getCurrentPositionAsync({});
      setPosition({ latitude: location.coords.latitude, longitude: location.coords.longitude, address: "" });
      setFirst(false);
      // setModalVisible(false)
    } catch {
      // return null
      try {

        let location = await Location.getLastKnownPositionAsync({});
        setPosition({ latitude: Number(location?.coords.latitude), longitude: Number(location?.coords.longitude), address: "" });
        setFirst(false);
        // setModalVisible(false)
      } catch {
        console.log("")
      }
    }
  }, [setFirst, setPosition])

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
      console.log("check terminé")
    }
  }, [emit, logout, refresh_tok, tok, user._id])

  useEffect(() => {
    if (!isAuthenticated) return;

    emit('user_connected', user._id);

    // if (first) {
    //   setModalVisible(true);
    // } else {
    //   getPosition();
    // }

    getPosition();

    const timeoutId = setTimeout(() => {
      tokenCheck();
    }, 1000);

    return () => clearTimeout(timeoutId);

  }, [first, getPosition, isAuthenticated, user._id])

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
    const address = await reverseGeocode(newRegion.latitude, newRegion.longitude);
    setPosition({ latitude: newRegion.latitude, longitude: newRegion.longitude, address: address });

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

  // useEffect(() => {
  //   generateRandomMarkers();
  // }, [])

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

  const handleGpsButtonPress = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let location = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = location.coords;

      mapRef.current?.fitToCoordinates([{ latitude, longitude }], {
        edgePadding: { top: 100, left: 100, bottom: 100, right: 100, },
        animated: true,
      });
      const address = await reverseGeocode(latitude, longitude);
      setPosition({ latitude: latitude, longitude: longitude, address: address });
    } catch (error) {
      console.log(error)
    }
  }

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
        // maxZoomLevel={16}
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
                    marker.type === "auto" ? require('../../assets/images/driver.png') : require('../../assets/images/customer.png')
                  }
                  style={{ height: 40, width: 40, resizeMode: "contain" }}
                />
              </View>
            </Marker>
          )
        }
      </MapView>

      <View style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon name="map-pin" type='font-awesome-5' size={25} color="red" />
      </View>

      {/* <DraggableMap height={mapHeight}/> */}
      {/* <LiveRide /> */}

      <View
        className="px-3 flex-row w-full justify-between items-center"
        style={{ position: 'absolute', top: insets.top }}
      >
        <View style={{ flex: 0.75 }} className='h-14 flex-row items-center'>
          <TouchableOpacity onPress={() => router.push('/(tabs)/profil')} className="w-12 h-12 justify-center items-center rounded-full bg-primary border border-primary">
            <Icon type="font-awesome" name="user" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={() => router.push('/notifications')} className="w-12 h-12 justify-center items-center rounded-full bg-primary border border-primary ml-2">
          <Icon type="font-awesome" name="bell" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 🔘 BOUTON EN BAS */}
      <View className="flex-row absolute bottom-3 justify-between items-center h-12 w-full px-3">
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
      </View>

      {/* <GrantLocationModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onConfirm={getPosition}
      /> */}
    </View>
  );
}
