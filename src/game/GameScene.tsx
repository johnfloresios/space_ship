import React, { useEffect, useRef, useCallback } from 'react';
import { View, Dimensions, StyleSheet } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import * as THREE from 'three';
import { gameManager, GameManager } from './GameManager';

const { width, height } = Dimensions.get('window');

interface GameSceneProps {
  onGameOver: () => void;
  score: number;
  speedMultiplier: number;
}

export default function GameScene({ onGameOver }: GameSceneProps) {
  const glRef = useRef<GLView | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Scene refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  
  // Object refs
  const shipGroupRef = useRef<THREE.Group | null>(null);
  const engineGlowRef = useRef<THREE.Mesh | null>(null);
  const particlesRef = useRef<THREE.Points | null>(null);
  const starsRef = useRef<THREE.Points | null>(null);
  const tunnelRingsRef = useRef<THREE.Group | null>(null);
  const tunnelLinesRef = useRef<THREE.Group | null>(null);
  const obstacleRefs = useRef<Map<number, THREE.Group>>(new Map());
  
  // Light refs
  const engineLightRef = useRef<THREE.PointLight | null>(null);
  const mainLightRef = useRef<THREE.PointLight | null>(null);

  const initRenderer = useCallback((gl: WebGLRenderingContext) => {
    const glWidth = gl.drawingBufferWidth;
    const glHeight = gl.drawingBufferHeight;

    // Create renderer
    const renderer = new Renderer({
      gl,
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(1);
    renderer.setSize(glWidth, glHeight);
    renderer.setClearColor(0x000011, 1);
    rendererRef.current = renderer;

    // Create scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000011, 0.015);
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(70, glWidth / glHeight, 0.1, 200);
    camera.position.set(0, 0, 12);
    camera.lookAt(0, 0, -20);
    cameraRef.current = camera;

    // Lighting
    const ambient = new THREE.AmbientLight(0x222244, 0.6);
    scene.add(ambient);

    const mainLight = new THREE.PointLight(0x0088ff, 3, 50);
    mainLight.position.set(0, 0, 15);
    scene.add(mainLight);
    mainLightRef.current = mainLight;

    const fillLight = new THREE.PointLight(0xff4400, 1, 30);
    fillLight.position.set(-8, -5, 0);
    scene.add(fillLight);

    // Build tunnel
    buildTunnel(scene);

    // Build spaceship
    buildSpaceship(scene);

    // Build starfield
    buildStarfield(scene);

    // Build engine particles
    buildParticles(scene);

    // Start render loop
    lastTimeRef.current = performance.now();
    startRenderLoop();
  }, []);

  const buildTunnel = (scene: THREE.Scene) => {
    const { tunnelRadius, tunnelSegments } = gameManager.getConfig();
    
    // Tunnel rings
    const ringsGroup = new THREE.Group();
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      emissive: 0x0044aa,
      emissiveIntensity: 1.0,
      transparent: true,
      opacity: 0.5,
    });

    const ringGeo = new THREE.TorusGeometry(tunnelRadius, 0.06, 6, 16);

    for (let i = 0; i < tunnelSegments; i++) {
      const z = -i * 1.5 - 5;
      const ring = new THREE.Mesh(ringGeo, ringMat.clone());
      ring.position.z = z;
      ring.rotation.y = Math.PI / 2;
      ringsGroup.add(ring);
    }
    scene.add(ringsGroup);
    tunnelRingsRef.current = ringsGroup;

    // Vertical grid lines
    const linesGroup = new THREE.Group();
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x0044aa,
      transparent: true,
      opacity: 0.2,
    });

    const numLines = 16;
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2;
      const points: THREE.Vector3[] = [];
      for (let j = 0; j <= 60; j++) {
        const x = Math.cos(angle) * tunnelRadius;
        const y = Math.sin(angle) * tunnelRadius;
        points.push(new THREE.Vector3(x, y, -j * 1.5 - 5));
      }
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      linesGroup.add(new THREE.Line(lineGeo, lineMat));
    }
    scene.add(linesGroup);
    tunnelLinesRef.current = linesGroup;

    // Accent rings (pink neon)
    const accentMat = new THREE.MeshStandardMaterial({
      color: 0xff0066,
      emissive: 0xff0044,
      emissiveIntensity: 2,
      transparent: true,
      opacity: 0.4,
    });
    for (let i = 0; i < 10; i++) {
      const z = -i * 15 - 10;
      const accentRing = new THREE.Mesh(
        new THREE.TorusGeometry(tunnelRadius * 0.9, 0.03, 4, 24),
        accentMat
      );
      accentRing.position.z = z;
      accentRing.rotation.y = Math.PI / 2;
      ringsGroup.add(accentRing);
    }
  };

  const buildSpaceship = (scene: THREE.Scene) => {
    const ship = new THREE.Group();

    // Main body - sleek arrow shape
    const bodyGeo = new THREE.ConeGeometry(0.25, 1.0, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.9,
      roughness: 0.15,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    ship.add(body);

    // Cockpit - glowing blue
    const cockpitGeo = new THREE.SphereGeometry(0.18, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2);
    cockpitGeo.translate(0, 0.03, 0.25);
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x0066cc,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.7,
    });
    ship.add(new THREE.Mesh(cockpitGeo, cockpitMat));

    // Wings - swept back shape
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.6, 0.4);
    wingShape.lineTo(0.6, 0.1);
    wingShape.lineTo(0, -0.1);
    
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.05, bevelEnabled: false });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x888888,
      metalness: 0.8,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    
    // Left wing
    const leftWing = new THREE.Mesh(wingGeo, wingMat);
    leftWing.position.set(0, -0.05, -0.2);
    leftWing.rotation.x = -Math.PI / 2;
    leftWing.scale.set(1, -1, 1);
    ship.add(leftWing);
    
    // Right wing
    const rightWing = new THREE.Mesh(wingGeo, wingMat);
    rightWing.position.set(0, -0.05, -0.2);
    rightWing.rotation.x = -Math.PI / 2;
    ship.add(rightWing);

    // Wing tip lights
    const tipGeo = new THREE.SphereGeometry(0.05, 6, 6);
    const tipMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff2200,
      emissiveIntensity: 3,
    });
    const leftTip = new THREE.Mesh(tipGeo, tipMat);
    leftTip.position.set(-0.55, 0, -0.1);
    ship.add(leftTip);
    
    const rightTip = new THREE.Mesh(tipGeo, tipMat.clone());
    rightTip.position.set(0.55, 0, -0.1);
    ship.add(rightTip);

    // Engine glow
    const engineGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 4,
      transparent: true,
      opacity: 0.8,
    });
    const engine = new THREE.Mesh(engineGeo, engineMat);
    engine.position.z = 0.55;
    engine.name = 'engine';
    ship.add(engine);
    engineGlowRef.current = engine;

    // Engine light
    const engineLight = new THREE.PointLight(0x00ccff, 3, 10);
    engineLight.position.z = 0.7;
    ship.add(engineLight);
    engineLightRef.current = engineLight;

    scene.add(ship);
    shipGroupRef.current = ship;
  };

  const buildStarfield = (scene: THREE.Scene) => {
    const count = 400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 2] = -Math.random() * 150 - 10;

      const b = 0.5 + Math.random() * 0.5;
      colors[i * 3] = b;
      colors[i * 3 + 1] = b * (0.9 + Math.random() * 0.1);
      colors[i * 3 + 2] = b;
    }

    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });

    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);
    starsRef.current = stars;
  };

  const buildParticles = (scene: THREE.Scene) => {
    const count = 150;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 1 + Math.random() * 3;
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: 0x00ccff,
      size: 0.06,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);
    particlesRef.current = particles;
  };

  const createObstacleMesh = (obs: GameManager['obstacles'][number]): THREE.Group => {
    const group = new THREE.Group();
    const { tunnelRadius } = gameManager.getConfig();
    const r = tunnelRadius * 0.88;
    group.position.set(
      Math.cos(obs.angle) * r,
      Math.sin(obs.angle) * r,
      obs.z
    );

    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xff2200,
      emissive: 0xff3300,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.85,
    });

    switch (obs.type) {
      case 'bar': {
        const bar = new THREE.Mesh(
          new THREE.BoxGeometry(0.1, tunnelRadius * 2 * obs.width, 0.3),
          baseMat
        );
        bar.rotation.z = obs.angle + Math.PI / 2;
        group.add(bar);
        break;
      }
      case 'block': {
        const block = new THREE.Mesh(
          new THREE.BoxGeometry(
            tunnelRadius * obs.width * 0.6,
            obs.height * 2,
            0.5
          ),
          baseMat
        );
        group.add(block);
        
        // Warning stripe
        const stripeMat = new THREE.MeshStandardMaterial({
          color: 0xff6600,
          emissive: 0xff4400,
          emissiveIntensity: 2,
        });
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(
            tunnelRadius * obs.width * 0.6 + 0.02,
            0.05,
            0.52
          ),
          stripeMat
        );
        group.add(stripe);
        break;
      }
      case 'diamond': {
        const diamond = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.5, 0),
          new THREE.MeshStandardMaterial({
            color: 0xff2200,
            emissive: 0xff4400,
            emissiveIntensity: 2,
            wireframe: true,
          })
        );
        diamond.scale.set(obs.width * 2, obs.height * 2, 0.5);
        group.add(diamond);
        
        // Inner solid core
        const coreMat = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          emissive: 0xff0000,
          emissiveIntensity: 2,
          transparent: true,
          opacity: 0.5,
        });
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(0.2, 6, 6),
          coreMat
        );
        group.add(core);
        break;
      }
    }

    // Glow sphere
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.15,
    });
    group.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 8), glowMat));

    return group;
  };

  const updateObstacles = (scene: THREE.Scene) => {
    const obstacles = gameManager.getObstaclesForRendering();
    const currentIds = new Set(obstacles.map(o => o.id));

    for (const obs of obstacles) {
      if (!obstacleRefs.current.has(obs.id)) {
        const mesh = createObstacleMesh(obs);
        scene.add(mesh);
        obstacleRefs.current.set(obs.id, mesh);
      } else {
        const mesh = obstacleRefs.current.get(obs.id)!;
        mesh.position.z = obs.z;
      }
    }

    for (const [id, mesh] of obstacleRefs.current) {
      if (!currentIds.has(id)) {
        scene.remove(mesh);
        obstacleRefs.current.delete(id);
      }
    }
  };

  const startRenderLoop = () => {
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const ship = shipGroupRef.current;
      const renderer = rendererRef.current;

      if (!scene || !camera || !ship || !renderer) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }

      // Update ship position
      const shipPos = gameManager.getShipPosition();
      const speed = gameManager.config.shipSpeed * gameManager.state.speedMultiplier * dt;
      
      ship.position.set(shipPos.x, shipPos.y, 0);
      ship.rotation.z = shipPos.angle + Math.PI / 2;

      // Engine pulse
      if (engineGlowRef.current) {
        const pulse = 0.7 + Math.sin(now * 0.012) * 0.3;
        engineGlowRef.current.scale.setScalar(pulse);
        (engineGlowRef.current.material as THREE.MeshStandardMaterial)
          .emissiveIntensity = 3 + Math.sin(now * 0.015) * 1.5;
      }

      // Ship gentle bob
      ship.position.y += Math.sin(now * 0.004) * 0.003;

      // Update engine particles
      if (particlesRef.current) {
        const pos = particlesRef.current.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < pos.length / 3; i++) {
          pos[i * 3] = shipPos.x + (Math.random() - 0.5) * 0.25;
          pos[i * 3 + 1] = shipPos.y + (Math.random() - 0.5) * 0.25;
          pos[i * 3 + 2] += speed * 0.5;
          if (pos[i * 3 + 2] > 4) pos[i * 3 + 2] = 0.5;
        }
        particlesRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Update obstacles
      updateObstacles(scene);

      // Scroll tunnel rings
      if (tunnelRingsRef.current) {
        tunnelRingsRef.current.children.forEach((child) => {
          if (child instanceof THREE.Mesh) {
            const geo = child.geometry;
            if (geo instanceof THREE.TorusGeometry) {
              child.position.z += speed;
              if (child.position.z > 8) {
                child.position.z -= 90;
              }
            }
          }
        });
      }

      // Scroll stars
      if (starsRef.current) {
        const starPos = starsRef.current.geometry.attributes.position.array as Float32Array;
        const starSpeed = speed * 0.4;
        for (let i = 0; i < starPos.length / 3; i++) {
          starPos[i * 3 + 2] += starSpeed;
          if (starPos[i * 3 + 2] > 20) starPos[i * 3 + 2] = -160;
        }
        starsRef.current.geometry.attributes.position.needsUpdate = true;
      }

      // Light follows ship
      if (mainLightRef.current) {
        mainLightRef.current.position.set(shipPos.x * 0.4, shipPos.y * 0.4, 12);
      }

      // Dynamic FOV based on speed
      camera.fov = 70 + gameManager.state.speedMultiplier * 4;
      camera.updateProjectionMatrix();

      // Render
      renderer.render(scene, camera);

      // Check game over
      if (gameManager.state.isGameOver) {
        onGameOver();
        return;
      }

      animationFrameRef.current = requestAnimationFrame(loop);
    };
    animationFrameRef.current = requestAnimationFrame(loop);
  };

  return (
    <View style={styles.container}>
      <GLView
        ref={glRef}
        style={styles.glView}
        onContextCreate={initRenderer}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000011',
  },
  glView: {
    flex: 1,
  },
});
