import axios from 'axios';
import { apiUrl } from './api';
import useStore from '@/store/useStore';
import { logout } from './authService';

export const refresh_tokens = async () => {
    // ✅ Récupérer le store en dehors d'un hook
    const refresh_tok = useStore.getState().refresh_tok;

    try {
        const response = await axios.post(
            `${apiUrl}refresh-token`,
            { refresh_token: refresh_tok },
            { headers: { "Content-Type": "application/json" } } // ✅ Ajout Content-Type
        );

        // console.log("check 3", response);

        const new_access_token = response.data.access_token;
        const new_refresh_token = response.data.refresh_token;

        // ✅ Mettre à jour Zustand sans `useStore()`
        useStore.getState().setTok(new_access_token);
        useStore.getState().setRefreshTok(new_refresh_token);

        return new_access_token;
    } catch (error) {
        console.log(error)
        logout();
    }
};

export const appAxios = axios.create({
    baseURL: apiUrl,
})

appAxios.interceptors.request.use(async config => {
    const accessToken = useStore().tok;
    if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
    };
    return config;
})

appAxios.interceptors.response.use(
    response => response,
    async error => {
        if (error.response && error.response.status === 401) {
            try {
                const newAccessToken = await refresh_tokens();
                error.config.headers.Authorization = 'Bearer ' + newAccessToken;
                return axios(error.config)
            } catch (error) {
                console.log("Error refreshing token: ", error)
            }

        }
        return Promise.reject(error);
    }
)