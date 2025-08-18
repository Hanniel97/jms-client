import { IRide } from "@/types";
import { router } from "expo-router";
import moment from "moment";
import "moment/locale/fr";
import React, { useMemo } from "react";
import {
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

moment.locale("fr");

type Props = {
  ride: IRide;
};

/** --- Helpers responsive (base iPhone 11 ~ 375x812) --- */
const BASE_W = 375;
const BASE_H = 812;
const hs = (size: number, w: number) => (size * w) / BASE_W; // horizontal scale
const vs = (size: number, h: number) => (size * h) / BASE_H; // vertical scale
const ms = (size: number, w: number, factor = 0.5) =>
  size + (hs(size, w) - size) * factor; // moderate scale

const RenderHistorique: React.FC<Props> = ({ ride }) => {
  const { width, height } = useWindowDimensions();

  // Tokens responsive
  const padV = Math.max(10, vs(10, height));
  const padH = Math.max(12, hs(12, width));
  const radius = ms(12, width);
  const gapSm = ms(6, width);
  const gapMd = ms(10, width);

  const fsTitle = ms(15, width);
  const fsTime = ms(12, width);
  const fsMeta = ms(12.5, width);
  const fsValue = ms(14, width);

  const formattedTime = useMemo(
    () => moment(ride.createdAt).format("DD MMM, HH:mm"),
    [ride.createdAt]
  );

  const formattedFare = useMemo(() => {
    try {
      return (
        new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
          ride.fare ?? 0
        ) + " XOF"
      );
    } catch {
      // fallback si Intl non dispo
      const raw = typeof ride.fare === "number" ? ride.fare : Number(ride.fare) || 0;
      return `${raw.toLocaleString?.("fr-FR") ?? raw} XOF`;
    }
  }, [ride.fare]);

  const name =
    ride?.rider ? `${ride?.rider?.prenom ?? ""} ${ride?.rider?.nom ?? ""}`.trim() : "—";
  const vehicle = String(ride?.vehicle ?? "").toUpperCase();

  const goToDetails = () => {
    router.push({ pathname: "/ridedetails", params: { id: ride._id } });
  };

  return (
    <TouchableOpacity
      onPress={goToDetails}
      activeOpacity={0.92}
      accessibilityRole="button"
      accessibilityLabel={`Détails course de ${name}, ${formattedTime}`}
      style={{
        width: "100%",
        backgroundColor: "#ffffff",
        paddingVertical: padV,
        paddingHorizontal: padH,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: "rgba(59,130,246,0.40)", // primary/40
        marginVertical: vs(6, height),
        // petite ombre cross-platform
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 1,
      }}
    >
      {/* Ligne 1 : Nom à gauche, Date/Heure à droite */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: gapMd,
        }}
      >
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginRight: hs(8, width),
            fontSize: fsTitle,
            fontWeight: "700",
            color: "#1f2937", // gray-800
          }}
        >
          {name || "—"}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            flexShrink: 0,
            fontSize: fsTime,
            color: "#6b7280", // gray-500
            maxWidth: "50%",
            textAlign: "right",
          }}
        >
          {formattedTime}
        </Text>
      </View>

      {/* Ligne 2 : Véhicule à gauche, Montant à droite */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            marginRight: hs(8, width),
            fontSize: fsMeta,
            fontWeight: "700",
            color: "#9ca3af", // gray-400
            letterSpacing: 0.5,
          }}
        >
          {vehicle || "—"}
        </Text>

        <Text
          numberOfLines={1}
          style={{
            fontSize: fsValue,
            fontWeight: "700",
            color: "#374151", // gray-700
          }}
        >
          {formattedFare}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

export default RenderHistorique;




// import { IRide } from '@/types';
// import { router } from 'expo-router';
// import moment from 'moment';
// import 'moment/locale/fr';
// import React from 'react';
// import { Text, TouchableOpacity, View } from 'react-native';

// moment.locale('fr');

// type Props = {
//     ride: IRide;
// };

// const RenderHistorique: React.FC<Props> = ({ ride }) => {
    
//     return (
//         <TouchableOpacity onPress={() =>{router.push({pathname: "/ridedetails", params: {id: ride._id}})}} className="flex-1 w-full my-1 justify-between rounded-lg p-3 border-[1px] border-primary/40">
//             <View className="flex-row justify-between">
//                 <Text numberOfLines={1} className="font-['RubikBold'] text-gray-800 flex">{ride?.rider?.prenom} {ride?.rider?.nom}</Text>
//                 <Text numberOfLines={1} className="font-['RubikRegular']">{moment(ride.createdAt).format('HH:mm')}</Text>
//             </View>

//             <View className="flex-row justify-between mt-2">
//                 <Text numberOfLines={1} className="font-['RubikBold'] text-gray-400 uppercase">{ride?.vehicle} </Text>
//                 <Text numberOfLines={1} className="font-['RubikRegular'] text-gray-400">{ride.fare.toLocaleString()} XOF</Text>
//             </View>
//         </TouchableOpacity>
//     )
// }

// export default RenderHistorique;