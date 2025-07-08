// import { IProps } from "@/types/auth.app";
// import React from "react";
// import { KeyboardAvoidingView, Keyboard, Pressable, Platform, ScrollView } from "react-native";

// const KeyboardAvoidWrapper: React.FC<IProps> = ({ children }) => {
//     return (
//         <KeyboardAvoidingView
//             className="flex flex-1"
//             behavior={Platform.OS === "ios" ? "padding" : "height"}
//             keyboardVerticalOffset={60}
//         >
//             <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 30 }} centerContent className="flex flex-1" showsVerticalScrollIndicator={false}>
//                 <Pressable onPress={Keyboard.dismiss}>{children}</Pressable>
//             </ScrollView>

//         </KeyboardAvoidingView>
//     );
// };
// export default KeyboardAvoidWrapper;


import { IProps } from "@/types/auth.app";
import React from "react";
import {
    KeyboardAvoidingView,
    Keyboard,
    TouchableWithoutFeedback,
    Platform,
    ScrollView,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const KeyboardAvoidWrapper: React.FC<IProps> = ({ children }) => {
    const insets = useSafeAreaInsets();
    
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={0}
            style={{ flex: 1 }}
        >
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 10 }}
                >
                    <View style={{ flex: 1 }}>{children}</View>
                </ScrollView>
            </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
    );
};

export default KeyboardAvoidWrapper;
