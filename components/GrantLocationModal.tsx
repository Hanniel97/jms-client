import React from 'react';
import { Dimensions, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface GrantLocationModalProps {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

const GrantLocationModal: React.FC<GrantLocationModalProps> = ({
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
                        source={require("../assets/images/location.png")}
                        className="w-24 h-24 mb-4 self-center rounded-full border-4 border-primary"
                    />

                    <Text className="text-lg font-['RubikBold']text-center text-black dark:text-white mb-2">
                        Activer la localisation
                    </Text>

                    <Text className="text-sm text-center text-gray-700 dark:text-gray-300 mb-6 font-['RubikRegular']">
                        Autoriser cette application à accéder à votre localisation.
                    </Text>

                    <View className="justify-center items-center gap-y-3">
                        <Pressable
                            onPress={onConfirm}
                            className="flex-1 items-center w-full justify-center bg-primary dark:bg-gray-700 px-4 py-3 rounded-lg"
                        >
                            <Text className="text-white font-['RubikMedium']">Utiliser ma localisation</Text>
                        </Pressable>

                        <Pressable
                            onPress={onClose}
                            className="flex-1 items-center w-full justify-center bg-gray-400 px-4 py-3 rounded-lg"
                        >
                            <Text className="text-white font-['RubikMedium']">Passer pour l'instant</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

export default GrantLocationModal;

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
