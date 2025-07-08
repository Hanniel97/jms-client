import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

type CustomProgressBarProps = {
    duration?: number; // durée d’un cycle complet, par défaut 1000 ms
};

const CustomProgressBar: React.FC<CustomProgressBarProps> = ({
    duration = 1000,
}) => {
    const animation = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const loopAnim = Animated.loop(
            Animated.timing(animation, {
                toValue: 1,
                duration,
                useNativeDriver: false,
            })
        );
        loopAnim.start();
        return () => loopAnim.stop();
    }, [animation, duration]);

    const widthInterpolated = animation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <View style={styles.container}>
            <Animated.View
                style={[
                    styles.bar,
                    { width: widthInterpolated },
                ]}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        height: 4,
        backgroundColor: '#eee',
        borderRadius: 10,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        backgroundColor: '#1BA665',
    },
});

export default CustomProgressBar;
