import React from "react";
import { Stack } from "expo-router";

export default function _layout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="phonecheck" />
            <Stack.Screen name="otpcheck" />
            <Stack.Screen name="userinfoadd" />
            <Stack.Screen name="passwordadd" />
            <Stack.Screen name="passwordcheck" />
            <Stack.Screen name="emailadd" />
        </Stack>
    );
}