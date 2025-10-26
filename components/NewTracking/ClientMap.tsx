// components/ClientMap.tsx
import { IRide } from "@/types";
import { LatLng } from "@/utils/geo";
import React, { useEffect, useRef } from "react";
import { View } from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";

type Props = {
    ride: IRide;
    routeCoords: LatLng[];
    markerRegion: any; // AnimatedRegion si tu veux plus tard
    currentCoord: LatLng | null;
    heading: number;
    isFollowing: boolean;
    showTraffic: boolean;
    markerRotation: number;
    pickupCoord?: LatLng;
    dropCoord?: LatLng;
};

const ClientMap: React.FC<Props> = ({
    ride,
    routeCoords,
    markerRegion,
    currentCoord,
    heading,
    isFollowing,
    showTraffic,
    markerRotation,
    pickupCoord,
    dropCoord,
}) => {
    const mapRef = useRef<MapView | null>(null);

    const initialRegion = routeCoords?.length
        ? {
            latitude: routeCoords[0].latitude,
            longitude: routeCoords[0].longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        }
        : {
            latitude: ride?.pickup?.latitude ?? 0,
            longitude: ride?.pickup?.longitude ?? 0,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
        };

    useEffect(() => {
        if (!mapRef.current || !currentCoord) return;
        if (isFollowing) {
            mapRef.current.animateCamera(
                {
                    center: {
                        latitude: currentCoord.latitude,
                        longitude: currentCoord.longitude,
                    },
                    heading: heading ?? 0,
                    pitch: 60,
                    zoom: 16,
                },
                { duration: 300 }
            );
        }
    }, [currentCoord, heading, isFollowing]);

    if (!initialRegion) return null;

    return (
        <View style={{ flex: 1 }}>
            <MapView
                ref={mapRef}
                provider={PROVIDER_GOOGLE}
                style={{ flex: 1 }}
                showsMyLocationButton
                showsBuildings={false}
                showsIndoorLevelPicker={false}
                pitchEnabled={false}
                initialRegion={initialRegion}
                showsTraffic={showTraffic}
                showsUserLocation={false}
            >
                {routeCoords.length > 0 && (
                    <Polyline coordinates={routeCoords} strokeWidth={5} strokeColor="#2563EB" tappable zIndex={2} geodesic />
                )}

                {pickupCoord && (
                    <Marker coordinate={pickupCoord} title="Départ" description="Point de prise en charge" pinColor="#10B981" zIndex={3} />
                )}

                {dropCoord && (
                    <Marker coordinate={dropCoord} title="Arrivée" description="Destination" pinColor="#EF4444" zIndex={3} />
                )}

                {/* Marker du chauffeur */}
                {currentCoord && (
                    <Marker
                        coordinate={{ latitude: currentCoord.latitude, longitude: currentCoord.longitude }}
                        anchor={{ x: 0.5, y: 0.5 }}
                        flat={false}
                        tracksViewChanges={false}
                        rotation={markerRotation}
                        image={require("../../assets/images/driver.png")}
                        zIndex={4}
                    />
                )}
            </MapView>
        </View>
    );
};

export default ClientMap;






// import MapboxGL from "@rnmapbox/maps";
// import React, { useEffect, useRef, useState } from "react";
// import { View } from "react-native";
// import { LatLng } from "../../utils/geo";

// type Props = {
//     routeCoords: LatLng[];
//     currentCoord: LatLng | null;
//     heading: number;
//     isFollowing: boolean;
//     showTraffic: boolean;
//     markerRotation: number;
// };

// const ClientMap: React.FC<Props> = ({
//     routeCoords,
//     currentCoord,
//     heading,
//     isFollowing,
//     showTraffic,
//     markerRotation,
// }) => {
//     const mapRef = useRef<MapboxGL.MapView>(null);

//     // Convert coords for Mapbox
//     const lineCoords = routeCoords.map((c) => [c.longitude, c.latitude]);

//     // GeoJSON for car position
//     const pointGeoJSON = {
//         type: "FeatureCollection" as const,
//         features: [
//             {
//                 type: "Feature" as const,
//                 geometry: {
//                     type: "Point" as const,
//                     coordinates: currentCoord
//                         ? [currentCoord.longitude, currentCoord.latitude]
//                         : lineCoords[0],
//                 },
//                 properties: {},
//             },
//         ],
//     };

//     // Smooth heading (optionnel, sinon tu passes directement markerRotation)
//     const [smoothedHeading, setSmoothedHeading] = useState(markerRotation); // Lissage de l'orientation

//     useEffect(() => {
//         // Lissage plus réactif pour la rotation du marker
//         setSmoothedHeading((prev) => {
//             const delta = Math.abs(markerRotation - prev);
//             // Sensibilité augmentée
//             const alpha = delta > 10 ? 0.85 : 0.55;
//             return prev + alpha * (markerRotation - prev);
//         });
//     }, [markerRotation]);

//     return (
//         <View style={{ flex: 1 }}>
//             <MapboxGL.MapView
//                 ref={mapRef}
//                 style={{ flex: 1 }}
//                 styleURL={MapboxGL.StyleURL.Street}
//                 rotateEnabled
//                 pitchEnabled
//                 compassEnabled
//             >
//                 <MapboxGL.Images images={{ car: require("../../assets/images/driver.png") }} />
//                 {/* Camera follow */}
//                 {currentCoord && (
//                     <MapboxGL.Camera
//                         centerCoordinate={[currentCoord.longitude, currentCoord.latitude]}
//                         zoomLevel={17}
//                         pitch={60}
//                         heading={isFollowing ? smoothedHeading : 0} // Utilise le heading lissé pour la caméra
//                         animationDuration={350} // Animation plus longue pour la rotation
//                     />
//                 )}

//                 {/* Route polyline */}
//                 <MapboxGL.ShapeSource
//                     id="routeSource"
//                     shape={{
//                         type: "Feature" as const,
//                         geometry: { type: "LineString" as const, coordinates: lineCoords },
//                         properties: {},
//                     }}
//                 >
//                     <MapboxGL.LineLayer
//                         id="routeLine"
//                         style={{
//                             lineColor: "#2563EB",
//                             lineWidth: 5,
//                         }}
//                     />
//                 </MapboxGL.ShapeSource>

//                 {/* Car marker */}
//                 <MapboxGL.ShapeSource id="driverSource" shape={pointGeoJSON}>
//                     <MapboxGL.SymbolLayer
//                         id="driverSymbol"
//                         style={{
//                             iconImage: "car", // doit être enregistré via MapboxGL.Images
//                             iconAllowOverlap: true,
//                             iconIgnorePlacement: true,
//                             iconSize: 0.6,
//                             // rotation : si follow auto → voiture vers le haut (viewport)
//                             // sinon → rotation selon heading sur la carte
//                             iconRotate: isFollowing ? 0 : smoothedHeading,
//                             iconRotationAlignment: isFollowing ? "viewport" : "map",
//                             iconAnchor: "center", // format string requis par MapboxGL
//                         }}
//                     />
//                 </MapboxGL.ShapeSource>
//             </MapboxGL.MapView>
//         </View>
//     );
// };

// export default ClientMap;