import { useWS } from "@/services/WSProvider";
import useStore from "@/store/useStore";
import { reverseGeocode } from "@/utils/mapUtils";
import { useIsFocused } from "@react-navigation/native";
import { Icon } from "@rneui/base";
import * as Location from "expo-location";
import haversine from "haversine-distance";
import React, { memo, useEffect, useRef, useState } from "react";
import {
    Image,
    View
} from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { CustomButton } from "./CustomButton";

const DraggableMap: React.FC<{ height: number }> = ({ height }) => {
    const { position, setPosition, outOfRange, setOutOfRange } = useStore();
    const { emit, on, off } = useWS();
    const isFocused = useIsFocused();
    const [markers, setMarkers] = useState<any>([])
    const mapRef = useRef<MapView | null>(null);
    const MAx_DISTANCE_THERESHOLD = 10000;

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

    const gererateRandomMarkers = () => {
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
        setMarkers(newMarkers)
    }

    useEffect(() => {
        gererateRandomMarkers();
    }, [position])


    useEffect(() => {
        if (position?.latitude && position?.longitude && isFocused) {
            emit("subscribeToZone", {
                latitude: position.latitude,
                longitude: position.longitude,
            });

            on("nearbyRiders", (riders: any[]) => {
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
                edgePadding: { top: 50, left: 50, bottom: 20, right: 50, },
                animated: true,
            });
            const address = await reverseGeocode(latitude, longitude);
            setPosition({ latitude: latitude, longitude: longitude, address: address });
        } catch (error) {
            console.log(error)
        }
    }

    return (
        <View className="flex-1 bg-white">
            <MapView
                style={{ flex: 1 }}
                // maxZoomLevel={16}
                // minZoomLevel={12}
                ref={mapRef}
                showsUserLocation={false}
                showsMyLocationButton={false}
                zoomEnabled={true}
                initialRegion={{
                    latitude: Number(position.latitude),
                    longitude: Number(position.longitude),
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                }}
                followsUserLocation
                onRegionChangeComplete={onRegionChangeComplete}
                pitchEnabled={false}
                provider="google"
                showsCompass={false}
                showsIndoors={false}
                showsIndoorLevelPicker={false}
                showsTraffic={false}
                showsScale={false}
                showsBuildings={false}
                showsPointsOfInterest={false}

            >
                {
                    markers.filter((marker: any) => marker?.latitude && marker.longitude && marker.visible).map((marker: any, index: number) =>
                        <Marker
                            key={index}
                            zIndex={index + 1}
                            flat
                            anchor={{ x: 0.5, y: 0.5 }}
                            coordinate={{
                                latitude: marker.latitude,
                                longitude: marker.longitude
                            }}
                        >
                            <View style={{ backgroundColor: "red", transform: [{ rotate: `${marker?.rotation}deg` }] }}>
                                <Image
                                    source={
                                        marker.type === "auto" ? require('../assets/images/car.png') : require('../assets/images/car2.png')
                                    }
                                    style={{ height: 50, width: 50, resizeMode: "contain" }}
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
                <Icon name="map-pin" type='font-awesome-5' size={20} color="#000000" />
            </View>

            <View className="bottom-4 justify-center w-full px-3">
                <CustomButton
                    icon={<Icon name="my-location" type="material-icon" size={24} color="#ff6d00" />}
                    // buttonText="Commander une course"
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    textClassNames="text-white text-lg"
                    onPress={() => { handleGpsButtonPress() }}
                />
            </View>
            {outOfRange && (
                <View>
                    <Icon name="road-circle-exclamation" type='font-awesome-6' size={20} color="red" />
                </View>
            )}
        </View>
    )
}

export default memo(DraggableMap)