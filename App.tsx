import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import GameScreen from './src/game/GameScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <GameScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000011',
  },
});
