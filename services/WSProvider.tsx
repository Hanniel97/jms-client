import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { socketUrl } from "./api";
import useStore from "@/store/useStore";
import { refresh_tokens } from "./apiInterceptors";

interface WSService {
    initializeSocket: () => void;
    emit: (event: string, data?: any) => void;
    on: (event: string, callback: (data: any) => void) => void;
    off: (event: string) => void;
    removeListener: (listenerName: string) => void;
    updateAccessToken: () => void;
    disconnect: () => void;
    reconnectWithNewToken: () => Promise<void>;
}

const WSContext = createContext<WSService | undefined>(undefined);

interface WSProviderProps {
    children: ReactNode;
}

export const WSProvider: React.FC<WSProviderProps> = ({ children }) => {
    const [socketAccessToken, setSocketAccessToken] = useState<string | null>(
        null
    );

    const { tok, user, isAuthenticated } = useStore();

    // console.log('mon user', user)

    const socket = useRef<Socket | null>(null);

    useEffect(() => {
        if (tok && isAuthenticated) {
            // console.log("🟢 Mise à jour du token détectée :", tok);
            setSocketAccessToken(tok);
        }
    }, [isAuthenticated, tok]);

    useEffect(() => {
        if (!socketAccessToken && !isAuthenticated) return;

        // console.log("🔄 Tentative de connexion WebSocket...");

        if (socket.current) {
            // console.log("❌ Déconnexion du socket existant...");
            socket.current.disconnect();
        }

        socket.current = io(socketUrl, {
            transports: ["websocket"],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            withCredentials: true,
            auth: {
                token: socketAccessToken || "",
            },
            // extraHeaders: {
            //     access_token: socketAccessToken || "",
            // },
        });

        // console.log("✅ WebSocket initialisé avec le token :", socketAccessToken);

        // socket.current.on("connect", () => {
        //     console.log("🟢 WebSocket connecté !");
        // });

        socket.current.on('connect', () => {
            // console.log('✅ Connecté au serveur Socket.IO');
            if (user) {
                // console.log('✅ User connecté ', user._id);
                emit('user_connected', user._id);
            }
        });

        // console.log("Etat", socket.current);

        socket.current.on("connect_error", (error) => {
            console.error("❌ Erreur de connexion WebSocket :", error);
            if (error.message === "Authentication error") {
                // console.log("🔄 Rafraîchissement du token...");
                refresh_tokens();
            }
        });


        return () => {
            // console.log("🔴 Déconnexion WebSocket dans le cleanup...");
            socket.current?.disconnect();
        }

    }, [isAuthenticated, socketAccessToken, user]);

    const emit = (event: string, data: any = {}) => {
        socket.current?.emit(event, data);
    }

    const on = (event: string, callback: (data: any) => void) => {
        socket.current?.on(event, callback);
    }

    const off = (event: string) => {
        socket.current?.off(event);
    }

    const removeListener = (listenerName: string) => {
        socket?.current?.removeAllListeners(listenerName);
    }

    const updateAccessToken = () => {
        const token = useStore.getState().tok;
        setSocketAccessToken(token);
        // console.log("🔄 Mise à jour du token WebSocket :", token);
    }

    const reconnectWithNewToken = async () => {
        const newToken = await refresh_tokens();
        if (newToken) setSocketAccessToken(newToken);
    };

    const disconnect = () => {
        if (socket.current) {
            socket.current.disconnect();
            socket.current = null;
            console.log('disconnected');
        }
    }

    const socketService: WSService = {
        initializeSocket: () => { },
        emit,
        on,
        off,
        removeListener,
        updateAccessToken,
        disconnect,
        reconnectWithNewToken,
    }

    return (
        <WSContext.Provider value={socketService}>
            {children}
        </WSContext.Provider>
    )
}

export const useWS = (): WSService => {
    const socketService = useContext(WSContext)
    if (!socketService) {
        throw new Error("useWS must be used within a WSProvider")
    }

    return socketService;
}