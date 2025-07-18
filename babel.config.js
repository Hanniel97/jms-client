module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        plugins: [
            "tailwindcss-react-native/babel",
            "react-native-reanimated/plugin",
            // ['module:react-native-dotenv', {
            //     envName: 'APP_ENV',
            //     moduleName: '@env',
            //     path: '.env',
            //     blocklist: null,
            //     allowlist: null,
            //     safe: false,
            //     allowUndefined: true,
            // }]
        ],
    };
};
