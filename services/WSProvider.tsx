import useStore from "@/store/useStore";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { socketUrl } from "./api";
import { refresh_tokens } from "./apiInterceptors";

type AnyObj = Record<string, any>;

export interface WSService {
    socket: Socket | null;
    connected: boolean;
    initializeSocket: (token?: string) => void;
    emit: (event: string, data?: any, ack?: (...args: any[]) => void) => void;
    on: (event: string, cb: (...args: any[]) => void) => void;
    off: (event: string, cb?: (...args: any[]) => void) => void;
    removeListener: (event: string) => void;
    updateAccessToken: (token?: string) => void;
    disconnect: () => void;
    reconnectWithNewToken: () => Promise<void>;
    sendPresence: (status?: "online" | "away" | "offline", location?: { latitude: number; longitude: number } | null) => void;
}

const WSContext = createContext<WSService | undefined>(undefined);

export const WSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const socketRef = useRef<Socket | null>(null);
    const heartbeatRef = useRef<number | null>(null);
    const [connected, setConnected] = useState<boolean>(false);

    const { tok, user } = useStore();

    // --- Create / init socket (idempotent) ---
    const initializeSocket = useCallback(
        (token?: string) => {
            const authToken = token ?? useStore.getState().tok ?? null;

            // If there's an existing socket, disconnect it cleanly first
            if (socketRef.current) {
                try {
                    socketRef.current.removeAllListeners();
                    socketRef.current.disconnect();
                } catch (e) {
                    // ignore
                }
                socketRef.current = null;
            }

            if (!socketUrl) {
                console.warn("WSProvider: socketUrl not set");
                return;
            }

            const s: Socket = io(socketUrl, {
                transports: ["websocket"],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 2000,
                auth: { token: authToken ?? "" },
                // withCredentials not necessary for mobile usually, enable if your server needs cookies
                // withCredentials: true,
            });

            socketRef.current = s;

            s.on("connect", () => {
                setConnected(true);
                console.log("[WS] connect", s.id);
                // announce user presence when connected
                if (user?._id) {
                    const userId = (user as any).id || (user as any)._id;
                    s.emit("user_connected", userId);
                    // also set presence on server (server should update OnDuty socketId/lastSeen)
                    s.emit("presence:set", { userId, status: "online" });
                }
                // start heartbeat
                if (heartbeatRef.current) {
                    clearInterval(heartbeatRef.current);
                    heartbeatRef.current = null;
                }
                heartbeatRef.current = setInterval(() => {
                    try {
                        s.emit("presence:ping");
                    } catch (e) {
                        /* ignore */
                    }
                }, 60000) as unknown as number;
            });

            s.on("disconnect", (reason: any) => {
                setConnected(false);
                console.log("[WS] disconnect", reason);
                if (heartbeatRef.current) {
                    clearInterval(heartbeatRef.current);
                    heartbeatRef.current = null;
                }
            });

            s.on("connect_error", (err: any) => {
                console.error("[WS] connect_error", err?.message || err);
                // if the server returns auth error, try to refresh token and reconnect
                if (err && (err.message === "Authentication error" || err.message?.includes("Authentication"))) {
                    // attempt refresh and re-connect
                    reconnectWithNewToken().catch(() => {
                        console.warn("[WS] reconnectWithNewToken failed");
                    });
                }
            });

            // Optional: handle other global events here (e.g., server heartbeats, server broadcasts)
            return s;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );

    // create socket initially if tok exists (or later via updateAccessToken)
    useEffect(() => {
        if (tok) {
            initializeSocket(tok);
        }
        // cleanup on unmount
        return () => {
            try {
                socketRef.current?.removeAllListeners();
                socketRef.current?.disconnect();
            } catch (e) {
                /* ignore */
            }
            socketRef.current = null;
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        };
    }, [tok, initializeSocket]);

    // --- emit/on/off helpers ---
    const emit = useCallback((event: string, data: any = {}, ack?: (...args: any[]) => void) => {
        try {
            socketRef.current?.emit(event, data, ack);
        } catch (e) {
            console.warn("[WS] emit error", e);
        }
    }, []);

    const on = useCallback((event: string, cb: (...args: any[]) => void) => {
        socketRef.current?.on(event, cb);
    }, []);

    const off = useCallback((event: string, cb?: (...args: any[]) => void) => {
        if (cb) socketRef.current?.off(event, cb);
        else socketRef.current?.off(event);
    }, []);

    const removeListener = useCallback((event: string) => {
        socketRef.current?.removeAllListeners(event);
    }, []);

    const disconnect = useCallback(() => {
        try {
            socketRef.current?.removeAllListeners();
            socketRef.current?.disconnect();
        } catch (e) {
            // ignore
        } finally {
            socketRef.current = null;
            setConnected(false);
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        }
    }, []);

    // --- update token without recreating reference (set auth + reconnect) ---
    const updateAccessToken = useCallback((token?: string) => {
        const newToken = token ?? useStore.getState().tok ?? null;
        if (!socketRef.current) {
            // create socket if none
            initializeSocket(newToken ?? undefined);
            return;
        }
        try {
            // set auth and force reconnect so server reads new token
            socketRef.current.auth = { token: newToken ?? "" };
            socketRef.current.disconnect();
            socketRef.current.connect();
            console.log("[WS] updateAccessToken and reconnect");
        } catch (e) {
            console.warn("[WS] failed updateAccessToken:", e);
            // fallback: reinitialize
            initializeSocket(newToken ?? undefined);
        }
    }, [initializeSocket]);

    // --- try to refresh tokens and update socket auth ---
    const reconnectWithNewToken = useCallback(async (): Promise<void> => {
        try {
            const newToken = await refresh_tokens(); // doit retourner token ou null selon ton impl
            if (newToken) {
                // save into store if refresh_tokens didn't already
                if (!useStore.getState().tok || useStore.getState().tok !== newToken) {
                    useStore.getState().setTok?.(newToken as any); // adapte si tu as setToken
                }
                updateAccessToken(newToken);
                console.log("[WS] reconnected with new token");
            } else {
                // nothing to do: maybe user is logged out
                console.warn("[WS] reconnectWithNewToken: no token returned");
                disconnect();
            }
        } catch (e) {
            console.error("[WS] reconnectWithNewToken error", e);
            disconnect();
        }
    }, [disconnect, updateAccessToken]);

    // --- presence helper (called from UI when needed) ---
    const sendPresence = useCallback(
        (status: "online" | "away" | "offline" = "online", location: { latitude: number; longitude: number } | null = null) => {
            const s = socketRef.current;
            if (!s || !s.connected) return;
            const userId = (user as any)?.id ?? (user as any)?._id ?? null;
            if (!userId) return;
            s.emit("presence:set", { userId, status, location });
        },
        [user]
    );

    // Provide a stable API object
    const api: WSService = {
        socket: socketRef.current,
        connected,
        initializeSocket,
        emit,
        on,
        off,
        removeListener,
        updateAccessToken,
        disconnect,
        reconnectWithNewToken,
        sendPresence,
    };

    return <WSContext.Provider value={api}>{children}</WSContext.Provider>;
};

