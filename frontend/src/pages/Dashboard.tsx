import React from 'react';
import { motion } from 'framer-motion';
import { Share2, Bookmark, Plus, MoreVertical } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { CountUp } from '../components/ui/CountUp';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const areaData = [
  { name: 'Mon', nodes: 4000, interactions: 2400 },
  { name: 'Tue', nodes: 4200, interactions: 2800 },
  { name: 'Wed', nodes: 5100, interactions: 3800 },
  { name: 'Thu', nodes: 6000, interactions: 3200 },
  { name: 'Fri', nodes: 6800, interactions: 4800 },
  { name: 'Sat', nodes: 7100, interactions: 3800 },
  { name: 'Sun', nodes: 7500, interactions: 4300 },
];

const feedItems = [
  {
    id: 1,
    title: 'Market Volatility Analysis: APAC Q4',
    description:
      'New correlations found between manufacturing delays in Vietnam and consumer price indexes in Japan. Recommend immediate review of the supply chain node #42.',
    tag: 'Confidential',
    tagColor: 'bg-primary/10 text-primary',
    meta: '2 hours ago • By System-Alpha',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 2,
    title: 'Strategic Ops: Project Luminous Milestone',
    description:
      'Phase 1 integration complete. Knowledge graph expanded by 34,000 entities across technical documentation and internal wikis.',
    tag: 'Internal',
    tagColor: 'bg-secondary/10 text-secondary',
    meta: '5 hours ago • By Neural-Link 4',
    image: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=600',
  },
  {
    id: 3,
    title: 'Industry Trend: Decentralized ML',
    description:
      'Competitor intelligence suggests a shift toward edge computing for large language models. Mapping potential impacts on our API enterprise infrastructure.',
    tag: 'Public Insight',
    tagColor: 'bg-primary-container/20 text-primary-container',
    meta: 'Yesterday • By Crawler-Bot',
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&q=80&w=600',
  },
];

const recentContexts = [
  { label: 'Q4 Planning', sub: 'Strategy', initials: 'Q4', bg: 'bg-sage/30' },
  { label: 'Project Luminous', sub: 'R&D Alpha', icon: '💡', bg: 'bg-signal-red/20' },
  { label: 'API Specs', sub: 'Tech Docs', icon: '⌨️', bg: 'bg-primary/20' },
];



