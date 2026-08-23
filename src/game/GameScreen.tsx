import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Vibration,
  Animated,
  Easing,
} from 'react-native';
import GameScene from './GameScene';
import WheelControl from './WheelControl';
import { gameManager } from './GameManager';

const { width, height } = Dimensions.get('window');

// High score storage
const HIGH_SCORE_KEY = '__spaceShipHighScore';

function getHighScore(): number {
  try {
    const saved = (globalThis as Record<string, unknown>)[HIGH_SCORE_KEY];
    return (saved as number) ?? 0;
  } catch {
    return 0;
  }
}

function setHighScore(value: number): void {
  try {
    (globalThis as Record<string, unknown>)[HIGH_SCORE_KEY] = value;
  } catch {
    // ignore
  }
}

export default function GameScreen() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [score, setScore] = useState(0);
  const [highScore, setHighScoreState] = useState(getHighScore());
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [showTutorial, setShowTutorial] = useState(true);

  const startAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(startAnimation, {
          toValue: 1,
          duration: 8000,
          useNativeDriver: true,
          easing: Easing.linear,
        }),
      ])
    ).start();
  }, [startAnimation]);

  const handleStart = useCallback(() => {
    setGameState('playing');
    setShowTutorial(false);
    setScore(0);
    gameManager.start();
  }, []);

  const handleGameOver = useCallback(() => {
    Vibration.vibrate([100, 50, 100, 50, 200]);
    const finalScore = gameManager.state.score;
    const currentHigh = getHighScore();
    const newHigh = Math.max(finalScore, currentHigh);
    setHighScoreState(newHigh);
    setHighScore(newHigh);
    setGameState('gameover');
  }, []);

  // Poll score
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      setScore(gameManager.state.score);
      setSpeedMultiplier(gameManager.state.speedMultiplier);
      if (gameManager.state.isGameOver) {
        handleGameOver();
      }
    }, 150);
    return () => clearInterval(interval);
  }, [gameState, handleGameOver]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" hidden />

      {/* Animated Star Background */}
      <StarBackground animatedValue={startAnimation} />

      {/* 3D Game Scene */}
      {gameState === 'playing' && (
        <GameScene
          onGameOver={handleGameOver}
          score={score}
          speedMultiplier={speedMultiplier}
        />
      )}

      {/* HUD */}
      {gameState === 'playing' && <HUD score={score} highScore={highScore} speed={speedMultiplier} />}

      {/* Menu */}
      {gameState === 'menu' && <MenuScreen onStart={handleStart} highScore={highScore} />}

      {/* Game Over */}
      {gameState === 'gameover' && (
        <GameOverScreen score={score} highScore={highScore} onRetry={handleStart} onMenu={() => setGameState('menu')} />
      )}

      {/* Wheel Control */}
      {gameState === 'playing' && (
        <WheelControl
          onRotate={(dir, delta) => gameManager.rotateShip(dir, delta)}
          speedMultiplier={speedMultiplier}
        />
      )}
    </View>
  );
}

