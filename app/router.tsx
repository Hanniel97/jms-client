import { Stack } from 'expo-router';

const Routes = () =>{
    
    return(
        <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="editprofil" options={{ headerShown: false }} />
            <Stack.Screen name="rechargewallet" options={{ headerShown: false }} />
            <Stack.Screen name="changepassword" options={{ headerShown: false }} />
            <Stack.Screen name="policy" options={{ headerShown: false }} />
            <Stack.Screen name="contactus" options={{ headerShown: false }} />
            <Stack.Screen name="notifications" options={{ headerShown: false }} />
            <Stack.Screen name="deleteaccount" options={{ headerShown: false }} />
            <Stack.Screen name="addcourse" options={{ headerShown: false }} />
            <Stack.Screen name="liveride" options={{ headerShown: false }} />
            {/* <Stack.Screen name="send" options={{ headerShown: false }} />
            <Stack.Screen name="sendmoneyform" options={{ headerShown: false }} />
            <Stack.Screen name="sendmoneysummary" options={{ headerShown: false }} />
            <Stack.Screen name="request" options={{ headerShown: false }} />
            <Stack.Screen name="userinfo" options={{ headerShown: false }} /> */}
        </Stack>
    )
}

export default Routes;