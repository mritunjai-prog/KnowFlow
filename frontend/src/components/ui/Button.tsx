import React from 'react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  magnet?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', magnet = false, children, ...props }, ref) => {
    // Magnet effect handled via framer-motion in a wrapper if needed, 
    // but for simplicity we'll just style the button first.
    
    const baseStyles = "relative inline-flex items-center justify-center rounded-lg px-6 py-3 font-heading font-semibold text-sm transition-all duration-200 ease-custom outline-none focus:ring-2 focus:ring-offset-2 focus:ring-deep-slate focus:ring-offset-sand disabled:opacity-50 disabled:cursor-not-allowed";
    
    const variants = {
      primary: "bg-signal-red text-white hover:bg-signal-red/90 shadow-[0_4px_14px_0_rgba(230,72,51,0.39)] hover:shadow-[0_6px_20px_rgba(230,72,51,0.23)] hover:-translate-y-[1px]",
      secondary: "bg-sage/10 text-deep-slate border border-sage/20 hover:bg-sage/20",
      ghost: "text-deep-slate hover:bg-deep-slate/5"
    };

    return (
      <motion.button
        ref={ref}
        className={cn(baseStyles, variants[variant], className)}
        whileHover={magnet ? { scale: 1.02 } : {}}
        whileTap={{ scale: 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        {...props as any}
      >
        {children}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';
