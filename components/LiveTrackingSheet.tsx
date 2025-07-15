import { photoUrl } from "@/services/api";
import { useWS } from "@/services/WSProvider";
import { vehiculeIcons } from "@/utils/mapUtils";
import { Icon } from "@rneui/base";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Alert, Image, Linking, Platform, Text, TouchableOpacity, View } from "react-native";
import QRCode from 'react-native-qrcode-svg';
import { CustomButton } from "./CustomButton";
import { ICar } from "@/types";

type VehicleType = "eco" | "confort";

interface RideItem {
    _id: string,
    vehicle?: VehicleType;
    pickup?: { address: string };
    drop?: { address: string };
    fare?: number;
    otp?: string,
    rider: any,
    status: string,
    distance?: number,
    estimatedDuration?: number,
    estimatedDurationFormatted?: string,
}

const LiveTrackingSheet: React.FC<{ item: RideItem, duration: number, car: ICar, rating: { moyenne: number, total: number } }> = ({
    item, duration, car, rating
}) => {
    const { emit } = useWS();

    const cancelOrder = () => {
        emit('cancelRideCustomer', item?._id)
    };

    const formatTimeMMSS = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    const callNumber = (phone: string) => {
        let phoneNumber = '';

        if (Platform.OS === 'android') {
            phoneNumber = `tel:${phone}`;
        } else {
            phoneNumber = `telprompt:${phone}`;
        }

        Linking.canOpenURL(phoneNumber)
            .then((supported) => {
                if (!supported) {
                    Alert.alert('Erreur', 'Le numéro de téléphone n’est pas valide');
                } else {
                    return Linking.openURL(phoneNumber);
                }
            })
            .catch((err) => console.log(err));
    };

    return (
        <View className="bg-white px-4 pb-6 rounded-t-2xl shadow-md">
            {item?.status === "ACCEPTED" ?
                <>
                    <View className="mb-3 w-full">
                        <Text className="text-black font-['RubikBold'] text-sm">Votre course a été acceptée</Text>
                        <Text className="text-black font-['RubikBold'] mt-1">Votre chauffeur est en route</Text>
                    </View>

                    <View className="mb-3 flex-row justify-center items-center self-center w-full">
                        <View className="flex w-14 h-14 rounded-full">
                            <Image
                                source={item?.rider?.photo === "" ? require("../assets/images/profil1.png") : { uri: photoUrl + item?.rider?.photo }}
                                className="w-14 h-14 rounded-full border-4 border-primary"
                            />
                            <View className=" px-2 flex-row rounded-full bg-primary absolute bottom-0 right-0 justify-center items-center">
                                <Icon type="entypo" name="star" size={15} color={"#facc15"} />
                                <Text className="ml-1 text-white font-['RubikRegular']">{rating?.moyenne}</Text>
                            </View>
                        </View>
                        <View style={{ flex: 1 }} className="pl-1 gap-1">
                            <Text className="ml-1 text-black font-['RubikRegular']">{item?.rider?.prenom} {item?.rider?.nom}</Text>
                            <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.marque} - {car?.model}</Text>
                            <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.immatriculation}</Text>
                        </View>
                        <TouchableOpacity onPress={() => callNumber(item?.rider?.phone)} className="bg-green-400 h-10 w-10 rounded-full justify-center items-center">
                            <Icon type="ionicon" name="call" size={25} color={"#FFFFFF"} />
                        </TouchableOpacity>
                    </View>
                </>
                : item?.status === "ARRIVED" ?
                    <>
                        <View className="mb-3 justify-center items-center self-center bg-primary/50 p-3 rounded-xl">
                            <QRCode
                                value={item?.otp}
                                size={80}
                                quietZone={10}
                                ecl="H"
                            />

                            <View className="mt-2 flex-row justify-center items-center">
                                <Icon name="access-time-filled" type='material-icon' size={20} color="#FFFFFF" />
                                <Text className="text-white ffont-['RubikLight'] ml-1">{formatTimeMMSS(duration)} min</Text>
                            </View>
                        </View>

                        <View className="mb-3 w-full">
                            <Text className="text-black font-['RubikBold'] text-sm">Votre chauffeur est là</Text>
                            {/* <Text className="text-black font-['RubikBold'] mt-1">Votre chauffeur est en route</Text> */}
                        </View>

                        <View className="mb-3 flex-row justify-center items-center self-center w-full">
                            <View className="flex w-14 h-14 rounded-full">
                                <Image
                                    source={item?.rider?.photo === "" ? require("../assets/images/profil1.png") : { uri: photoUrl + item?.rider?.photo }}
                                    className="w-14 h-14 rounded-full border-4 border-primary"
                                />
                                <View className=" px-2 flex-row rounded-full bg-primary absolute bottom-0 right-0 justify-center items-center">
                                    <Icon type="entypo" name="star" size={15} color={"#facc15"} />
                                    <Text className="ml-1 text-white font-['RubikRegular']">{rating?.moyenne}</Text>
                                </View>
                            </View>
                            <View style={{ flex: 1 }} className="pl-1 gap-1">
                                <Text className="ml-1 text-black font-['RubikRegular']">{item?.rider?.prenom} {item?.rider?.nom}</Text>
                                <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.marque} - {car?.model}</Text>
                                <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.immatriculation}</Text>
                            </View>
                            <TouchableOpacity onPress={() => callNumber(item?.rider?.phone)} className="bg-green-400 h-10 w-10 rounded-full justify-center items-center">
                                <Icon type="ionicon" name="call" size={25} color={"#FFFFFF"} />
                            </TouchableOpacity>
                        </View>
                    </>
                    : item?.status === "VERIFIED" ?
                        <>
                            <View className="mb-3 w-full">
                                <Text className="text-black font-['RubikBold'] text-sm">Votre course peut commencer</Text>
                                {/* <Text className="text-black font-['RubikBold'] mt-1">Votre chauffeur est en route</Text> */}
                            </View>

                            <View className="mb-3 flex-row justify-center items-center self-center w-full">
                                <View className="flex w-14 h-14 rounded-full">
                                    <Image
                                        source={item?.rider?.photo === "" ? require("../assets/images/profil1.png") : { uri: photoUrl + item?.rider?.photo }}
                                        className="w-14 h-14 rounded-full border-4 border-primary"
                                    />
                                    <View className=" px-2 flex-row rounded-full bg-primary absolute bottom-0 right-0 justify-center items-center">
                                        <Icon type="entypo" name="star" size={15} color={"#facc15"} />
                                        <Text className="ml-1 text-white font-['RubikRegular']">{rating?.moyenne}</Text>
                                    </View>
                                </View>
                                <View style={{ flex: 1 }} className="pl-1 gap-1">
                                    <Text className="ml-1 text-black font-['RubikRegular']">{item?.rider?.prenom} {item?.rider?.nom}</Text>
                                    <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.marque} - {car?.model}</Text>
                                    <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.immatriculation}</Text>
                                </View>
                                <TouchableOpacity onPress={() => callNumber(item?.rider?.phone)} className="bg-green-400 h-10 w-10 rounded-full justify-center items-center">
                                    <Icon type="ionicon" name="call" size={25} color={"#FFFFFF"} />
                                </TouchableOpacity>
                            </View>
                        </>
                        : item?.status === "START" ?
                            <>
                                <View className="mb-3 w-full">
                                    <Text className="text-black font-['RubikBold'] text-sm">Votre course a démarré</Text>
                                    <Text className="text-black font-['RubikBold'] mt-1"><Text className="text-primary font-bold">JMS</Text> vous souhaite de passer un agréable moment.</Text>
                                </View>

                                <View className="mb-3 flex-row justify-center items-center self-center w-full">
                                    <View className="flex w-14 h-14 rounded-full">
                                        <Image
                                            source={item?.rider?.photo === "" ? require("../assets/images/profil1.png") : { uri: photoUrl + item?.rider?.photo }}
                                            className="w-14 h-14 rounded-full border-4 border-primary"
                                        />
                                        <View className=" px-2 flex-row rounded-full bg-primary absolute bottom-0 right-0 justify-center items-center">
                                            <Icon type="entypo" name="star" size={15} color={"#facc15"} />
                                            <Text className="ml-1 text-white font-['RubikRegular']">{rating?.moyenne}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1 }} className="pl-1 gap-1">
                                        <Text className="ml-1 text-black font-['RubikRegular']">{item?.rider?.prenom} {item?.rider?.nom}</Text>
                                        <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.marque} - {car?.model}</Text>
                                        <Text className="ml-1 text-gray-400 font-['RubikRegular']">{car?.immatriculation}</Text>
                                    </View>
                                    <TouchableOpacity onPress={() => callNumber(item?.rider?.phone)} className="bg-green-400 h-10 w-10 rounded-full justify-center items-center">
                                        <Icon type="ionicon" name="call" size={25} color={"#FFFFFF"} />
                                    </TouchableOpacity>
                                </View>
                            </>
                            : item?.status === "COMPLETED" ?
                                <View className="mb-3 w-full">
                                    <Text className="text-black font-['RubikBold'] text-sm">Votre course a démarré</Text>
                                    <Text className="text-black font-['RubikBold'] mt-1"><Text className="text-primary font-bold">JMS</Text> vous souhaite de passer un agréable moment.</Text>
                                </View>
                                :
                                <>
                                </>
            }
            <View>
                <View className="py-1 px-2 w-full flex-row justify-center items-center">
                    <Icon name="dot-fill" type='octicon' size={25} color="#000000" />
                    <View className="my-2 ml-2 bg-gray-200/20 border border-gray-200 rounded-lg h-[50px] py-1 px-3 justify-center w-full">
                        <Text className="font-['RubikRegular']">{item?.pickup?.address}</Text>
                    </View>
                </View>

                <View className="bg-black w-1 h-16 absolute bottom-11 left-0.5" />

                <View className="py-1 px-2 w-full flex-row justify-center items-center">
                    <Icon name="pin-drop" type='material-icon' size={20} color="#000000" />
                    <View className="my-2 ml-2 bg-gray-200/20 border border-gray-200 rounded-lg h-[50px] py-1 px-3 justify-center w-full">
                        <Text className="font-['RubikRegular']">{item?.drop?.address}</Text>
                    </View>
                </View>
            </View>

            <View className="rounded-xl h-14 flex-row my-2">
                <LinearGradient
                    colors={['#ff6d00', '#FFFFFF']}
                    start={{ x: 1, y: 1 }}
                    end={{ x: 0, y: 1 }}
                    style={{
                        flex: 0.35,
                        height: 56,
                        width: '50%',
                        borderTopRightRadius: 12,
                        borderBottomRightRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        overflow: 'hidden',
                    }}
                >
                    {item?.vehicle && vehiculeIcons[item.vehicle] && (
                        <Image
                            source={vehiculeIcons[item.vehicle].icon}
                            style={{
                                height: 80,
                                width: 80,
                                resizeMode: 'contain',
                                position: 'absolute',
                            }}
                        />
                    )}
                </LinearGradient>

                <View style={{ flex: 0.60 }} className="p-2 gap-1 flex-row justify-between">
                    <View className="justify-center items-center">
                        <Text className="text-gray-500 font-['RubikRegular']">Distance</Text>
                        <Text className="font-['RubikBold']">{item?.distance
                            ? `${item?.distance.toFixed(2)} Km`
                            : '...'}</Text>
                    </View>
                    <View className="justify-center items-center">
                        <Text className="text-gray-500 font-['RubikRegular']">Temps</Text>
                        <Text className="font-['RubikBold']">{item?.estimatedDurationFormatted
                            ? `${item?.estimatedDurationFormatted} min`
                            : '...'}</Text>
                    </View>
                    <View className="justify-center items-center">
                        <Text className="text-gray-500 font-['RubikRegular']">Prix</Text>
                        <Text className="font-['RubikBold']">{item?.fare
                            ? `${item?.fare.toFixed(0)} XOF`
                            : '...'}</Text>
                    </View>
                </View>
            </View>

            {item?.status === "ACCEPTED" ?
                <CustomButton
                    buttonText="Annuler la course"
                    buttonClassNames="bg-primary shadow-xl h-12 rounded-full items-center justify-center mt-4 mb-6"
                    textClassNames="text-white text-lg font-['RubikBold']"
                    onPress={cancelOrder}
                />
                :
                <CustomButton
                    buttonText={`Destination dans ${formatTimeMMSS(duration)} min`}
                    disable={true}
                    buttonClassNames="bg-primary shadow-xl h-12 rounded-full items-center justify-center mt-4 mb-6"
                    textClassNames="text-white text-lg font-['RubikBold']"
                    onPress={cancelOrder}
                />
            }

            {/* <CustomButton
                buttonText={`Destination dans ${formatTimeMMSS(duration)} min`}
                disable={true}
                buttonClassNames="bg-primary shadow-xl h-12 rounded-full items-center justify-center mt-4 mb-6"
                textClassNames="text-white text-lg font-['RubikBold']"
                onPress={cancelOrder}
            /> */}



            {/* <View>
                <View className="flex-row justify-center items-center mb-4">
                    {item?.vehicle && vehiculeIcons[item.vehicle] && (
                        <Image
                            source={vehiculeIcons[item.vehicle].icon}
                            style={{ height: 60, width: 60, resizeMode: "contain" }}
                        />
                    )}
                    <View>
                        <Text>
                            {item?.status === "START" ? "Votre chauffeur est proche"
                                : item?.status === "ARRIVED" ? "Bonne journée"
                                    : "Wohoo"
                            }
                        </Text>
                        <Text>
                            {item?.status === "START" ? `OPT - ${item?.otp}` : "--"}
                        </Text>
                    </View>
                </View>

                {item?.rider?.phone && (
                    <Text>
                        +229{" "}
                        {
                            item?.rider?.phone &&
                            item?.rider?.phone?.slice(0, 5) + " " + item?.rider?.phone.slice(5)
                        }
                    </Text>
                )}
            </View> */}
        </View>
    )
}

