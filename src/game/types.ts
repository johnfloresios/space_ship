export interface ObstacleData {
  id: number;
  angle: number;       // angle around the tunnel (radians)
  z: number;           // position along tunnel z-axis
  width: number;       // arc width of obstacle
  height: number;      // height from tunnel wall
  type: 'bar' | 'block' | 'diamond';
  passed: boolean;
}

export interface StarFieldData {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}

export interface GameConfig {
  tunnelRadius: number;
  tunnelLength: number;
  tunnelSegments: number;
  shipSpeed: number;
  shipRotationSpeed: number;
  obstacleSpawnRate: number;    // per second
  obstacleSpeed: number;
  maxObstacles: number;
  shipCollisionRadius: number;
}

export interface GameState {
  isRunning: boolean;
  isGameOver: boolean;
  score: number;
  highScore: number;
  speedMultiplier: number;
  distance: number;
}
