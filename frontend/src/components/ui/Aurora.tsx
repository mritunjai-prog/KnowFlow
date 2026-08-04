import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export function Aurora() {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden opacity-[0.12]">
      <motion.div
        className="absolute -top-[20%] -left-[10%] h-[50vh] w-[50vw] rounded-full bg-sage blur-[100px]"
        animate={{
          x: [0, 100, 0],
          y: [0, 50, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div
        className="absolute top-[20%] right-[10%] h-[40vh] w-[40vw] rounded-full bg-signal-red blur-[120px]"
        animate={{
          x: [0, -80, 0],
          y: [0, 100, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
      />
      <motion.div
        className="absolute -bottom-[20%] left-[20%] h-[60vh] w-[60vw] rounded-full bg-umber blur-[150px]"
        animate={{
          x: [0, 150, 0],
          y: [0, -100, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
      />
    </div>
  );
}
