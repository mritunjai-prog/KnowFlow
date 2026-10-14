import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../lib/utils';
type ButtonProps = HTMLMotionProps<'button'> & {
  variant?: 'primary' | 'secondary' | 'ghost';
  magnet?: boolean;
};
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', magnet = false, type = 'button', ...props }, ref) => (
    <motion.button
      ref={ref}
      type={type}
      whileTap={{ scale: 0.98 }}
      whileHover={magnet ? { scale: 1.02 } : undefined}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        variant === 'primary'
          ? 'bg-secondary text-white hover:bg-primary'
          : variant === 'secondary'
            ? 'border border-primary/30 bg-white/70 text-primary hover:bg-sage/20'
            : 'text-primary hover:bg-primary/10',
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = 'Button';
