
import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet, View, ActivityIndicator } from 'react-native';

export function DisplayLoading(){

    return(
        <View style={styles.loading_container}>
            <ActivityIndicator size={"large"} color={"#ff6d00"} />
            {/* <LottieView
                source={require('../assets/lottie/loading.json')}
                autoPlay
                loop
                style={{width: 120, height: 120}}
            /> */}
        </View>
    )
}

const styles = StyleSheet.create({
    loading_container: {
        flex: 1,
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
