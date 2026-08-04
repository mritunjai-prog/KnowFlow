import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface KnowledgeWebProps {
  phase: 'drifting' | 'dissolving' | 'igniting' | 'web' | 'idle';
  isBackgroundAtmosphere?: boolean;
}

const PARTICLE_COUNT = 150;

export function KnowledgeWeb({ phase, isBackgroundAtmosphere = false }: KnowledgeWebProps) {
  const particlesRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  
  // Pre-calculate target positions (a structured graph)
  const graphPositions = useMemo(() => {
    const pos = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Create a roughly spherical/web-like distribution
      const r = 3 + Math.random() * 4;
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos((Math.random() * 2) - 1);
      pos.push(new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi)
      ));
    }
    return pos;
  }, []);

  // Pre-calculate lines connecting nearby nodes
  const linesGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dist = graphPositions[i].distanceTo(graphPositions[j]);
        if (dist < 2.5) { // Connection threshold
          points.push(graphPositions[i]);
          points.push(graphPositions[j]);
        }
      }
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [graphPositions]);

  // Current states for animation
  const currentPositions = useRef<THREE.Vector3[]>(
    Array(PARTICLE_COUNT).fill(0).map(() => new THREE.Vector3(0, 0, 0)) // Start at center
  );

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lineMaterial = useRef<THREE.LineBasicMaterial>(null);

  useFrame((state, delta) => {
    if (!particlesRef.current) return;
    if (isBackgroundAtmosphere) return; // Web doesn't show in simple background

    let targetOpacity = 0;
    
    switch (phase) {
      case 'igniting':
        // Explode outward from center
        currentPositions.current.forEach((pos, i) => {
          pos.lerp(graphPositions[i], delta * 3);
        });
        targetOpacity = 0.5;
        break;
      case 'web':
      case 'idle':
        // Settle into final graph structure and gently float
        currentPositions.current.forEach((pos, i) => {
          const target = graphPositions[i].clone();
          // Gentle floating
          target.y += Math.sin(state.clock.elapsedTime * 0.5 + i) * 0.2;
          pos.lerp(target, delta * 2);
        });
        targetOpacity = 0.8;
        break;
      default:
        // Sucked into center
        currentPositions.current.forEach(pos => pos.lerp(new THREE.Vector3(0, 0, 0), delta * 5));
        targetOpacity = 0;
        break;
    }

    // Update instanced mesh
    currentPositions.current.forEach((pos, i) => {
      dummy.position.copy(pos);
      // Scale based on opacity
      const scale = targetOpacity * 0.15;
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      particlesRef.current!.setMatrixAt(i, dummy.matrix);
    });
    particlesRef.current.instanceMatrix.needsUpdate = true;

    // Update lines (opacity and points if we were doing dynamic lines, but static geometry with scale is fine for this effect)
    if (linesRef.current && lineMaterial.current) {
      lineMaterial.current.opacity = THREE.MathUtils.lerp(lineMaterial.current.opacity, targetOpacity * 0.3, delta * 2);
      
      // Make lines grow/shrink with the particles conceptually (by scaling the whole group)
      if (phase === 'igniting' || phase === 'web' || phase === 'idle') {
        const lineScale = linesRef.current.scale.x;
        const targetScale = phase === 'igniting' ? 0.8 : 1.0;
        linesRef.current.scale.setScalar(THREE.MathUtils.lerp(lineScale, targetScale, delta * 2));
      } else {
        linesRef.current.scale.setScalar(0.01);
      }
    }
  });

  if (isBackgroundAtmosphere) return null;

  return (
    <group>
      <instancedMesh ref={particlesRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial color="#a8ccdc" transparent opacity={0.8} />
      </instancedMesh>
      
      <lineSegments ref={linesRef} geometry={linesGeometry}>
        <lineBasicMaterial ref={lineMaterial} color="#a8ccdc" transparent opacity={0} depthWrite={false} />
      </lineSegments>
    </group>
  );
}