export default LiveTrackingSheet;



// import { useWS } from "@/services/WSProvider";
// import { vehiculeIcons } from "@/utils/mapUtils";
// import { Icon } from "@rneui/base";
// import { LinearGradient } from "expo-linear-gradient";
// import QRCode from "react-native-qrcode-svg";
// import React from "react";
// import { Image, Text, TouchableOpacity, View, Linking, Platform, Alert, } from "react-native";
// import { CustomButton } from "./CustomButton";
// import { photoUrl } from "@/services/api";

// type VehicleType = "eco" | "confort";

// interface RideItem {
//     _id: string;
//     vehicle?: VehicleType;
//     pickup?: { address: string };
//     drop?: { address: string };
//     fare?: number;
//     otp?: string;
//     rider: any;
//     status: string;
//     distance?: number;
//     estimatedDuration?: number;
//     estimatedDurationFormatted?: string;
// }

// const LiveTrackingSheet: React.FC<{ item: RideItem }> = ({ item }) => {
//     const { emit } = useWS();

//     const cancelOrder = () => {
//         emit("cancelRideCustomer", item?._id);
//     };

//     const callNumber = (phone: string) => {
//         if (!phone) return;
//         const phoneNumber = Platform.OS === "android" ? `tel:${phone}` : `telprompt:${phone}`;

