
import BottomSheetScrollView, { BottomSheetMethods } from "@/components/BottomSheetScrollView";
import { CustomButton } from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import { DisplayLoading } from "@/components/DisplayLoading";
import { apiRequest, GOOGLE_API_KEY, photoUrl } from "@/services/api";
import useStore from "@/store/useStore";
import { ICar, IRide } from "@/types";
import { showError, showSuccess } from "@/utils/showToast";
import polyline from "@mapbox/polyline";
// import { Icon, Rating } from "@rneui/base";
import Rating from "@/components/Rating";
import { AirbnbRating, Icon } from '@rneui/themed';
import { useLocalSearchParams } from "expo-router";
import moment from "moment";
import "moment/locale/fr";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    Dimensions,
    Image,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

moment.locale("fr");
const { width } = Dimensions.get("window");

export default function RideDetails() {
    const insets = useSafeAreaInsets();
    const { tok } = useStore();
    const { id } = useLocalSearchParams();

    const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
    const [trafficColor, setTrafficColor] = useState("#16B84E");
    const [loading, setLoading] = useState(true);
    const [loading2, setLoading2] = useState(false);
    const [ride, setRide] = useState<IRide | null>(null);
    const [car, setCar] = useState<ICar | null>(null);
    const [note, setNote] = useState<number>(0);

    const ratingCompleted = (rating: number) => {
        console.log('Rating is: ' + rating);
        setNote(rating)
    };

    const bottomSheetRef = useRef<BottomSheetMethods>(null);

    const pressHandler = useCallback(() => {
        bottomSheetRef.current?.expand();
    }, []);

    const close = useCallback(() => {
        bottomSheetRef.current?.close();
    }, []);

    const getRide = useCallback(async () => {
        try {
            setLoading(true);
            const res = await apiRequest({
                method: "GET",
                endpoint: `ride/getRideByIdForDetail/${id}`,
                token: tok,
            });

            console.log(res)

            if (res.success) {
                setRide(res.data.ride);
                setCar(res.data.car);
            }
        } catch (e) {
            console.error("Erreur récupération course :", e);
        } finally {
            setLoading(false);
        }
    }, [id, tok]);

    useEffect(() => {
        getRide();
    }, [getRide]);

    const onSubmit = async () => {
        setLoading2(true)
        const res = await apiRequest({
            method: 'POST',
            endpoint: 'rating/add',
            token: tok,
            data: {
                note,
                rider: ride?.rider?._id
            },
        });

        // console.log('dfdbfk jd', res)

        if (res.success === false) {
            setLoading2(false)
            showError(res.message)
            return;
        }

        if (res.success === true) {
            close()
            setLoading2(false)
            showSuccess(res.message)
            getRide()
        }
    };

    const fetchDirections = useCallback(async () => {
        if (!ride) return;

        try {
            const origin = `${ride.pickup.latitude},${ride.pickup.longitude}`;
            const destination = `${ride.drop.latitude},${ride.drop.longitude}`;
            const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}&departure_time=now&mode=driving`;

            const response = await fetch(url);
            const json = await response.json();

            if (!json.routes.length) return;

            const points = polyline.decode(json.routes[0].overview_polyline.points);
            const mapped = points.map(([latitude, longitude]) => ({ latitude, longitude }));
            setCoords(mapped);

            const leg = json.routes[0].legs[0];
            const duration = leg.duration.value;
            const traffic = leg.duration_in_traffic?.value || duration;

            if (traffic > duration * 1.5) setTrafficColor("#DE2916");
            else if (traffic > duration * 1.2) setTrafficColor("#FFA500");
            else setTrafficColor("#16B84E");
        } catch (err) {
            console.error("Erreur Directions API:", err);
        }
    }, [ride]);

    useEffect(() => {
        if (ride) fetchDirections();
    }, [fetchDirections, ride]);

    if (loading) return <DisplayLoading />;

    if (!ride) {
        return (
            <View className="flex-1 justify-center items-center bg-white">
                <Text className="text-lg text-gray-500">Détails non disponibles.</Text>
            </View>
        );
    }

    return (
        <View style={{ paddingBottom: insets.bottom }} className="flex-1 bg-white">
            <CustomHeader title="Détails de la course" showBack />
            {/* <CustomHeader title={`Course N° ${ride._id?.slice(-6).toUpperCase()}`} showBack /> */}

            <ScrollView showsVerticalScrollIndicator={false} className="px-4">
                {/* Date */}
                <View className="flex flex-row justify-between items-center">
                    <Text className="text-lg text-gray-500 mt-2 font-['RubikBold'] ">
                        {moment(ride.createdAt).format("DD MMM YYYY, HH:mm")}
                    </Text>

                    <View className="justify-center items-center">
                        <Image
                            source={
                                ride.vehicle === "eco"
                                    ? require("../assets/images/Taxi_confort_gris_miroir.png")
                                    : require("../assets/images/Taxi_confort_blanc_recadre.png")
                            }
                            className="w-20 h-10"
                        />
                        <Text className="font-['RubikSemiBold'] text-gray-800 text-lg">
                            {ride.vehicle}
                        </Text>
                    </View>
                </View>


                {/* Infos Chauffeur */}
                <View className="justify-center mt-1">
                    <View className="flex-row items-center py-3 space-x-3 border-b-[1px] border-gray-100">
                        <Image
                            source={
                                ride.rider?.photo
                                    ? { uri: `${photoUrl}${ride.rider.photo}` }
                                    : require("../assets/images/profil1.png")
                            }
                            className="w-14 h-14 rounded-full"
                        />
                        <View className="gap-2">
                            <Text className="font-['RubikSemiBold'] text-gray-800 text-lg">
                                {ride.rider?.prenom} {ride.rider?.nom?.[0]}.
                            </Text>
                            <Text className="text-sm text-gray-500 font-['RubikSemiBold']">
                                {car?.marque} - {car?.model} - {car?.immatriculation}
                            </Text>
                            <View className="bg-primary px-2 py-1 w-20 rounded-full justify-center items-center">
                                <Text numberOfLines={1} adjustsFontSizeToFit className="text-white font-['RubikSemiBold']">★ {ride.rider?.moyenne} </Text>
                            </View>

                        </View>
                    </View>

                    <View className="mt-3 flex flex-row justify-between items-center">
                        <View>
                            {/* <Text className="text-gray-600 font-['RubikSemiBold']">Noter</Text> */}
                            {/* <View>
                                <Rating
                                    showRating
                                    type="star"
                                    fractions={1}
                                    startingValue={ride.rider?.moyenne}
                                    readonly
                                    imageSize={40}
                                    onFinishRating={ratingCompleted}
                                    style={{ paddingVertical: 10 }}
                                />
                            </View> */}

                            <Rating value={ride.rider?.moyenne} editable={false} onChange={setNote} />

                        </View>
                        <TouchableOpacity onPress={pressHandler} className="bg-primary px-4 py-2 rounded-full">
                            <Text className="text-white font-['RubikSemiBold']">Noter</Text>
                        </TouchableOpacity>
                    </View>


                </View>

                {/* Résumé course */}
                <View className="bg-gray-50 px-2 py-4 rounded-xl mt-6 gap-x-3">
                    <View className="flex-row justify-between mb-2">
                        <View className="flex flex-row justify-center items-center">
                            <Icon name="map-marker-distance" type="material-community" size={25} color="#4b5563" />
                            <Text className="text-gray-600 font-['RubikSemiBold'] ml-2">Distance</Text>
                        </View>
                        {/* <Text className="text-gray-600 font-['RubikSemiBold']">Distance</Text> */}
                        <Text className="font-['RubikBold']">{ride.distance?.toFixed(2)} km</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <View className="flex flex-row justify-center items-center">
                            <Icon name="clock-time-four" type="material-community" size={25} color="#4b5563" />
                            <Text className="text-gray-600 font-['RubikSemiBold'] ml-2">Durée</Text>
                        </View>

                        <Text className="font-['RubikBold']">{ride?.estimatedDurationFormatted} min</Text>
                    </View>
                    <View className="flex-row justify-between mb-2">
                        <View className="flex flex-row justify-center items-center">
                            <Icon name="money-bill-wave-alt" type="font-awesome-5" size={20} color="#4b5563" />
                            <Text className="text-gray-600 font-['RubikSemiBold'] ml-2">Montant</Text>
                        </View>

                        <Text className="font-['RubikBold']">{ride.fare} F</Text>
                    </View>
                    {/* <TouchableOpacity className="p-3 self-center">
                        <Text className="text-primary text-sm font-semibold">Voir la facture →</Text>
                    </TouchableOpacity> */}
                </View>

                {/* Carte */}
                <MapView
                    style={{
                        width: width - 32,
                        height: 100,
                        borderRadius: 12,
                        marginTop: 20,
                    }}
                    initialRegion={{
                        latitude: ride.pickup.latitude,
                        longitude: ride.pickup.longitude,
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    }}
                    scrollEnabled={false}
                    showsTraffic
                >
                    <Marker
                        coordinate={ride.pickup}
                        title="Départ"
                        pinColor="green"
                    />
                    <Marker
                        coordinate={ride.drop}
                        title="Destination"
                        pinColor="red"
                    />
                    <Polyline coordinates={coords} strokeColor={trafficColor} strokeWidth={5} />
                </MapView>

                {/* Lieux + horaires */}
                {/* <View className="mt-4 mb-10">
                    <View className="flex-row justify-between mb-1">
                        <Text className="text-gray-500">Départ</Text>
                        <Text className="text-sm">{moment(ride.createdAt).add(6, "minutes").format("HH:mm")}</Text>
                    </View>
                    <Text className="font-semibold text-gray-800 mb-2">{ride.pickup.address}</Text>

                    <View className="flex-row justify-between mb-1">
                        <Text className="text-gray-500">Arrivée</Text>
                        <Text className="text-sm">{moment(ride.createdAt).add(28, "minutes").format("HH:mm")}</Text>
                    </View>
                    <Text className="font-semibold text-gray-800">{ride.drop.address}</Text>
                </View> */}

                <View className="mt-4 mb-10">
                    <View className="py-1 px-2 w-full flex-row justify-center  items-center">
                        <Icon name="dot-fill" type='octicon' size={25} color="#000000" />
                        <View className="my-2 ml-2 py-1 px-3 justify-center w-full h-16">
                            <View className="flex flex-row justify-between items-center">
                                <Text className="text-gray-500 font-['RubikSemiBold'] text-lg">Départ</Text>
                                <Text className="text-lg font-['RubikRegular']">{moment(ride.createdAt).add(6, "minutes").format("HH:mm")}</Text>
                            </View>

                            <Text numberOfLines={2} className="font-['RubikRegular'] text-lg">{ride.pickup.address}</Text>
                        </View>
                    </View>

                    <View className="bg-black w-1 h-20 absolute bottom-14 left-0.5" />

                    <View className="py-1 px-1 w-full flex-row justify-center  items-center">
                        <Icon name="pin-drop" type='material-icon' size={30} color="#000000" />

                        <View className="my-2 py-1 px-3 justify-center w-full h-16">
                            <View className="flex flex-row justify-between items-center">
                                <Text className="text-gray-500 font-['RubikSemiBold'] text-lg">Arrivée</Text>
                                <Text className="text-lg font-['RubikRegular']">{moment(ride.createdAt).add(28, "minutes").format("HH:mm")}</Text>
                            </View>

                            <Text numberOfLines={2} className="font-['RubikRegular'] text-lg">{ride.drop.address}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <BottomSheetScrollView
                ref={bottomSheetRef}
                snapTo={'35%'}
                backgroundColor={'white'}
                backDropColor={'black'}
            >
                <View className="p-3">

                    <View className="self-center">
                        <Text className="text-gray-600 font-['RubikSemiBold'] py-3">Noter le chauffeur pour la course effectuée</Text>
                        {/* <AirbnbRating
                            count={5}
                            size={35}
                            defaultRating={note}
                            showRating={false}
                            onFinishRating={value => setNote(value)}
                        /> */}
                        <Rating value={note} onChange={setNote} />
                    </View>

                    <CustomButton
                        buttonText="Noter"
                        loading={loading2}
                        buttonClassNames="bg-primary shadow-xl h-12 rounded-full items-center justify-center mt-4"
                        textClassNames="text-white text-lg font-['RubikBold']"
                        onPress={onSubmit}
                    />
                </View>
            </BottomSheetScrollView>
        </View>
    );
}





// /* eslint-disable react-hooks/rules-of-hooks */
// import CustomHeader from "@/components/CustomHeader";
// import { DisplayLoading } from "@/components/DisplayLoading";
// import { apiRequest, GOOGLE_API_KEY, photoUrl } from "@/services/api";
// import useStore from "@/store/useStore";
// import { ICar, IRide } from "@/types";
// import polyline from '@mapbox/polyline';
// import { useLocalSearchParams } from "expo-router";
// import moment from 'moment';
// import 'moment/locale/fr';
// import React, { useCallback, useEffect, useState } from "react";
// import {
//     Dimensions,
//     Image,
//     ScrollView,
//     Text,
//     View,
// } from "react-native";
// import MapView, { Marker, Polyline } from "react-native-maps";

// moment.locale('fr');
// const { width } = Dimensions.get("window");

// export default function RideDetails() {
//     const {tok} = useStore();
//     const { id } = useLocalSearchParams();

//     const [coords, setCoords] = useState<{ latitude: number; longitude: number }[]>([]);
//     const [trafficColor, setTrafficColor] = useState("#16B84E");
//     const [loading, setLoading] = useState(true);
//     const [ride, setRide] = useState<IRide | null>(null);
//     const [car, setCar] = useState<ICar | null>(null);

//     const getRide = useCallback(async () => {
//         try {
//             setLoading(true);
//             const res = await apiRequest({
//                 method: 'GET',
//                 endpoint: `ride/getRideByIdForDetail/${id}`,
//                 token: tok,
//             });

//             console.log(res)

//             if (res.success) {
//                 setRide(res.data.ride);
//                 setCar(res.data.car);
//             }
//         } catch (e) {
//             console.error("Erreur récupération course :", e);
//         } finally {
//             setLoading(false);
//         }
//     }, [id, tok]);

//     useEffect(() => {
//         getRide();
//     }, [getRide]);

//     const fetchDirections = useCallback(async () => {
//         if (!ride) return;

//         try {
//             const origin = `${ride.pickup.latitude},${ride.pickup.longitude}`;
//             const destination = `${ride.drop.latitude},${ride.drop.longitude}`;
//             const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_API_KEY}&departure_time=now&mode=driving`;

//             const response = await fetch(url);
//             const json = await response.json();

//             if (!json.routes.length) return;

//             const route = json.routes[0];
//             const points = polyline.decode(route.overview_polyline.points);
//             const mapped = points.map(([latitude, longitude]) => ({ latitude, longitude }));
//             setCoords(mapped);

//             const leg = route.legs[0];
//             const duration = leg.duration.value;
//             const traffic = leg.duration_in_traffic?.value || duration;

//             if (traffic > duration * 1.5) {
//                 setTrafficColor("#DE2916"); // rouge
//             } else if (traffic > duration * 1.2) {
//                 setTrafficColor("#FFA500"); // orange
//             } else {
//                 setTrafficColor("#16B84E"); // vert
//             }
//         } catch (err) {
//             console.error("Erreur Directions API:", err);
//         }
//     }, [ride]);

//     useEffect(() => {
//         if (ride) {
//             fetchDirections();
//         }
//     }, [fetchDirections, ride]);

//     if (loading) return <DisplayLoading />;

//     if (!ride) {
//         return (
//             <View className="flex-1 justify-center items-center bg-white">
//                 <Text className="text-lg text-gray-500">Détails non disponibles.</Text>
//             </View>
//         );
//     }

//     return (
//         <View className="flex-1 bg-white">
//             <CustomHeader title="Détails de la course" showBack />
//             <ScrollView className="px-4">
//                 {/* === TRAJET === */}
//                 <View className="mt-4 mb-4">
//                     <Text className="text-lg font-['RubikBold'] text-primary mb-1">Trajet</Text>
//                     <Text className="text-sm text-gray-600 font-['RubikSemiBold']">Départ :</Text>
//                     <Text className="text-base font-['RubikRegular']">{ride.pickup.address}</Text>

//                     <Text className="text-sm text-gray-600 mt-2 font-['RubikSemiBold']">Destination :</Text>
//                     <Text className="text-base font-['RubikRegular']">{ride.drop.address}</Text>

//                     <Text className="text-sm text-gray-600 mt-2 font-['RubikSemiBold']">Distance :</Text>
//                     <Text className="text-base font-['RubikRegular']">{ride.distance?.toFixed(2)} km</Text>
//                 </View>

//                 {/* === INFOS === */}
//                 <View className="mb-4">
//                     <Text className="text-lg text-primary mb-1 font-['RubikBold']">Infos</Text>
//                     <View className="flex-row justify-between mb-2">
//                         <Text className="text-gray-600 font-['RubikSemiBold']">Montant :</Text>
//                         <Text className="font-['RubikRegular']">{ride.fare} XOF</Text>
//                     </View>
//                     <View className="flex-row justify-between mb-2">
//                         <Text className="text-gray-600 font-['RubikSemiBold']">Paiement :</Text>
//                         <Text className="capitalize font-['RubikRegular']">{ride.paymentMethod}</Text>
//                     </View>
//                     <View className="flex-row justify-between mb-2">
//                         <Text className="text-gray-600 font-['RubikSemiBold']">Statut :</Text>
//                         <Text className="font-['RubikRegular'] text-green-600">
//                             {ride.status === "PAYED" ? "PAYÉE" : ride.status}
//                         </Text>
//                     </View>
//                     <View className="flex-row justify-between mb-2">
//                         <Text className="text-gray-600 font-['RubikSemiBold']">Date :</Text>
//                         <Text className="font-['RubikRegular']">{moment(ride.createdAt).calendar()}</Text>
//                     </View>
//                 </View>

//                 {/* === CHAUFFEUR === */}
//                 <View className="mb-4">
//                     <Text className="text-lg font-['RubikBold'] text-primary mb-1">Chauffeur</Text>
//                     <View className="flex-row items-center gap-3 mt-2">
//                         <Image
//                             source={
//                                 ride.rider?.photo
//                                     ? { uri: `${photoUrl}${ride.rider.photo}` }
//                                     : require('../assets/images/profil1.png')
//                             }
//                             className="w-14 h-14 rounded-full"
//                         />
//                         <View>
//                             <Text className="text-base font-['RubikSemiBold']">
//                                 {ride.rider?.prenom} {ride.rider?.nom}
//                             </Text>
//                             <Text className="text-sm text-gray-500 font-['RubikRegular']">
//                                 {ride.rider?.phone}
//                             </Text>
//                         </View>
//                     </View>
//                 </View>

//                 {/* === MAP === */}
//                 <MapView
//                     style={{
//                         width: width - 32,
//                         height: 250,
//                         borderRadius: 12,
//                         marginBottom: 16,
//                     }}
//                     initialRegion={{
//                         latitude: ride.pickup.latitude,
//                         longitude: ride.pickup.longitude,
//                         latitudeDelta: 0.05,
//                         longitudeDelta: 0.05,
//                     }}
//                     showsScale
//                     showsTraffic
//                     showsBuildings
//                     scrollEnabled={false}
//                 >
//                     <Marker
//                         coordinate={{
//                             latitude: ride.pickup.latitude,
//                             longitude: ride.pickup.longitude,
//                         }}
//                         title="Départ"
//                         pinColor="green"
//                     />
//                     <Marker
//                         coordinate={{
//                             latitude: ride.drop.latitude,
//                             longitude: ride.drop.longitude,
//                         }}
//                         title="Destination"
//                         pinColor="red"
//                     />
//                     <Polyline coordinates={coords} strokeColor={trafficColor} strokeWidth={5} />
//                 </MapView>
//             </ScrollView>
//         </View>
//     );
// }
