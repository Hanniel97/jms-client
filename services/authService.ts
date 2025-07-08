/* eslint-disable react-hooks/rules-of-hooks */
import useStore from "@/store/useStore";

export const logout = async (disconnect?: () => void) => {
    if(disconnect){
        disconnect();
    }
    useStore().setLogout();
}