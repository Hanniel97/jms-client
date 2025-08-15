import BottomSheetScrollView, { BottomSheetMethods } from "@/components/BottomSheetScrollView";
import { CustomButton } from "@/components/CustomButton";
import CustomHeader from "@/components/CustomHeader";
import { CustomLocationTextInput } from "@/components/CustomTextInput";
import MapPickerModal from "@/components/MapPickerModal";
import { apiRequest, Coordinates, getPlaceDetails, searchPlaces } from "@/services/api";
import { getDistanceFromLatLonInKm } from "@/services/distanceCalculator";
import useStore from "@/store/useStore";
import { showError, showSuccess } from "@/utils/showToast";
import { Icon } from "@rneui/base";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  PixelRatio,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height } = Dimensions.get("window");
const scale = PixelRatio.getFontScale();
const baseSize = (size: number) => size / scale;

const paymentMethods = [
  { key: "wallet", title: "Portefeuille", image: require("../assets/images/wallet.jpg") },
  { key: "espece", title: "Espèces", image: require("../assets/images/espece.png") },
] as const;
type PaymentKey = typeof paymentMethods[number]["key"];

type FareDetails = {
  distance: number;
  estimatedDuration: string;
  fare: { eco: number; confort: number };
};

export default function AddCourse() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const bottomSheetRef = useRef<BottomSheetMethods>(null);

  const { tok, position } = useStore();

  const [loading, setLoading] = useState<boolean>(false);
  const [pricingLoading, setPricingLoading] = useState<boolean>(false);

  const [pickup, setPickup] = useState<string>("");
  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);

  const [drop, setDrop] = useState<string>("");
  const [dropCoords, setDropCoords] = useState<Coordinates | null>(null);

  const [focusedInput, setFocusedInput] = useState<"pickup" | "drop">("drop");
  const [modalTitle, setModalTitle] = useState<"pickup" | "drop">("drop");
  const [isMapModalVisible, setMapModalVisible] = useState(false);

  const [selectedMethod, setSelectedMethod] = useState<PaymentKey>("wallet");
  const [selectedCar, setSelectedCar] = useState<"eco" | "confort">("eco");

  const [courseDetails, setCourseDetails] = useState<FareDetails | null>(null);

  // Suggestions & recherche (debounce + order guard)
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const searchSeqRef = useRef(0);

  const pressHandler = useCallback(() => bottomSheetRef.current?.expand(), []);
  const close = useCallback(() => bottomSheetRef.current?.close(), []);

  /** Pré-remplir avec la position actuelle au premier rendu */
  useEffect(() => {
    if (position) {
      // n’écrase pas si l’utilisateur a déjà saisi
      setPickupCoords((prev) => prev ?? position);
      if (!pickup && position.address) setPickup(position.address);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [position?.latitude, position?.longitude, position?.address]);

  /** Utiliser ma position pour Départ */
  const useMyPosition = useCallback(() => {
    if (position) {
      setPickupCoords(position);
      if (position.address) setPickup(position.address);
      setFocusedInput("pickup");
    }
  }, [position]);

  /** Recherche d’adresses avec debounce et anti-race-condition */
  const handleInputChange = useCallback((text: string) => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!text || text.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const seq = ++searchSeqRef.current;
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(text.trim());
        if (seq === searchSeqRef.current) {
          setSuggestions(results || []);
        }
      } catch {
        // silencieux
      }
    }, 300);
  }, []);

  /** Sélection depuis Google Places (liste) */
  const handlePlaceSelect = useCallback(
    async (placeId: string) => {
      try {
        const location: Coordinates | null = await getPlaceDetails(placeId);
        if (!location) return;

        if (focusedInput === "drop") {
          setDrop(location.address ?? "");
          setDropCoords(location);
        } else {
          setPickup(location.address ?? "");
          setPickupCoords(location);
        }
        setSuggestions([]);
        Keyboard.dismiss();
      } catch {
        // silencieux
      }
    },
    [focusedInput]
  );

  /** Comparateur simple pour éviter les recalculs inutiles */
  const coordsEqual = (a?: Coordinates | null, b?: Coordinates | null) =>
    !!a &&
    !!b &&
    Number(a.latitude) === Number(b.latitude) &&
    Number(a.longitude) === Number(b.longitude);

  const lastComputedRef = useRef<{ p?: Coordinates | null; d?: Coordinates | null } | null>(null);

  /** Calcul distance + tarifs (après que pickup & drop soient définis) */
  const checkDistanceAndPrice = useCallback(async () => {
    if (!pickupCoords || !dropCoords) return;

    // évite appels répétés si mêmes coords
    if (
      lastComputedRef.current &&
      coordsEqual(lastComputedRef.current.p, pickupCoords) &&
      coordsEqual(lastComputedRef.current.d, dropCoords)
    ) {
      return;
    }

    const { latitude: lat1, longitude: lon1 } = pickupCoords;
    const { latitude: lat2, longitude: lon2 } = dropCoords;

    if (lat1 === lat2 && lon1 === lon2) {
      showError("Les adresses doivent être différentes");
      return;
    }

    const distance = getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2);
    const minDistance = 0.5;
    const maxDistance = 50;

    if (distance < minDistance) {
      showError("L'emplacement choisi est trop proche");
      return;
    }
    if (distance > maxDistance) {
      showError("L'emplacement choisi est trop éloigné");
      return;
    }

    setPricingLoading(true);
    try {
      const res = await apiRequest({
        method: "POST",
        endpoint: "ride/calculateCourseDetails",
        token: tok,
        data: {
          pickup: pickupCoords,
          drop: dropCoords,
        },
      });

      if (res.success === true) {
        setCourseDetails(res.data as FareDetails);
        lastComputedRef.current = { p: pickupCoords, d: dropCoords };
        pressHandler();
      } else {
        setCourseDetails(null);
        showError(res.message || "Impossible de calculer le tarif");
      }
    } catch (e) {
      setCourseDetails(null);
      showError("Erreur réseau lors du calcul");
    } finally {
      setPricingLoading(false);
    }
  }, [dropCoords, pickupCoords, pressHandler, tok]);

  /** Déclenche le calcul dès que pickup & drop prêts */
  useEffect(() => {
    if (pickupCoords && dropCoords) {
      checkDistanceAndPrice();
    }
  }, [pickupCoords?.latitude, pickupCoords?.longitude, dropCoords?.latitude, dropCoords?.longitude, checkDistanceAndPrice]);

  /** Création de la course */
  const onSubmit = useCallback(async () => {
    if (loading) return;
    if (!pickupCoords || !dropCoords) {
      showError("Veuillez sélectionner les adresses de départ et d'arrivée.");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest({
        method: "POST",
        endpoint: "ride/create",
        token: tok,
        data: {
          vehicle: selectedCar,
          pickup: pickupCoords,
          drop: dropCoords,
          paymentMethod: selectedMethod,
        },
      });

      if (res.success === false) {
        showError(res.message || "Création de course échouée");
        return;
      }

      if (res.success === true) {
        close();
        showSuccess(res.message || "Course créée");
        router.replace({ pathname: "/liveride", params: { id: res.ride._id } });
      }
    } catch {
      showError("Erreur réseau lors de la création");
    } finally {
      setLoading(false);
    }
  }, [close, dropCoords, loading, pickupCoords, selectedCar, selectedMethod, tok]);

  /** Ouverture du picker carte */
  const openMapPicker = useCallback(
    (target: "pickup" | "drop") => {
      setModalTitle(target);
      setMapModalVisible(true);
      setSuggestions([]); // nettoie la liste
      Keyboard.dismiss();
    },
    []
  );

  /** Location initiale pour le MapPicker */
  const selectedLocationForModal = useMemo(() => {
    const fallback = {
      latitude: position?.latitude ?? 0,
      longitude: position?.longitude ?? 0,
      address: position?.address ?? "",
    };
    if (modalTitle === "drop") {
      return dropCoords
        ? { latitude: dropCoords.latitude, longitude: dropCoords.longitude, address: drop || dropCoords.address }
        : fallback;
    }
    return pickupCoords
      ? { latitude: pickupCoords.latitude, longitude: pickupCoords.longitude, address: pickup || pickupCoords.address }
      : fallback;
  }, [drop, dropCoords, modalTitle, pickup, pickupCoords, position?.address, position?.latitude, position?.longitude]);

  return (
    <View style={{ marginBottom: insets.bottom }} className="flex-1 bg-white">
      <CustomHeader showBack={true} title={"Créer une course"} />

      {/* Form adresses */}
      <View className="w-full px-5">
        {/* Départ */}
        <View className="py-1 px-2 w-full flex-row items-center">
          <Icon name="dot-fill" type="octicon" size={35} color="#000000" />
          <View className="my-2 h-[50px] py-1 ml-1 justify-center flex-1">
            <CustomLocationTextInput
              placeholder={"Adresse de départ"}
              type={"pickup"}
              value={pickup}
              onChangeText={(text) => {
                setPickup(text);
                setFocusedInput("pickup");
                handleInputChange(text);
              }}
              onFocus={() => setFocusedInput("pickup")}
            />
          </View>
          <TouchableOpacity onPress={() => openMapPicker("pickup")} className="ml-2">
            <Icon name="map" type="feather" size={20} color="#000" />
          </TouchableOpacity>
        </View>

        {/* <View className="bg-black w-1 h-16 absolute bottom-11 left-8" /> */}

        <View className="bg-black w-1 h-16 ml-[22px] absolute bottom-11 left-3" />

        {/* Arrivée */}
        <View className="py-1 px-1 w-full flex-row items-center">
          <Icon name="pin-drop" type="material-icon" size={25} color="#000000" />
          <View className="my-2 h-[50px] py-1 ml-1 justify-center flex-1">
            <CustomLocationTextInput
              placeholder={"Adresse d'arrivée"}
              type={"drop"}
              value={drop}
              onChangeText={(text) => {
                setDrop(text);
                setFocusedInput("drop");
                handleInputChange(text);
              }}
              onFocus={() => setFocusedInput("drop")}
            />
          </View>
          <TouchableOpacity onPress={() => openMapPicker("drop")} className="ml-2">
            <Icon name="map" type="feather" size={20} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Suggestions */}
      <View className="bg-white px-3 space-y-4">
        <View className="flex-row items-center rounded-lg">
          <Text className="text-gray-700 ml-2 font-['RubikMedium']">
            Suggestion {focusedInput === "drop" ? "adresse d'arrivée" : "adresse de départ"}
          </Text>
        </View>

        <FlatList
          data={suggestions}
          keyExtractor={(item, index) => item?.place_id ?? index.toString()}
          initialNumToRender={6}
          windowSize={6}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            item?.description && item?.place_id ? (
              <TouchableOpacity
                key={item.place_id}
                onPress={() => handlePlaceSelect(item.place_id)}
                className="flex-row items-center border-[1px] border-primary/10 px-4 py-4 rounded-lg mb-2"
              >
                <Icon name="location-pin" type="entypo" size={20} color="#000000" />
                <Text className="py-2 px-3 text-black font-['RubikRegular'] flex-1">{item.description}</Text>
              </TouchableOpacity>
            ) : null
          }
          style={{ maxHeight: height * 0.7 }}
          ListFooterComponent={
            <View>
              <TouchableOpacity
                onPress={useMyPosition}
                className="flex-row items-center border-[1px] border-primary/10 px-4 py-4 rounded-lg mb-2"
              >
                <Icon name="my-location" type="material" size={20} color="#000000" />
                <Text className="text-gray-700 ml-2 font-['RubikMedium']">Utiliser ma position</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => openMapPicker(focusedInput)}
                className="flex-row items-center border-[1px] border-primary/10 px-4 py-4 rounded-lg"
              >
                <Icon name="map" type="feather" size={20} color="#000000" />
                <Text className="text-gray-700 ml-2 font-['RubikMedium']">Sélectionner depuis la carte</Text>
              </TouchableOpacity>
            </View>
          }
        />
      </View>

      {/* Modal Picker Map */}
      {isMapModalVisible && (
        <MapPickerModal
          title={modalTitle}
          visible={isMapModalVisible}
          onClose={() => setMapModalVisible(false)}
          selectedLocation={selectedLocationForModal}
          onSelectLocation={(data) => {
            if (!data) return;
            const coords: Coordinates = { latitude: data.latitude, longitude: data.longitude, address: data.address };
            if (modalTitle === "drop") {
              setDropCoords(coords);
              setDrop(data.address ?? `${data.latitude}, ${data.longitude}`);
              setFocusedInput("drop");
            } else {
              setPickupCoords(coords);
              setPickup(data.address ?? `${data.latitude}, ${data.longitude}`);
              setFocusedInput("pickup");
            }
          }}
        />
      )}

      {/* BottomSheet récap & paiement */}
      <BottomSheetScrollView ref={bottomSheetRef} snapTo={"55%"} backgroundColor={"white"} backDropColor={"black"}>
        <View className="p-3 space-y-4">
          {/* Cartes ECO / CONFORT */}
          <View className="flex-row justify-between space-x-2">
            {(["eco", "confort"] as const).map((type) => (
              <TouchableOpacity
                key={type}
                activeOpacity={0.8}
                onPress={() => setSelectedCar(type)}
                className="flex-1 rounded-xl border border-gray-300 bg-white"
                style={{ minHeight: baseSize(110) }}
              >
                <View className="bg-primary h-10 w-[70%] rounded-tl-xl rounded-br-xl">
                  <Image
                    source={
                      type === "eco"
                        ? require("../assets/images/Taxi_confort_gris_miroir.png")
                        : require("../assets/images/Taxi_confort_blanc_recadre.png")
                    }
                    style={{
                      height: baseSize(110),
                      width: baseSize(110),
                      resizeMode: "contain",
                      position: "absolute",
                      top: -baseSize(40),
                    }}
                  />
                </View>

                <View className="flex-1 justify-center px-2 py-2">
                  <View className="flex-row justify-between items-center">
                    <Text className="font-['RubikRegular'] text-black" style={{ fontSize: baseSize(14) }} numberOfLines={1}>
                      {type === "eco" ? "ECO" : "CONFORT"}
                    </Text>
                    <Text className="font-['RubikBold']" style={{ fontSize: baseSize(12) }} numberOfLines={1}>
                      {courseDetails?.fare?.[type] != null ? `${courseDetails.fare[type]} XOF` : pricingLoading ? "..." : "--"}
                    </Text>
                  </View>

                  <View className="flex-row justify-between items-center mt-1">
                    <Text className="text-gray-500 font-['RubikRegular']" style={{ fontSize: baseSize(12) }}>
                      {courseDetails?.estimatedDuration ?? (pricingLoading ? "..." : "--")} min
                    </Text>
                    <Text className="font-['RubikBold']" style={{ fontSize: baseSize(12) }}>
                      {courseDetails?.distance ?? (pricingLoading ? "..." : "--")} km
                    </Text>
                    <View className="w-4 h-4 rounded-full border border-gray-400 items-center justify-center">
                      {selectedCar === type && <View className="w-2 h-2 rounded-full bg-green-500" />}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Méthodes de paiement */}
          <View className="flex-row justify-between space-x-2 p-2 rounded-xl border border-gray-300 bg-white mb-3">
            {paymentMethods.map((method) => (
              <TouchableOpacity
                key={method.key}
                activeOpacity={0.8}
                onPress={() => setSelectedMethod(method.key)}
                className="flex-1 items-center rounded-xl bg-gray-50 p-2"
                style={{ minHeight: baseSize(100) }}
              >
                <Image
                  source={method.image}
                  style={{
                    width: baseSize(48),
                    height: baseSize(48),
                    resizeMode: "contain",
                    marginBottom: baseSize(4),
                  }}
                />
                <Text className="text-center text-black font-['RubikRegular']" style={{ fontSize: baseSize(12) }} numberOfLines={1}>
                  {method.title}
                </Text>
                <View className="w-5 h-5 rounded-full border-2 border-primary items-center justify-center mt-1">
                  {selectedMethod === method.key && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Bouton Commander */}
          <CustomButton
            buttonText={loading ? "Création..." : "Commander"}
            loading={loading}
            buttonClassNames={`${
              !pickupCoords || !dropCoords || pricingLoading ? "bg-gray-300" : "bg-primary"
            } h-12 rounded-full items-center justify-center mt-4`}
            textClassNames="text-white text-sm font-['RubikBold']"
            onPress={onSubmit}
          />
        </View>
      </BottomSheetScrollView>
    </View>
  );
}






// import BottomSheetScrollView, { BottomSheetMethods } from "@/components/BottomSheetScrollView";
// import { CustomButton } from "@/components/CustomButton";
// import CustomHeader from "@/components/CustomHeader";
// import { CustomLocationTextInput } from "@/components/CustomTextInput";
// import MapPickerModal from "@/components/MapPickerModal";
// import { apiRequest, Coordinates, getPlaceDetails, searchPlaces } from "@/services/api";
// import { getDistanceFromLatLonInKm } from "@/services/distanceCalculator";
// import useStore from "@/store/useStore";
// import { showError, showSuccess } from "@/utils/showToast";
// import { Icon } from "@rneui/base";
// import { router } from "expo-router";
// import React, { useCallback, useEffect, useRef, useState } from "react";
// import { Dimensions, FlatList, Image, Text, TouchableOpacity, View, PixelRatio, useWindowDimensions } from "react-native";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// const { height } = Dimensions.get('window');
// const scale = PixelRatio.getFontScale();

// const baseSize = (size: number) => size / scale

// const paymentMethods = [
//     {
//         key: "wallet",
//         title: "Portefeuille",
//         image: require("../assets/images/wallet.jpg"),
//     },
//     {
//         key: "espece",
//         title: "Espèces",
//         image: require("../assets/images/espece.png"),
//     },
// ];

// export default function AddCourse() {
//     const { width } = useWindowDimensions();
//     const { tok } = useStore()
//     const { position } = useStore();

//     const insets = useSafeAreaInsets();
//     const bottomSheetRef = useRef<BottomSheetMethods>(null);

//     const pressHandler = useCallback(() => {
//         bottomSheetRef.current?.expand();
//     }, []);

//     const close = useCallback(() => {
//         bottomSheetRef.current?.close();
//     }, []);

//     const [loading, setLoading] = useState<boolean>(false);
//     const [pickup, setPickup] = useState("");
//     const [pickupCoords, setPickupCoords] = useState<any>(null);
//     const [drop, setDrop] = useState("");
//     const [dropCoords, setDropCoords] = useState<any>(null);
//     // const [locations, setLocations] = useState([]);
//     const [focusedInput, setFocusedInput] = useState("drop");
//     const [modalTitle, setModalTitle] = useState("drop");
//     const [isMapModalVisible, setMapModalVisible] = useState(false);
//     const [selectedMethod, setSelectedMethod] = useState<string>("wallet");
//     const [selectedCar, setSelectedCar] = useState<string>("eco");
//     const [courseDetails, setCourseDetails] = useState<{
//         distance: number;
//         estimatedDuration: string;
//         fare: {
//             eco: number;
//             confort: number;
//         };
//     } | null>(null);

//     // const [region, setRegion] = useState<Region>({
//     //     latitude: position.latitude,
//     //     longitude: position.longitude,
//     //     latitudeDelta: 0.01,
//     //     longitudeDelta: 0.01,
//     // });

//     const [suggestions, setSuggestions] = useState<any[]>([]);

//     const handleInputChange = async (text: string) => {
//         const results = await searchPlaces(text);
//         setSuggestions(results);
//     };

//     const handlePlaceSelect = async (
//         placeId: string,
//     ) => {
//         const location: Coordinates | null = await getPlaceDetails(placeId);

//         if (!location) return;

//         if (focusedInput === 'drop') {
//             setDrop(location.address);
//             setDropCoords(location);
//             // console.log('drop coords:', location);
//         } else {
//             setPickup(location.address);
//             setPickupCoords(location);
//             // console.log('pickup coords:', location);
//         }

//         setSuggestions([]);
//     };

//     const checkDistance = useCallback(async () => {
//         const { latitude: lat1, longitude: lon1 } = pickupCoords
//         const { latitude: lat2, longitude: lon2 } = dropCoords

//         // console.log(pickupCoords, dropCoords)

//         if (lat1 === lat2 && lon1 === lon2) {
//             alert("Les adresses doivent être différentes");
//             return;
//         }

//         const distance = getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2)

//         const minDistance = 0.5;
//         const maxDistance = 50;

//         if (distance < minDistance) {
//             alert("L'emplacement choisi est trop proche");
//             return;
//         } else if (distance > maxDistance) {
//             alert("L'emplacement choisi est trop éloigné");
//             return;
//         } else {
//             // setLocations([])

//             // pressHandler()

//             const res = await apiRequest({
//                 method: 'POST',
//                 endpoint: 'ride/calculateCourseDetails',
//                 token: tok,
//                 data: {
//                     pickup: pickupCoords,
//                     drop: dropCoords,
//                 },
//             });

//             if (res.success === true) {
//                 setCourseDetails(res.data);
//                 pressHandler()
//             }
//         }
//     }, [dropCoords, pickupCoords, pressHandler, tok])

//     useEffect(() => {
//         if (dropCoords && pickupCoords) {
//             checkDistance()
//         } else {
//             setMapModalVisible(false)
//         }
//     }, [checkDistance, dropCoords, pickupCoords])

//     useEffect(() => {
//         if (position) {
//             // console.log('user position:', position)
//             setPickupCoords(position);
//             if (position.address !== null) {
//                 setPickup(position.address)
//             }
//         }
//     }, [position])

//     const onSubmit = async () => {
//         setLoading(true)
//         const res = await apiRequest({
//             method: 'POST',
//             endpoint: 'ride/create',
//             token: tok,
//             data: {
//                 vehicle: selectedCar,
//                 pickup: pickupCoords,
//                 drop: dropCoords,
//                 paymentMethod: selectedMethod
//             },
//         });

//         if (res.success === false) {
//             setLoading(false)
//             showError(res.message)
//             return;
//         }

//         if (res.success === true) {
//             close()
//             setLoading(false)
//             showSuccess(res.message)
//             router.replace({ pathname: '/liveride', params: { id: res.ride._id } })
//         }
//     };

//     const useMyPosition = async () => {
//         // console.log(position)
//         if (position) {
//             setPickupCoords(position);
//             if (position.address !== null) {
//                 setPickup(position.address)
//             }
//         }
//     }

//     return (
//         <View style={{ marginBottom: insets.bottom }} className="flex-1 bg-white">
//             <CustomHeader showBack={true} title={"Créer une course"} />

//             <View className="w-full px-5">
//                 <View className="py-1 px-2 w-full flex-row justify-center  items-center">
//                     <Icon name="dot-fill" type='octicon' size={25} color="#000000" />
//                     <View className="my-2 h-[50px] py-1 ml-1 justify-center w-full">
//                         <CustomLocationTextInput
//                             placeholder={"Adresse de départ"}
//                             type={"pickup"}
//                             value={pickup}
//                             onChangeText={(text) => {
//                                 setPickup(text)
//                                 handleInputChange(text)
//                             }}
//                             onFocus={() => setFocusedInput("pickup")}
//                         />
//                     </View>

//                 </View>

//                 <View className="bg-black w-1 h-16 absolute bottom-11 left-6" />

//                 <View className="py-1 px-2 w-full flex-row justify-center  items-center">
//                     <Icon name="pin-drop" type='material-icon' size={25} color="#000000" />
//                     <View className="my-2 h-[50px] py-1 ml-1 justify-center w-full">
//                         <CustomLocationTextInput
//                             placeholder={"Adresse d'arrivée"}
//                             type={"pickup"}
//                             value={drop}
//                             onChangeText={(text) => {
//                                 setDrop(text)
//                                 handleInputChange(text)
//                             }}
//                             onFocus={() => setFocusedInput("drop")}
//                         />
//                     </View>

//                 </View>
//             </View>
//             <View className="bg-white px-3 space-y-4">
//                 <View
//                     className={`flex-row items-center rounded-lg`}
//                 >
//                     {/* <Icon name="location-pin" type='entypo' size={20} color="#000000" /> */}
//                     <Text className="text-gray-700 ml-2 font-['RubikMedium']">Suggestion {focusedInput === "drop" ? "adresse d'arrivée" : "adresse de départ"} </Text>
//                 </View>

//                 <FlatList
//                     data={suggestions}
//                     keyExtractor={(item, index) =>
//                         item?.place_id ?? index.toString()
//                     }
//                     initialNumToRender={5}
//                     windowSize={5}
//                     showsVerticalScrollIndicator={false}
//                     renderItem={({ item }) =>
//                         item?.description && item?.place_id ? (
//                             <TouchableOpacity
//                                 key={item.place_id}
//                                 onPress={() =>
//                                     handlePlaceSelect(item.place_id)
//                                 }
//                                 className={`flex-row items-center border-[1px] border-primary/10 px-4 py-4 rounded-lg mb-2`}
//                             >
//                                 <Icon name="location-pin" type='entypo' size={20} color="#000000" />
//                                 {/* <Text className="py-2 px-3 text-black">
//                                     {item.title}
//                                 </Text> */}
//                                 <Text className="py-2 px-3 text-black font-['RubikRegular']">
//                                     {item.description}
//                                 </Text>
//                             </TouchableOpacity>
//                         ) : null
//                     }
//                     style={{ maxHeight: height * 0.7 }}
//                     // contentContainerStyle={{marginBottom: 100}}
//                     keyboardShouldPersistTaps="handled"
//                     ListFooterComponent={
//                         <TouchableOpacity
//                             onPress={useMyPosition}
//                             className={`flex-row items-center border-[1px] border-primary/10 px-4 py-4 rounded-lg mb-2`}
//                         >
//                             <Icon name="location-pin" type='entypo' size={20} color="#000000" />
//                             <Text className="text-gray-700 ml-2 font-['RubikMedium']">Utiliser ma position</Text>
//                         </TouchableOpacity>
//                     }
//                 // ListFooterComponent={
//                 //     <TouchableOpacity
//                 //         onPress={() => {
//                 //             setModalTitle(focusedInput);
//                 //             setMapModalVisible(true)
//                 //         }}
//                 //         className={`flex-row items-center border-[1px] border-primary/10 px-4 py-4 rounded-lg mb-2`}
//                 //     >
//                 //         <Icon name="location-pin" type='entypo' size={20} color="#000000" />
//                 //         <Text className="text-gray-700 ml-2 font-medium font-['ItemRegular']">Sélectionner depuis la carte</Text>
//                 //     </TouchableOpacity>
//                 // }
//                 />
//             </View>

//             {isMapModalVisible && (
//                 <MapPickerModal
//                     selectedLocation={{
//                         latitude: focusedInput === "drop" ? dropCoords?.latitude : pickupCoords.latitude,
//                         longitude: focusedInput === "drop" ? dropCoords?.longitude : pickupCoords.longitude,
//                         address: focusedInput === "drop" ? drop : pickup
//                     }}
//                     title={modalTitle}
//                     visible={isMapModalVisible}
//                     onClose={() => setMapModalVisible(false)}
//                     onSelectLocation={(data) => {
//                         if (data) {
//                             if (modalTitle === "drop") {
//                                 setDropCoords(data);
//                                 setDrop(data?.address)
//                             } else {
//                                 // setLocations(data);
//                                 setPickupCoords(data);
//                                 setPickup(data?.address)
//                             }
//                         }
//                     }}
//                 />
//             )}

//             <BottomSheetScrollView
//                 ref={bottomSheetRef}
//                 snapTo={'55%'}
//                 backgroundColor={'white'}
//                 backDropColor={'black'}
//             >
//                 <View className="p-3 space-y-4">
//                     {/* Cartes ECO / CONFORT */}
//                     <View className="flex-row justify-between space-x-2">
//                         {['eco', 'confort'].map((type) => (
//                             <TouchableOpacity
//                                 key={type}
//                                 activeOpacity={0.8}
//                                 onPress={() => setSelectedCar(type)}
//                                 className="flex-1 rounded-xl border border-gray-300 bg-white"
//                                 style={{ minHeight: baseSize(110) }} // Hauteur dynamique
//                             >
//                                 <View className="bg-primary h-10 w-[70%] rounded-tl-xl rounded-br-xl">
//                                     <Image
//                                         source={type === 'eco'
//                                             ? require('../assets/images/Taxi_confort_gris_miroir.png')
//                                             : require('../assets/images/Taxi_confort_blanc_recadre.png')}
//                                         style={{
//                                             height: baseSize(110),
//                                             width: baseSize(110),
//                                             resizeMode: 'contain',
//                                             position: 'absolute',
//                                             top: -baseSize(40),
//                                         }}
//                                     />
//                                 </View>

//                                 <View className="flex-1 justify-center px-2 py-2">
//                                     <View className="flex-row justify-between items-center">
//                                         <Text
//                                             className="font-['RubikRegular'] text-black"
//                                             style={{ fontSize: baseSize(14) }}
//                                             adjustsFontSizeToFit
//                                             numberOfLines={1}
//                                         >
//                                             {type === 'eco' ? 'ECO' : 'CONFORT'}
//                                         </Text>
//                                         <Text
//                                             className="font-['RubikBold']"
//                                             style={{ fontSize: baseSize(12) }}
//                                             adjustsFontSizeToFit
//                                             numberOfLines={1}
//                                         >
//                                             {courseDetails?.fare[type]
//                                                 ? `${courseDetails.fare[type]} XOF`
//                                                 : '...'}
//                                         </Text>
//                                     </View>

//                                     <View className="flex-row justify-between items-center mt-1">
//                                         <Text
//                                             className="text-gray-500 font-['RubikRegular']"
//                                             style={{ fontSize: baseSize(12) }}
//                                             adjustsFontSizeToFit
//                                         >
//                                             {courseDetails?.estimatedDuration || '...'} min
//                                         </Text>
//                                         <Text
//                                             className="font-['RubikBold']"
//                                             style={{ fontSize: baseSize(12) }}
//                                             adjustsFontSizeToFit
//                                         >
//                                             {courseDetails?.distance || '...'} km
//                                         </Text>
//                                         <View className="w-4 h-4 rounded-full border border-gray-400 items-center justify-center">
//                                             {selectedCar === type && (
//                                                 <View className="w-2 h-2 rounded-full bg-green-500" />
//                                             )}
//                                         </View>
//                                     </View>
//                                 </View>
//                             </TouchableOpacity>
//                         ))}
//                     </View>

//                     {/* Méthodes de paiement */}
//                     <View className="flex-row justify-between space-x-2 p-2 rounded-xl border border-gray-300 bg-white mb-3">
//                         {paymentMethods.map((method) => (
//                             <TouchableOpacity
//                                 key={method.key}
//                                 activeOpacity={0.8}
//                                 onPress={() => setSelectedMethod(method.key)}
//                                 className="flex-1 items-center rounded-xl bg-gray-50 p-2"
//                                 style={{ minHeight: baseSize(100) }}
//                             >
//                                 <Image
//                                     source={method.image}
//                                     style={{
//                                         width: baseSize(48),
//                                         height: baseSize(48),
//                                         resizeMode: 'contain',
//                                         marginBottom: baseSize(4),
//                                     }}
//                                 />
//                                 <Text
//                                     className="text-center text-black font-['RubikRegular']"
//                                     style={{ fontSize: baseSize(12) }}
//                                     adjustsFontSizeToFit
//                                     numberOfLines={1}
//                                 >
//                                     {method.title}
//                                 </Text>
//                                 <View className="w-5 h-5 rounded-full border-2 border-primary items-center justify-center mt-1">
//                                     {selectedMethod === method.key && (
//                                         <View className="w-2.5 h-2.5 rounded-full bg-primary" />
//                                     )}
//                                 </View>
//                             </TouchableOpacity>
//                         ))}
//                     </View>

//                     {/* Bouton Commander */}
//                     <CustomButton
//                         buttonText="Commander"
//                         loading={loading}
//                         buttonClassNames="bg-primary h-12 rounded-full items-center justify-center mt-4"
//                         textClassNames="text-white text-sm font-['RubikBold']"
//                         // style={{ minHeight: baseSize(48) }}
//                         // textStyle={{ fontSize: baseSize(16) }}
//                         onPress={onSubmit}
//                     />
//                 </View>
//             </BottomSheetScrollView>

//             {/* <BottomSheetScrollView
//                 ref={bottomSheetRef}
//                 snapTo={'55%'}
//                 backgroundColor={'white'}
//                 backDropColor={'black'}
//             >
//                 <View className="p-3">
//                     <View className="flex-row justify-between">
//                         <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedCar("eco")} style={{ flex: 0.48 }} className="h-28 rounded-xl border-[1px] border-gray-300/30 bg-white">
//                             <View style={{ flex: 0.5 }} className="bg-primary h-10 w-[70%] rounded-tl-xl rounded-br-xl">
//                                 <Image
//                                     source={require('../assets/images/Taxi_confort_gris_miroir.png')}
//                                     style={{ height: 140, width: 140, resizeMode: "contain", position: "absolute", top: -40 }}
//                                 />
//                             </View>

//                             <View style={{ flex: 0.5 }} className="justify-center px-2 gap-1">
//                                 <View className="flex-row justify-between">
//                                     <Text className="font-['RubikRegular']">ECO</Text>
//                                     <Text className="font-['RubikBold']">{courseDetails?.fare.eco
//                                         ? `${courseDetails.fare.eco.toFixed(0)} XOF`
//                                         : '...'}</Text>
//                                 </View>
//                                 <View className="flex-row justify-between">
//                                     <Text className="text-gray-500 font-['RubikRegular']">{courseDetails?.estimatedDuration} min</Text>
//                                     <Text className="font-['RubikBold']">{courseDetails?.distance
//                                         ? `${courseDetails.distance} Km`
//                                         : '...'}</Text>
//                                     <View className="w-4 h-4 rounded-full border-[1px] border-gray-400 items-center justify-center">
//                                         {selectedCar === "eco" && (
//                                             <View className="w-2 h-2 rounded-full bg-green-500" />
//                                         )}
//                                     </View>
//                                 </View>
//                             </View>
//                         </TouchableOpacity>

//                         <TouchableOpacity activeOpacity={0.8} onPress={() => setSelectedCar("confort")} style={{ flex: 0.48 }} className="h-28 rounded-xl border-[1px] border-gray-300/30 bg-white">
//                             <View style={{ flex: 0.5 }} className="bg-green-500 h-10 w-[70%] rounded-tl-xl rounded-br-xl">
//                                 <Image
//                                     source={require('../assets/images/Taxi_confort_blanc_recadre.png')}
//                                     style={{ height: 140, width: 140, resizeMode: "contain", position: "absolute", top: -40 }}
//                                 />
//                             </View>

//                             <View style={{ flex: 0.5 }} className="justify-center px-2 gap-1">
//                                 <View className="flex-row justify-between">
//                                     <Text style={{ flex: 0.45 }} numberOfLines={1} adjustsFontSizeToFit className="justify-center items-center mr-1 font-['RubikRegular']">CONFORT</Text>
//                                     <Text style={{ flex: 0.45 }} numberOfLines={1} adjustsFontSizeToFit className="font-['RubikBold']">{courseDetails?.fare.confort
//                                         ? `${courseDetails.fare?.confort.toFixed(0)} XOF`
//                                         : '...'}
//                                     </Text>
//                                 </View>
//                                 <View className="flex-row justify-between">
//                                     <Text className="text-gray-500 font-['RubikRegular']">{courseDetails?.estimatedDuration} min</Text>
//                                     <Text className="font-['RubikBold']">{courseDetails?.distance
//                                         ? `${courseDetails.distance} Km`
//                                         : '...'}</Text>
//                                     <View className="w-4 h-4 rounded-full border-[1px] border-gray-400 items-center justify-center">
//                                         {selectedCar === "confort" && (
//                                             <View className="w-2 h-2 rounded-full bg-green-500" />
//                                         )}
//                                     </View>
//                                 </View>
//                             </View>
//                         </TouchableOpacity>
//                     </View>

//                     <View className="flex-row justify-between my-2 p-2 w-64 rounded-xl border-[1px] border-gray-300/30 bg-white">
//                         {paymentMethods.map((method) => (
//                             <TouchableOpacity
//                                 key={method.key}
//                                 activeOpacity={0.8}
//                                 onPress={() => setSelectedMethod(method.key)}
//                                 className={`items-center rounded-xl w-[42%] bg-gray-50`}
//                             >
//                                 <Image
//                                     source={method.image}
//                                     className="w-12 h-12 mb-2"
//                                     resizeMode="contain"
//                                 />
//                                 <Text numberOfLines={1} adjustsFontSizeToFit className="text-center text-black dark:text-white text-sm mb-2 font-['RubikRegular']">
//                                     {method.title}
//                                 </Text>

                                
//                                 <View className="w-5 h-5 rounded-full border-2 border-primary items-center justify-center">
//                                     {selectedMethod === method.key && (
//                                         <View className="w-2.5 h-2.5 rounded-full bg-primary" />
//                                     )}
//                                 </View>
//                             </TouchableOpacity>
//                         ))}
//                     </View>

//                     <CustomButton
//                         buttonText="Commander"
//                         loading={loading}
//                         buttonClassNames="bg-primary h-12 rounded-full items-center justify-center mt-4"
//                         textClassNames="text-white text-sm font-['RubikBold']"
//                         onPress={onSubmit}
//                     />
//                 </View>
//             </BottomSheetScrollView> */}
//         </View>
//     );
// }
