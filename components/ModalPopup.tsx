import React, {useEffect, useCallback, useState, useRef, JSX,} from 'react';
import { StyleSheet, View, Animated, Modal } from 'react-native';

export interface Props {
    visible: boolean,
    children: JSX.Element
}

export const ModalPopup = ({visible, children}: Props) => {

    const [showModal, setShowModal] = useState(visible);
    const scaleValue = useRef(new Animated.Value(0)).current;

    const toggleModal = useCallback(() => {
        if (visible) {
            setShowModal(true);
            Animated.spring(scaleValue, {
                toValue: 1,
                // duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            setTimeout(() => setShowModal(false), 200);
            Animated.timing(scaleValue, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [scaleValue, visible]) ;

    useEffect(() => {
        toggleModal();
    }, [toggleModal, visible]);

    return (
        <Modal transparent visible={showModal}>
            <View style={[styles.modalBackGround, {backgroundColor: 'rgba(0, 0, 0, 0.3)', }]}>
                <Animated.View
                    style={[styles.modalContainer, {transform: [{scale: scaleValue}], backgroundColor: 'white'}]}>
                    {children}
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBackGround: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContainer: {
        width: '90%',
        backgroundColor: 'white',
        paddingHorizontal: 10,
        paddingVertical: 15,
        borderRadius: 10,
        elevation: 20,
    },
    header: {
        width: '100%',
        // height: 40,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
});