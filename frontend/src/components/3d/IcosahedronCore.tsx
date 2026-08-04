import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface IcosahedronCoreProps {
  phase: 'drifting' | 'dissolving' | 'igniting' | 'web' | 'idle';
  isPulseTriggered?: boolean;
  isInteractive?: boolean;
}

export function IcosahedronCore({ phase, isPulseTriggered = false, isInteractive = false }: IcosahedronCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshStandardMaterial>(null);

  // Use a ref for pulse value so it smoothly decays
  const pulseIntensity = useRef(0);

  // Colors
  const baseColor = useMemo(() => new THREE.Color('#b62515'), []); // secondary (coral/red)
  const igniteColor = useMemo(() => new THREE.Color('#fc5841'), []); // secondary-container (bright)
  const idleColor = useMemo(() => new THREE.Color('#fc5841'), []); 
  
  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return;

    // Base rotation
    if (isInteractive) {
      // In interactive mode (Login), rotate to look at mouse
      const targetX = (state.pointer.y * Math.PI) * 0.2;
      const targetY = (state.pointer.x * Math.PI) * 0.2;
      meshRef.current.rotation.x = THREE.MathUtils.lerp(meshRef.current.rotation.x, targetX, delta * 2);
      meshRef.current.rotation.y = THREE.MathUtils.lerp(meshRef.current.rotation.y, targetY, delta * 2);
      
      // Also add a gentle idle float
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, Math.sin(state.clock.elapsedTime) * 0.2, delta);
    } else {
      meshRef.current.rotation.x += delta * 0.2;
      meshRef.current.rotation.y += delta * 0.3;
    }

    // Handle pulse trigger
    if (isPulseTriggered) {
      pulseIntensity.current = 1.0;
    }
    
    // Decay pulse over time
    if (pulseIntensity.current > 0) {
      pulseIntensity.current = Math.max(0, pulseIntensity.current - delta * 1.5);
    }

    // Determine target scale and color based on phase
    let targetScale = 1;
    let targetEmissiveIntensity = 0.5;
    let targetColor = baseColor;

    switch (phase) {
      case 'drifting':
        targetScale = 0.8;
        targetEmissiveIntensity = 0.2;
        targetColor = baseColor;
        break;
      case 'dissolving':
        targetScale = 1.2;
        targetEmissiveIntensity = 0.8;
        targetColor = baseColor;
        break;
      case 'igniting':
        targetScale = 1.5;
        targetEmissiveIntensity = 2.0;
        targetColor = igniteColor;
        break;
      case 'web':
      case 'idle':
      default:
        targetScale = 1.0;
        targetEmissiveIntensity = 0.8;
        targetColor = idleColor;
        break;
    }

    // Add pulse effect to scale and intensity
    const currentScale = targetScale + (pulseIntensity.current * 0.3);
    const currentIntensity = targetEmissiveIntensity + (pulseIntensity.current * 2.0);

    // Smoothly interpolate
    meshRef.current.scale.lerp(new THREE.Vector3(currentScale, currentScale, currentScale), delta * 5);
    materialRef.current.emissive.lerp(targetColor, delta * 3);
    materialRef.current.emissiveIntensity = THREE.MathUtils.lerp(materialRef.current.emissiveIntensity, currentIntensity, delta * 5);
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial 
        ref={materialRef}
        color="#244855" 
        emissive="#b62515"
        emissiveIntensity={0.5}
        flatShading={true}
        roughness={0.2}
        metalness={0.8}
        wireframe={false}
      />
      
      {/* Wireframe overlay for technical feel */}
      <mesh>
         <icosahedronGeometry args={[1.02, 0]} />
         <meshBasicMaterial 
            color="#fc5841"
            wireframe={true}
            transparent={true}
            opacity={0.3}
         />
      </mesh>
    </mesh>
  );
}
