import React, { useEffect, useState } from "react";
import { Image, View } from "react-native";
import { Marker } from "react-native-maps";
import driverIcon from "../../assets/images/driver.png";

type Props = {
    currentCoord: { latitude: number; longitude: number };
    markerRotation: number;
    zoom?: number; // 👈 ajouté pour suivre le niveau de zoom de la caméra
};

const CarMarker: React.FC<Props> = ({ currentCoord, markerRotation, zoom = 16 }) => {
    const [size, setSize] = useState(40);

    // 🔧 Ajuste automatiquement la taille selon le zoom
    useEffect(() => {
        // Plage de zoom standard : 10 → 20
        const minZoom = 10;
        const maxZoom = 20;
        const minSize = 24;
        const maxSize = 44;

        // Interpolation linéaire
        const clampedZoom = Math.max(minZoom, Math.min(maxZoom, zoom));
        const newSize =
            minSize + ((clampedZoom - minZoom) / (maxZoom - minZoom)) * (maxSize - minSize);
        setSize(newSize);
    }, [zoom]);

    if (!currentCoord) return null;

    return (
        <Marker
            coordinate={currentCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
            tracksViewChanges={false}
            zIndex={4}
        >
            <View
                style={{
                    width: 40,
                    height: 40,
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <Image
                    source={driverIcon}
                    style={{
                        width: 40,
                        height: 40,
                        resizeMode: "contain",
                        transform: [{ rotate: `${markerRotation}deg` }],
                    }}
                />
            </View>
        </Marker>
    );
};

export default CarMarker;