//         Linking.canOpenURL(phoneNumber)
//             .then((supported) => {
//                 if (!supported) {
//                     Alert.alert("Erreur", "Le numéro de téléphone n’est pas valide");
//                 } else {
//                     return Linking.openURL(phoneNumber);
//                 }
//             })
//             .catch((err) => console.log(err));
//     };

//     const renderRiderInfo = () => (
//         <View className="mb-3 flex-row justify-center items-center self-center w-full">
//             <View className="flex w-14 h-14 rounded-full">
//                 <Image
//                     source={
//                         !item?.rider?.photo
//                             ? require("../assets/images/profil1.png")
//                             : { uri: photoUrl + item?.rider?.photo }
//                     }
//                     className="w-14 h-14 rounded-full border-4 border-primary"
//                 />
//                 <View className="px-2 flex-row rounded-full bg-primary absolute bottom-0 right-0 justify-center items-center">
//                     <Icon type="entypo" name="star" size={15} color={"#facc15"} />
//                     <Text className="ml-1 text-white font-['RubikRegular']">4.9</Text>
//                 </View>
//             </View>

//             <View style={{ flex: 1 }} className="pl-1 gap-1">
//                 <Text className="ml-1 text-black font-['RubikRegular']">
//                     {item?.rider?.prenom} {item?.rider?.nom}
//                 </Text>
//                 <Text className="ml-1 text-gray-400 font-['RubikRegular']">
//                     {item?.rider?.nom} Mercedes Benz (Rouge)
//                 </Text>
//                 <Text className="ml-1 text-gray-400 font-['RubikRegular']">
//                     {item?.rider?.nom} BC 2484 RB
//                 </Text>
//             </View>

