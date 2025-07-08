import Toast from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info';

export const showToast = (
    type: ToastType,
    title: string,
    message?: string
) => {
    Toast.show({
        type,
        text1: title,
        text2: message,
        position: 'top',
        visibilityTime: 4000,
        autoHide: true,
        topOffset: 30,
    });
};

// raccourcis utiles
export const showSuccess = (message: string, title = 'Succès') =>
    showToast('success', title, message);

export const showError = (message: string, title = 'Erreur') =>
    showToast('error', title, message);

export const showInfo = (message: string, title = 'Info') =>
    showToast('info', title, message);
