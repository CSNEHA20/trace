import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';

interface AnimatedSplashScreenProps {
  onFinish?: () => void;
}

const { width, height } = Dimensions.get('window');

export function AnimatedSplashScreen({ onFinish }: AnimatedSplashScreenProps) {
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulseAura = useRef(new Animated.Value(1)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(16)).current;
  const badgeOpacity = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;

  const [statusText, setStatusText] = useState('Initializing Air-Gapped Secure Vault...');
  const [isFinished, setIsFinished] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAura, {
          toValue: 1.15,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAura, {
          toValue: 1.0,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 450,
          useNativeDriver: true,
        }),
        Animated.timing(textTranslateY, {
          toValue: 0,
          duration: 450,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 1400,
      useNativeDriver: false,
    }).start();

    const timer1 = setTimeout(() => {
      setStatusText('Validating Cryptographic Hash Chains...');
    }, 600);

    const timer2 = setTimeout(() => {
      setStatusText('100% On-Device · Privacy-First');
    }, 1100);

    const exitTimer = setTimeout(() => {
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }).start(() => {
        pulseLoop.stop();
        setIsFinished(true);
        if (onFinish) {
          onFinish();
        }
      });
    }, 1650);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(exitTimer);
      pulseLoop.stop();
    };
  }, []);

  if (isFinished) {
    return null;
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: containerOpacity,
        },
      ]}
      pointerEvents={isFinished ? 'none' : 'auto'}
    >
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.glowAura,
            {
              transform: [{ scale: pulseAura }],
            },
          ]}
        />

        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.textContainer,
            {
              opacity: textOpacity,
              transform: [{ translateY: textTranslateY }],
            },
          ]}
        >
          <Text style={styles.titleText}>TRACE</Text>
          <Text style={styles.taglineText}>
            Tamper-Resistant AI Case Evidence
          </Text>
        </Animated.View>

        <Animated.View style={[styles.badgeContainer, { opacity: badgeOpacity }]}>
          <View style={styles.badge}>
            <View style={styles.statusDot} />
            <Text style={styles.badgeText}>
              ZERO CLOUD · 100% ON-DEVICE FORENSICS
            </Text>
          </View>
        </Animated.View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBarBackground}>
            <Animated.View
              style={[styles.progressBarFill, { width: progressWidth }]}
            />
          </View>
          <Text style={styles.statusText}>{statusText}</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 99999,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    width: '100%',
  },
  glowAura: {
    position: 'absolute',
    top: height * 0.18,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(20, 114, 214, 0.08)',
  },
  logoContainer: {
    width: 140,
    height: 140,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#0052FF',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  logoImage: {
    width: 130,
    height: 130,
    borderRadius: 24,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  titleText: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
    color: '#0D1B2A',
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-black',
    marginBottom: 6,
  },
  taglineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#415A77',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  badgeContainer: {
    marginBottom: 36,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 114, 214, 0.08)',
    borderColor: 'rgba(20, 114, 214, 0.22)',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0066FF',
    marginRight: 6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: '#0052FF',
  },
  progressContainer: {
    width: width * 0.55,
    alignItems: 'center',
  },
  progressBarBackground: {
    width: '100%',
    height: 3,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#0066FF',
    borderRadius: 2,
  },
  statusText: {
    fontSize: 11,
    color: '#8D99AE',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
});
