import { IUser, INotification, IPosition, ITransaction, IRide } from "@/types";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const AsyncStore = {
    getItem: async (key: string) => {
        const value = await AsyncStorage.getItem(key);
        return value ? JSON.parse(value) : null;
    },
    setItem: async (key: string, value: any) => {
        await AsyncStorage.setItem(key, JSON.stringify(value));
    },
    removeItem: async (key: string) => {
        await AsyncStorage.removeItem(key);
    },
};

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
    setTok: (tok: string) => void;
    setRefreshTok: (refreshtok: string) => void;
    setIsAuthenticated: (isAuthenticated: boolean) => void;
    setUser: (newUser: IUser) => void;
    setTransaction: (transactions: ITransaction) => void;
    setOutOfRange: (data: boolean) => void;
    setPosition: (position: IPosition) => void;
    setFirst: (first: boolean) => void;
    setNotification: (notifications: INotification[]) => void;
    setHistorique: (historiques: IRide[]) => void;
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
                otp: ""
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
                        otp: ""
                    },
                    position: {
                        longitude: 0,
                        latitude: 0,
                        address: "",
                    },
                    first: false,
                    notifications: [],
                    historiques: [],
                })
            }
        }),
        {
            name: 'app-storage', // Nom du stockage dans AsyncStorage
            storage: AsyncStore, // Utilisation d'AsyncStorage
        }
    )
)

export default useStore;