//             <TouchableOpacity
//                 onPress={() => callNumber(item?.rider?.phone)}
//                 className="bg-green-400 h-10 w-10 rounded-full justify-center items-center"
//             >
//                 <Icon type="ionicon" name="call" size={25} color="#fff" />
//             </TouchableOpacity>
//         </View>
//     );

//     const renderQRCode = () => (
//         <View className="mb-3 justify-center items-center self-center bg-primary/50 p-3 rounded-xl">
//             <QRCode
//                 value={item?.otp || "OTP"}
//                 size={80}
//                 quietZone={10}
//                 ecl="H"
//             />
//             <View className="mt-2 flex-row justify-center items-center">
//                 <Icon name="access-time-filled" type="material-icon" size={20} color="#fff" />
//                 <Text className="text-white font-['RubikLight'] ml-1">02:00</Text>
//             </View>
//         </View>
//     );

//     const renderStatusInfo = () => {
//         switch (item.status) {
//             case "ACCEPTED":
//                 return (
//                     <>
//                         <View className="mb-3 w-full">
//                             <Text className="text-black font-['RubikBold'] text-sm">
//                                 Votre course a été acceptée
//                             </Text>
//                             <Text className="text-black font-['RubikBold'] mt-1">
//                                 Votre chauffeur est en route
//                             </Text>
//                         </View>
//                         {renderRiderInfo()}
//                     </>
//                 );

