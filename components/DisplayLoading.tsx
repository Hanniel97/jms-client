
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

export function DisplayLoading(){

    return(
        <View style={styles.loading_container}>
            <ActivityIndicator size={"large"} color={"#ff6d00"} />
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
