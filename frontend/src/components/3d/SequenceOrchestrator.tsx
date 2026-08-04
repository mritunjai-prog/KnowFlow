import { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, Float, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

import { IcosahedronCore } from './IcosahedronCore';
import { DocumentPlanes } from './DocumentPlanes';
import { KnowledgeWeb } from './KnowledgeWeb';

type Phase = 'drifting' | 'dissolving' | 'igniting' | 'web' | 'idle';

interface SequenceOrchestratorProps {
  mode: 'landing' | 'login';
  isLoginPulsing?: boolean;
}

function Scene({ mode, isLoginPulsing }: SequenceOrchestratorProps) {
  const [phase, setPhase] = useState<Phase>(mode === 'landing' ? 'drifting' : 'idle');
  const groupRef = useRef<THREE.Group>(null);

  // Orchestrate phases for landing page
  useEffect(() => {
    if (mode !== 'landing') return;

    const t1 = setTimeout(() => setPhase('dissolving'), 2500); // Documents sucked in
    const t2 = setTimeout(() => setPhase('igniting'), 4000);   // Core flares, particles burst
    const t3 = setTimeout(() => setPhase('web'), 5000);      // Particles settle into graph
    const t4 = setTimeout(() => setPhase('idle'), 7000);       // Settle

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [mode]);

  // Subtle mouse parallax
  useFrame((state) => {
    if (groupRef.current) {
      // Very restrained rotation based on mouse
      const targetX = (state.pointer.y * Math.PI) * 0.05;
      const targetY = (state.pointer.x * Math.PI) * 0.05;
      
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.05);
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetY, 0.05);
    }
  });

  const isBackgroundAtmosphere = mode === 'login';

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={45} />
      
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1.5} color="#fff8f3" />
      <pointLight position={[0, 0, 0]} intensity={phase === 'igniting' ? 5 : 1} color="#fc5841" distance={20} />

      <group ref={groupRef} position={mode === 'login' ? [-2, 0, 0] : [0, 0, 0]}>
        <Float speed={1} rotationIntensity={0.2} floatIntensity={0.5}>
          <IcosahedronCore phase={phase} isPulseTriggered={isLoginPulsing} isInteractive={mode === 'login'} />
          <DocumentPlanes phase={phase} isBackgroundAtmosphere={isBackgroundAtmosphere} />
          <KnowledgeWeb phase={phase} isBackgroundAtmosphere={isBackgroundAtmosphere} />
        </Float>
      </group>

      <Environment preset="city" />
    </>
  );
}

export function CoreScene({ mode, isLoginPulsing = false }: SequenceOrchestratorProps) {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas 
        dpr={[1, 2]} 
        gl={{ antialias: false, alpha: true }}
      >
        <Scene mode={mode} isLoginPulsing={isLoginPulsing} />
      </Canvas>
    </div>
  );
}
