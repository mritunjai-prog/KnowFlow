import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function GlassCard({ children, className = '', ...props }: GlassCardProps) {
  return (
    <div
      className={`rounded-xl p-8 border border-outline/30 ${className}`}
      style={{
        background: 'rgba(251, 233, 208, 0.5)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 32px 0 rgba(8, 50, 62, 0.05)',
      }}
      {...props}
    >
      {children}
    </div>
  );
}
