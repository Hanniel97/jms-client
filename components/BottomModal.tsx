import React from 'react';
import { Pressable, Text, View } from 'react-native';
import Modal from 'react-native-modal';

interface BottomModalProps {
    visible: boolean;
    onClose: () => void;
    onFirstAction?: () => void;
    onSecondAction?: () => void;
    content?: React.ReactNode;
    title?: string;
    description?: string;
}

const BottomModal: React.FC<BottomModalProps> = ({
    visible,
    onClose,
    onFirstAction,
    onSecondAction,
    content,
    title = "Nouveau numéro ?",
    description = "Ceci est une description brève de l’action à effectuer."
}) => {
    return (
        <Modal
            isVisible={visible}
            onBackdropPress={onClose}
            onBackButtonPress={onClose}
            useNativeDriver
            style={{ justifyContent: 'flex-end', margin: 0 }}
        >
            <View className="bg-white rounded-t-3xl p-5">
                {/* Fermer en haut à droite */}
                <View className="flex-row justify-end">
                    <Pressable onPress={onClose}>
                        <Text className="text-gray-400 text-xl font-['RubikBold']">✕</Text>
                    </Pressable>
                </View>

                {/* Contenu */}
                <Text className="text-xl font-['RubikBold'] text-black dark:text-white mt-2">{title}</Text>
                <Text className="text-sm text-gray-500 dark:text-gray-300 mt-1 mb-6 font-['RubikRegular']">{description}</Text>

                {content}
            </View>
        </Modal>
    );
};

export default BottomModal;
