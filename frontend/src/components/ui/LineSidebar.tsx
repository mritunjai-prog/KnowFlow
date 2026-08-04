import React, { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';

export interface LineSidebarItem {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export interface LineSidebarProps {
  items?: (string | LineSidebarItem)[];
  accentColor?: string;
  textColor?: string;
  markerColor?: string;
  showIndex?: boolean;
  showMarker?: boolean;
  proximityRadius?: number;
  maxShift?: number;
  markerLength?: number;
  markerGap?: number;
  tickScale?: number;
  itemGap?: number;
  fontSize?: number;
  defaultActive?: number | null;
  onItemClick?: (index: number, label: string) => void;
  className?: string;
}

function SidebarItem({
  item,
  index,
  isActive,
  onClick,
  accentColor,
  textColor,
  markerColor,
  showIndex,
  showMarker,
  proximityRadius,
  maxShift,
  markerLength,
  markerGap,
  tickScale,
  itemGap,
  fontSize,
  isLast,
}: {
  item: string | LineSidebarItem;
  index: number;
  isActive: boolean;
  onClick: () => void;
  accentColor: string;
  textColor: string;
  markerColor: string;
  showIndex: boolean;
  showMarker: boolean;
  proximityRadius: number;
  maxShift: number;
  markerLength: number;
  markerGap: number;
  tickScale: number;
  itemGap: number;
  fontSize: number;
  isLast: boolean;
}) {
  const itemRef = useRef<HTMLLIElement>(null);
  const pointerY = useMotionValue(Infinity);

  const handlePointerMove = (e: React.PointerEvent<HTMLLIElement>) => {
    if (!itemRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    pointerY.set(e.clientY - center);
  };

  const handlePointerLeave = () => {
    pointerY.set(Infinity);
  };

  // Distance calculation
  const effectRaw = useTransform(pointerY, (y) => {
    const dist = Math.abs(y);
    if (dist >= proximityRadius) return 0;
    const p = 1 - dist / proximityRadius;
    return p * p * (3 - 2 * p); // smooth step
  });

  // Spring smoothing for hover effect
  const hoverEffect = useSpring(effectRaw, {
    stiffness: 300,
    damping: 30,
    restDelta: 0.001
  });

  // Force effect to 1 if active, otherwise use hover
  const effect = useTransform(hoverEffect, (v) => Math.max(v, isActive ? 1 : 0));

  // Visual transforms
  const scaleX = useTransform(effect, [0, 1], [0.7, 1.2]);
  const translateX = useTransform(effect, [0, 1], [0, maxShift]);
  
  // Color-mix interpolations
  const effectPercent = useTransform(effect, (v) => `${(v * 100).toFixed(1)}%`);
  
  const markerBg = useMotionTemplate`color-mix(in srgb, ${accentColor} ${effectPercent}, ${markerColor})`;
  const labelColor = useMotionTemplate`color-mix(in srgb, ${accentColor} ${effectPercent}, ${textColor})`;

  const isString = typeof item === 'string';
  const label = isString ? item : item.label;
  const Icon = !isString && item.icon ? item.icon : null;
  const paddingLeft = showMarker ? markerLength + markerGap : 0;

  return (
    <li
      ref={itemRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onClick={onClick}
      className="relative cursor-pointer"
      style={{ padding: '6px 0' }}
    >
      {/* Marker line */}
      {showMarker && (
        <motion.span
          aria-hidden="true"
          className="absolute top-1/2 origin-left -translate-y-1/2"
          style={{
            left: `-${paddingLeft}px`,
            height: '2px',
            width: `${markerLength}px`,
            backgroundColor: markerBg,
            scaleX: scaleX,
          }}
        />
      )}

      {/* Tick separator (between items) */}
      {showMarker && !isLast && (
        <span
          aria-hidden="true"
          className="absolute"
          style={{
            left: `-${paddingLeft}px`,
            top: `calc(100% + ${itemGap / 2}px)`,
            height: '1px',
            width: `${markerLength * tickScale}px`,
            backgroundColor: markerColor,
            opacity: 0.3,
          }}
        />
      )}

      {/* Label */}
      <motion.span
        className="relative flex items-center gap-3 leading-[1.2] font-medium"
        style={{
          color: labelColor,
          fontSize: `${fontSize}rem`,
          x: translateX,
        }}
      >
        {showIndex && (
          <span className="mr-2 font-mono text-[0.85em]">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
        {Icon && <Icon className="w-5 h-5" />}
        <span>{label}</span>
      </motion.span>
    </li>
  );
}

export const LineSidebar = ({
  items = [],
  accentColor = '#e64833',
  textColor = '#fbe9d0',
  markerColor = '#90aead',
  showIndex = false,
  showMarker = true,
  proximityRadius = 120,
  maxShift = 20,
  markerLength = 40,
  markerGap = 16,
  tickScale = 0.5,
  itemGap = 20,
  fontSize = 1,
  defaultActive = null,
  onItemClick,
  className = '',
}: LineSidebarProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(defaultActive);

  useEffect(() => {
    setActiveIndex(defaultActive);
  }, [defaultActive]);

  const paddingLeft = showMarker ? markerLength + markerGap : 0;

  return (
    <nav
      className={`relative flex justify-start${className ? ` ${className}` : ''}`}
      style={{ paddingLeft: `${paddingLeft}px` }}
    >
      <ul
        className="relative m-0 list-none flex flex-col py-4 w-full"
        style={{ gap: `${itemGap}px` }}
      >
        {items.map((item, index) => (
          <SidebarItem
            key={`${typeof item === 'string' ? item : item.label}-${index}`}
            item={item}
            index={index}
            isActive={activeIndex === index}
            onClick={() => {
              setActiveIndex(index);
              onItemClick?.(index, typeof item === 'string' ? item : item.label);
            }}
            accentColor={accentColor}
            textColor={textColor}
            markerColor={markerColor}
            showIndex={showIndex}
            showMarker={showMarker}
            proximityRadius={proximityRadius}
            maxShift={maxShift}
            markerLength={markerLength}
            markerGap={markerGap}
            tickScale={tickScale}
            itemGap={itemGap}
            fontSize={fontSize}
            isLast={index === items.length - 1}
          />
        ))}
      </ul>
    </nav>
  );
};
