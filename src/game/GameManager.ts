import { ObstacleData, GameConfig, GameState } from './types';

const DEFAULT_CONFIG: GameConfig = {
  tunnelRadius: 4,
  tunnelLength: 100,
  tunnelSegments: 60,
  shipSpeed: 8,
  shipRotationSpeed: 2.5,
  obstacleSpawnRate: 0.8,
  obstacleSpeed: 10,
  maxObstacles: 15,
  shipCollisionRadius: 0.6,
};

export class GameManager {
  config: GameConfig;
  state: GameState;
  shipAngle: number = 0;
  shipTargetAngle: number = 0;
  obstacles: ObstacleData[] = [];
  private nextObstacleId: number = 0;
  private lastSpawnTime: number = 0;
  private lastFrameTime: number = 0;
  private animFrameId: number | null = null;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.state = {
      isRunning: false,
      isGameOver: false,
      score: 0,
      highScore: 0,
      speedMultiplier: 1,
      distance: 0,
    };
    this.lastFrameTime = performance.now();
  }

  start() {
    this.state = {
      isRunning: true,
      isGameOver: false,
      score: 0,
      highScore: this.state.highScore,
      speedMultiplier: 1,
      distance: 0,
    };
    this.obstacles = [];
    this.shipAngle = 0;
    this.shipTargetAngle = 0;
    this.nextObstacleId = 0;
    this.lastSpawnTime = 0;
    this.lastFrameTime = performance.now();
    this.gameLoop();
  }

  stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.state.isRunning = false;
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }
  }

  gameLoop = () => {
    const now = performance.now();
    const dt = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    this.update(dt);
    this.animFrameId = requestAnimationFrame(this.gameLoop);
  };

  update(dt: number) {
    if (!this.state.isRunning) return;

    // Increase difficulty over time
    this.state.speedMultiplier = 1 + this.state.distance * 0.002;
    this.state.distance += this.config.shipSpeed * dt * this.state.speedMultiplier;
    this.state.score = Math.floor(this.state.distance / 5);

    // Smooth ship angle interpolation
    this.shipAngle += (this.shipTargetAngle - this.shipAngle) * Math.min(1, dt * 8);

    // Spawn obstacles
    this.lastSpawnTime += dt;
    const spawnInterval = 1 / (this.config.obstacleSpawnRate * this.state.speedMultiplier);
    if (this.lastSpawnTime >= spawnInterval && this.obstacles.length < this.config.maxObstacles) {
      this.spawnObstacle();
      this.lastSpawnTime = 0;
    }

    // Update obstacles
    const speed = this.config.obstacleSpeed * this.state.speedMultiplier;
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.z += speed * dt;

      // Check if obstacle has passed the ship (for scoring)
      if (!obs.passed && obs.z > 2) {
        obs.passed = true;
      }

      // Check collision
      if (this.checkCollision(obs)) {
        this.gameOver();
        return;
      }

      // Remove obstacles that have passed
      if (obs.z > 20) {
        this.obstacles.splice(i, 1);
      }
    }
  }

  spawnObstacle() {
    const zStart = -50;
    const types: ObstacleData['type'][] = ['bar', 'block', 'diamond'];
    const type = types[Math.floor(Math.random() * types.length)];

    // Obstacle position around the tunnel
    const angle = Math.random() * Math.PI * 2;
    
    let width: number;
    let height: number;

    switch (type) {
      case 'bar':
        // Thin bar - player must go around it
        width = 0.3 + Math.random() * 0.4;
        height = 0.1;
        break;
      case 'block':
        // Wide block - player must dodge
        width = 0.8 + Math.random() * 0.8;
        height = 0.5 + Math.random() * 0.8;
        break;
      case 'diamond':
        // Medium diamond pattern
        width = 0.5 + Math.random() * 0.5;
        height = 0.4 + Math.random() * 0.5;
        break;
    }

    this.obstacles.push({
      id: this.nextObstacleId++,
      angle,
      z: zStart,
      width,
      height,
      type,
      passed: false,
    });
  }

  checkCollision(obs: ObstacleData): boolean {
    // Normalize angles to 0-2PI range
    let shipAng = this.shipAngle % (Math.PI * 2);
    if (shipAng < 0) shipAng += Math.PI * 2;
    
    let obsAng = obs.angle % (Math.PI * 2);
    if (obsAng < 0) obsAng += Math.PI * 2;

    // Calculate angular distance (shortest path around circle)
    let angleDiff = Math.abs(shipAng - obsAng);
    if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

    // Check if ship is within collision zone along z-axis
    const zCollisionZone = 2.5;
    const zHit = obs.z > -zCollisionZone && obs.z < zCollisionZone;

    // Check angular collision
    const halfWidth = obs.width / 2;
    const angularHit = angleDiff < halfWidth;

    return zHit && angularHit;
  }

  gameOver() {
    this.state.isRunning = false;
    this.state.isGameOver = true;
    if (this.state.score > this.state.highScore) {
      this.state.highScore = this.state.score;
    }
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  // Called when user rotates wheel
  rotateShip(direction: 'cw' | 'ccw', deltaAngle: number) {
    if (!this.state.isRunning) return;
    
    if (direction === 'cw') {
      this.shipTargetAngle -= deltaAngle;
    } else {
      this.shipTargetAngle += deltaAngle;
    }
  }

  getShipPosition() {
    const r = this.config.tunnelRadius * 0.7;
    return {
      x: Math.cos(this.shipAngle) * r,
      y: Math.sin(this.shipAngle) * r,
      angle: this.shipAngle,
    };
  }

  getObstaclesForRendering() {
    return this.obstacles.map(obs => ({
      ...obs,
      x: Math.cos(obs.angle) * this.config.tunnelRadius,
      y: Math.sin(obs.angle) * this.config.tunnelRadius,
    }));
  }

  getConfig() {
    return this.config;
  }
}

export const gameManager = new GameManager();