export const useWS = (): WSService => {
    const ctx = useContext(WSContext);
    if (!ctx) throw new Error("useWS must be used within WSProvider");
    return ctx;
};




// import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
// import { io, Socket } from "socket.io-client";
// import { socketUrl } from "./api";
// import useStore from "@/store/useStore";
// import { refresh_tokens } from "./apiInterceptors";

// interface WSService {
//     initializeSocket: () => void;
//     emit: (event: string, data?: any) => void;
//     on: (event: string, callback: (data: any) => void) => void;
//     off: (event: string) => void;
//     removeListener: (listenerName: string) => void;
//     updateAccessToken: () => void;
//     disconnect: () => void;
//     reconnectWithNewToken: () => Promise<void>;
// }

// const WSContext = createContext<WSService | undefined>(undefined);

// interface WSProviderProps {
//     children: ReactNode;
// }

// export const WSProvider: React.FC<WSProviderProps> = ({ children }) => {
//     const [socketAccessToken, setSocketAccessToken] = useState<string | null>(
//         null
//     );

//     const { tok, user, isAuthenticated } = useStore();

//     // console.log('mon user', user)

//     const socket = useRef<Socket | null>(null);

//     useEffect(() => {
//         if (tok && isAuthenticated) {
//             // console.log("🟢 Mise à jour du token détectée :", tok);
//             setSocketAccessToken(tok);
//         }
//     }, [isAuthenticated, tok]);

