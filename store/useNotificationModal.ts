import { create } from 'zustand';


export type NotificationPayload = {
    title: string;
    body: string;
    data?: any;
};


type NotificationModalState = {
    visible: boolean;
    payload: NotificationPayload | null;
    show: (payload: NotificationPayload) => void;
    hide: () => void;
};


export const useNotificationModal = create<NotificationModalState>((set) => ({
    visible: false,
    payload: null,
    show: (payload) => set({ visible: true, payload }),
    hide: () => set({ visible: false, payload: null }),
}));