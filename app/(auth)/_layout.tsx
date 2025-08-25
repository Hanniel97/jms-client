import React from "react";
import { Stack } from "expo-router";

export default function _layout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="phonecheck" options={{ animation: "slide_from_right" }}/>
            <Stack.Screen name="otpcheck" options={{ animation: "slide_from_right" }}/>
            <Stack.Screen name="userinfoadd" options={{ animation: "slide_from_right" }}/>
            <Stack.Screen name="passwordadd" options={{ animation: "slide_from_right" }}/>
            <Stack.Screen name="passwordcheck" options={{ animation: "slide_from_right" }}/>
            <Stack.Screen name="emailadd" options={{ animation: "slide_from_right" }}/>
        </Stack>
    );
}