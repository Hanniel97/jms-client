import useStore from "@/store/useStore";
// import { GOOGLE_API_KEY } from '@env';

// import { Platform } from "react-native";

export const GOOGLE_API_KEY = "AIzaSyB6_OxzEd6VT4yqdW2zS0wjT7Gc6w9xxTw";

const test: boolean = __DEV__;

export const apiUrl: string = test ?
    "http://192.168.100.14:5000/api/"
    :
    "https://jms-tansport-backend.onrender.com/api/"

export const socketUrl: string = test ?
    "http://192.168.100.14:5000"
    :
    "https://jms-tansport-backend.onrender.com"

export const photoUrl: string = test ?
    "http://192.168.100.14:5000/"
    :
    "https://jms-tansport-backend.onrender.com/"

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

interface RequestOptions {
    method?: Method;
    endpoint: string;
    data?: any;
    token?: string;
    headers?: Record<string, string>;
    retry?: boolean;
    silentSuccess?: boolean;
}

export const apiRequest = async <T = any>({
    method = 'GET',
    endpoint,
    data,
    token,
    headers = {},
    retry = true,
}: RequestOptions): Promise<T> => {
    const url = `${apiUrl}${endpoint}`;
    const store = useStore.getState();

    const config: RequestInit = {
        method,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
        },
    };

    if (data && method !== 'GET') {
        config.body = JSON.stringify(data);
    }

    const response = await fetch(url, config);
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');
    const responseData = isJson ? await response.json() : await response.text();

    if (response.status === 401 && retry && store.refresh_tok) {
        try {
            // Rafraîchir le token
            const refreshRes = await fetch(`${apiUrl}/refresh-token`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ refresh_token: store.refresh_tok }),
            });

            const refreshData = await refreshRes.json();

            if (!refreshRes.ok) {
                // store.setLogout();
                throw new Error(refreshData.message || 'Session expirée');
            }

            store.setTok(refreshData.token);
            return await apiRequest({
                method,
                endpoint,
                data,
                token: refreshData.token,
                headers,
                retry: false, // ne pas re-réessayer encore
            });
        } catch (err) {
            console.error('Refresh failed:', err);
            throw err;
        }
    }

    // if (!response.ok) {
    //     throw new Error(
    //         responseData?.message || `Erreur ${response.status}: ${response.statusText}`
    //     );
    // }

    // if (['POST', 'PUT', 'DELETE'].includes(method) && responseData.success === true) {
    //     showSuccess(responseData.message);
    // }

    // if (['POST', 'PUT', 'DELETE'].includes(method) && responseData.success === false) {
    //     showError(responseData.message);
    // }

    // console.log('Main', responseData)

    return responseData;
};

// interface PlaceSuggestion {
//     description: string;
//     place_id: string;
//     structured_formatting?: {
//         main_text: string;
//         secondary_text: string;
//     };
// }

export interface Coordinates {
    latitude: number;
    longitude: number;
    address: string;
}

export const searchPlaces = async (text: string) => {
    if (text.length < 3) return [];

    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
                text
            )}&key=${GOOGLE_API_KEY}&language=fr&components=country:bj`
        );

        const json = await res.json();

        // console.log(json)
        return Array.isArray(json.predictions) ? json.predictions : [];
    } catch (error) {
        console.error("Erreur API Google Autocomplete :", error);
        return [];
    }
};

export const getPlaceDetails = async (placeId: string): Promise<Coordinates | null> => {
    try {
        const res = await fetch(
            `https://maps.googleapis.com/maps/api/place/details/json?placeid=${placeId}&key=${GOOGLE_API_KEY}`
        );

        const json = await res.json();

        // console.log(json)

        if (json.status !== 'OK' || !json.result?.geometry?.location) {
            return null;
        }

        const location = json.result.geometry.location;
        const address = json.result.formatted_address;

        return {
            latitude: location.lat,
            longitude: location.lng,
            address,
        };
    } catch (error) {
        console.error('Erreur API Google Place Details :', error);
        return null;
    }
};