import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';

export function CountUp({ to, duration = 1.5, className }: { to: number, duration?: number, className?: string }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!hasAnimated) {
      const animation = animate(count, to, { duration, ease: [0.22, 1, 0.36, 1] });
      setHasAnimated(true);
      return animation.stop;
    }
  }, [count, to, duration, hasAnimated]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
