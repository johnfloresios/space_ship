import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, PanResponder, Text, Animated } from 'react-native';

interface WheelControlProps {
  onRotate: (direction: 'cw' | 'ccw', deltaAngle: number) => void;
  speedMultiplier: number;
}

export default function WheelControl({ onRotate, speedMultiplier }: WheelControlProps) {
  const rotationRef = useRef(new Animated.Value(0));
  const lastAngleRef = useRef<{ x: number; y: number } | null>(null);
  const accumulatedAngleRef = useRef(0);
  const wheelRotationRef = useRef(0);
  const glowAnimRef = useRef(new Animated.Value(0.3));

  const getAngleFromCenter = (pageX: number, pageY: number) => {
    const centerX = 100; // half of wheel container width
    const centerY = 50;  // half of wheel container height
    return Math.atan2(pageY - centerY, pageX - centerX);
  };

  const handleMove = useCallback((event: any) => {
    const { pageX, pageY } = event.nativeEvent;

    if (!lastAngleRef.current) {
      lastAngleRef.current = { x: pageX, y: pageY };
      return;
    }

    const currentAngle = getAngleFromCenter(pageX, pageY);
    const lastAngle = getAngleFromCenter(lastAngleRef.current.x, lastAngleRef.current.y);
    
    let delta = currentAngle - lastAngle;

    // Handle angle wrapping
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;

    if (Math.abs(delta) > 0.02) {
      const direction: 'cw' | 'ccw' = delta < 0 ? 'cw' : 'ccw';
      accumulatedAngleRef.current += Math.abs(delta);
      wheelRotationRef.current -= delta;

      // Update wheel visual rotation
      Animated.timing(rotationRef.current, {
        toValue: wheelRotationRef.current,
        duration: 0,
        useNativeDriver: true,
      }).start();

      // Glow pulse on rotation
      glowAnimRef.current.setValue(1);
      Animated.timing(glowAnimRef.current, {
        toValue: 0.3,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Throttle rotation events
      if (accumulatedAngleRef.current >= 0.05) {
        onRotate(direction, accumulatedAngleRef.current * 0.3);
        accumulatedAngleRef.current = 0;
      }

      lastAngleRef.current = { x: pageX, y: pageY };
    }
  }, [onRotate]);

  const handleRelease = useCallback(() => {
    lastAngleRef.current = null;
    accumulatedAngleRef.current = 0;
  }, []);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderMove: handleMove,
    onPanResponderRelease: handleRelease,
  })).current;

  // Arrow positions for visual indicators
  const arrowAngles = [0, Math.PI / 3, (2 * Math.PI) / 3, Math.PI, (4 * Math.PI) / 3, (5 * Math.PI) / 3];

  return (
    <View style={styles.container}>
      <View style={styles.wheelContainer}>
        {/* Outer glow ring */}
        <Animated.View
          style={[
            styles.glowRing,
            { opacity: glowAnimRef.current },
          ]}
        />
        
        {/* Wheel track */}
        <View style={styles.wheelTrack}>
          {/* Directional arrows */}
          {arrowAngles.map((angle, i) => {
            const x = Math.cos(angle) * 42;
            const y = Math.sin(angle) * 22;
            const isHighlight = i % 2 === 0;
            return (
              <View
                key={i}
                style={[
                  styles.arrowDot,
                  {
                    left: 50 + x - 4,
                    top: 25 + y - 4,
                    opacity: isHighlight ? 0.8 : 0.3,
                  },
                ]}
              >
                <View style={[styles.arrowDotInner, { backgroundColor: isHighlight ? '#00aaff' : '#334466' }]} />
              </View>
            );
          })}

          {/* Rotating wheel */}
          <Animated.View
            style={[
              styles.wheel,
              { transform: [{ rotate: `${wheelRotationRef.current}rad` }] },
            ]}
          >
            {/* Wheel inner pattern */}
            <View style={styles.wheelInner}>
              {/* Cross lines */}
              <View style={styles.crossH} />
              <View style={styles.crossV} />
              <View style={styles.crossD1} />
              <View style={styles.crossD2} />
              
              {/* Center pivot */}
              <View style={styles.pivot} />
              
              {/* Rotation indicators */}
              <View style={[styles.indicator, { top: 2, alignSelf: 'center' }]}>
                <Text style={styles.indicatorText}>↻</Text>
              </View>
              <View style={[styles.indicator, { bottom: 2, alignSelf: 'center' }]}>
                <Text style={styles.indicatorText}>↺</Text>
              </View>
            </View>
          </Animated.View>

          {/* Touch overlay for wheel */}
          <View
            style={styles.touchOverlay}
            {...panResponder.panHandlers}
          />
        </View>

        {/* Speed indicator */}
        <View style={styles.speedDisplay}>
          <Text style={styles.speedLabel}>SPEED</Text>
          <Text style={styles.speedValue}>x{speedMultiplier.toFixed(1)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 120,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelContainer: {
    position: 'relative',
    width: 200,
    height: 100,
    alignItems: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 180,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#0088ff',
    shadowColor: '#0088ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  wheelTrack: {
    position: 'relative',
    width: 100,
    height: 50,
  },
  wheel: {
    width: 84,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#0066cc',
    backgroundColor: 'rgba(0, 50, 100, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    left: 8,
    top: 3,
  },
  wheelInner: {
    width: 70,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  crossH: {
    position: 'absolute',
    width: 60,
    height: 1,
    backgroundColor: '#004488',
  },
  crossV: {
    position: 'absolute',
    width: 1,
    height: 20,
    backgroundColor: '#004488',
  },
  crossD1: {
    position: 'absolute',
    width: 50,
    height: 0.5,
    backgroundColor: '#003366',
    transform: [{ rotate: '45deg' }],
  },
  crossD2: {
    position: 'absolute',
    width: 50,
    height: 0.5,
    backgroundColor: '#003366',
    transform: [{ rotate: '-45deg' }],
  },
  pivot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00aaff',
    borderWidth: 1,
    borderColor: '#0066cc',
  },
  indicator: {
    position: 'absolute',
    width: 16,
    height: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorText: {
    color: '#00aaff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  touchOverlay: {
    ...StyleSheet.absoluteFill as any,
    width: 100,
    height: 50,
    zIndex: 10,
  },
  arrowDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  arrowDotInner: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  speedDisplay: {
    position: 'absolute',
    right: 0,
    bottom: -5,
    alignItems: 'center',
  },
  speedLabel: {
    color: '#0066aa',
    fontSize: 8,
    letterSpacing: 2,
  },
  speedValue: {
    color: '#00ccff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
