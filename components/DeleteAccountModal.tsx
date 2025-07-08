import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Dimensions, Image } from 'react-native';

interface DeleteAccountModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
    visible,
    onClose,
    onConfirm,
}) => {
    return (
        <Modal
            animationType="fade"
            transparent
            visible={visible}
            onRequestClose={onClose}
        >
            <View style={[styles.overlay, {}]}>
                <View style={styles.modalContainer}>
                    <Image
                        source={require("../assets/images/downcast-face.png")}
                        className="w-24 h-24 mb-4 self-center rounded-full border-4 border-primary"
                    />

                    <Text className="text-lg font-['RubikBold'] text-center text-black dark:text-white mb-2">
                        Supprimer le compte ?
                    </Text>

                    <Text className="text-sm text-center text-gray-700 dark:text-gray-300 mb-6 font-['RubikRegular']">
                        Cette action est irréversible. Êtes-vous sûr de vouloir supprimer votre compte ?
                    </Text>

                    <View className="flex-row justify-between">
                        <Pressable
                            onPress={onClose}
                            className="flex-1 mr-2 items-center justify-center bg-primary dark:bg-gray-700 px-4 py-3 rounded-full"
                        >
                            <Text className="text-white font-['RubikMedium']">Non</Text>
                        </Pressable>

                        <Pressable
                            onPress={onConfirm}
                            className="flex-1 ml-2 items-center justify-center bg-green-600 px-4 py-3 rounded-full"
                        >
                            <Text className="text-white font-['RubikMedium']">Oui</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default DeleteAccountModal;

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.3)', // assombrit tout l'écran
        justifyContent: 'center',
        alignItems: 'center',
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 10,
        padding: 30,
        width: '85%',
    },
});
