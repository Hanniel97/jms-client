import { create as createZustand } from 'zustand';


export type BannerPayload = {
    title: string;
    body?: string;
    data?: any; // ex: { type: 'RIDE_STATUS', url?: string, id?: string }
};


type TopBannerState = {
    queue: BannerPayload[];
    current: BannerPayload | null;
    visible: boolean;
    show: (payload: BannerPayload) => void;
    hide: () => void;
    clear: () => void;
};


export const useTopBanner = createZustand<TopBannerState>((set, get) => ({
    queue: [],
    current: null,
    visible: false,
    show: (payload) => {
        const { visible, current, queue } = get();
        if (visible || current) {
            set({ queue: [...queue, payload] });
        } else {
            set({ current: payload, visible: true });
        }
    },
    hide: () => {
        const { queue } = get();
        if (queue.length > 0) {
            const [next, ...rest] = queue;
            set({ current: next, queue: rest, visible: true });
        } else {
            set({ current: null, visible: false });
        }
    },
    clear: () => set({ queue: [], current: null, visible: false }),
}));