// ---- Glass card ----
const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-2xl p-6 ${className}`}
    style={{
      background: 'rgba(251, 233, 208, 0.4)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(144, 174, 173, 0.3)',
      boxShadow: '0 8px 32px 0 rgba(8, 50, 62, 0.05)',
    }}
  >
    {children}
  </div>
);

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 24 } },
};

export function Dashboard() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="space-y-10 pb-20"
      >
        {/* ── Page heading ── */}
        <motion.div variants={itemVariants}>
          <h1 className="font-heading text-4xl font-bold text-primary tracking-tight">
            Knowledge Hub
          </h1>
          <p className="text-on-surface-variant/70 mt-1">
            Real-time overview of your enterprise intelligence ecosystem.
          </p>
        </motion.div>

        {/* ── Stat cards ── */}
        <div className="flex gap-6 overflow-x-auto pb-2">
          {[
            { label: 'Intelligence Depth', value: 84, suffix: '%', sub: '+2.4% vs last week' },
            { label: 'Active Nodes', value: 1242, suffix: '', sub: 'Currently operational' },
            { label: 'Daily Insights', value: 12, suffix: '+', sub: 'New high-fidelity findings' },
          ].map((stat, i) => (
            <motion.div key={i} variants={itemVariants} className="shrink-0 w-72">
              <GlassCard className="h-full hover:-translate-y-1 transition-transform">
                <p className="font-mono text-[10px] uppercase tracking-widest text-on-surface-variant/70 mb-4">
                  {stat.label}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="font-heading text-5xl font-bold text-primary">
                    <CountUp to={stat.value} />
                  </span>
                  <span className="text-2xl font-heading text-primary/60">{stat.suffix}</span>
                </div>
                <p className="text-sm text-on-surface-variant mt-2">{stat.sub}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>

        {/* ── Visualization + Recent Contexts ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Network Growth Chart */}
          <motion.div variants={itemVariants} className="lg:col-span-2">
            <GlassCard className="h-full">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="font-heading text-xl font-bold text-primary">Knowledge Ecosystem</h2>
                  <p className="text-sm text-on-surface-variant">Real-time cross-functional topic distribution</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-4 py-1.5 rounded-lg text-xs font-mono bg-surface-container/80 hover:bg-surface-container transition-colors">
                    Week
                  </button>
                  <button className="px-4 py-1.5 rounded-lg text-xs font-mono bg-primary text-white">
                    Month
                  </button>
                </div>
              </div>

              <div className="h-52 w-full -ml-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gNodes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e64833" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#e64833" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gInteract" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#244855" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#244855" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: 'rgba(36,72,85,0.5)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'rgba(36,72,85,0.5)', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(36,72,85,0.08)" />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(251,233,208,0.95)',
                        border: '1px solid rgba(144,174,173,0.3)',
                        borderRadius: '12px',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        fontFamily: 'Inter',
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="nodes"
                      stroke="#e64833"
                      strokeWidth={2.5}
                      fill="url(#gNodes)"
                    />
                    <Area
                      type="monotone"
                      dataKey="interactions"
                      stroke="#244855"
                      strokeWidth={2.5}
                      fill="url(#gInteract)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>
          </motion.div>

          {/* Recent Contexts */}
          <motion.div variants={itemVariants}>
            <GlassCard className="h-full">
              <h2 className="font-heading text-xl font-bold text-primary mb-5">Recent Contexts</h2>
              <div className="flex flex-col gap-3">
                {recentContexts.map((ctx) => (
                  <button
                    key={ctx.label}
                    className="group flex items-center justify-between p-3 rounded-xl bg-white/40 hover:bg-white/80 border border-transparent hover:border-outline/30 hover:scale-[1.02] transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full ${ctx.bg} flex items-center justify-center text-primary text-sm font-bold`}
                      >
                        {ctx.icon ?? ctx.initials}
                      </div>
                      <div className="text-left">
                        <p className="font-mono text-sm text-primary font-medium">{ctx.label}</p>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                          {ctx.sub}
                        </p>
                      </div>
                    </div>
                    <span className="text-on-surface-variant/40 group-hover:text-primary transition-colors text-lg">
                      →
                    </span>
                  </button>
                ))}

                <button className="mt-2 py-3 w-full border-2 border-dashed border-outline/30 rounded-xl text-on-surface-variant hover:bg-white/20 transition-all flex items-center justify-center gap-2 text-sm font-mono">
                  <Plus className="w-4 h-4" /> Pin New Context
                </button>
              </div>
            </GlassCard>
          </motion.div>
        </div>

        {/* ── Intelligence Feed ── */}
        <motion.section variants={itemVariants} className="space-y-5">
          <div className="flex justify-between items-end">
            <div>
              <h2 className="font-heading text-2xl font-bold text-primary">Intelligence Feed</h2>
              <p className="text-sm text-on-surface-variant">
                Sequential data captures from your intelligence network
              </p>
            </div>
            <button className="text-secondary text-sm font-mono flex items-center gap-1 hover:underline">
              View Archive →
            </button>
          </div>

          <div className="space-y-4">
            {feedItems.map((item) => (
              <motion.div
                key={item.id}
                whileHover={{ x: 8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="group cursor-pointer"
              >
                <GlassCard className="flex flex-col md:flex-row gap-5 p-5 overflow-hidden relative">
                  {/* Shimmer */}
                  <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl">
                    <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-gradient-to-br from-transparent via-white/10 to-transparent rotate-45 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  </div>

                  <div className="w-full md:w-44 h-28 rounded-xl overflow-hidden shrink-0">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                  </div>

                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3 mb-2">
                        <span className={`px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${item.tagColor}`}>
                          {item.tag}
                        </span>
                        <span className="text-[10px] text-on-surface-variant/60">{item.meta}</span>
                      </div>
                      <h3 className="font-heading text-lg font-bold text-primary group-hover:text-secondary transition-colors mb-1">
                        {item.title}
                      </h3>
                      <p className="text-sm text-on-surface-variant/80 line-clamp-2">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex md:flex-col justify-end items-end gap-3 shrink-0">
                    <button className="p-1.5 hover:bg-primary/5 rounded-full transition-colors">
                      <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                    </button>
                    <div className="flex gap-2">
                      <Bookmark className="w-4 h-4 text-outline" />
                      <Share2 className="w-4 h-4 text-outline" />
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </motion.section>
      </motion.div>
    </div>
  );
}
