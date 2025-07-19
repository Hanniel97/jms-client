import { useWS } from "@/services/WSProvider";
import { vehiculeIcons } from "@/utils/mapUtils";
import { Icon } from "@rneui/base";
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect } from "react";
import {
    Image,
    Text,
    View
} from "react-native";
import { CustomButton } from "./CustomButton";
import CustomProgressBar from "./CustomProgressBar";

type VehicleType = "eco" | "confort";

interface RiderItem {
    vehicle?: VehicleType;
    _id: string;
    pickup?: { address: string };
    drop?: { address: string };
    fare?: number;
    distance?: number,
    estimatedDuration?: number,
    estimatedDurationFormatted?: string,
}

const SearchingRiderSheet: React.FC<{ item: RiderItem, duration: number }> = ({ item, duration }) => {
    const { emit } = useWS();

    const cancelOrder = () => {
        emit('cancelRide', item?._id)
    };

    useEffect(() => {
        emit("searchrider", item?._id)
    },[emit, item?._id])

    const formatTimeMMSS = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    };

    return (
        <View className="bg-white px-4 pb-6 rounded-t-2xl shadow-md">
            <View className="mb-3 flex-row justify-center items-center self-center bg-primary/80 px-2 py-1 rounded-full">
                <Icon name="access-time-filled" type='material-icon' size={20} color="#FFFFFF" />
                <Text className="text-white font-['RubikLight'] ml-1">{duration
                    ? `${formatTimeMMSS(duration)} min`
                    : '...'}</Text>
            </View>

            <View className="mb-3 w-full">
                <Text className="text-black font-['RubikSemiBold'] text-sm">Recherche d'un chauffeur en cours...</Text>
                <CustomProgressBar duration={2000} />
                {/* <Text className="text-gray-500 text-sm mt-1 capitalize">Course {item?.vehicle}</Text> */}
            </View>

            <View>
                <View className="py-1 px-2 w-full flex-row justify-center  items-center">
                    <Icon name="dot-fill" type='octicon' size={25} color="#000000" />
                    <View className="my-2 ml-2 bg-gray-200/20 border border-gray-200 rounded-lg h-[65px] py-1 px-3 justify-center w-full">
                        <Text numberOfLines={2} className="font-['RubikRegular']">{item?.pickup?.address}</Text>
                    </View>
                </View>

                <View className="bg-black w-1 h-20 absolute bottom-14 left-0.5" />

                <View className="py-1 px-2 w-full flex-row justify-center  items-center">
                    <Icon name="pin-drop" type='material-icon' size={27} color="#000000" />
                    <View className="my-2 ml-2 bg-gray-200/20 border border-gray-200 rounded-lg h-[65px] py-1 px-3 justify-center w-full">
                        <Text numberOfLines={2} className="font-['RubikRegular']">{item?.drop?.address}</Text>
                    </View>
                </View>
            </View>

            {/* Vehicle image */}
            {/* <View className="flex-row justify-center items-center mb-4">
                {item?.vehicle && vehiculeIcons[item.vehicle] && (
                    <Image
                        source={vehiculeIcons[item.vehicle].icon}
                        style={{ height: 60, width: 60, resizeMode: "contain" }}
                    />
                )}
            </View> */}

            <View className="rounded-xl h-14 flex-row my-2">
                {/* <View style={{ flex: 0.35 }} className="bg-primary h-14 w-[25%] rounded-tr-lg rounded-br-lg">
                    {item?.vehicle && vehiculeIcons[item.vehicle] && (
                        <Image
                            source={vehiculeIcons[item.vehicle].icon}
                            style={{ height: 80, width: 80, resizeMode: "contain", position: "absolute" }}
                        />
                    )}
                </View> */}

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
                        <Text numberOfLines={1} adjustsFontSizeToFit className="text-gray-500 font-['RubikRegular']">Distance</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit className="font-['RubikBold']">{item?.distance
                            ? `${item?.distance.toFixed(2)} Km`
                            : '...'}</Text>
                    </View>
                    <View className="justify-center items-center">
                        <Text numberOfLines={1} adjustsFontSizeToFit className="text-gray-500 font-['RubikRegular']">Temps</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit className="font-['RubikBold']">{duration
                            ? `${formatTimeMMSS(duration)} min`
                            : '...'}</Text>
                    </View>
                    <View className="justify-center items-center">
                        <Text numberOfLines={1} adjustsFontSizeToFit className="text-gray-500 font-['RubikRegular']">Prix</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit className="font-['RubikBold']">{item?.fare
                            ? `${item?.fare} XOF`
                            : '...'}</Text>
                    </View>
                </View>
            </View>

            <CustomButton
                buttonText="Annuler la course"
                buttonClassNames="bg-primary h-12 rounded-full items-center justify-center mt-4 mb-6"
                textClassNames="text-white text-sm font-['RubikBold']"
                onPress={() => {cancelOrder()}}
            />
        </View>
    );
};

export default SearchingRiderSheet;
