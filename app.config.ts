import 'dotenv/config';

export default () => ({
  expo: {
    name: 'Jms Taxi',
    slug: 'jms-client',
    version: '1.1.2',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'com.jmsclient.app',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/icon.png',
      resizeMode: 'contain',
      backgroundColor: '#FF6D00',
    },
    ios: {
      supportsTablet: true,
      usesAppleSignIn: true,
      bundleIdentifier: 'com.jmsclient.app',
      buildNumber: '1.0.0',
      infoPlist: {
        NSCameraUsageDescription:
          "Cette application utilise l'appareil photo pour permettre aux utilisateurs de changer leurs photos de profil. Vos photos ne seront pas partagées sans votre autorisation",
        NSPhotoLibraryUsageDescription:
          "Cette application veut accéder à votre Librairie photo pour permettre aux utilisateurs de changer leurs photos de profil. Vos photos ne seront pas partagées sans votre autorisation",
        NSLocationWhenInUseUsageDescription:
          "Cette application veut accéder à votre localisation pour vous permettre de commander vos courses et de suivre le trajet en temps réel.",
        UIBackgroundModes: ['fetch', 'remote-notification'],
      },
      config: {
        googleMapsApiKey: process.env.GOOGLE_API_KEY ?? '',
      },
      sound: true,
    },
    notification: {
      icon: './assets/images/notification-icon.png',
      color: '#ffffff',
      androidMode: 'default',
      androidCollapsedTitle: 'Nouvelles notifications',
    },
    android: {
      sound: true,
      resources: ['./assets/sound/notification.wav'],
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_API_KEY ?? '',
        },
      },
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#ffffff',
      },
      edgeToEdgeEnabled: true,
      package: 'com.jmsclient.app',
      versionCode: 1,
      googleServicesFile: './google-services.json',
      permissions: ['android.permission.RECORD_AUDIO', 'android.permission.MODIFY_AUDIO_SETTINGS'],
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      '@maplibre/maplibre-react-native',
      [
        '@rnmapbox/maps',
        {
          RNMapboxMapsDownloadToken:
            'sk.eyJ1Ijoiam1zdGF4aSIsImEiOiJjbWYyeDA2MXUyZGFsMmtzaHljMnFqazdqIn0.E7PXdSczPuons3QL5ZakOQ',
        },
      ],
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#FF6D00',
        },
      ],
      'expo-asset',
      'expo-font',
      'expo-web-browser',
      [
        'expo-notifications',
        {
          sounds: ['./assets/sound/notification.wav'],
        },
      ],
      'expo-audio',
      [
        'expo-av',
        {
          microphonePermission: 'Autoriser $(PRODUCT_NAME) à accéder à votre micro.',
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
    owner: 'hanniel_ekp',
    extra: {
      apiUrl: process.env.API_URL ?? 'https://api.jmstaxi.com/api/',
      socketUrl: process.env.SOCKET_URL ?? 'https://api.jmstaxi.com',
      photoUrl: process.env.PHOTO_URL ?? 'https://api.jmstaxi.com/',
      googleApiKey: process.env.GOOGLE_API_KEY ?? '',
      mapboxAccessToken: process.env.MAPBOX_ACCESS_TOKEN ?? '',
      router: {},
      eas: {
        projectId: '3284560b-398e-4db7-bab1-11534bd924bf',
      },
    },
  },
});