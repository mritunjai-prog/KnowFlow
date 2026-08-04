import { motion } from 'framer-motion';
import { Plus, Filter, Search, Zap, UserPlus, Trash2, Archive, FileText, Clock, History, MoreVertical, Users } from 'lucide-react';

const GlassCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`rounded-2xl transition-all duration-300 hover:-translate-y-1 ${className}`}
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
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};

const TASKS = [
  {
    id: 'KF-9921',
    title: 'Review Q4 Market Correlates',
    priority: 'High',
    priorityColor: 'bg-secondary text-white',
    status: 'New',
    statusIcon: 'fiber_manual_record',
    statusColor: 'text-primary',
    actions: [
      { icon: <Zap className="w-4 h-4" />, label: 'Process' },
      { icon: <UserPlus className="w-4 h-4" />, label: 'Assign' },
    ],
    endAction: { icon: <Trash2 className="w-4 h-4" />, danger: true },
    span: 1,
  },
  {
    id: 'KF-8845',
    title: 'Approve Neural-Link Specs',
    priority: 'Medium',
    priorityColor: 'bg-primary/80 text-white',
    status: 'In-Progress',
    statusIcon: 'pending',
    statusColor: 'text-secondary',
    actions: [
      { icon: <motion.div animate={{ scale: [1,1.2,1] }} transition={{ repeat: Infinity, duration: 1.2 }}><Zap className="w-4 h-4" /></motion.div>, label: 'Process' },
      { icon: <Users className="w-4 h-4" />, label: 'Team' },
    ],
    endAction: { icon: <Archive className="w-4 h-4" />, danger: false },
    span: 1,
  },
  {
    id: 'KF-7120',
    title: 'Sync Learning Cluster Delta',
    priority: 'Low',
    priorityColor: 'bg-outline/30 text-on-surface-variant',
    status: 'New',
    statusIcon: 'fiber_manual_record',
    statusColor: 'text-primary',
    actions: [
      { icon: <Zap className="w-4 h-4" />, label: 'Process' },
      { icon: <UserPlus className="w-4 h-4" />, label: 'Assign' },
    ],
    endAction: { icon: <Trash2 className="w-4 h-4" />, danger: true },
    span: 1,
  },
  {
    id: 'KF-6632',
    title: 'Archive Legacy Knowledge Nodes',
    priority: 'Medium',
    priorityColor: 'bg-outline/30 text-on-surface-variant',
    status: 'Completed',
    statusIcon: 'check_circle',
    statusColor: 'text-outline',
    actions: [
      { icon: <FileText className="w-4 h-4" />, label: 'Report' },
    ],
    endAction: { icon: <History className="w-4 h-4" />, danger: false },
    span: 1,
  },
];

const FEATURED_TASK = {
  id: 'KF-1042',
  title: 'Biometric Data Governance Audit',
  priority: 'High',
  desc: 'Complete review of compliance protocols for the upcoming neural infrastructure upgrade. Requires immediate executive sign-off.',
  status: 'Urgent',
};