// Animated starfield background component
function StarBackground({ animatedValue }: { animatedValue: Animated.Value }) {
  const stars = useRef(
    Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
    }))
  ).current;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={styles.bgGradient} />
      {stars.map((star: { x: number; y: number; size: number }, i: number) => {
        const translateY = animatedValue.interpolate({
          inputRange: [0, 1],
          outputRange: [star.y - height, star.y + height],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.star,
              {
                left: star.x,
                width: star.size,
                height: star.size,
                opacity: 0.3 + (i % 5) * 0.1,
                transform: [{ translateY }],
              },
            ]}
          />
        );
      })}
      
      {/* Tunnel perspective rings */}
      <View style={styles.tunnelRings}>
        {[...Array(5)].map((_, i) => (
          <Animated.View
            key={`ring-${i}`}
            style={[
              styles.tunnelRing,
              {
                width: 100 + i * 60,
                height: 50 + i * 30,
                borderWidth: 1,
                borderColor: `rgba(0, 100, 255, ${0.15 - i * 0.02})`,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// Menu screen component
function MenuScreen({ onStart, highScore }: { onStart: () => void; highScore: number }) {
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 40,
      friction: 8,
    }).start();
  }, [scaleAnim]);

  return (
    <Animated.View style={[styles.menuOverlay, { transform: [{ scale: scaleAnim }] }]}>
      <View style={styles.menuContent}>
        <Text style={styles.title}>SPACE</Text>
        <Text style={styles.titleAccent}>TUNNEL</Text>
        <Text style={styles.subtitle}>RUNNER</Text>

        {highScore > 0 && (
          <View style={styles.highScoreBadge}>
            <Text style={styles.highScoreIcon}>🏆</Text>
            <Text style={styles.highScoreText}>BEST: {highScore}</Text>
          </View>
        )}

        <TouchableOpacity style={styles.startButton} onPress={onStart} activeOpacity={0.8}>
          <Text style={styles.startButtonText}>🚀 LAUNCH</Text>
        </TouchableOpacity>

        <View style={styles.tutorialBox}>
          <Text style={styles.tutorialTitle}>HOW TO PLAY</Text>
          <View style={styles.tutorialRow}>
            <Text style={styles.tutorialIcon}>👆</Text>
            <Text style={styles.tutorialText}>Drag the wheel to steer</Text>
          </View>
          <View style={styles.tutorialRow}>
            <Text style={styles.tutorialIcon}>🔄</Text>
            <Text style={styles.tutorialText}>Clockwise & counter-clockwise</Text>
          </View>
          <View style={styles.tutorialRow}>
            <Text style={styles.tutorialIcon}>⚡</Text>
            <Text style={styles.tutorialText}>Avoid the red obstacles!</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

// Game over screen component
function GameOverScreen({
  score,
  highScore,
  onRetry,
  onMenu,
}: {
  score: number;
  highScore: number;
  onRetry: () => void;
  onMenu: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 30,
        friction: 10,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, opacityAnim]);

  const isNewBest = score >= highScore && score > 0;

  return (
    <Animated.View
      style={[
        styles.gameOverOverlay,
        { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={styles.gameOverTitle}>CRASHED!</Text>
      
      <View style={styles.scoreCard}>
        <Text style={styles.scoreCardLabel}>SCORE</Text>
        <Animated.Text style={[styles.scoreCardValue, { opacity: opacityAnim }]}>
          {score}
        </Animated.Text>
        
        {isNewBest && (
          <Animated.View style={{ opacity: opacityAnim }}>
            <Text style={styles.newHighScore}>🏆 NEW BEST!</Text>
          </Animated.View>
        )}
        
        <View style={styles.divider} />
        
        <Text style={styles.scoreCardLabel}>BEST</Text>
        <Animated.Text style={[styles.highScoreValue, { opacity: opacityAnim }]}>
          {highScore}
        </Animated.Text>
      </View>

      <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
        <Text style={styles.retryButtonText}>🔄 RETRY</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.menuButton} onPress={onMenu} activeOpacity={0.8}>
        <Text style={styles.menuButtonText}>MENU</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

// HUD overlay
function HUD({ score, highScore, speed }: { score: number; highScore: number; speed: number }) {
  return (
    <View style={styles.hudContainer}>
      <View style={styles.hudLeft}>
        <Text style={styles.hudLabel}>SCORE</Text>
        <Text style={styles.hudValue}>{score}</Text>
      </View>
      
      <View style={styles.hudCenter}>
        <View style={styles.speedMeter}>
          <View style={[styles.speedFill, { width: Math.min(speed * 35, 70) }]} />
          <Text style={styles.speedText}>{speed.toFixed(1)}x</Text>
        </View>
      </View>
      
      <View style={styles.hudRight}>
        <Text style={styles.hudLabel}>BEST</Text>
        <Text style={styles.hudValue}>{highScore}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000011',
  },
  bgGradient: {
    ...StyleSheet.absoluteFill as any,
    backgroundColor: '#000011',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#ffffff',
    borderRadius: 999,
  },
  tunnelRings: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tunnelRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 80, 200, 0.1)',
  },
  menuOverlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 17, 0.75)',
  },
  menuContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    color: '#00aaff',
    textShadowColor: '#0044aa',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    letterSpacing: 4,
  },
  titleAccent: {
    fontSize: 52,
    fontWeight: '900',
    color: '#00ddff',
    textShadowColor: '#0088ff',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    letterSpacing: 6,
    marginTop: -5,
  },
  subtitle: {
    fontSize: 22,
    fontWeight: '300',
    color: '#0066aa',
    letterSpacing: 10,
    marginTop: 5,
  },
  highScoreBadge: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#ffaa00',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 170, 0, 0.1)',
  },
  highScoreIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  highScoreText: {
    color: '#ffaa00',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 2,
  },
  startButton: {
    marginTop: 40,
    paddingHorizontal: 50,
    paddingVertical: 18,
    backgroundColor: '#0066ff',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#00aaff',
    shadowColor: '#0066ff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  startButtonText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 5,
  },
  tutorialBox: {
    marginTop: 35,
    backgroundColor: 'rgba(0, 40, 80, 0.5)',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(0, 100, 200, 0.25)',
    maxWidth: 280,
  },
  tutorialTitle: {
    color: '#00aaff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 3,
  },
  tutorialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  tutorialIcon: {
    fontSize: 14,
    marginRight: 8,
    width: 20,
  },
  tutorialText: {
    color: '#88bbdd',
    fontSize: 13,
  },
  gameOverOverlay: {
    ...StyleSheet.absoluteFill as any,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 0, 0, 0.85)',
  },
  gameOverTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ff2200',
    textShadowColor: '#ff0000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    letterSpacing: 4,
  },
  scoreCard: {
    marginTop: 25,
    backgroundColor: 'rgba(30, 10, 10, 0.7)',
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 50, 0, 0.3)',
    alignItems: 'center',
    minWidth: 210,
  },
  scoreCardLabel: {
    color: '#886666',
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
  },
  scoreCardValue: {
    color: '#ff4400',
    fontSize: 44,
    fontWeight: '900',
    marginVertical: 6,
  },
  newHighScore: {
    color: '#ffaa00',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
    letterSpacing: 2,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: 'rgba(255, 50, 0, 0.2)',
    marginVertical: 12,
  },
  highScoreValue: {
    color: '#ffaa00',
    fontSize: 32,
    fontWeight: '800',
  },
  retryButton: {
    marginTop: 28,
    paddingHorizontal: 45,
    paddingVertical: 15,
    backgroundColor: '#ff2200',
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#ff4400',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 4,
  },
  menuButton: {
    marginTop: 12,
    paddingHorizontal: 25,
    paddingVertical: 8,
  },
  menuButtonText: {
    color: '#888888',
    fontSize: 13,
    letterSpacing: 3,
  },
  hudContainer: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    zIndex: 100,
  },
  hudLeft: { alignItems: 'flex-start' },
  hudCenter: { alignItems: 'center' },
  hudRight: { alignItems: 'flex-end' },
  hudLabel: {
    color: '#0066aa',
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: '600',
  },
  hudValue: {
    color: '#00ccff',
    fontSize: 26,
    fontWeight: '800',
  },
  speedMeter: {
    width: 70,
    height: 3,
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  speedFill: {
    height: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 2,
  },
  speedText: {
    color: '#00ff88',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
