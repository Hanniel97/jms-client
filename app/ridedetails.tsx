/* eslint-disable react-hooks/rules-of-hooks */
import CustomHeader from "@/components/CustomHeader";
import { GOOGLE_API_KEY, photoUrl } from "@/services/api";
import { IRide } from "@/types";
import polyline from '@mapbox/polyline';
import { useLocalSearchParams } from "expo-router";
import moment from 'moment';
import 'moment/locale/fr';
import React, { useCallback, useEffect, useState } from "react";
import {
    Dimensions,
    Image,
    ScrollView,
    Text,
    View
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

moment.locale('fr');

const { width } = Dimensions.get("window");

export default function ridedetails() {
    const { item } = useLocalSearchParams();
    const ride: IRide = JSON.parse(item as string);

    const [coords, setCoords] = useState([]);
    const [trafficColor, setTrafficColor] = useState("#16B84E"); // Couleur par défaut
    const [loading, setLoading] = useState(true);

    const fetchDirections = useCallback(async () => {
        try {
            const origin = `${ride.pickup.latitude},${ride.pickup.longitude}`;
            const destination = `${ride.drop.latitude},${ride.drop.longitude}`;

            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}&departure_time=now&mode=driving`;

            const response = await fetch(url);
            const json = await response.json();

            if (!json.routes.length) return;

            const route = json.routes[0];
            const points = polyline.decode(route.overview_polyline.points);
            const coords = points.map(([latitude, longitude]) => ({ latitude, longitude }));
            setCoords(coords);

            const leg = route.legs[0];
            const duration = leg.duration.value;
            const durationInTraffic = leg.duration_in_traffic?.value;

            // Ajuste la couleur en fonction du trafic
            if (durationInTraffic && durationInTraffic > duration * 1.5) {
                setTrafficColor("#DE2916"); //rouge
            } else if (durationInTraffic && durationInTraffic > duration * 1.2) {
                setTrafficColor("#FFA500"); //orange
            } else {
                setTrafficColor("#16B84E"); //vert
            }

            setLoading(false);
        } catch (err) {
            console.error("Erreur Directions API:", err);
            setLoading(false);
        }
    }, [ride.drop.latitude, ride.drop.longitude, ride.pickup.latitude, ride.pickup.longitude]);

    useEffect(() => {
        fetchDirections();
    }, [fetchDirections]);

    return (
        <View className="flex-1 bg-white dark:bg-black">
            <CustomHeader title="Détails de la course" showBack />

            <ScrollView className="px-4">
                {/* === TRAJET === */}
                <View className="mt-4 mb-4">
                    <Text className="text-lg font-['RubikBold'] text-primary mb-1">Trajet</Text>
                    <Text className="text-sm text-gray-600 font-['RubikSemiBold']">Départ :</Text>
                    <Text className="text-base font-['RubikRegular']">{ride.pickup.address}</Text>

                    <Text className="text-sm font-['RubikSemiBold'] text-gray-600 mt-2">Destination :</Text>
                    <Text className="text-base font-['RubikRegular']">{ride.drop.address}</Text>

                    <Text className="text-sm font-['RubikSemiBold'] text-gray-600 mt-2">Distance :</Text>
                    <Text className="text-base font-['RubikRegular']">{ride.distance?.toFixed(2)} km</Text>
                </View>

                {/* === INFOS === */}
                <View className="mb-4">
                    <Text className="text-lg font-bold text-primary mb-1 font-['RubikBold']">Infos</Text>

                    <View className="flex-row justify-between mb-2">
                        <Text className="text-gray-600 font-['RubikSemiBold']">Montant :</Text>
                        <Text className="font-['RubikRegular']">{ride.fare} XOF</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-gray-600 font-['RubikSemiBold']">Paiement :</Text>
                        <Text className="capitalize font-['RubikRegular']">{ride.paymentMethod}</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-gray-600 font-['RubikSemiBold']">Statut :</Text>
                        <Text className="capitalize font-['RubikRegular'] text-green-600">{ride.status === "PAYED" ? "PAYEE" : "--"}</Text>
                    </View>
                    {/* <View className="flex-row justify-between mb-2">
                        <Text className="text-gray-600">OTP :</Text>
                        <Text className="font-semibold">{ride.otp}</Text>
                    </View> */}
                    <View className="flex-row justify-between mb-2">
                        <Text className="text-gray-600 font-['RubikSemiBold']">Date :</Text>
                        <Text className="font-['RubikRegular']">
                            {moment(ride.createdAt).calendar()}
                            {/* {new Date(ride.createdAt).toLocaleString()} */}
                        </Text>
                    </View>
                </View>

                {/* === CHAUFFEUR === */}
                <View className="mb-4">
                    <Text className="text-lg font-bold text-primary mb-1 font-['RubikBold']">Chauffeur</Text>
                    <View className="flex-row items-center gap-3 mt-2">
                        <Image
                            source={{ uri: photoUrl + ride.rider?.photo || require('../assets/images/profil1.png') }}
                            className="w-14 h-14 rounded-full"
                        />
                        <View>
                            <Text className="text-base font-['RubikSemiBold']">
                                {ride.rider?.prenom} {ride.rider?.nom}
                            </Text>
                            <Text className="text-sm text-gray-500 font-['RubikRegular']">{ride.rider?.phone}</Text>
                        </View>
                    </View>
                </View>

                {/* === VÉHICULE === */}
                {/* Tu peux activer cette section si tu as les infos véhicule dans ride.vehicle */}
                {/* <View className="mb-6">
                    <Text className="text-lg font-bold text-primary mb-1">Véhicule</Text>
                    <View className="flex-row items-center justify-between">
                        <Text className="text-base">
                            {ride.vehicle?.name} ({ride.vehicle?.type})
                        </Text>
                        <Text className="text-base font-semibold">{ride.vehicle?.numberPlate}</Text>
                    </View>
                </View> */}

                {/* === MAP === */}
                <MapView
                    style={{
                        width: width - 32,
                        height: 250,
                        borderRadius: 12,
                        marginBottom: 16,
                    }}
                    initialRegion={{
                        latitude: ride.pickup.latitude,
                        longitude: ride.pickup.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    // maxZoomLevel={16}
                    // minZoomLevel={12}
                    showsScale={true}
                    showsBuildings={true}
                    showsTraffic={true}
                    zoomControlEnabled={false}
                    zoomEnabled={false}
                    zoomTapEnabled={false}
                    scrollEnabled={false}
                    showsUserLocation={false}
                    showsMyLocationButton={false}
                >
                    <Marker
                        coordinate={{
                            latitude: ride.pickup.latitude,
                            longitude: ride.pickup.longitude,
                        }}
                        title="Départ"
                        pinColor="green"
                    />
                    <Marker
                        coordinate={{
                            latitude: ride.drop.latitude,
                            longitude: ride.drop.longitude,
                        }}
                        title="Destination"
                        pinColor="red"
                    />

                    <Polyline coordinates={coords} strokeColor={trafficColor} strokeWidth={5} />

                    {/* <MapViewDirections
                        origin={{
                            latitude: ride.pickup.latitude,
                            longitude: ride.pickup.longitude,
                        }}
                        destination={{
                            latitude: ride.drop.latitude,
                            longitude: ride.drop.longitude,
                        }}
                        apikey={GOOGLE_API_KEY}
                        strokeWidth={4}
                        strokeColor="#007bff"
                        optimizeWaypoints={true}
                        mode="DRIVING"
                    /> */}
                </MapView>

                {/* === BOUTON === */}
                {/* <TouchableOpacity
                    className="bg-primary rounded-full py-3 items-center flex-row justify-center mt-4 mb-10"
                    onPress={() => {
                        // Appeler ou ouvrir WhatsApp ?
                    }}
                >
                    <Icon name="phone" type="feather" color="#fff" size={18} />
                    <Text className="ml-2 text-white font-semibold text-base">
                        Contacter le chauffeur
                    </Text>
                </TouchableOpacity> */}
            </ScrollView>
        </View>
    );
}