//             case "ARRIVED":
//                 return (
//                     <>
//                         {renderQRCode()}
//                         <View className="mb-3 w-full">
//                             <Text className="text-black font-['RubikBold'] text-sm">Votre chauffeur est là</Text>
//                         </View>
//                         {renderRiderInfo()}
//                     </>
//                 );

//             case "VERIFIED":
//                 return (
//                     <>
//                         <View className="mb-3 w-full">
//                             <Text className="text-black font-['RubikBold'] text-sm">
//                                 Votre course peut commencer
//                             </Text>
//                         </View>
//                         {renderRiderInfo()}
//                     </>
//                 );

//             case "START":
//                 return (
//                     <>
//                         <View className="mb-3 w-full">
//                             <Text className="text-black font-['RubikBold'] text-sm">Votre course a démarré</Text>
//                             <Text className="text-black font-['RubikBold'] mt-1">
//                                 <Text className="text-primary font-bold">JMS</Text> vous souhaite un agréable trajet.
//                             </Text>
//                         </View>
//                         {renderRiderInfo()}
//                     </>
//                 );

//             case "COMPLETED":
//                 return (
//                     <View className="mb-3 w-full">
//                         <Text className="text-black font-['RubikBold'] text-sm">Course terminée</Text>
//                         <Text className="text-black font-['RubikBold'] mt-1">
//                             Merci d’avoir choisi <Text className="text-primary font-bold">JMS</Text> !
//                         </Text>
//                     </View>
//                 );

