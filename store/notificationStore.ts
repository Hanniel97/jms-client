// store/notificationStore.ts
import { create } from "zustand";

interface NotificationState {
    pendingRoute: { url: string; id: string } | null;
    setPendingRoute: (route: { url: string; id: string } | null) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    pendingRoute: null,
    setPendingRoute: (route) => set({ pendingRoute: route }),
}));
