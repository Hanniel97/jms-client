import { Dimensions, StyleSheet, View } from 'react-native';
import React, {
    forwardRef,
    useImperativeHandle,
    useCallback,
    useState,
} from 'react';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    useAnimatedScrollHandler,
    runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BackDrop from './BackDrop';

interface Props {
    snapTo: string;
    backgroundColor: string;
    backDropColor: string;
    onClose?: () => void;
    children?: React.ReactNode;
}

export interface BottomSheetMethods {
    expand: () => void;
    close: () => void;
}

const BottomSheetScrollView = forwardRef<BottomSheetMethods, Props>(
    ({ snapTo, children, backgroundColor, onClose, backDropColor }, ref) => {
        const inset = useSafeAreaInsets();
        const { height } = Dimensions.get('screen');
        const percentage = parseFloat(snapTo.replace('%', '')) / 100;
        const closeHeight = height;
        const openHeight = height - height * percentage;

        const topAnimation = useSharedValue(closeHeight);
        const context = useSharedValue(0);
        const scrollBegin = useSharedValue(0);
        const scrollY = useSharedValue(0);
        const [enableScroll, setEnableScroll] = useState(true);

        const expand = useCallback(() => {
            topAnimation.value = withTiming(openHeight);
        }, [openHeight, topAnimation]);

        const close = useCallback(() => {
            topAnimation.value = withTiming(closeHeight, {}, (finished) => {
                if (finished && onClose) {
                    runOnJS(onClose)();
                }
            });
        }, [closeHeight, onClose, topAnimation]);

        useImperativeHandle(ref, () => ({ expand, close }), [expand, close]);

        const animationStyle = useAnimatedStyle(() => ({
            top: topAnimation.value,
        }));

        const pan = Gesture.Pan()
            .onBegin(() => {
                context.value = topAnimation.value;
            })
            .onUpdate((event) => {
                if (event.translationY < 0) {
                    topAnimation.value = withSpring(openHeight);
                } else {
                    topAnimation.value = withSpring(context.value + event.translationY);
                }
            })
            .onEnd(() => {
                if (topAnimation.value > openHeight + 50) {
                    close();
                } else {
                    topAnimation.value = withSpring(openHeight);
                }
            });

        const panScroll = Gesture.Pan()
            .onBegin(() => {
                context.value = topAnimation.value;
            })
            .onUpdate((event) => {
                if (event.translationY < 0) {
                    topAnimation.value = withSpring(openHeight);
                } else if (event.translationY > 0 && scrollY.value === 0) {
                    runOnJS(setEnableScroll)(false);
                    topAnimation.value = withSpring(
                        Math.max(context.value + event.translationY - scrollBegin.value, openHeight)
                    );
                }
            })
            .onEnd(() => {
                runOnJS(setEnableScroll)(true);
                if (topAnimation.value > openHeight + 50) {
                    close();
                } else {
                    topAnimation.value = withSpring(openHeight);
                }
            });

        const onScroll = useAnimatedScrollHandler({
            onBeginDrag: (event) => {
                scrollBegin.value = event.contentOffset.y;
            },
            onScroll: (event) => {
                scrollY.value = event.contentOffset.y;
            },
        });

        return (
            <>
                <BackDrop
                    topAnimation={topAnimation}
                    backDropColor={backDropColor}
                    closeHeight={closeHeight}
                    openHeight={openHeight}
                    close={close}
                />

                <GestureDetector gesture={pan}>
                    <Animated.View
                        style={[
                            styles.container,
                            animationStyle,
                            {
                                backgroundColor,
                                // paddingBottom: inset.bottom,
                            },
                        ]}
                    >
                        <View style={styles.lineContainer}>
                            <View style={styles.line} />
                        </View>

                        <GestureDetector gesture={panScroll}>
                            <Animated.ScrollView
                                scrollEnabled={enableScroll}
                                bounces={false}
                                scrollEventThrottle={16}
                                onScroll={onScroll}
                            >
                                {children}
                            </Animated.ScrollView>
                        </GestureDetector>
                    </Animated.View>
                </GestureDetector>
            </>
        );
    }
);

BottomSheetScrollView.displayName = "BottomSheetScrollView";

export default BottomSheetScrollView;

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
    },
    lineContainer: {
        marginVertical: 10,
        alignItems: 'center',
    },
    line: {
        width: 50,
        height: 4,
        backgroundColor: '#ccc',
        borderRadius: 50,
    },
});
