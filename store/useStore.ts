import { INotification, IPosition, IPrice, IRide, ITransaction, IUser } from "@/types";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Use JSON storage adapter recommended for React Native

interface Store {
    tok: string,
    refresh_tok: string,
    isAuthenticated: boolean;
    user: IUser;
    transactions: ITransaction[],
    outOfRange: boolean,
    position: IPosition;
    first: boolean,
    notifications: INotification[];
    historiques: IRide[];
    enCours: IRide[];
    currentRide: IRide | null;
    currentRideEtaMs: number | null;
    currentRideRemainingMeters: number | null;
    currentRideEtaUpdatedAt: number | null;
    driverLocation: { latitude: number; longitude: number; heading?: number } | null;
    prices: IPrice[];
    setPrices: (prices: IPrice[]) => void;
    setTok: (tok: string) => void;
    setRefreshTok: (refreshtok: string) => void;
    setIsAuthenticated: (isAuthenticated: boolean) => void;
    setUser: (newUser: IUser) => void;
    setTransaction: (transactions: ITransaction[]) => void;
    setOutOfRange: (data: boolean) => void;
    setPosition: (position: IPosition) => void;
    setFirst: (first: boolean) => void;
    setNotification: (notifications: INotification[]) => void;
    setHistorique: (historiques: IRide[]) => void;
    setEnCours: (enCours: IRide[]) => void;
    setCurrentRide: (ride: IRide | null) => void;
    clearCurrentRide: () => void;
    setRideProgress: (etaMs: number, remainingMeters: number) => void;
    clearRideProgress: () => void;
    setDriverLocation: (loc: { latitude: number; longitude: number; heading?: number } | null) => void;
    setLogout: () => void;
}

const useStore = create<Store>()(
    persist(
        (set) => ({
            tok: "",
            refresh_tok: "",
            isAuthenticated: false,
            user: {
                _id: "",
                role: "",
                phone: "",
                email: "",
                nom: "",
                prenom: "",
                sexe: "",
                birthday: Date.now(),
                pushNotificationToken: "",
                photo: "",
                disabled: false,
                wallet: 0,
                idCard: "",
                verified: false,
                otp: "",
                countryCode: "ci",
                firebaseConfirmation: undefined
            },
            transactions: [],
            outOfRange: false,
            position: {
                longitude: 0,
                latitude: 0,
                address: "",
            },
            first: true,
            notifications: [],
            historiques: [],
            enCours: [],
            currentRide: null,
            currentRideEtaMs: null,
            currentRideRemainingMeters: null,
            currentRideEtaUpdatedAt: null,
            driverLocation: null,
            prices: [],
            setPrices: (prices) => set({ prices }),
            setTok: (tok) => set({ tok }),
            setRefreshTok: (refresh_tok) => set({ refresh_tok }),
            setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
            setUser: (newUser) => set({ user: newUser }),
            setTransaction: (data) => set({ transactions: data }),
            setOutOfRange: (data) => set({ outOfRange: data }),
            setPosition: (position) => set({ position }),
            setFirst: (first) => set({ first }),
            setNotification: (notifications) => set({ notifications }),
            setHistorique: (historiques) => set({ historiques }),
            setEnCours: (enCours) => set({ enCours }),
            setCurrentRide: (ride) => set({ currentRide: ride }),
            clearCurrentRide: () => set({ currentRide: null }),
            setRideProgress: (etaMs, remainingMeters) => set({ currentRideEtaMs: etaMs, currentRideRemainingMeters: remainingMeters, currentRideEtaUpdatedAt: Date.now() }),
            clearRideProgress: () => set({ currentRideEtaMs: null, currentRideRemainingMeters: null, currentRideEtaUpdatedAt: null }),
            setDriverLocation: (loc) => set({ driverLocation: loc }),
            setLogout: () => {
                set({
                    isAuthenticated: false,
                    tok: "",
                    refresh_tok: "",
                    user: {
                        _id: "",
                        role: "",
                        phone: "",
                        email: "",
                        nom: "",
                        prenom: "",
                        sexe: "",
                        birthday: undefined,
                        pushNotificationToken: "",
                        photo: "",
                        disabled: false,
                        wallet: 0,
                        idCard: "",
                        verified: false,
                        otp: "",
                        countryCode: "ci",
                        firebaseConfirmation: undefined
                    },
                    position: {
                        longitude: 0,
                        latitude: 0,
                        address: "",
                    },
                    first: false,
                    notifications: [],
                    historiques: [],
                    enCours: [],
                    currentRide: null,
                    currentRideEtaMs: null,
                    currentRideRemainingMeters: null,
                    currentRideEtaUpdatedAt: null,
                    driverLocation: null,
                    prices: [],
                })
            }
        }),
        {
            name: 'app-storage', // Nom du stockage dans AsyncStorage
            storage: createJSONStorage(() => AsyncStorage),
        }
    )
)

export default useStore;