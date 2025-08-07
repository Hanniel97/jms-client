import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import useStore from '@/store/useStore';

export default function IndexPage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const { isAuthenticated } = useStore();


  // Animations
  const jOpacity = useRef(new Animated.Value(0)).current;
  const mOpacity = useRef(new Animated.Value(0)).current;
  const sOpacity = useRef(new Animated.Value(0)).current;
  const jTranslate = useRef(new Animated.Value(20)).current;
  const mTranslate = useRef(new Animated.Value(20)).current;
  const sTranslate = useRef(new Animated.Value(20)).current;
  const taxiOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) return;

    Animated.sequence([
      Animated.parallel([
        Animated.timing(jOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(jTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
      ]),
      Animated.parallel([
        Animated.timing(mOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(mTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
      ]),
      Animated.parallel([
        Animated.timing(sOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sTranslate, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
          easing: Easing.out(Easing.exp),
        }),
      ]),
      Animated.timing(taxiOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Après animation
      setTimeout(() => {
        setLoading(false);
        if (isAuthenticated) {
          router.replace("/(tabs)")
        } else {
          router.replace("/(auth)/phonecheck")
        }
      }, 1000); // Petit délai de pause visuelle
    });
  }, [isAuthenticated, jOpacity, jTranslate, loading, mOpacity, mTranslate, router, sOpacity, sTranslate, taxiOpacity]);

  if (!loading) return null;

  return (
    <View style={styles.container}>
      <View style={styles.jmsBlock}>
        <View style={styles.jmsRow}>
          <Animated.Text
            style={[
              styles.letter,
              { opacity: jOpacity, transform: [{ translateX: jTranslate }] },
            ]}
          >
            J
          </Animated.Text>
          <Animated.Text
            style={[
              styles.letter,
              { opacity: mOpacity, transform: [{ translateX: mTranslate }] },
            ]}
          >
            M
          </Animated.Text>
          <Animated.Text
            style={[
              styles.letter,
              { opacity: sOpacity, transform: [{ translateX: sTranslate }] },
            ]}
          >
            S
          </Animated.Text>
        </View>

        <Animated.Text style={[styles.taxi, { opacity: taxiOpacity }]}>
          Taxi
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FF6D00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  jmsBlock: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jmsRow: {
    flexDirection: 'row',
  },
  letter: {
    fontSize: 100,
    // fontWeight: 'bold',
    color: '#fff',
    fontFamily: 'RubikBold',
    marginHorizontal: 4,
  },
  taxi: {
    position: 'absolute',
    bottom: -30,
    right: 0,
    fontSize: 38,
    color: '#fff',
    fontFamily: 'RubikBold',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
    fontWeight: '600',
  },
});
