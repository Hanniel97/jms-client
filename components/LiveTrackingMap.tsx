import { GOOGLE_API_KEY } from "@/services/api";
import useStore from "@/store/useStore";
import polyline from "@mapbox/polyline";
import { Icon } from "@rneui/base";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import {
    Image,
    useColorScheme,
    View
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import darkMapStyle from "../services/mapStyleDark.json";
import lightMapStyle from '../services/mapStyleLight.json';
import { CustomButton } from "./CustomButton";

// const androidHeights = [ScreenHeight * 0.12, ScreenHeight * 0.42]
// const iosHeights = [ScreenHeight * 0.2, ScreenHeight * 0.5]

export const LiveTrackingMap: React.FC<{
    height: number;
    drop: any;
    pickup: any;
    rider: any;
    status: string
    bottomSheetHeight: number,
    setDuration: any
}> = ({ drop, status, pickup, rider, bottomSheetHeight, setDuration }) => {
    const theme = useColorScheme();
    const mapStyle = theme === 'dark' ? darkMapStyle : lightMapStyle;

    const { position } = useStore();
    const mapRef = useRef<MapView | null>(null);
    const [isUserInteracting, setIsUserInteracting] = useState(false);
    const [trafficColor, setTrafficColor] = useState("#16B84E");
    const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);

    const fitToMarkers = async () => {
        if (isUserInteracting) return;

        const coordinates = [];

        if (pickup?.latitude && pickup?.longitude && status === "START" || "SEARCHING_FOR_RIDER") {
            coordinates.push({
                latitude: pickup.latitude,
                longitude: pickup.longitude,
            });
        }

        if (drop?.latitude && drop?.longitude && status === "ARRIVED") {
            coordinates.push({ latitude: drop.latitude, longitude: drop.longitude });
        }

        if (rider?.latitude && rider?.longitude) {
            coordinates.push({
                latitude: rider.latitude,
                longitude: rider.longitude,
            })
        }

        if (coordinates.length === 0) return;

        try {
            mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 50, left: 50, bottom: 20, right: 50, },
                animated: true,
            });
        } catch (error) {
            console.log(error)
        }
    }

    const calculateInitialRegion = () => {
        if (pickup?.latitude && drop?.latitude) {
            const latitude = (pickup.latitude + drop.latitude) / 2;
            const longitude = (pickup.longitude + drop.longitude) / 2;
            return {
                latitude,
                longitude,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
            }
        }
        return {
            latitude: Number(position.latitude),
            longitude: Number(position.longitude),
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        } //initial map région à revoir
    }

    useEffect(() => {
        if (pickup?.latitude && drop?.latitude) fitToMarkers();
    }, [drop?.latitude, pickup?.latitude, rider.latitude])

    const fetchDirections = useCallback(async () => {
        try {
            const origin = status === "ACCEPTED" ? `${rider.latitude},${rider.longitude}` : `${pickup.latitude},${pickup.longitude}`;
            // `${pickup.latitude},${pickup.longitude}`;
            const destination = status === "ACCEPTED" ? `${pickup.latitude},${pickup.longitude}` : `${drop.latitude},${drop.longitude}`;
            // `${drop.latitude},${drop.longitude}`;
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}&departure_time=now&mode=driving`;

            const response = await fetch(url);
            const json = await response.json();

            if (!json.routes.length) return;

            const points = polyline.decode(json.routes[0].overview_polyline.points);
            const mapped = points.map(([latitude, longitude]) => ({ latitude, longitude }));
            setCoords(mapped);

            const leg = json.routes[0].legs[0];
            const duration = leg.duration.value;
            const trafficDuration = leg.duration_in_traffic?.value || duration;

            setDuration(Math.round(trafficDuration / 60));

            if (trafficDuration > duration * 1.5) setTrafficColor("#DE2916");
            else if (trafficDuration > duration * 1.2) setTrafficColor("#FFA500");
            else setTrafficColor("#16B84E");
        } catch (err) {
            console.error("Erreur Directions API:", err);
        }
    }, [drop.latitude, drop.longitude, pickup.latitude, pickup.longitude]);

    useEffect(() => {
        fetchDirections();
    }, [fetchDirections]);

    // useEffect(() => {
    //     const interval = setInterval(() => {
    //         fetchDirections();
    //     }, 1000);
    //     return () => clearInterval(interval);
    // }, [fetchDirections]);

    return (
        <View className="flex-1 bg-white">
            <MapView
                style={{ flex: 1 }}
                ref={mapRef}
                customMapStyle={mapStyle}
                showsUserLocation={false}
                // showsMyLocationButton={false}
                showsCompass={false}
                showsIndoors={false}
                zoomEnabled={true}
                initialRegion={calculateInitialRegion()}
                followsUserLocation
                onRegionChange={() => setIsUserInteracting(true)}
                onRegionChangeComplete={() => setIsUserInteracting(false)}
                provider="google"
            >
                {/* {rider?.latitude && pickup?.latitude && (
                    <MapViewDirections
                        // origin={rider}
                        origin={status === "ACCEPTED" ? rider : pickup}
                        destination={status === "ACCEPTED" ? pickup : drop}
                        onReady={(result) => {
                            setDuration(result.duration); // durée estimée en minutes
                            fitToMarkers();
                        }}
                        apikey={GOOGLE_API_KEY}
                        strokeColor="red"
                        strokeWidth={5}
                        precision="high"
                        onError={(error) => console.log("Directions error:", error)}
                    />
                )} */}

                {drop?.latitude && (
                    <Marker
                        anchor={{ x: 0.3, y: 0.6 }}
                        coordinate={{
                            latitude: drop.latitude,
                            longitude: drop.longitude
                        }}
                        zIndex={1}
                        title="Destination"
                        pinColor="red"
                    >
                        <View>
                            {/* <Image
                                source={require('../assets/images/customer.png')}
                                style={{ height: 40, width: 40, resizeMode: "contain" }}
                            /> */}
                            <Icon name="location-pin" type="entypo" size={35} color="red" />
                        </View>
                    </Marker>
                )}

                {pickup?.latitude && (
                    <Marker
                        anchor={{ x: 0.3, y: 0.6 }}
                        coordinate={{
                            latitude: pickup.latitude,
                            longitude: pickup.longitude
                        }}
                        zIndex={2}
                        title="Départ"
                        pinColor="green"
                    >
                        <View>
                            {/* <Image
                                source={require('../assets/images/car2.png')}
                                style={{ height: 50, width: 50, resizeMode: "contain" }}
                            /> */}
                            <Icon name="location-pin" type="entypo" size={35} color="green" />
                        </View>
                    </Marker>
                )}

                {rider?.latitude && (
                    <Marker
                        anchor={{ x: 0.3, y: 0.6 }}
                        coordinate={{
                            latitude: rider.latitude,
                            longitude: rider.longitude
                        }}
                        zIndex={1}
                    >
                        <View>
                            <Image
                                source={require('../assets/images/driver.png')}
                                style={{ height: 50, width: 50, resizeMode: "contain", transform: [{ rotate: `${rider.heading || 0}deg` }], }}
                            />
                        </View>
                    </Marker>
                )}

                {/* {drop && pickup && (
                    <Polyline
                        coordinates={getPoints([drop, pickup])}
                        strokeColor={theme === "dark" ? "#FFFFFF" : "#000000"}
                        strokeWidth={2}
                        geodesic={true}
                        lineDashPattern={[12, 5]}
                    />
                )} */}
                <Polyline coordinates={coords} strokeColor={trafficColor} strokeWidth={5} />
            </MapView>

            {/* <CustomButton
                icon={<Icon name="my-location" type="material-icon" size={24} color="#ff6d00" />}
                // buttonText="Commander une course"
                buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                textClassNames="text-white text-lg"
                onPress={() => { fitToMarkers() }}
            /> */}

            <View
                style={{
                    position: "absolute",
                    right: 16,
                    bottom: bottomSheetHeight + 16,
                    zIndex: 10,
                }}
            >
                <CustomButton
                    icon={
                        <Icon
                            name="my-location"
                            type="material-icon"
                            size={24}
                            color="#ff6d00"
                        />
                    }
                    buttonClassNames="bg-white shadow-xl w-12 h-12 rounded-full items-center justify-center"
                    onPress={fitToMarkers}
                />
            </View>
        </View>
    )
}

export default memo(LiveTrackingMap);