//             default:
//                 return null;
//         }
//     };

//     return (
//         <View className="bg-white px-4 pb-6 rounded-t-2xl shadow-md">
//             {renderStatusInfo()}

//             {/* Pickup & Drop */}
//             <View>
//                 <View className="py-1 px-2 w-full flex-row justify-center items-center">
//                     <Icon name="dot-fill" type="octicon" size={25} color="#000" />
//                     <View className="my-2 ml-2 bg-gray-200/20 border border-gray-200 rounded-lg h-[50px] py-1 px-3 justify-center w-full">
//                         <Text className="font-['RubikRegular']">{item?.pickup?.address}</Text>
//                     </View>
//                 </View>

//                 <View className="bg-black w-1 h-16 absolute bottom-11 left-0.5" />

//                 <View className="py-1 px-2 w-full flex-row justify-center items-center">
//                     <Icon name="pin-drop" type="material-icon" size={20} color="#000" />
//                     <View className="my-2 ml-2 bg-gray-200/20 border border-gray-200 rounded-lg h-[50px] py-1 px-3 justify-center w-full">
//                         <Text className="font-['RubikRegular']">{item?.drop?.address}</Text>
//                     </View>
//                 </View>
//             </View>

//             {/* Distance / Temps / Prix */}
//             <View className="rounded-xl h-14 flex-row my-2">
//                 <LinearGradient
//                     colors={["#ff6d00", "#FFFFFF"]}
//                     start={{ x: 1, y: 1 }}
//                     end={{ x: 0, y: 1 }}
//                     style={{
//                         flex: 0.35,
//                         height: 56,
//                         borderTopRightRadius: 12,
//                         borderBottomRightRadius: 12,
//                         justifyContent: "center",
//                         alignItems: "center",
//                         overflow: "hidden",
//                     }}
//                 >
//                     {item?.vehicle && vehiculeIcons[item.vehicle] && (
//                         <Image
//                             source={vehiculeIcons[item.vehicle].icon}
//                             style={{
//                                 height: 80,
//                                 width: 80,
//                                 resizeMode: "contain",
//                                 position: "absolute",
//                             }}
//                         />
//                     )}
//                 </LinearGradient>

//                 <View className="p-2 gap-1 flex-row justify-between" style={{ flex: 0.6 }}>
//                     <View className="justify-center items-center">
//                         <Text className="text-gray-500 font-['RubikRegular']">Distance</Text>
//                         <Text className="font-['RubikBold']">
//                             {item?.distance ? `${item.distance.toFixed(2)} Km` : "..."}
//                         </Text>
//                     </View>
//                     <View className="justify-center items-center">
//                         <Text className="text-gray-500 font-['RubikRegular']">Temps</Text>
//                         <Text className="font-['RubikBold']">
//                             {item?.estimatedDurationFormatted ? `${item.estimatedDurationFormatted} min` : "..."}
//                         </Text>
//                     </View>
//                     <View className="justify-center items-center">
//                         <Text className="text-gray-500 font-['RubikRegular']">Prix</Text>
//                         <Text className="font-['RubikBold']">
//                             {item?.fare ? `${item.fare.toFixed(0)} XOF` : "..."}
//                         </Text>
//                     </View>
//                 </View>
//             </View>

//             {/* Bouton Annulation */}
//             <CustomButton
//                 buttonText={
//                     item?.status === "ACCEPTED" ? "Annuler la course" : "Destination dans 02:00"
//                 }
//                 disable={item?.status !== "ACCEPTED"}
//                 onPress={cancelOrder}
//                 buttonClassNames="bg-primary shadow-xl h-12 rounded-full items-center justify-center mt-4 mb-6"
//                 textClassNames="text-white text-lg font-['RubikBold']"
//             />
//         </View>
//     );
// };

// export default LiveTrackingSheet;