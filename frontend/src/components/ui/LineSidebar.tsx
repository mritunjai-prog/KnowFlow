import { NavLink } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import type { ComponentType } from 'react';
type Item = { label: string; to: string; icon: ComponentType<{ className?: string }> };
function ItemLink({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const proximity = useMotionValue(0);
  const smooth = useSpring(proximity, { stiffness: 300, damping: 30 });
  const x = useTransform(smooth, [0, 1], [0, 6]);
  const reduced = useReducedMotion();
  return (
    <li>
      <NavLink
        to={item.to}
        onClick={onNavigate}
        onPointerEnter={() => proximity.set(1)}
        onPointerLeave={() => proximity.set(0)}
        className={({ isActive }) =>
          `block rounded-xl p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${isActive ? 'bg-white/15 text-white' : 'text-sand hover:bg-white/10'}`
        }
      >
        <motion.span style={reduced ? undefined : { x }} className="flex items-center gap-3">
          <item.icon className="h-5 w-5 shrink-0" />
          {item.label}
        </motion.span>
      </NavLink>
    </li>
  );
}
export function LineSidebar({ items, onNavigate }: { items: Item[]; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main navigation">
      <ul className="space-y-2">
        {items.map((item) => (
          <ItemLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </ul>
    </nav>
  );
}
