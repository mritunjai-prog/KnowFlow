import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useMotionTemplate } from 'framer-motion';
import { FileText, Bot, Clock } from 'lucide-react';

type TimelineItem = {
  id: number;
  type: string;
  title: string;
  time: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
};

type TimelineGroup = {
  date: string;
  items: TimelineItem[];
};

function TimelineNode({ item }: { item: TimelineItem }) {
  const itemRef = useRef<HTMLDivElement>(null);
  const pointerY = useMotionValue(Infinity);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!itemRef.current) return;
    const rect = itemRef.current.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    pointerY.set(e.clientY - center);
  };

  const handlePointerLeave = () => {
    pointerY.set(Infinity);
  };

  // Convert distance to an effect value [0, 1]
  const effectRaw = useTransform(pointerY, (y) => {
    const radius = 150;
    const dist = Math.abs(y);
    if (dist >= radius) return 0;
    const p = 1 - dist / radius;
    return p * p * (3 - 2 * p); // smooth step
  });

  // Apply spring smoothing
  const effect = useSpring(effectRaw, {
    stiffness: 300,
    damping: 24,
    restDelta: 0.001
  });

  // Transform outputs
  const scale = useTransform(effect, [0, 1], [1, 1.25]);
  const translateX = useTransform(effect, [0, 1], [0, 12]);
  
  // Color transforms using standard CSS color-mix (supported by Framer Motion templates)
  const effectPercent = useTransform(effect, v => `${(v * 100).toFixed(1)}%`);
  const effectPercentHalf = useTransform(effect, v => `${(v * 40).toFixed(1)}%`);
  const effectPercentQuarter = useTransform(effect, v => `${(v * 25).toFixed(1)}%`);
  const effectPercentEighty = useTransform(effect, v => `${(v * 80).toFixed(1)}%`);

  const dotBg = useMotionTemplate`color-mix(in srgb, #e64833 ${effectPercentHalf}, #fbe9d0)`;
  const dotBorder = useMotionTemplate`color-mix(in srgb, #e64833 ${effectPercent}, rgba(144,174,173,0.3))`;
  const iconColor = useMotionTemplate`color-mix(in srgb, #e64833 ${effectPercent}, #90aead)`;
  const cardBorder = useMotionTemplate`color-mix(in srgb, #e64833 ${effectPercentQuarter}, rgba(36,72,85,0.07))`;
  const timeColor = useMotionTemplate`color-mix(in srgb, #e64833 ${effectPercentEighty}, rgba(36,72,85,0.4))`;

  return (
    <motion.div
      ref={itemRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className="relative pl-6 py-2 group"
    >
      {/* Dot marker */}
      <motion.div
        className="absolute -left-[35px] top-1/2 -translate-y-1/2 w-8 h-8 rounded-full border-2 flex items-center justify-center z-10"
        style={{
          backgroundColor: dotBg,
          borderColor: dotBorder,
          scale: scale,
        }}
      >
        <motion.div style={{ color: iconColor }}>
          <item.icon className="w-3.5 h-3.5" />
        </motion.div>
      </motion.div>

      {/* Card */}
      <motion.div
        className="bg-white/50 group-hover:bg-white/80 backdrop-blur rounded-xl p-4 border cursor-pointer flex justify-between items-center transition-colors duration-200"
        style={{
          x: translateX,
          borderColor: cardBorder,
        }}
      >
        <div>
          <h3 className="font-medium text-deep-slate text-sm">{item.title}</h3>
          <span className="text-xs text-deep-slate/50 font-mono capitalize">{item.type}</span>
        </div>
        <motion.span
          className="text-xs flex items-center gap-1"
          style={{ color: timeColor }}
        >
          <Clock className="w-3 h-3" /> {item.time}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}

export function Timeline() {
  const timelineData: TimelineGroup[] = [
    {
      date: 'Today',
      items: [
        { id: 1, type: 'note', title: 'Q3 Product Strategy Notes', time: '10:45 AM', icon: FileText },
        { id: 2, type: 'chat', title: 'Asked about vector databases', time: '9:30 AM', icon: Bot },
      ]
    },
    {
      date: 'Yesterday',
      items: [
        { id: 3, type: 'note', title: 'System Architecture Diagram', time: '4:15 PM', icon: FileText },
        { id: 4, type: 'note', title: 'Lecture 4 - Transformers', time: '2:00 PM', icon: FileText },
      ]
    }
  ];

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } }
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      <header className="mb-10">
        <h1 className="font-heading text-3xl font-bold mb-2">Timeline</h1>
        <p className="text-deep-slate/70">A chronological diary of your knowledge and interactions.</p>
      </header>

      <div className="space-y-12">
        {timelineData.map((group) => (
          <motion.div
            key={group.date}
            variants={container}
            initial="hidden"
            animate="show"
            className="relative"
          >
            <div className="flex items-center gap-4 mb-6">
              <span className="font-heading font-semibold text-lg">{group.date}</span>
              <div className="flex-1 h-px bg-deep-slate/10" />
            </div>

            <div className="space-y-2 pl-4 border-l-2 border-sage/20 ml-2">
              {group.items.map((item) => (
                <motion.div key={item.id} variants={itemAnim}>
                  <TimelineNode item={item} />
                </motion.div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