//     useEffect(() => {
//         if (!socketAccessToken && !isAuthenticated) return;

//         // console.log("🔄 Tentative de connexion WebSocket...");

//         if (socket.current) {
//             // console.log("❌ Déconnexion du socket existant...");
//             socket.current.disconnect();
//         }

//         socket.current = io(socketUrl, {
//             transports: ["websocket"],
//             reconnection: true,
//             reconnectionAttempts: 5,
//             reconnectionDelay: 2000,
//             withCredentials: true,
//             auth: {
//                 token: socketAccessToken || "",
//             },
//             // extraHeaders: {
//             //     access_token: socketAccessToken || "",
//             // },
//         });

//         // console.log("✅ WebSocket initialisé avec le token :", socketAccessToken);

//         // socket.current.on("connect", () => {
//         //     console.log("🟢 WebSocket connecté !");
//         // });

//         socket.current.on('connect', () => {
//             // console.log('✅ Connecté au serveur Socket.IO');
//             if (user) {
//                 // console.log('✅ User connecté ', user._id);
//                 emit('user_connected', user._id);
//             }
//         });

//         // console.log("Etat", socket.current);

//         socket.current.on("connect_error", (error) => {
//             console.error("❌ Erreur de connexion WebSocket :", error);
//             if (error.message === "Authentication error") {
//                 // console.log("🔄 Rafraîchissement du token...");
//                 refresh_tokens();
//             }
//         });


//         return () => {
//             // console.log("🔴 Déconnexion WebSocket dans le cleanup...");
//             socket.current?.disconnect();
//         }

//     }, [isAuthenticated, socketAccessToken, user]);

//     const emit = (event: string, data: any = {}) => {
//         socket.current?.emit(event, data);
//     }

//     const on = (event: string, callback: (data: any) => void) => {
//         socket.current?.on(event, callback);
//     }

//     const off = (event: string) => {
//         socket.current?.off(event);
//     }

//     const removeListener = (listenerName: string) => {
//         socket?.current?.removeAllListeners(listenerName);
//     }

//     const updateAccessToken = () => {
//         const token = useStore.getState().tok;
//         setSocketAccessToken(token);
//         // console.log("🔄 Mise à jour du token WebSocket :", token);
//     }

//     const reconnectWithNewToken = async () => {
//         const newToken = await refresh_tokens();
//         if (newToken) setSocketAccessToken(newToken);
//     };

//     const disconnect = () => {
//         if (socket.current) {
//             socket.current.disconnect();
//             socket.current = null;
//             console.log('disconnected');
//         }
//     }

//     const socketService: WSService = {
//         initializeSocket: () => { },
//         emit,
//         on,
//         off,
//         removeListener,
//         updateAccessToken,
//         disconnect,
//         reconnectWithNewToken,
//     }

//     return (
//         <WSContext.Provider value={socketService}>
//             {children}
//         </WSContext.Provider>
//     )
// }

// export const useWS = (): WSService => {
//     const socketService = useContext(WSContext)
//     if (!socketService) {
//         throw new Error("useWS must be used within a WSProvider")
//     }

//     return socketService;
// }