import React from "react";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import { IProps } from "@/types/auth.app";

const Container : React.FC<IProps> = ({children, classs}) => {
    const insets = useSafeAreaInsets();

    // console.log(classs)

    return(
        <SafeAreaProvider style={{ paddingTop: insets.top, }} className={`flex-1 bg-white dark:bg-black ${classs}`}>
            <GestureHandlerRootView className="flex-1">
                {children}
            </GestureHandlerRootView>
        </SafeAreaProvider>
    )
}

export default Container