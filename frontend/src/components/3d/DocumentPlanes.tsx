import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DocumentPlanesProps {
  phase: 'drifting' | 'dissolving' | 'igniting' | 'web' | 'idle';
  isBackgroundAtmosphere?: boolean; // True for the Login page
}

export function DocumentPlanes({ phase, isBackgroundAtmosphere = false }: DocumentPlanesProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  // Generate random initial positions and rotations for planes
  const planeData = useMemo(() => {
    const count = isBackgroundAtmosphere ? 4 : 12;
    const planes = [];
    for (let i = 0; i < count; i++) {
      planes.push({
        position: new THREE.Vector3(
          (Math.random() - 0.5) * 15,
          (Math.random() - 0.5) * 15 + 5, // Start slightly higher
          (Math.random() - 0.5) * 10 - 5
        ),
        rotation: new THREE.Euler(
          Math.random() * Math.PI,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        ),
        speed: new THREE.Vector3(
          (Math.random() - 0.5) * 0.5,
          -Math.random() * 0.5 - 0.2, // Drift downwards
          (Math.random() - 0.5) * 0.5
        ),
        rotSpeed: new THREE.Euler(
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5,
          (Math.random() - 0.5) * 0.5
        ),
        scale: Math.random() * 0.5 + 0.5,
        targetCenter: isBackgroundAtmosphere ? false : Math.random() > 0.5 // Some drift to center
      });
    }
    return planes;
  }, [isBackgroundAtmosphere]);

  const materials = useRef<THREE.MeshStandardMaterial[]>([]);

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    let targetOpacity = 0;
    
    if (isBackgroundAtmosphere) {
      targetOpacity = 0.1; // Always barely visible in background
    } else {
      switch (phase) {
        case 'drifting':
          targetOpacity = 0.6;
          break;
        case 'dissolving':
          targetOpacity = 0.0;
          break;
        case 'igniting':
        case 'web':
        case 'idle':
          targetOpacity = 0.0;
          break;
      }
    }

    // Animate each plane
    groupRef.current.children.forEach((child, i) => {
      const data = planeData[i];
      if (!data) return;

      // Update rotation
      child.rotation.x += data.rotSpeed.x * delta;
      child.rotation.y += data.rotSpeed.y * delta;
      child.rotation.z += data.rotSpeed.z * delta;

      // Update position
      if (phase === 'drifting' || isBackgroundAtmosphere) {
        if (data.targetCenter) {
          // Slowly drift towards center (0,0,0)
          child.position.lerp(new THREE.Vector3(0, 0, 0), delta * 0.2);
        } else {
          // Just drift normally
          child.position.addScaledVector(data.speed, delta);
        }
      } else if (phase === 'dissolving' && !isBackgroundAtmosphere) {
        // Get sucked rapidly into center
        child.position.lerp(new THREE.Vector3(0, 0, 0), delta * 4);
        child.scale.lerp(new THREE.Vector3(0, 0, 0), delta * 5);
      }

      // If they drift too far down, reset them up top (endless drift effect for atmosphere)
      if (isBackgroundAtmosphere && child.position.y < -10) {
        child.position.y = 10;
        child.position.x = (Math.random() - 0.5) * 15;
      }
    });

    // Update opacities
    materials.current.forEach(mat => {
      if (mat) {
        mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, delta * 2);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {planeData.map((data, i) => (
        <mesh 
          key={i} 
          position={data.position} 
          rotation={data.rotation}
          scale={[data.scale, data.scale, data.scale]}
        >
          <planeGeometry args={[1.5, 2]} />
          <meshStandardMaterial 
            ref={el => { if (el) materials.current[i] = el; }}
            color="#fff8f3"
            emissive="#a8ccdc"
            emissiveIntensity={0.1}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
