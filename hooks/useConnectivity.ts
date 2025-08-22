// hooks/useConnectivity.ts
import { useEffect, useState, useRef } from "react";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { AppState, AppStateStatus } from "react-native";
import { useWS } from "@/services/WSProvider"; // adapte le path si besoin
import { Socket } from "socket.io-client";

interface UseConnectivityOptions {
    debounceMs?: number;
}

interface ConnectivityResult {
    isInternetConnected: boolean;
    isSocketConnected: boolean;
    appState: AppStateStatus;
    isOnline: boolean;
}

export default function useConnectivity(
    { debounceMs = 1000 }: UseConnectivityOptions = {}
): ConnectivityResult {
    const [isInternetConnected, setIsInternetConnected] = useState<boolean>(true);
    const [isSocketConnected, setIsSocketConnected] = useState<boolean>(false);
    const [appState, setAppState] = useState<AppStateStatus>(
        AppState.currentState
    );

    // ⚡ On expose socket depuis useWS
    const { socket } = useWS() as { socket: Socket | null };

    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // 🔌 Vérification Internet via NetInfo
    useEffect(() => {
        const unsub = NetInfo.addEventListener((state: NetInfoState) => {
            const connected = Boolean(
                state.isConnected && state.isInternetReachable !== false
            );

            // debounce pour éviter les "flapping"
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            debounceTimer.current = setTimeout(() => {
                setIsInternetConnected(connected);
            }, debounceMs);
        });

        return () => {
            if (debounceTimer.current) clearTimeout(debounceTimer.current);
            unsub();
        };
    }, [debounceMs]);

    // 📱 État de l'application (foreground/background)
    useEffect(() => {
        const handler = (nextAppState: AppStateStatus) => setAppState(nextAppState);

        const sub = AppState.addEventListener("change", handler);

        return () => {
            sub.remove();
        };
    }, []);

    // 🔄 Vérification état du WebSocket
    useEffect(() => {
        if (!socket) {
            setIsSocketConnected(false);
            return;
        }

        const onConnect = () => setIsSocketConnected(true);
        const onDisconnect = () => setIsSocketConnected(false);

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);

        // État initial
        setIsSocketConnected(socket.connected);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
        };
    }, [socket]);

    // ✅ Calcul final : app online si internet + socket ok + app active
    const isAppActive =
        appState === "active" || appState === "foreground";
    const isOnline =
        isInternetConnected && (isSocketConnected || !socket) && isAppActive;

    return { isInternetConnected, isSocketConnected, appState, isOnline };
}
