import { useColorScheme } from '@/hooks/useColorScheme';
import { WSProvider } from '@/services/WSProvider';
import { useFonts } from 'expo-font';
import NetInfo from "@react-native-community/netinfo";
import { StatusBar } from 'expo-status-bar';
import React, { JSX, Suspense, useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Toast, { BaseToast, BaseToastProps, ErrorToast } from 'react-native-toast-message';
import { TailwindProvider } from 'tailwindcss-react-native';
import { useKeepAwake } from 'expo-keep-awake';
import Routes from './router';

function Loading() {
  return <ActivityIndicator size="large" color="blue" />;
}

const toastConfig = {
  success: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: 'green' }}
      contentContainerStyle={{ paddingHorizontal: 15 }}
      text1Style={{
        fontSize: 15,
        fontWeight: '400',
        fontFamily: "RubikRegular"
      }}
      text2Style={{
        fontSize: 13,
        fontFamily: "RubikRegular"
      }}
    />
  ),

  error: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
    <ErrorToast
      {...props}
      text1Style={{
        fontSize: 15,
        fontFamily: "RubikRegular"
      }}
      text2Style={{
        fontSize: 13,
        fontFamily: "RubikRegular"
      }}
    />
  ),
  info: (props: JSX.IntrinsicAttributes & BaseToastProps) => (
    <ErrorToast
      {...props}
      text1Style={{
        fontSize: 15,
        fontFamily: "RubikRegular"
      }}
      text2Style={{
        fontSize: 13,
        fontFamily: "RubikRegular"
      }}
    />
  )
}

export default function RootLayout() {
  const [isConnected, setIsConnected] = useState(true);
  const colorScheme = useColorScheme();
  useKeepAwake();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    RubikRegular: require('../assets/fonts/Rubik/static/Rubik-Regular.ttf'),
    RubikBold: require('../assets/fonts/Rubik/static/Rubik-Bold.ttf'),
    RubikSemiBold: require('../assets/fonts/Rubik/static/Rubik-SemiBold.ttf'),
    RubikLight: require('../assets/fonts/Rubik/static/Rubik-Light.ttf'),
    RubikMedium: require('../assets/fonts/Rubik/static/Rubik-Medium.ttf'),
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log(state)
      setIsConnected(state.isConnected ?? false);
      // if (!state.isConnected) {
      //   router.replace("/_offline");
      // }
    });

    return () => unsubscribe();
  }, []);

  // 🔌 Écoute de la connexion Internet
  // useEffect(() => {
  //   const unsubscribe = NetInfo.addEventListener(state => {
  //     setIsConnected(state.isConnected && state.isInternetReachable !== false);
  //   });

  //   return () => unsubscribe();
  // }, []);

  if (!loaded) {
    // Async font loading only occurs in development.
    return null;
  }

  return (
    <TailwindProvider>
      <WSProvider>
        <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
        <Suspense fallback={<Loading />}>
          <GestureHandlerRootView style={{
            flex: 1,
            // marginBottom: insets.bottom
          }}>
            <Routes isConnected={isConnected} />
            {/* <Slot /> */}
          </GestureHandlerRootView>
        </Suspense>
        <Toast config={toastConfig} />
      </WSProvider>
    </TailwindProvider>
  );
}
