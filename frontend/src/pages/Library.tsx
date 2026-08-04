import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, MoreVertical, Clock } from 'lucide-react';

const GlassCard = ({ children, className = '', onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div
    className={`rounded-2xl transition-all duration-300 hover:-translate-y-1 ${onClick ? 'cursor-pointer' : ''} ${className}`}
    onClick={onClick}
    style={{
      background: 'rgba(251, 233, 208, 0.45)',
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      border: '1px solid rgba(144, 174, 173, 0.3)',
      boxShadow: '0 4px 24px rgba(8, 50, 62, 0.06)',
    }}
  >
    {children}
  </div>
);

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const recentItems = [
  { id: 1, title: 'Architecture Overview', time: '2 hours ago', icon: 'description' },
  { id: 2, title: 'Q3 Performance', time: 'Yesterday', icon: 'analytics' },
  { id: 3, title: 'Security Protocol v4', time: '3 days ago', icon: 'policy' },
  { id: 4, title: 'Neural-Link Brief', time: '4 days ago', icon: 'psychology' },
];

const repoItems = [
  {
    id: 1,
    title: 'Q4 Market Analysis',
    desc: 'Comprehensive review of emerging trends and competitive positioning in the learning tech landscape.',
    tag: 'Confidential',
    tagColor: 'bg-secondary/10 text-secondary',
    icon: 'insights',
    date: 'Oct 12, 2023',
  },
  {
    id: 2,
    title: 'Neural-Link Specs',
    desc: 'Technical specifications for the v2 brain-computer interface module for enterprise knowledge transfer.',
    tag: 'Internal',
    tagColor: 'bg-primary/10 text-primary',
    icon: 'psychology',
    date: 'Oct 08, 2023',
  },
  {
    id: 3,
    title: 'Knowledge Graph v9',
    desc: 'Schema documentation for the latest relational mapping of internal siloed data points.',
    tag: 'Public',
    tagColor: 'bg-outline/10 text-on-surface-variant',
    icon: 'hub',
    date: 'Sep 28, 2023',
  },
  {
    id: 4,
    title: 'Privacy Policy 2024',
    desc: 'Draft for upcoming data compliance standards and user privacy rights across the platform.',
    tag: 'Confidential',
    tagColor: 'bg-secondary/10 text-secondary',
    icon: 'security',
    date: 'Sep 15, 2023',
  },
  {
    id: 5,
    title: 'Onboarding Flow',
    desc: 'Asset directory for new employee technical training and culture immersion paths.',
    tag: 'Internal',
    tagColor: 'bg-primary/10 text-primary',
    icon: 'groups',
    date: 'Sep 10, 2023',
  },
  {
    id: 6,
    title: 'System Scalability',
    desc: 'Research paper on horizontal scaling of the knowledge ingestion engine for global deployment.',
    tag: 'Internal',
    tagColor: 'bg-primary/10 text-primary',
    icon: 'architecture',
    date: 'Aug 22, 2023',
  },
];

export function Library() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = repoItems.filter(
    item =>
      !query ||
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-6xl mx-auto px-6 py-10 space-y-12"
    >
      {/* Header & Search */}
      <motion.section variants={itemVariants}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex-1 max-w-2xl">
            <h1 className="font-heading text-4xl font-bold text-primary tracking-tight mb-5">Library</h1>
            <div
              className={`relative transition-all duration-300 ${searchFocused ? 'scale-[1.01]' : ''}`}
            >
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/50" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                placeholder="Search the knowledge repository..."
                className="w-full pl-12 pr-4 py-4 rounded-xl font-body text-sm outline-none transition-all focus:ring-2 focus:ring-primary/40"
                style={{
                  background: 'rgba(251, 233, 208, 0.55)',
                  backdropFilter: 'blur(12px)',
                  border: searchFocused
                    ? '1px solid rgba(36,72,85,0.6)'
                    : '1px solid rgba(144, 174, 173, 0.3)',
                  boxShadow: searchFocused ? '0 0 0 3px rgba(36,72,85,0.08)' : 'none',
                }}
              />
            </div>
          </div>
          <button
            className="flex items-center gap-2 px-6 py-4 rounded-xl font-mono text-sm tracking-wide text-white hover:opacity-90 active:scale-95 transition-all h-14 shrink-0"
            style={{ background: 'linear-gradient(135deg, #e64833, #b62515)', boxShadow: '0 4px 16px rgba(182,37,21,0.3)' }}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </button>
        </div>
      </motion.section>

      {/* Recently Viewed */}
      <motion.section variants={itemVariants}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-2xl font-bold text-primary">Recently Viewed</h2>
          <button className="text-secondary font-mono text-xs uppercase tracking-widest flex items-center gap-1 hover:underline">
            View All →
          </button>
        </div>
        <div className="flex gap-5 overflow-x-auto pb-3 -mx-1 px-1">
          {recentItems.map(item => (
            <motion.div
              key={item.id}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="flex-shrink-0 w-56 p-5 rounded-2xl cursor-pointer group"
              style={{
                background: 'rgba(251, 233, 208, 0.45)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(144, 174, 173, 0.3)',
              }}
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {item.icon}
                </span>
              </div>
              <h4 className="font-heading text-base font-semibold text-primary mb-1">{item.title}</h4>
              <div className="flex items-center gap-1 text-on-surface-variant/70">
                <Clock className="w-3 h-3" />
                <p className="font-mono text-[10px]">{item.time}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Knowledge Repository Grid */}
      <motion.section variants={containerVariants}>
        <h2 className="font-heading text-2xl font-bold text-primary mb-8">Knowledge Repository</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(item => (
            <motion.div
              key={item.id}
              variants={itemVariants}
              className="p-6 rounded-2xl group cursor-pointer"
              style={{
                background: 'rgba(251, 233, 208, 0.45)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(144, 174, 173, 0.3)',
              }}
              whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(8,50,62,0.12)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <div className="flex justify-between items-start mb-5">
                <div className="w-14 h-14 rounded-xl bg-white/50 border border-glass-border flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-primary text-[28px]">{item.icon}</span>
                </div>
                <span className={`font-mono text-[10px] px-3 py-1 rounded-full uppercase tracking-wider ${item.tagColor}`}>
                  {item.tag}
                </span>
              </div>
              <h4 className="font-heading text-lg font-bold text-primary mb-2 group-hover:text-secondary transition-colors">
                {item.title}
              </h4>
              <p className="text-sm text-on-surface-variant mb-5 line-clamp-2 leading-relaxed">{item.desc}</p>
              <div className="flex items-center justify-between pt-4 border-t border-glass-border">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-on-surface-variant/50" />
                  <span className="font-mono text-[11px] text-on-surface-variant">{item.date}</span>
                </div>
                <button className="text-primary/30 group-hover:text-secondary transition-colors">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-on-surface-variant/60 font-mono text-sm">
            No documents match "{query}"
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