export function Tasks() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="max-w-6xl mx-auto px-6 py-10 space-y-10"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between gap-6">
        <div>
          <h1 className="font-heading text-4xl font-bold text-primary tracking-tight mb-2">AI-Generated Tasks</h1>
          <p className="text-on-surface-variant text-base max-w-2xl">
            Real-time neural synthesis of critical operational nodes requiring manual validation or processing.
          </p>
        </div>
        <div className="flex gap-3 shrink-0">
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm text-primary hover:bg-primary/10 transition-all border border-outline/30"
          >
            <Filter className="w-4 h-4" />
            Filter
          </button>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-mono text-sm text-primary hover:bg-primary/10 transition-all border border-outline/30"
          >
            <Search className="w-4 h-4" />
            Search
          </button>
        </div>
      </motion.div>

      {/* Featured Task */}
      <motion.div variants={itemVariants}>
        <div
          className="p-8 rounded-2xl relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(36,72,85,0.9) 0%, rgba(8,50,62,0.95) 100%)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(144,174,173,0.2)',
            boxShadow: '0 16px 48px rgba(8,50,62,0.25)',
          }}
        >
          {/* Decorative orb */}
          <div className="absolute top-0 right-0 w-80 h-80 rounded-full opacity-10 pointer-events-none"
            style={{ background: 'radial-gradient(circle, #e64833, transparent 70%)', transform: 'translate(30%, -30%)' }} />

          <div className="relative z-10">
            <div className="flex items-start justify-between mb-4">
              <span className="font-mono text-xs px-3 py-1.5 rounded-full uppercase tracking-wider bg-secondary/20 text-secondary border border-secondary/30">
                ⚡ High Priority · Urgent
              </span>
              <span className="font-mono text-xs text-white/40">{FEATURED_TASK.id}</span>
            </div>

            <div className="flex items-start gap-8">
              <div className="flex-1">
                <h2 className="font-heading text-3xl font-bold text-white mb-3 leading-tight">
                  {FEATURED_TASK.title}
                </h2>
                <p className="text-white/60 text-sm leading-relaxed max-w-xl mb-6">{FEATURED_TASK.desc}</p>
                <div className="flex gap-3 flex-wrap">
                  <button
                    className="px-6 py-2.5 rounded-xl font-mono text-sm text-white active:scale-95 transition-all hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #e64833, #b62515)', boxShadow: '0 4px 16px rgba(182,37,21,0.4)' }}
                  >
                    Process Now
                  </button>
                  <button className="px-6 py-2.5 rounded-xl font-mono text-sm text-white border border-white/20 hover:bg-white/10 active:scale-95 transition-all">
                    Details
                  </button>
                </div>
              </div>
              <div className="hidden lg:flex w-24 h-24 rounded-2xl items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="material-symbols-outlined text-white/50 text-5xl" style={{ fontVariationSettings: "'wght' 200" }}>policy</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Task Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-xl font-semibold text-primary">All Tasks</h2>
          <span className="font-mono text-xs text-on-surface-variant">{TASKS.length} pending</span>
        </div>
        <motion.div
          variants={containerVariants}
          className="grid grid-cols-1 md:grid-cols-2 gap-5"
        >
          {TASKS.map(task => (
            <motion.div
              key={task.id}
              variants={itemVariants}
              className="p-6 rounded-2xl flex flex-col justify-between min-h-[200px] group"
              style={{
                background: 'rgba(251, 233, 208, 0.45)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(144, 174, 173, 0.3)',
              }}
              whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(8,50,62,0.1)' }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <span className={`font-mono text-[10px] px-2.5 py-1 rounded-md uppercase tracking-wider ${task.priorityColor}`}>
                    {task.priority} Priority
                  </span>
                  <span className="font-mono text-[10px] text-outline/60">{task.id}</span>
                </div>
                <h3 className="font-heading text-lg font-bold text-primary mb-2 group-hover:text-secondary transition-colors leading-tight">
                  {task.title}
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`material-symbols-outlined ${task.statusColor}`} style={{ fontSize: '14px' }}>
                    {task.statusIcon}
                  </span>
                  <span className="font-mono text-xs text-on-surface-variant">Status: {task.status}</span>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-glass-border pt-4 mt-4">
                <div className="flex gap-2">
                  {task.actions.map((action, i) => (
                    <button
                      key={i}
                      title={action.label}
                      className="p-2 rounded-lg text-white transition-all active:scale-90 hover:scale-105"
                      style={{ background: i === 0 ? '#08323e' : 'transparent', border: i === 0 ? 'none' : '1px solid rgba(144,174,173,0.4)', color: i === 0 ? 'white' : '#08323e' }}
                    >
                      {action.icon}
                    </button>
                  ))}
                </div>
                <button
                  className={`p-2 rounded-lg transition-all active:scale-90 ${task.endAction.danger ? 'text-on-surface-variant hover:text-error hover:bg-error/5' : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'}`}
                >
                  {task.endAction.icon}
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* FAB */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 w-14 h-14 rounded-full text-white flex items-center justify-center shadow-2xl z-40"
        style={{ background: 'linear-gradient(135deg, #e64833, #b62515)', boxShadow: '0 8px 32px rgba(182,37,21,0.4)' }}
        title="Add Task"
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </motion.div>
  );
}
