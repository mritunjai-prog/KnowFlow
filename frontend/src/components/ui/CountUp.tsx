import { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate, useReducedMotion } from 'framer-motion';
export function CountUp({
  to,
  duration = 1.5,
  className,
}: {
  to: number;
  duration?: number;
  className?: string;
}) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (value) => Math.round(value));
  const reduced = useReducedMotion();
  useEffect(() => {
    if (reduced || duration === 0) {
      count.set(to);
      return;
    }
    const animation = animate(count, to, { duration, ease: [0.22, 1, 0.36, 1] });
    return () => animation.stop();
  }, [count, to, duration, reduced]);
  return reduced || duration === 0 ? (
    <span className={className}>{Math.round(to)}</span>
  ) : (
    <motion.span className={className}>{rounded}</motion.span>
  );
}
