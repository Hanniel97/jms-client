/* eslint-disable react-hooks/rules-of-hooks */
import { View, Text, Modal, TouchableOpacity, TextInput } from "react-native"
import React, { memo, useEffect, useRef, useState } from "react";
import { Icon } from "@rneui/base";
import MapView, { Region } from "react-native-maps";
import useStore from "@/store/useStore";

const GOOGLE_API_KEY = "AIzaSyB6_OxzEd6VT4yqdW2zS0wjT7Gc6w9xxTw";

interface MapPickerModalProps {
    visible: boolean;
    onClose: () => void;
    title: string;
    selectedLocation: {
        latitude: number;
        longitude: number;
        address: string;
    };
    onSelectLocation: (location: any) => void;
}

const MapPickerModal: React.FC<MapPickerModalProps> = ({
    visible,
    onClose,
    title,
    selectedLocation,
    onSelectLocation
}) => {
    const { position } = useStore();

    const mapRef = useRef<MapView | null>(null);
    const [text, setText] = useState('')
    const [address, setAddress] = useState("")
    const [region, setRegion] = useState<Region | null>(null)
    const [locations, setLocations] = useState([])
    const textInputRef = useRef<TextInput>(null)

    const searchPlaces = async (text: string) => {
        if (text.length < 3) return;

        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
                    text
                )}&key=${GOOGLE_API_KEY}&language=fr&components=country:bj`
            );
            const json = await res.json();

            if (Array.isArray(json.predictions)) {
                setLocations(json.predictions);
            } else {
                setLocations([]);
            }
        } catch (error) {
            console.error("Erreur API Google Autocomplete :", error);
            setLocations([]);
        }
    };

    useEffect(() => {
        if (selectedLocation?.latitude) {
            setAddress(selectedLocation?.address);
            setRegion({
                latitude: selectedLocation?.latitude,
                longitude: selectedLocation?.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            });

            mapRef?.current?.fitToCoordinates([
                {
                    latitude: selectedLocation?.latitude,
                    longitude: selectedLocation?.longitude,
                },
            ],
                {
                    edgePadding: { top: 50, left: 50, bottom: 20, right: 50, },
                    animated: true,
                }
            )
        }
    }, [selectedLocation, mapRef])

    const addLocation = async (
        placeId: string,
    ) => {
        try {
            const res = await fetch(
                `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${GOOGLE_API_KEY}`
            );
            const json = await res.json();

            const loc = json?.result?.geometry?.location;

            if (!loc) return;

            if (json.status === "OK" && json.result) {
                const location = json.result.geometry.location;
                const address = json.result.formatted_address;

                setRegion({
                    latitude: location?.latitude,
                    longitude: location?.longitude,
                    latitudeDelta: 0.01,
                    longitudeDelta: 0.01,
                });
                setAddress(address)
            }
            textInputRef.current?.blur()
            setText("")
        } catch (error) {
            console.error("Erreur lors de la sélection de lieu :", error);
        }
    };

    const handleRegionChangeComplete = async (newRegion: Region) => {
        try{
            // const 
        }catch(error: any){
            console.log(error)
        }
    }

    return (
        <Modal
            animationType="slide"
            visible={visible}
            presentationStyle="formSheet"
            onRequestClose={onClose}
        >
            <View className="h-14 px-3 border-b-[1px] border-gray-100 flex-row justify-between items-center bg-white">
                <Text className="ml-2 text-[18px] font-['RubikBold'] text-[#313742]">Adresse {title === "drop" ? "d'arrivée" : "de départ"}</Text>
                <View className="flex-row items-center space-x-2">
                    <TouchableOpacity
                        onPress={() => onClose()}
                        // className="h-10 w-10 rounded-xl justify-center items-center"
                        className="h-10 w-10 rounded-full justify-center items-center"
                    >
                        <Icon name="close" type="ant-design" size={25} color="#000000" />
                    </TouchableOpacity>
                </View>
            </View>

        </Modal>
    )
}

export default memo(MapPickerModal);